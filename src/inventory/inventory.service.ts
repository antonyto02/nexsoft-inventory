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

    const outOfStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock = 0')
      .orderBy('product.updated_at', 'DESC')
      .getMany();

    const lowStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock > 0')
      .andWhere('product.stock < product.min_stock')
      .orderBy('product.stock', 'ASC')
      .getMany();

    const expiringEntries = await this.stockEntryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.product', 'product')
      .where('entry.expiration_date IS NOT NULL')
      .andWhere('entry.expiration_date <= :limitDate', { limitDate: sevenDays })
      .andWhere('entry.deleted_at IS NULL')
      .orderBy('entry.expiration_date', 'ASC')
      .getMany();

    const nearMinimumProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock >= product.min_stock')
      .andWhere('product.stock <= product.min_stock + 1')
      .orderBy('product.stock - product.min_stock', 'ASC')
      .getMany();

    const overstockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock > product.max_stock')
      .orderBy('product.stock - product.max_stock', 'DESC')
      .getMany();

    const allProducts = await this.productRepository
      .createQueryBuilder('product')
      .orderBy('product.name', 'ASC')
      .getMany();

    const assigned = new Set<number>();

    const takeUnique = <T>(items: T[], idFn: (item: T) => number) => {
      const result: T[] = [];
      for (const item of items) {
        const id = idFn(item);
        if (!assigned.has(id)) {
          assigned.add(id);
          result.push(item);
          if (result.length >= limit) break;
        }
      }
      return result;
    };

    const out_of_stock = takeUnique(outOfStockProducts, (p) => p.id).map((p) => ({
      id: String(p.id),
      name: p.name,
      stock_actual: Number(p.stock),
      image_url: p.image_url,
      sensor_type: p.sensor_type,
    }));

    const low_stock = takeUnique(lowStockProducts, (p) => p.id).map((p) => ({
      id: String(p.id),
      name: p.name,
      stock_actual: Number(p.stock),
      stock_minimum: Number(p.min_stock),
      image_url: p.image_url,
      sensor_type: p.sensor_type,
    }));

    const expiring = takeUnique(
      expiringEntries.filter((e) => !!e.product),
      (e) => e.product.id,
    ).map((e) => ({
      id: String(e.product.id),
      name: e.product.name,
      stock_actual: Number(e.product.stock),
      expiration_date: e.expiration_date
        ? new Date(e.expiration_date as unknown as string)
            .toISOString()
            .split('T')[0]
        : undefined,
      image_url: e.product.image_url,
      sensor_type: e.product.sensor_type,
    }));

    const near_minimum = takeUnique(nearMinimumProducts, (p) => p.id).map((p) => ({
      id: String(p.id),
      name: p.name,
      stock_actual: Number(p.stock),
      stock_minimum: Number(p.min_stock),
      image_url: p.image_url,
      sensor_type: p.sensor_type,
    }));

    const overstock = takeUnique(overstockProducts, (p) => p.id).map((p) => ({
      id: String(p.id),
      name: p.name,
      stock_actual: Number(p.stock),
      stock_maximum: Number(p.max_stock),
      image_url: p.image_url,
      sensor_type: p.sensor_type,
    }));

    const all = takeUnique(allProducts, (p) => p.id).map((p) => ({
      id: String(p.id),
      name: p.name,
      image_url: p.image_url,
      stock_actual: Number(p.stock),
      sensor_type: p.sensor_type,
    }));

    console.error('Expiring mapped:', expiring);

    return {
      message: 'Resumen cargado correctamente',
      out_of_stock,
      low_stock,
      expiring,
      near_minimum,
      overstock,
      all,
    };
  }
}
