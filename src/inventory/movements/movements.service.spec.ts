import { Test, TestingModule } from '@nestjs/testing';
import { MovementsService } from './movements.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { Movement } from '../entities/movement.entity';
import { MovementType } from '../entities/movement-type.entity';

const repoMock = {};

describe('MovementsService', () => {
  let service: MovementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: getRepositoryToken(Product), useValue: repoMock },
        { provide: getRepositoryToken(Movement), useValue: repoMock },
        { provide: getRepositoryToken(MovementType), useValue: repoMock },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findByProduct should throw if product missing', async () => {
    repoMock.findOne = jest.fn().mockResolvedValue(null);
    await expect(service.findByProduct('1')).rejects.toThrow();
  });

  it('findByProduct should return mapped movements', async () => {
    repoMock.findOne = jest.fn().mockResolvedValue({ id: 1 });
    repoMock.find = jest.fn().mockResolvedValue([
      {
        movement_date: new Date('2025-06-17T14:23:00Z'),
        type: { id: 2, name: 'Baja' },
        previous_quantity: 23,
        quantity: 3,
        final_quantity: 20,
        comment: 'Producto vencido',
      },
    ]);

    const result = await service.findByProduct('1');
    expect(result).toEqual({
      message: 'Movimientos obtenidos correctamente',
      movements: [
        {
          date: '2025-06-17',
          time: '14:23',
          type: 'Baja',
          stock_before: 23,
          quantity: -3,
          stock_after: 20,
          comment: 'Producto vencido',
        },
      ],
    });
  });
});
