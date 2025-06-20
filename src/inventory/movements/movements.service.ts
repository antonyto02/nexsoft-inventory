import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movement } from '../entities/movement.entity';
import { MovementType } from '../entities/movement-type.entity';
import { Product } from '../entities/product.entity';
import { RegisterMovementDto } from './dto/register-movement.dto';

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(Movement)
    private readonly movementRepository: Repository<Movement>,
    @InjectRepository(MovementType)
    private readonly movementTypeRepository: Repository<MovementType>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async registerManualMovement(productId: string, dto: RegisterMovementDto) {
    const id = parseInt(productId, 10);
    if (isNaN(id)) {
      throw new NotFoundException('Producto no encontrado');
    }

    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (product.sensor_type !== 'manual') {
      throw new BadRequestException(
        'Este producto no permite movimientos manuales porque tiene sensor.',
      );
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor que cero');
    }

    const movementType = await this.movementTypeRepository.findOne({
      where: { id: dto.type },
    });
    if (!movementType) {
      throw new BadRequestException('Tipo de movimiento no válido');
    }

    const movement = this.movementRepository.create({
      product,
      type: movementType,
      quantity: dto.quantity,
      previous_quantity: product.stock,
      final_quantity: product.stock + dto.quantity,
      comment: dto.note,
    });

    await this.movementRepository.save(movement);

    product.stock = movement.final_quantity;
    await this.productRepository.save(product);

    return {
      message: 'Movimiento registrado correctamente',
      new_stock: Number(product.stock),
    };
  }
}
