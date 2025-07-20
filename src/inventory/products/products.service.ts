import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Unit } from '../entities/unit.entity';
import { StockEntry } from '../entities/stock-entry.entity';
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
  ) {}

  async create(companyId: string, dto: CreateProductDto) {
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
      company_id: companyId,
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

  async findByStatus(companyId: string | undefined, status: string, page = 1, limit = 10) {
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
      const expiringQb = this.stockEntryRepository
        .createQueryBuilder('entry')
        .leftJoinAndSelect('entry.product', 'product')
        .leftJoinAndSelect('product.category', 'category')
        .where('entry.expiration_date IS NOT NULL')
        .andWhere('entry.expiration_date <= :limitDate', {
          limitDate: sevenDays,
        })
        .andWhere('entry.deleted_at IS NULL');
      if (companyId) {
        expiringQb.andWhere('product.company_id = :companyId', { companyId });
      }
      const entries = await expiringQb
        .orderBy('entry.expiration_date', 'ASC')
        .getMany();

      const unique: { [key: number]: typeof entries[0] } = {};
      for (const e of entries) {
        if (!unique[e.product.id]) {
          unique[e.product.id] = e;
        }
      }

      const paginated = Object.values(unique).slice(skip, skip + limit);

      const products = paginated.map((e) => ({
        id: String(e.product.id),
        name: e.product.name,
        image_url: e.product.image_url,
        stock_actual: Number(e.product.stock),
        category: e.product.category?.name,
        sensor_type: e.product.sensor_type,
        expiration_date: e.expiration_date
          ? new Date(e.expiration_date as unknown as string)
              .toISOString()
              .split('T')[0]
          : undefined,
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

    if (companyId) {
      qb = qb.andWhere('product.company_id = :companyId', { companyId });
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

  async findGeneral(
    companyId: string | undefined,
    categoryId?: number,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    let qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.is_active = true');
    if (companyId) {
      qb = qb.andWhere('product.company_id = :companyId', { companyId });
    }

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

  private async hasUnaccent(): Promise<boolean> {
    try {
      const result = await this.productRepository.query(
        "SELECT extname FROM pg_extension WHERE extname = 'unaccent'",
      );
      return result.length > 0;
    } catch {
      return false;
    }
  }

  async searchByName(
    companyId: string | undefined,
    name?: string,
    limit = 20,
    offset = 0,
  ) {
    if (!name || name.length < 2) {
      throw new BadRequestException(
        "El parámetro 'name' es obligatorio y debe tener al menos 2 caracteres",
      );
    }

    const useUnaccent = await this.hasUnaccent();

    let qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.is_active = true')
      .andWhere('product.deleted_at IS NULL');
    if (companyId) {
      qb = qb.andWhere('product.company_id = :companyId', { companyId });
    }

    const searchTerm = `%${name}%`;

    if (useUnaccent) {
      qb = qb.andWhere(
        'unaccent(product.name) ILIKE unaccent(:name)',
        { name: searchTerm },
      );
    } else {
      qb = qb.andWhere('product.name ILIKE :name', { name: searchTerm });
    }

    const [result, total] = await qb
      .orderBy('product.name', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const products = result.map((p) => ({
      id: String(p.id),
      name: p.name,
      image_url: p.image_url,
      stock_actual: Number(p.stock),
      category: p.category?.name,
      sensor_type: p.sensor_type,
    }));

    const response: any = {
      message: 'Búsqueda completada',
      total,
      results: products,
    };

    if (!useUnaccent) {
      response.warning = 'Extensión unaccent no habilitada';
    }

    return response;
  }

  async findByName(name: string) {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new NotFoundException('Producto no encontrado');
    }

    const useUnaccent = await this.hasUnaccent();

    let qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.is_active = true')
      .andWhere('product.deleted_at IS NULL');

    const searchTerm = `%${trimmed}%`;

    if (useUnaccent) {
      qb = qb.andWhere(
        'unaccent(product.name) ILIKE unaccent(:name)',
        { name: searchTerm },
      );
    } else {
      qb = qb.andWhere('product.name ILIKE :name', { name: searchTerm });
    }

    const product = await qb.orderBy('product.id', 'ASC').getOne();

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

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.brand !== undefined) product.brand = dto.brand;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.stock_minimum !== undefined)
      product.min_stock = dto.stock_minimum;
    if (dto.stock_maximum !== undefined)
      product.max_stock = dto.stock_maximum;
    if (dto.image_url !== undefined) product.image_url = dto.image_url;

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
      product.category = category;
    }

    await this.productRepository.save(product);

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
