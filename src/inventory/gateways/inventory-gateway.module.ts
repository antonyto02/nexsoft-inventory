import { Module } from '@nestjs/common';
import { InventoryGateway } from './inventory.gateway';

@Module({
  providers: [InventoryGateway],
  exports: [InventoryGateway],
})
export class InventoryGatewayModule {}
