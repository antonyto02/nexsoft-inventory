import { Injectable } from '@nestjs/common';

@Injectable()
export class EntryModeService {
  private entryMode = false;

  setEntryMode(mode: boolean) {
    this.entryMode = mode;
  }

  getEntryMode() {
    return this.entryMode;
  }
}
