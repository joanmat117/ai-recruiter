import { Module, Global } from '@nestjs/common';
import { WhitelistService } from './services/whitelist.service';
import { IpWhitelistGuard } from './guards/ip-whitelist.guard';

@Global()
@Module({
  providers: [WhitelistService, IpWhitelistGuard],
  exports: [WhitelistService, IpWhitelistGuard],
})
export class CommonModule {}
