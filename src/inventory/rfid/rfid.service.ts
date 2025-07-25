import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { StockEntry } from '../entities/stock-entry.entity';
import { Movement } from '../entities/movement.entity';
import { MovementType } from '../entities/movement-type.entity';
import { RfidEntryItemDto } from '../products/dto/rfid-entry.dto';
import { getMexicoCityISO } from '../../utils/time';

@Injectable()
export class RfidService {
  private isRfidEntryMode = true;

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(StockEntry)
    private readonly stockEntryRepository: Repository<StockEntry>,
    @InjectRepository(Movement)
    private readonly movementRepository: Repository<Movement>,
    @InjectRepository(MovementType)
    private readonly movementTypeRepository: Repository<MovementType>,
  ) {}

  setEntryMode(entry: boolean) {
    this.isRfidEntryMode = entry;
  }

  getEntryMode() {
    return this.isRfidEntryMode;
  }

  async registerEntries(productId: string, entries: RfidEntryItemDto[]) {
    const id = parseInt(productId, 10);
    if (isNaN(id)) {
      throw new NotFoundException('Producto no encontrado');
    }

    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (product.sensor_type !== 'rfid') {
      throw new BadRequestException('Este producto no utiliza RFID');
    }

    if (!this.isRfidEntryMode) {
      throw new BadRequestException('El modo entrada no está activo');
    }

    if (!entries || !Array.isArray(entries)) {
      throw new BadRequestException('Lista de entradas inválida');
    }

    let registered = 0;
    let duplicates = 0;

    for (const item of entries) {
      if (!item || typeof item.rfid_tag !== 'string') {
        continue;
      }

      const exists = await this.stockEntryRepository.findOne({
        where: { rfid_tag: item.rfid_tag },
      });

      if (exists) {
        duplicates++;
        continue;
      }

      const stockEntry = this.stockEntryRepository.create({
        product,
        rfid_tag: item.rfid_tag,
        expiration_date: item.expiration_date
          ? new Date(item.expiration_date)
          : undefined,
      });
      await this.stockEntryRepository.save(stockEntry);
      registered++;
    }

    if (registered > 0) {
      const prevQuantity = Number(product.stock);
      const finalQuantity = prevQuantity + registered;

      product.stock = finalQuantity;
      await this.productRepository.save(product);

      const movementType = await this.movementTypeRepository.findOne({
        where: { id: 1 },
      });
      if (!movementType) {
        throw new BadRequestException('Tipo de movimiento inválido');
      }

      const movement = this.movementRepository.create({
        product,
        type: movementType,
        quantity: registered,
        previous_quantity: prevQuantity,
        final_quantity: finalQuantity,
        movement_date: getMexicoCityISO(),
        comment: 'Registro RFID',
      });
      await this.movementRepository.save(movement);
    }

    return {
      message: 'Entradas RFID registradas correctamente',
      registered,
      duplicates,
    };
  }
}
