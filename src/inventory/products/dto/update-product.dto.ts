export class UpdateProductDto {
  name?: string;
  brand?: string;
  description?: string;
  stock_minimum?: number;
  stock_maximum?: number;
  image_url?: string;
  category?: number | string;
}
