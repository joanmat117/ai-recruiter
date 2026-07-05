import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WhitelistService } from '../services/whitelist.service';
import { WhitelistMetadata } from '../interfaces/whitelist.interface';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);

  constructor(
    private readonly whitelistService: WhitelistService,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = this.extractIp(request);

    this.logger.log(`IP access attempt from: ${ip}`);

    if (!this.whitelistService.isAllowed(ip).allowed) {
      this.logger.warn(`IP denied: ${ip}`);
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access denied: Your IP address is not authorized to access this resource',
        error: 'Forbidden',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    // Inject metadata into request
    const metadata = this.whitelistService.getMetadata(ip);
    if (metadata) {
      request.whitelistMetadata = metadata;
    }

    this.logger.log(`IP allowed: ${ip}`);
    return true;
  }

  private extractIp(request: any): string {
    // x-forwarded-for (first IP in chain)
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ip = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0].trim();
      if (ip) return ip;
    }

    // x-real-ip
    const xRealIp = request.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    // socket.remoteAddress
    return request.socket?.remoteAddress || request.ip || '127.0.0.1';
  }
}
