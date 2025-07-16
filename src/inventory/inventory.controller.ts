import { Body, Controller, Get, Patch, BadRequestException, Req } from '@nestjs/common';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import { RfidService } from './rfid/rfid.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly rfidService: RfidService,
  ) {}

  @Get('home')
  getHome(@Req() req: Request) {
    const companyId = (req as any).user.company_id;
    return this.inventoryService.getHomeSummary(companyId);
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
