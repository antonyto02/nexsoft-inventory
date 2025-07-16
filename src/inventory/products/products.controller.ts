import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Patch,
  Delete,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MovementsService } from '../movements/movements.service';
import { CreateMovementDto } from '../movements/dto/create-movement.dto';
import { RfidService } from '../rfid/rfid.service';
import { RfidEntryDto } from './dto/rfid-entry.dto';
import { AwsS3Service } from './s3.service';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';


@Controller('inventory/products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly movementsService: MovementsService,
    private readonly rfidService: RfidService,
    private readonly s3Service: AwsS3Service,
  ) {}

  @Post()
  create(@Body() dto: CreateProductDto, @Req() req: Request) {
    const companyId = (req as any).user?.companyId;
    console.log('company_id del usuario:', companyId);
    if (!companyId) {
      throw new UnauthorizedException('Falta company_id en el token');
    }
    return this.productsService.create(companyId, dto);
  }

  @Get()
  getByStatus(
    @Query('status') status: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: Request,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const companyId = (req as any).user?.companyId;
    console.log('company_id del usuario:', companyId);
    if (!companyId) {
      throw new UnauthorizedException('Falta company_id en el token');
    }
    return this.productsService.findByStatus(companyId, status, pageNum, limitNum);
  }

  @Get('general')
  getGeneral(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: Request,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const categoryId = category ? parseInt(category, 10) : undefined;
    const companyId = (req as any).user?.companyId;
    console.log('company_id del usuario:', companyId);
    if (!companyId) {
      throw new UnauthorizedException('Falta company_id en el token');
    }
    return this.productsService.findGeneral(companyId, categoryId, pageNum, limitNum);
  }

  @Get('search')
  async search(
    @Query('name') name?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Req() req?: Request,
  ) {
    if (!name || name.length < 2) {
      throw new BadRequestException(
        "El parámetro 'name' es obligatorio y debe tener al menos 2 caracteres",
      );
    }

    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const companyId = (req as any).user?.companyId;
    console.log('company_id del usuario:', companyId);
    if (!companyId) {
      throw new UnauthorizedException('Falta company_id en el token');
    }

    try {
      return await this.productsService.searchByName(
        companyId,
        name,
        limitNum,
        offsetNum,
      );
    } catch (err) {
      throw new InternalServerErrorException();
    }
  }
  @Get('upload-url')
  getUploadUrl(
    @Query('type') type: string,
    @Query('ext') ext: string,
  ) {
    return this.s3Service.generateSignedUrl(type, ext);
  }



  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Post(':id/movements')
  createMovement(@Param('id') id: string, @Body() dto: CreateMovementDto) {
    return this.movementsService.createManual(id, dto);
  }

  @Post(':id/rfid-entry')
  registerRfidEntry(@Param('id') id: string, @Body() dto: RfidEntryDto) {
    return this.rfidService.registerEntries(id, dto?.entries);
  }

  @Get(':id/movements')
  getMovements(@Param('id') id: string) {
    return this.movementsService.findByProduct(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
