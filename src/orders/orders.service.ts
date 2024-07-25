import { Injectable, OnModuleInit, Logger, HttpStatus, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto, PaidOrderDto, ChangeOrderStatusDto, CreateOrderDto } from './dto';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrderService'); 

  constructor(
    @Inject(NATS_SERVICE) private readonly client: ClientProxy,
  )
  {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }
  
  async create(createOrderDto: CreateOrderDto) {
    try {
      const productIds = createOrderDto.items.map(item => item.productId)
      const products: any[] = await firstValueFrom(
        this.client.send({ cmd: 'validate_product' }, productIds)
      );
  
      const totalAmount = createOrderDto.items.reduce((acc,orderItem)=> {
        const price = products.find( 
          (product) => product.id === orderItem.productId,
        ).price;
        return price * orderItem.quantity;
      }, 0);
    
      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc = orderItem.quantity;
      },0);

      const order = await this.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map( (orderItem) => ({
                price: products.find( 
                  (product) => product.id === orderItem.productId 
                ).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity,
              }) )
            },
          }
        },
        include: {
          OrderItem: {
            select: {
              productId: true,
              price: true,
              quantity: true
            }
          }
        }
      });


      return {
        ... order,
        OrderItem: order.OrderItem.map( (orderItem) => ({
          ...orderItem,
          name: products.find( product => product.id === orderItem.productId ).name
        }))
      };



    } catch (error) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Check logs',
      })      
    }
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
      where: { id },
      include: {
        OrderItem: {
          select: {
            productId: true,
            price: true,
            quantity: true
          }
        }
      }
    });


    if (!order) {
      throw new RpcException({
        message: `product with id #${ id } not found`,
        status: HttpStatus.NOT_FOUND
      });
    }
    
    
    const productIds = order.OrderItem.map( orderItem => orderItem.productId );
    const products: any[] = await firstValueFrom(
      this.client.send({ cmd: 'validate_product' }, productIds)
    );

    return {
        ... order,
        OrderItem: order.OrderItem.map( (orderItem) => ({
          ...orderItem,
          name: products.find( product => product.id === orderItem.productId ).name
        }))
      };
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

  async createPaymentSession(order: OrderWithProducts){
    const paymentSession = await firstValueFrom(
      this.client.send('create.payment.session',{
        orderId: order.id,
        currency: 'usd',
        items: order.OrderItem.map( item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }),)
      })
    )
    return paymentSession;
  }

  async paidOrder(paidOrderDto: PaidOrderDto){
    this.logger.log('Order Paid');
    this.logger.log(paidOrderDto);

    const order = await this.order.update({
      where: {id: paidOrderDto.orderId},
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripePaymentId,

        // La relacion
        OrderReceipt:{
          create: {
            receiptUrl: paidOrderDto.receiptUrl
          }
        }
      }
    });

    return order;
  }

}
