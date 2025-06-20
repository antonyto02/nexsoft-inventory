import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Unit } from '../entities/unit.entity';
import { StockEntry } from '../entities/stock-entry.entity';

const repoMock = {};

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repoMock },
        { provide: getRepositoryToken(Category), useValue: repoMock },
        { provide: getRepositoryToken(Unit), useValue: repoMock },
        { provide: getRepositoryToken(StockEntry), useValue: repoMock },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getOne should call service', async () => {
    const svc = controller['productsService'];
    svc.findById = jest.fn().mockResolvedValue('result');
    const res = await controller.getOne('1');
    expect(svc.findById).toHaveBeenCalledWith('1');
    expect(res).toBe('result');
  });

  it('remove should call service', async () => {
    const svc = controller['productsService'];
    svc.remove = jest.fn().mockResolvedValue('done');
    const res = await controller.remove('2');
    expect(svc.remove).toHaveBeenCalledWith('2');
    expect(res).toBe('done');
  });
});
