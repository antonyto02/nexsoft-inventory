import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Unit } from '../entities/unit.entity';
import { StockEntry } from '../entities/stock-entry.entity';
import { InventoryGateway } from '../gateways/inventory.gateway';
import { buildProductCard } from '../utils/product-card.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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
    private readonly inventoryGateway: InventoryGateway,
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
        id: String(e.product.id),
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
      id: String(p.id),
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
      id: String(p.id),
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

  async searchByName(name?: string) {
    if (!name) {
      throw new BadRequestException('El nombre es requerido');
    }

    const result = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('LOWER(product.name) LIKE LOWER(:name)', { name: `%${name}%` })
      .andWhere('product.is_active = true')
      .orderBy('product.name', 'ASC')
      .getMany();

    const products = result.map((p) => ({
      name: p.name,
      image_url: p.image_url,
      stock_actual: Number(p.stock),
      category: p.category?.name,
      sensor_type: p.sensor_type,
    }));

    return {
      message: 'Búsqueda completada',
      results: products,
    };
  }

  async findById(id: string) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new NotFoundException('Producto no encontrado');
    }

    const product = await this.productRepository.findOne({
      where: { id: numericId },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return {
      message: 'Producto obtenido correctamente',
      product: {
        id: String(product.id),
        name: product.name,
        image_url: product.image_url,
        description: product.description,
        category: product.category?.name,
        brand: product.brand,
        stock_actual: Number(product.stock),
        stock_minimum: Number(product.min_stock),
        stock_maximum: Number(product.max_stock),
        last_updated: product.updated_at.toISOString().split('.')[0],
        sensor_type: product.sensor_type,
      },
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new NotFoundException('Producto no encontrado');
    }

    const product = await this.productRepository.findOne({
      where: { id: numericId },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    let changed = false;

    if (dto.name !== undefined && dto.name !== product.name) {
      product.name = dto.name;
      changed = true;
    }
    if (dto.brand !== undefined && dto.brand !== product.brand) {
      product.brand = dto.brand;
      changed = true;
    }
    if (dto.description !== undefined && dto.description !== product.description) {
      product.description = dto.description;
      changed = true;
    }
    if (
      dto.stock_minimum !== undefined &&
      dto.stock_minimum !== Number(product.min_stock)
    ) {
      product.min_stock = dto.stock_minimum;
      changed = true;
    }
    if (
      dto.stock_maximum !== undefined &&
      dto.stock_maximum !== Number(product.max_stock)
    ) {
      product.max_stock = dto.stock_maximum;
      changed = true;
    }
    if (dto.image_url !== undefined && dto.image_url !== product.image_url) {
      product.image_url = dto.image_url;
      changed = true;
    }

    if (dto.category !== undefined) {
      let category: Category | null = null;
      if (typeof dto.category === 'number') {
        category = await this.categoryRepository.findOne({
          where: { id: dto.category },
        });
      } else {
        category = await this.categoryRepository.findOne({
          where: { name: dto.category },
        });
      }
      if (!category) {
        throw new BadRequestException('Category not found');
      }
      if (product.category?.id !== category.id) {
        product.category = category;
        changed = true;
      }
    }

    await this.productRepository.save(product);

    if (changed) {
      const updated = await this.productRepository.findOne({
        where: { id: numericId },
        relations: ['category'],
      });
      if (updated) {
        const card = await buildProductCard(updated, this.stockEntryRepository);
        this.inventoryGateway.emitInventoryUpdate(card);
      }
    }

    return { message: 'Producto actualizado correctamente' };
  }

  async remove(id: string) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new NotFoundException('Producto no encontrado');
    }

    const product = await this.productRepository.findOne({
      where: { id: numericId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (!product.is_active) {
      return { message: 'Producto eliminado correctamente' };
    }

    product.is_active = false;
    product.deleted_at = new Date();
    await this.productRepository.save(product);

    return { message: 'Producto eliminado correctamente' };
  }
}
