import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockEntry } from '../entities/stock-entry.entity';
import { Product } from '../entities/product.entity';
import { Movement } from '../entities/movement.entity';
import { MovementType } from '../entities/movement-type.entity';

@Injectable()
export class RfidListenerService {
  constructor(
    @InjectRepository(StockEntry)
    private readonly stockEntryRepository: Repository<StockEntry>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Movement)
    private readonly movementRepository: Repository<Movement>,
    @InjectRepository(MovementType)
    private readonly movementTypeRepository: Repository<MovementType>,
  ) {}

  async handleTag(tag: string): Promise<void> {
    const entry = await this.stockEntryRepository.findOne({ where: { rfid_tag: tag } });
    if (!entry) {
      return;
    }

    await this.stockEntryRepository.delete({ id: entry.id });

    const product = entry.product;
    if (!product) {
      return;
    }

    const prevStock = Number(product.stock);
    const newStock = prevStock - 1;

    product.stock = newStock;
    await this.productRepository.save(product);

    const movementType = await this.movementTypeRepository.findOne({ where: { id: 2 } });
    if (!movementType) {
      return;
    }

    const movement = this.movementRepository.create({
      product,
      type: movementType,
      quantity: -1,
      previous_quantity: prevStock,
      final_quantity: newStock,
      comment: 'Salida',
      movement_date: new Date(),
    });
    await this.movementRepository.save(movement);
  }
}
