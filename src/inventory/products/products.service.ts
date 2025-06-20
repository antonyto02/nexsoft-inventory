import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Unit } from '../entities/unit.entity';
import { StockEntry } from '../entities/stock-entry.entity';
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
    @InjectRepository(StockEntry)
    private readonly stockEntryRepository: Repository<StockEntry>,
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

  async findByStatus(status: string, page = 1, limit = 10) {
    if (status === 'all') {
      throw new BadRequestException(
        "El estado 'all' no es válido para este endpoint.",
      );
    }

    const validStatuses = [
      'out_of_stock',
      'low_stock',
      'expiring',
      'near_minimum',
      'overstock',
    ];

    if (!status || !validStatuses.includes(status)) {
      throw new BadRequestException('El estado es inválido');
    }

    const skip = (page - 1) * limit;

    if (status === 'expiring') {
      const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const entries = await this.stockEntryRepository
        .createQueryBuilder('entry')
        .leftJoinAndSelect('entry.product', 'product')
        .leftJoinAndSelect('product.category', 'category')
        .where('entry.expiration_date IS NOT NULL')
        .andWhere('entry.expiration_date <= :limitDate', {
          limitDate: sevenDays,
        })
        .andWhere('entry.deleted_at IS NULL')
        .orderBy('entry.expiration_date', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany();

      const products = entries.map((e) => ({
        name: e.product.name,
        image_url: e.product.image_url,
        stock_actual: Number(e.product.stock),
        category: e.product.category?.name,
        sensor_type: e.product.sensor_type,
      }));

      return {
        message: 'Productos obtenidos correctamente',
        products,
      };
    }

    let qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    switch (status) {
      case 'out_of_stock':
        qb = qb.where('product.stock = 0');
        break;
      case 'low_stock':
        qb = qb.where('product.stock > 0').andWhere(
          'product.stock < product.min_stock',
        );
        break;
      case 'near_minimum':
        qb = qb
          .where('product.stock >= product.min_stock')
          .andWhere('product.stock <= product.min_stock + 1');
        break;
      case 'overstock':
        qb = qb.where('product.stock > product.max_stock');
        break;
    }

    const result = await qb.orderBy('product.name', 'ASC').skip(skip).take(limit).getMany();

    const products = result.map((p) => ({
      name: p.name,
      image_url: p.image_url,
      stock_actual: Number(p.stock),
      category: p.category?.name,
      sensor_type: p.sensor_type,
    }));

    return {
      message: 'Productos obtenidos correctamente',
      products,
    };
  }

  async findGeneral(categoryId?: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    let qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.is_active = true');

    if (categoryId) {
      qb = qb.andWhere('category.id = :categoryId', { categoryId });
    }

    const result = await qb
      .orderBy('product.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();

    const products = result.map((p) => ({
      name: p.name,
      image_url: p.image_url,
      stock_actual: Number(p.stock),
      category: p.category?.name,
      sensor_type: p.sensor_type,
    }));

    return {
      message: 'Productos obtenidos correctamente',
      products,
    };
  }
}
