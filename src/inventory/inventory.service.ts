import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { StockEntry } from './entities/stock-entry.entity';


@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(StockEntry)
    private readonly stockEntryRepository: Repository<StockEntry>,
  ) {}

  async getHomeSummary() {
    const limit = 5;
    const today = new Date();
    const sevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiringEntries = await this.stockEntryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.product', 'product')
      .where('entry.expiration_date IS NOT NULL')
      .andWhere('entry.expiration_date <= :limitDate', { limitDate: sevenDays })
      .andWhere('entry.deleted_at IS NULL')
      .orderBy('entry.expiration_date', 'ASC')
      .limit(limit)
      .getMany();

    const expiring = expiringEntries.map((e) => ({
      name: e.product.name,
      stock_actual: Number(e.product.stock),
      expiration_date: e.expiration_date?.toISOString().split('T')[0],
      image_url: e.product.image_url,
      sensor_type: e.product.sensor_type,
    }));

    const outOfStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock = 0')
      .orderBy('product.updated_at', 'DESC')
      .limit(limit)
      .getMany();

    const out_of_stock = outOfStockProducts.map((p) => ({
      name: p.name,
      stock_actual: Number(p.stock),
      image_url: p.image_url,
      sensor_type: p.sensor_type,
    }));

    const lowStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock < product.min_stock')
      .orderBy('product.stock', 'ASC')
      .limit(limit)
      .getMany();

    const low_stock = lowStockProducts.map((p) => ({
      name: p.name,
      stock_actual: Number(p.stock),
      stock_minimum: Number(p.min_stock),
      sensor_type: p.sensor_type,
    }));

    const nearMinimumProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock >= product.min_stock')
      .andWhere('product.stock <= product.min_stock + 1')
      .orderBy('product.stock - product.min_stock', 'ASC')
      .limit(limit)
      .getMany();

    const near_minimum = nearMinimumProducts.map((p) => ({
      name: p.name,
      stock_actual: Number(p.stock),
      stock_minimum: Number(p.min_stock),
      sensor_type: p.sensor_type,
    }));

    const overstockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock > product.max_stock')
      .orderBy('product.stock - product.max_stock', 'DESC')
      .limit(limit)
      .getMany();

    const overstock = overstockProducts.map((p) => ({
      name: p.name,
      stock_actual: Number(p.stock),
      stock_maximum: Number(p.max_stock),
      sensor_type: p.sensor_type,
    }));

    const allProducts = await this.productRepository
      .createQueryBuilder('product')
      .orderBy('product.name', 'ASC')
      .limit(limit)
      .getMany();

    const all = allProducts.map((p) => ({
      name: p.name,
      image_url: p.image_url,
      stock_actual: Number(p.stock),
      sensor_type: p.sensor_type,
    }));

    return {
      message: 'Resumen cargado correctamente',
      expiring,
      out_of_stock,
      low_stock,
      near_minimum,
      overstock,
      all,
    };
  }
}
