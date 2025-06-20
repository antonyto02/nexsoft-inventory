import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { MovementsService } from '../movements/movements.service';
import { RegisterMovementDto } from '../movements/dto/register-movement.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('inventory/products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly movementsService: MovementsService,
  ) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  getByStatus(
    @Query('status') status: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.productsService.findByStatus(status, pageNum, limitNum);
  }

  @Get('general')
  getGeneral(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const categoryId = category ? parseInt(category, 10) : undefined;
    return this.productsService.findGeneral(categoryId, pageNum, limitNum);
  }

  @Get('search')
  search(@Query('name') name?: string) {
    return this.productsService.searchByName(name);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post(':id/movements')
  registerMovement(
    @Param('id') id: string,
    @Body() dto: RegisterMovementDto,
  ) {
    return this.movementsService.registerManualMovement(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
