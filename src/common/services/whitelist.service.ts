import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import IPCIDR from 'ip-cidr';
import { WhitelistConfig, WhitelistEntry, WhitelistMetadata } from '../interfaces/whitelist.interface';

@Injectable()
export class WhitelistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhitelistService.name);
  private whitelist: WhitelistConfig | null = null;
  private cache: Map<string, WhitelistMetadata | null> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute
  private watcher: fs.FSWatcher | null = null;
  private readonly whitelistPath: string;

  constructor(private readonly configService: ConfigService) {
    this.whitelistPath = this.configService.get<string>(
      'WHITELIST_FILE_PATH',
      'src/data/ip-whitelist.json'
    );
  }

  onModuleInit() {
    this.loadWhitelist();
    this.setupWatcher();
  }

  onModuleDestroy() {
    if (this.watcher) {
      this.watcher.close();
    }
  }

  private loadWhitelist(): void {
    try {
      const absolutePath = path.resolve(this.whitelistPath);
      const data = fs.readFileSync(absolutePath, 'utf-8');
      this.whitelist = JSON.parse(data) as WhitelistConfig;
      this.cache.clear();
      this.cacheExpiry.clear();
      this.logger.log(`Whitelist loaded from ${absolutePath}`);
    } catch (error) {
      this.logger.warn(`Failed to load whitelist from ${this.whitelistPath}: ${error}`);
      this.whitelist = null;
    }
  }

  private setupWatcher(): void {
    try {
      const absolutePath = path.resolve(this.whitelistPath);
      let debounceTimer: NodeJS.Timeout | null = null;

      this.watcher = fs.watch(absolutePath, (eventType) => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          this.logger.log(`Whitelist file changed (${eventType}), reloading...`);
          this.loadWhitelist();
        }, 1000);
      });

      this.logger.log(`Watching whitelist file: ${absolutePath}`);
    } catch (error) {
      this.logger.warn(`Failed to setup whitelist watcher: ${error}`);
    }
  }

  isAllowed(ip: string): { allowed: boolean } {
    if (!this.whitelist || !this.whitelist.allowedIps) {
      this.logger.warn('Whitelist not loaded, denying access');
      return { allowed: false };
    }

    // Check cache first
    const cached = this.getCachedResult(ip);
    if (cached !== undefined) {
      return { allowed: cached !== null };
    }

    // Check against whitelist
    for (const entry of this.whitelist.allowedIps) {
      if (this.matchIp(ip, entry.ip)) {
        this.setCachedResult(ip, {
          ip: entry.ip,
          department: entry.department,
          employeeId: entry.employeeId,
          description: entry.description,
        });
        return { allowed: true };
      }
    }

    this.setCachedResult(ip, null);
    return { allowed: false };
  }

  getMetadata(ip: string): WhitelistMetadata | null {
    if (!this.whitelist || !this.whitelist.allowedIps) {
      return null;
    }

    for (const entry of this.whitelist.allowedIps) {
      if (this.matchIp(ip, entry.ip)) {
        return {
          ip: entry.ip,
          department: entry.department,
          employeeId: entry.employeeId,
          description: entry.description,
        };
      }
    }

    return null;
  }

  private matchIp(clientIp: string, whitelistIp: string): boolean {
    // Check if it's a CIDR notation
    if (whitelistIp.includes('/')) {
      try {
        if (!IPCIDR.isValidCIDR(whitelistIp)) {
          return false;
        }
        const cidr = new IPCIDR(whitelistIp);
        return cidr.contains(clientIp);
      } catch (error) {
        this.logger.warn(`Invalid CIDR notation: ${whitelistIp}`);
        return false;
      }
    }

    // Exact match
    return clientIp === whitelistIp;
  }

  private getCachedResult(ip: string): WhitelistMetadata | null | undefined {
    const expiry = this.cacheExpiry.get(ip);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(ip);
      this.cacheExpiry.delete(ip);
      return undefined;
    }
    return this.cache.has(ip) ? this.cache.get(ip) : undefined;
  }

  private setCachedResult(ip: string, metadata: WhitelistMetadata | null): void {
    this.cache.set(ip, metadata);
    this.cacheExpiry.set(ip, Date.now() + this.CACHE_TTL);
  }

  getWhitelistConfig(): WhitelistConfig | null {
    return this.whitelist;
  }
}
