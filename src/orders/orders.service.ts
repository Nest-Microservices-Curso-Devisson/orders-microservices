import { Injectable, OnModuleInit, Logger, NotFoundException, HttpStatus } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrderService'); 

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }
  
  create(createOrderDto: CreateOrderDto) {

    return this.order.create({
      data: createOrderDto
    });
  }

  async findAll(orderPaginationDto: OrderPaginationDto){
    const totalPages = await this.order.count({
      where:{
        status: orderPaginationDto.status
      }
    })
    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDto.status
        }
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages/perPage)
      }
    }
  }

  async findOne(id: string) {

    const order = await this.order.findUnique({
      where: { id }
    });

    if (!order) {
      throw new RpcException({
        message: `product with id #${ id } not found`,
        status: HttpStatus.NOT_FOUND
      });
    }

    return order;
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto){
    const { id,status } = changeOrderStatusDto;

    const order = await this.findOne(id);
    
    if(order.status === status){
      return order;
    }

    return this.order.update({
      where: { id },
      data: {
        status: status
      }
    })
  }

}
