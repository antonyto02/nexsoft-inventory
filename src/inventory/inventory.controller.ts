import { Body, Controller, Get, Patch, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { EntryModeService } from './rfid/entry-mode.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly entryModeService: EntryModeService,
  ) {}

  @Get('home')
  getHome() {
    return this.inventoryService.getHomeSummary();
  }

  @Patch('rfid-mode')
  setRfidMode(@Body('entry_mode') entryMode?: boolean) {
    if (entryMode === undefined) {
      throw new BadRequestException("El campo 'entry_mode' es obligatorio");
    }
    this.entryModeService.setEntryMode(entryMode);
    return {
      message: entryMode ? 'Modo entrada activado' : 'Modo entrada desactivado',
    };
  }

  @Get('rfid-mode')
  getRfidMode() {
    return {
      entry_mode: this.entryModeService.getEntryMode(),
    };
  }
}
