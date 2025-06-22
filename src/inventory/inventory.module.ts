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
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { MovementsController } from './movements/movements.controller';
import { MovementsService } from './movements/movements.service';
import { StockEntry } from './entities/stock-entry.entity';
import { RfidModule } from './rfid/rfid.module';
import { AwsS3Service } from './products/s3.service';
import { RfidGateway } from './rfid.gateway';
import { RfidListenerService } from './rfid-listener.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      Unit,
      Movement,
      MovementType,
      StockEntry
    ]),
    RfidModule,
  ],
  controllers: [InventoryController, ProductsController, MovementsController],
  providers: [
    InventoryService,
    AwsMqttService,
    ProductsService,
    MovementsService,
    AwsS3Service,
    RfidListenerService,
  ], // 👈 Registra el servicio MQTT aquí
})
export class InventoryModule {}
