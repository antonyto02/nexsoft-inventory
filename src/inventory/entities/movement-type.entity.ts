import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Movement } from './movement.entity';

@Entity('movement_types')
export class MovementType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Movement, (movement) => movement.type)
  movements: Movement[];
}
