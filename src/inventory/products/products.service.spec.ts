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
    await expect(service.searchByName(undefined as any, 20, 0)).rejects.toThrow();
  });

  it('searchByName should return mapped products', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 5,
            name: 'Agua natural 1L',
            image_url: 'url',
            stock: 30,
            category: { name: 'Bebidas' },
            sensor_type: 'rfid',
          },
        ],
        1,
      ]),
    };

    repoMock.createQueryBuilder = jest.fn().mockReturnValue(qb);
    repoMock.query = jest.fn().mockResolvedValue([{ extname: 'unaccent' }]);

    const result = await service.searchByName('agua', 20, 0);
    expect(result).toEqual({
      message: 'Búsqueda completada',
      total: 1,
      results: [
        {
          id: '5',
          name: 'Agua natural 1L',
          image_url: 'url',
          stock_actual: 30,
          category: 'Bebidas',
          sensor_type: 'rfid',
        },
      ],
    });
  });

  it('findById should return mapped product', async () => {
    const prod = {
      id: 1,
      name: 'Leche entera',
      image_url: 'url',
      description: 'desc',
      brand: 'Lala',
      stock: 20,
      min_stock: 5,
      max_stock: 50,
      updated_at: new Date('2025-06-17T14:23:00Z'),
      category: { name: 'Lácteos' },
      sensor_type: 'rfid',
    };
    repoMock.findOne = jest.fn().mockResolvedValue(prod);

    const result = await service.findById('1');
    expect(result).toEqual({
      message: 'Producto obtenido correctamente',
      product: {
        id: '1',
        name: 'Leche entera',
        image_url: 'url',
        description: 'desc',
        category: 'Lácteos',
        brand: 'Lala',
        stock_actual: 20,
        stock_minimum: 5,
        stock_maximum: 50,
        last_updated: '2025-06-17T14:23:00',
        sensor_type: 'rfid',
      },
    });
  });

  it('findById should throw if product missing', async () => {
    repoMock.findOne = jest.fn().mockResolvedValue(null);
    await expect(service.findById('2')).rejects.toThrow();
  });

  it('update should modify allowed fields', async () => {
    const product = {
      id: 3,
      name: 'Old',
      brand: 'Brand',
      description: 'desc',
      min_stock: 1,
      max_stock: 2,
      image_url: 'old.png',
      category: { id: 1, name: 'Cat' },
    };
    repoMock.findOne = jest.fn().mockResolvedValue(product);
    repoMock.save = jest.fn().mockResolvedValue(product);

    const cat = { id: 2, name: 'New' };
    const catRepo = service['categoryRepository'];
    catRepo.findOne = jest.fn().mockResolvedValue(cat);

    await service.update('3', {
      name: 'NewName',
      category: 2,
    });

    expect(repoMock.save).toHaveBeenCalled();
    expect(product.name).toBe('NewName');
    expect(product.category).toBe(cat);
  });

  it('update should throw if product not found', async () => {
    repoMock.findOne = jest.fn().mockResolvedValue(null);
    await expect(service.update('5', {} as any)).rejects.toThrow();
  });

  it('remove should deactivate product', async () => {
    const product = { id: 4, is_active: true } as any;
    repoMock.findOne = jest.fn().mockResolvedValue(product);
    repoMock.save = jest.fn().mockResolvedValue(product);

    const result = await service.remove('4');

    expect(repoMock.save).toHaveBeenCalledWith(product);
    expect(product.is_active).toBe(false);
    expect(product.deleted_at).toBeInstanceOf(Date);
    expect(result).toEqual({ message: 'Producto eliminado correctamente' });
  });

  it("findByStatus 'expiring' should return products with expiration", async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          expiration_date: '2025-06-26',
          product: {
            id: 89,
            name: 'Lata de elotes',
            image_url: 'img',
            stock: 1,
            category: { name: 'Alimentos' },
            sensor_type: 'rfid',
          },
        },
      ]),
    } as any;
    qb.leftJoinAndSelect.mockReturnValue(qb);
    repoMock.createQueryBuilder = jest.fn().mockReturnValue(qb);

    const result = await service.findByStatus('expiring', 1, 10);

    expect(result).toEqual({
      message: 'Productos obtenidos correctamente',
      products: [
        {
          id: '89',
          name: 'Lata de elotes',
          image_url: 'img',
          stock_actual: 1,
          category: 'Alimentos',
          sensor_type: 'rfid',
          expiration_date: '2025-06-26',
        },
      ],
    });
  });

  it('remove should throw if product not found', async () => {
    repoMock.findOne = jest.fn().mockResolvedValue(null);
    await expect(service.remove('10')).rejects.toThrow();
  });
});
