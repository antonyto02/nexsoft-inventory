import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('stock_entries')
export class StockEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.id, { eager: true })
  product: Product;

  @Column({ type: 'date', nullable: true })
  expiration_date?: Date;

  @Column({ type: 'text', unique: true })
  rfid_tag: string;

  @CreateDateColumn()
  created_at: Date;

  @DeleteDateColumn()
  deleted_at?: Date;
}
