import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { MovementType } from './movement-type.entity';

@Entity('movements')
export class Movement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.id, { eager: true })
  product: Product;

  @ManyToOne(() => MovementType, (type) => type.movements, { eager: true })
  type: MovementType;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  previous_quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  final_quantity: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @CreateDateColumn()
  movement_date: Date;

  @DeleteDateColumn()
  deleted_at?: Date;
}
