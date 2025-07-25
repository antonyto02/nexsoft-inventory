import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { StockEntry } from '../entities/stock-entry.entity';
import { Movement } from '../entities/movement.entity';
import { MovementType } from '../entities/movement-type.entity';
import { RfidController } from './rfid.controller';
import { RfidService } from './rfid.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, StockEntry, Movement, MovementType]),
  ],
  controllers: [RfidController],
  providers: [RfidService],
  exports: [RfidService],
})
export class RfidModule {}
