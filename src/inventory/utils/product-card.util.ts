import { Repository, LessThanOrEqual, IsNull } from 'typeorm';
import { Product } from '../entities/product.entity';
import { StockEntry } from '../entities/stock-entry.entity';

export async function buildProductCard(
  product: Product,
  stockEntryRepo: Repository<StockEntry>,
): Promise<any> {
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let status = 'all';

  if (
    product.sensor_type === 'rfid' &&
    (await stockEntryRepo.count({
      where: {
        product: { id: product.id },
        expiration_date: LessThanOrEqual(sevenDays),
        deleted_at: IsNull(),
      },
    })) > 0
  ) {
    status = 'expiring';
  } else if (Number(product.stock) === 0) {
    status = 'out_of_stock';
  } else if (Number(product.stock) < Number(product.min_stock)) {
    status = 'low_stock';
  } else if (
    Number(product.stock) >= Number(product.min_stock) &&
    Number(product.stock) <= Number(product.min_stock) + 1
  ) {
    status = 'near_minimum';
  } else if (
    product.max_stock !== null &&
    Number(product.stock) > Number(product.max_stock)
  ) {
    status = 'overstock';
  }

  return {
    id: String(product.id),
    name: product.name,
    image_url: product.image_url,
    stock_actual: Number(product.stock),
    stock_minimum: Number(product.min_stock),
    stock_maximum:
      product.max_stock !== null ? Number(product.max_stock) : null,
    sensor_type: product.sensor_type,
    category: product.category?.name,
    status,
    is_active: product.is_active,
  };
}
