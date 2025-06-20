import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Unit } from '../entities/unit.entity';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
  ) {}

  async create(dto: CreateProductDto) {
    const allowedSensorTypes = ['manual', 'rfid', 'weight', 'camera'];
    if (!allowedSensorTypes.includes(dto.sensor_type)) {
      throw new BadRequestException('Invalid sensor type');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: dto.category },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const unit = await this.unitRepository.findOne({
      where: { id: dto.unit_type },
    });
    if (!unit) {
      throw new BadRequestException('Unit not found');
    }

    const product = this.productRepository.create({
      name: dto.name,
      brand: dto.brand,
      description: dto.description,
      min_stock: dto.stock_min,
      max_stock: dto.stock_max,
      sensor_type: dto.sensor_type,
      image_url: dto.image_url,
      stock: 0,
      category,
      unit,
    });
    const saved = await this.productRepository.save(product);
    return {
      message: 'Producto creado correctamente',
      product_id: String(saved.id),
    };
  }
}
