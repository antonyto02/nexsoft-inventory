import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { AwsMqttService } from './aws-mqtt.service'; // 👈 Importa el servicio MQTT
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { Unit } from './entities/unit.entity';
import { Movement } from './entities/movement.entity';
import { MovementType } from './entities/movement-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      Unit,
      Movement,
      MovementType,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService, AwsMqttService], // 👈 Registra el servicio MQTT aquí
})
export class InventoryModule {}
