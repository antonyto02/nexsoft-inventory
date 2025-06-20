import { Body, Controller, Get, Post, Query, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('inventory/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

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
}
