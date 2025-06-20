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
});
