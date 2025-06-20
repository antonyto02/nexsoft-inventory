import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MovementsService } from './movements.service';
import { Movement } from '../entities/movement.entity';
import { MovementType } from '../entities/movement-type.entity';
import { Product } from '../entities/product.entity';

describe('MovementsService', () => {
  let service: MovementsService;
  const repo = {} as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: getRepositoryToken(Movement), useValue: repo },
        { provide: getRepositoryToken(MovementType), useValue: repo },
        { provide: getRepositoryToken(Product), useValue: repo },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw when product is not manual', async () => {
    repo.findOne = jest.fn().mockResolvedValue({ sensor_type: 'rfid' });
    await expect(
      service.registerManualMovement('1', { type: 1, quantity: 1 }),
    ).rejects.toThrow();
  });

  it('should register and update stock', async () => {
    repo.findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: 1, sensor_type: 'manual', stock: 2 }) // product
      .mockResolvedValueOnce({ id: 1 }); // movement type
    repo.create = jest.fn().mockReturnValue({});
    repo.save = jest.fn().mockResolvedValue({ final_quantity: 3 });

    const result = await service.registerManualMovement('1', {
      type: 1,
      quantity: 1,
    });

    expect(repo.save).toHaveBeenCalled();
    expect(result).toEqual({
      message: 'Movimiento registrado correctamente',
      new_stock: 3,
    });
  });
});
