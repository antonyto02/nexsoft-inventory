import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RfidService } from './rfid.service';
import { Product } from '../entities/product.entity';
import { StockEntry } from '../entities/stock-entry.entity';
import { Movement } from '../entities/movement.entity';
import { MovementType } from '../entities/movement-type.entity';
import { EntryModeService } from './entry-mode.service';

describe('RfidService', () => {
  let service: RfidService;
  const repoMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RfidService,
        EntryModeService,
        { provide: getRepositoryToken(Product), useValue: repoMock },
        { provide: getRepositoryToken(StockEntry), useValue: repoMock },
        { provide: getRepositoryToken(Movement), useValue: repoMock },
        { provide: getRepositoryToken(MovementType), useValue: repoMock },
      ],
    }).compile();

    service = module.get<RfidService>(RfidService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should toggle entry mode', () => {
    expect(service.getEntryMode()).toBe(false);
    service.setEntryMode(true);
    expect(service.getEntryMode()).toBe(true);
  });
});
