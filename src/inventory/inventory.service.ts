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

  async getHomeSummary(companyId?: string) {
    const limit = 5;
    const today = new Date();
    const sevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const outOfStockQb = this.productRepository
      .createQueryBuilder('product')
      .where('product.stock = 0');
    if (companyId) {
      outOfStockQb.andWhere('product.company_id = :companyId', { companyId });
    }
    const outOfStockProducts = await outOfStockQb
      .orderBy('product.updated_at', 'DESC')
      .getMany();

    const lowStockQb = this.productRepository
      .createQueryBuilder('product')
      .where('product.stock > 0')
      .andWhere('product.stock < product.min_stock');
    if (companyId) {
      lowStockQb.andWhere('product.company_id = :companyId', { companyId });
    }
    const lowStockProducts = await lowStockQb
      .orderBy('product.stock', 'ASC')
      .getMany();

    const expiringQb = this.stockEntryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.product', 'product')
      .where('entry.expiration_date IS NOT NULL')
      .andWhere('entry.expiration_date <= :limitDate', { limitDate: sevenDays })
      .andWhere('entry.deleted_at IS NULL');
    if (companyId) {
      expiringQb.andWhere('product.company_id = :companyId', { companyId });
    }
    const expiringEntries = await expiringQb
      .orderBy('entry.expiration_date', 'ASC')
      .getMany();

    const nearMinQb = this.productRepository
      .createQueryBuilder('product')
      .where('product.stock >= product.min_stock')
      .andWhere('product.stock <= product.min_stock + 1');
    if (companyId) {
      nearMinQb.andWhere('product.company_id = :companyId', { companyId });
    }
    const nearMinimumProducts = await nearMinQb
      .orderBy('product.stock - product.min_stock', 'ASC')
      .getMany();

    const overstockQb = this.productRepository
      .createQueryBuilder('product')
      .where('product.stock > product.max_stock');
    if (companyId) {
      overstockQb.andWhere('product.company_id = :companyId', { companyId });
    }
    const overstockProducts = await overstockQb
      .orderBy('product.stock - product.max_stock', 'DESC')
      .getMany();

    const allQb = this.productRepository.createQueryBuilder('product');
    if (companyId) {
      allQb.where('product.company_id = :companyId', { companyId });
    }
    const allProducts = await allQb.orderBy('product.name', 'ASC').getMany();

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
