import { Injectable } from '@nestjs/common';

@Injectable()
export class RfidService {
  private isRfidEntryMode = false;

  setEntryMode(entry: boolean) {
    this.isRfidEntryMode = entry;
  }

  getEntryMode() {
    return this.isRfidEntryMode;
  }
}
