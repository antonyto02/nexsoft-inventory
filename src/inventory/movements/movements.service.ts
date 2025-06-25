import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { getMexicoCityISO, formatMexicoCity } from '../../utils/time';
import { Product } from '../entities/product.entity';
import { Movement } from '../entities/movement.entity';
import { MovementType } from '../entities/movement-type.entity';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Movement)
    private readonly movementRepository: Repository<Movement>,
    @InjectRepository(MovementType)
    private readonly movementTypeRepository: Repository<MovementType>,
  ) {}

  async createManual(productId: string, dto: CreateMovementDto) {
    const id = parseInt(productId, 10);
    if (isNaN(id)) {
      throw new NotFoundException('Producto no encontrado');
    }

    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['unit'],
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (!product.is_active) {
      throw new BadRequestException('Producto inactivo');
    }

    if (product.sensor_type !== 'manual') {
      throw new BadRequestException(
        'Este producto no permite movimientos manuales porque tiene sensor.',
      );
    }

    if (
      !dto ||
      typeof dto.quantity !== 'number' ||
      typeof dto.type !== 'number'
    ) {
      throw new BadRequestException('Datos de movimiento inválidos');
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor que cero.');
    }

    const hasDecimals = dto.quantity % 1 !== 0;
    if (!product.unit.allows_decimals && hasDecimals) {
      throw new BadRequestException(
        'Este producto no permite cantidades decimales.',
      );
    }

    const movementType = await this.movementTypeRepository.findOne({
      where: { id: dto.type },
    });

    if (!movementType) {
      throw new BadRequestException('Tipo de movimiento inválido');
    }

    const prevQuantity = Number(product.stock);
    let finalQuantity = prevQuantity;

    if (dto.type === 1 || dto.type === 3) {
      finalQuantity += dto.quantity;
    } else if (dto.type === 2 || dto.type === 4) {
      finalQuantity -= dto.quantity;
      if (finalQuantity < 0) {
        throw new BadRequestException('No hay suficiente stock disponible');
      }
    } else {
      throw new BadRequestException('Tipo de movimiento inválido');
    }

    product.stock = finalQuantity;
    await this.productRepository.save(product);

    const movement = this.movementRepository.create({
      product,
      type: movementType,
      quantity: dto.quantity,
      previous_quantity: prevQuantity,
      final_quantity: finalQuantity,
      comment: dto.note,
      movement_date: getMexicoCityISO(),
    });

    await this.movementRepository.save(movement);

    return {
      message: 'Movimiento registrado correctamente',
      new_stock: finalQuantity,
    };
  }

  async findByProduct(productId: string) {
    const id = parseInt(productId, 10);
    if (isNaN(id)) {
      throw new NotFoundException('Producto no encontrado');
    }

    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const movements = await this.movementRepository.find({
      where: { product: { id }, deleted_at: IsNull() },
      order: { movement_date: 'DESC' },
      relations: ['type'],
    });

    const formatted = movements.map((m) => {
      const { date, time } = formatMexicoCity(m.movement_date);
      const item: any = {
        date,
        time,
        type: m.type.name,
        stock_before: Number(m.previous_quantity),
        quantity:
          m.type.id === 2 || m.type.id === 4
            ? -Number(m.quantity)
            : Number(m.quantity),
        stock_after: Number(m.final_quantity),
      };
      if (m.comment) {
        item.comment = m.comment;
      }
      return item;
    });

    return {
      message: 'Movimientos obtenidos correctamente',
      movements: formatted,
    };
  }
}
