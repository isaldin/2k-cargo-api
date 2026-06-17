import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApiSession } from '../session/session.entity';
import { AuthGuard } from '../auth/auth.guard';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { ListPackagesQueryDto } from './dto/list-packages-query.dto';
import { Package } from '../site-client/package.types';

interface RequestWithSession extends Request {
  session: ApiSession;
}

@ApiTags('Packages')
@Controller('packages')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @ApiOperation({ summary: 'List packages' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of packages',
    type: [Package],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'Upstream error',
  })
  async findAll(
    @Query() query: ListPackagesQueryDto,
    @Req() request: RequestWithSession,
  ) {
    return this.packagesService.list(request.session, query.page);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a package by ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Upstream package item id',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Package found',
    type: Package,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Package not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'Upstream error',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestWithSession,
  ) {
    return this.packagesService.getById(request.session, id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new package' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Package created',
    type: Package,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'Upstream error',
  })
  async create(
    @Body() dto: CreatePackageDto,
    @Req() request: RequestWithSession,
  ) {
    return this.packagesService.create(request.session, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a package' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Upstream package item id',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Package deleted',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Package not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'Upstream error',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestWithSession,
  ) {
    return this.packagesService.delete(request.session, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a package' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Upstream package item id',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Package updated',
    type: Package,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Package not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'Upstream error',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePackageDto,
    @Req() request: RequestWithSession,
  ) {
    return this.packagesService.update(request.session, id, dto);
  }
}
