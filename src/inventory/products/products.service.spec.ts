import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Unit } from '../entities/unit.entity';
import { StockEntry } from '../entities/stock-entry.entity';

const repoMock = {};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repoMock },
        { provide: getRepositoryToken(Category), useValue: repoMock },
        { provide: getRepositoryToken(Unit), useValue: repoMock },
        { provide: getRepositoryToken(StockEntry), useValue: repoMock },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it("should throw error when status is 'all'", async () => {
    await expect(service.findByStatus('all', 1, 10)).rejects.toThrow();
  });

  it('should throw error when status is invalid', async () => {
    await expect(service.findByStatus('invalid', 1, 10)).rejects.toThrow();
  });

  it('findGeneral should be defined', async () => {
    repoMock.createQueryBuilder = jest.fn().mockReturnValue({
      leftJoinAndSelect: () => ({
        where: () => ({
          andWhere: () => ({
            orderBy: () => ({
              skip: () => ({
                take: () => ({
                  getMany: async () => [],
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await service.findGeneral(undefined, 1, 10);
    expect(result).toEqual({
      message: 'Productos obtenidos correctamente',
      products: [],
    });
  });

  it('should throw error when name is missing', async () => {
    await expect(service.searchByName(undefined)).rejects.toThrow();
  });

  it('searchByName should return mapped products', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          name: 'Agua natural 1L',
          image_url: 'url',
          stock: 30,
          category: { name: 'Bebidas' },
          sensor_type: 'rfid',
        },
      ]),
    };

    repoMock.createQueryBuilder = jest.fn().mockReturnValue(qb);

    const result = await service.searchByName('agua');
    expect(result).toEqual({
      message: 'Búsqueda completada',
      results: [
        {
          name: 'Agua natural 1L',
          image_url: 'url',
          stock_actual: 30,
          category: 'Bebidas',
          sensor_type: 'rfid',
        },
      ],
    });
  });
});
