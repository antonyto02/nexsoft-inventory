import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Unit } from './unit.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  stock: number;

  @Column('decimal', { precision: 10, scale: 2 })
  min_stock: number;

  @Column('decimal', { precision: 10, scale: 2 })
  max_stock: number;

  @Column()
  brand: string;

  @Column('text')
  description: string;

  @Column({ default: false })
  has_sensor: boolean;


  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  image_url?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at?: Date;

  @ManyToOne(() => Category, (category) => category.products)
  category: Category;

  @ManyToOne(() => Unit, (unit) => unit.products)
  unit: Unit;
}
