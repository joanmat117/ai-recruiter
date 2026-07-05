import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { WhitelistService } from './whitelist.service';

// Mock fs
jest.mock('fs');

// Mock ip-cidr - need to handle the ESM default export correctly
jest.mock('ip-cidr', () => {
  const mockContains = jest.fn((ip: string) => {
    // Simple mock CIDR check
    return false;
  });

  const mockConstructor = jest.fn().mockImplementation((cidr: string) => ({
    contains: (ip: string) => {
      // Simple mock CIDR check: 10.0.0.0/8 contains any 10.x.x.x
      if (cidr === '10.0.0.0/8') {
        return ip.startsWith('10.');
      }
      if (cidr === '192.168.1.0/24') {
        return ip.startsWith('192.168.1.');
      }
      return false;
    },
  }));

  // Add static methods
  mockConstructor.isValidCIDR = jest.fn((cidr: string) => {
    return cidr.includes('/') && /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(cidr);
  });

  return {
    __esModule: true,
    default: mockConstructor,
  };
});

describe('WhitelistService', () => {
  let service: WhitelistService;
  let configService: ConfigService;

  const mockWhitelistData = {
    allowedIps: [
      {
        ip: '192.168.1.100',
        description: 'Oficina Principal - RRHH',
        department: 'Recursos Humanos',
        employeeId: 'EMP-001',
      },
      {
        ip: '10.0.0.0/8',
        description: 'Rango interno',
        department: 'Todas',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhitelistService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'WHITELIST_FILE_PATH') return 'src/data/ip-whitelist.json';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WhitelistService>(WhitelistService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock fs.readFileSync to return whitelist data
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockWhitelistData));
    (fs.watch as jest.Mock).mockReturnValue({
      close: jest.fn(),
    });

    // Initialize service (loads whitelist)
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isAllowed', () => {
    it('should allow exact IP match', () => {
      const result = service.isAllowed('192.168.1.100');
      expect(result.allowed).toBe(true);
    });

    it('should deny unknown IP', () => {
      const result = service.isAllowed('192.168.1.999');
      expect(result.allowed).toBe(false);
    });

    it('should handle CIDR range', () => {
      const result = service.isAllowed('10.0.0.50');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for allowed IP', () => {
      const metadata = service.getMetadata('192.168.1.100');
      expect(metadata).toBeDefined();
      expect(metadata?.department).toBe('Recursos Humanos');
    });

    it('should return null for unknown IP', () => {
      const metadata = service.getMetadata('192.168.2.999');
      expect(metadata).toBeNull();
    });
  });
});