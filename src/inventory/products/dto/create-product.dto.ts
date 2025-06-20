export class CreateProductDto {
  name: string;
  brand: string;
  description: string;
  category: number;
  unit_type: number;
  stock_min: number;
  stock_max: number;
  sensor_type: 'manual' | 'rfid' | 'weight' | 'camera';
  image_url?: string;
}
