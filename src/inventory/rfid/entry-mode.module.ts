import { Global, Module } from '@nestjs/common';
import { EntryModeService } from './entry-mode.service';

@Global()
@Module({
  providers: [EntryModeService],
  exports: [EntryModeService],
})
export class EntryModeModule {}
