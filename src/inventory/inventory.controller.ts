import { Body, Controller, Get, Patch, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { RfidService } from './rfid/rfid.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly rfidService: RfidService,
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
    this.rfidService.setEntryMode(entryMode);
    return {
      message: entryMode ? 'Modo entrada activado' : 'Modo entrada desactivado',
    };
  }

  @Get('rfid-mode')
  getRfidMode() {
    return {
      entry_mode: this.rfidService.getEntryMode(),
    };
  }
}
