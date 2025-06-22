import { Injectable } from '@nestjs/common';

@Injectable()
export class EntryModeService {
  private entryMode = false;

  setEntryMode(mode: boolean) {
    this.entryMode = mode;
  }

  getEntryMode(): boolean {
    console.log('[ENTRY MODE] Valor leído:', this.entryMode);
    return this.entryMode;
  }

}
