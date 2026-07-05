import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IpWhitelistGuard } from './ip-whitelist.guard';
import { WhitelistService } from '../services/whitelist.service';
import { Reflector } from '@nestjs/core';

describe('IpWhitelistGuard', () => {
  let guard: IpWhitelistGuard;
  let whitelistService: WhitelistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpWhitelistGuard,
        {
          provide: WhitelistService,
          useValue: {
            isAllowed: jest.fn(),
            getMetadata: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {},
        },
      ],
    }).compile();

    guard = module.get<IpWhitelistGuard>(IpWhitelistGuard);
    whitelistService = module.get<WhitelistService>(WhitelistService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow whitelisted IP', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            ip: '192.168.1.100',
            headers: { 'x-forwarded-for': undefined },
            url: '/api/recruiter/evaluate',
            socket: { remoteAddress: '192.168.1.100' },
          }),
        }),
      } as unknown as ExecutionContext;

      (whitelistService.isAllowed as jest.Mock).mockReturnValue({ allowed: true });
      (whitelistService.getMetadata as jest.Mock).mockReturnValue({ department: 'HR' });

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should deny non-whitelisted IP', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            ip: '10.0.0.999',
            headers: { 'x-forwarded-for': undefined },
            url: '/api/recruiter/evaluate',
            socket: { remoteAddress: '10.0.0.999' },
          }),
        }),
      } as unknown as ExecutionContext;

      (whitelistService.isAllowed as jest.Mock).mockReturnValue({ allowed: false });

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});