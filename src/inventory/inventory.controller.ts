import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  BadRequestException,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import { RfidService } from './rfid/rfid.service';
import { AwsMqttService } from './aws-mqtt.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly rfidService: RfidService,
    private readonly awsMqttService: AwsMqttService,
  ) {}

  @Get('home')
  getHome(@Req() req: Request) {
    const companyId = (req as any).user?.companyId;
    console.log('company_id del usuario:', companyId);
    if (!companyId) {
      throw new UnauthorizedException('Falta company_id en el token');
    }
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

  @Post('voice-command')
  handleVoiceCommand(@Body('command') command: string) {
    if (command?.trim().toLowerCase() === 'elotes') {
      this.awsMqttService.publish('nexsoft/inventory/leds', {
        onPins: [],
        offPins: [12, 13, 14, 17],
        parpadeo: 17,
      });
      return { message: 'Comando procesado' };
    }
    return { message: 'Comando no reconocido' };
  }
}
