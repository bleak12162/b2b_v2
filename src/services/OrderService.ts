import prisma from '../db/client.js';
import { pricingService } from './PricingService.js';
import { inventoryService } from './InventoryService.js';
import { OrderStatus } from '../types/index.js';
import { NotFoundError, PermissionError, ValidationError } from '../utils/errors.js';

export interface CreateOrderDto {
  farmerCompanyId: string;
  shipToId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  discountAmount?: number;
}

export interface ShipOrderDto {
  trackingNo: string;
  shippedAt?: Date;
}

export class OrderService {
  /**
   * Create a new order (status: NEW)
   * Snapshots prices at order creation time
   */
  async createOrder(ordererCompanyId: string, dto: CreateOrderDto) {
    // Verify ShipTo belongs to orderer company
    const shipTo = await prisma.shipTo.findUnique({
      where: { id: dto.shipToId },
    });

    if (!shipTo || shipTo.ordererCompanyId !== ordererCompanyId) {
      throw new NotFoundError('ShipTo', dto.shipToId);
    }

    // Verify farmer company exists
    const farmerCompany = await prisma.company.findUnique({
      where: { id: dto.farmerCompanyId },
    });

    if (!farmerCompany) {
      throw new NotFoundError('Company', dto.farmerCompanyId);
    }

    // Fetch products and snapshot prices
    const products = await prisma.product.findMany({
      where: {
        id: { in: dto.items.map(i => i.productId) },
        farmerCompanyId: dto.farmerCompanyId,
      },
      include: {
        specialPrices: {
          where: {
            validFrom: { lte: new Date() },
            validTo: { gte: new Date() },
          },
          take: 1,
        },
      },
    });

    if (products.length !== dto.items.length) {
      throw new ValidationError('One or more products not found or belong to different farmer');
    }

    // Calculate total
    const orderItems = dto.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new ValidationError('Product not found');

      const unitPrice = product.specialPrices[0]?.price || product.unitPrice;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal: item.quantity * unitPrice,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalAmount = Math.max(0, subtotal - (dto.discountAmount || 0));

    // Create order with items
    const order = await prisma.order.create({
      data: {
        ordererCompanyId,
        farmerCompanyId: dto.farmerCompanyId,
        status: OrderStatus.NEW,
        shipToId: dto.shipToId,
        shipToLabel: shipTo.label,
        shipToAddress: shipTo.address,
        shipToPhone: shipTo.phone,
        discountAmount: dto.discountAmount || 0,
        totalAmount,
        items: {
          create: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
      },
      include: { items: true },
    });

    return order;
  }

  /**
   * Confirm order (NEW → PROCESSING)
   * Allocates inventory for managed products
   */
  async confirmOrder(orderId: string, ordererCompanyId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.ordererCompanyId !== ordererCompanyId) {
      throw new NotFoundError('Order', orderId);
    }

    if (order.status !== OrderStatus.NEW) {
      throw new ValidationError(`Order must be in NEW status to confirm. Current: ${order.status}`);
    }

    // Allocate inventory for each item
    for (const item of order.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (product && product.isManaged) {
        await inventoryService.allocateInventory(orderId, item.productId, item.quantity);
      }
    }

    // Update order status
    return prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PROCESSING },
      include: { items: true },
    });
  }

  /**
   * Ship order (PROCESSING → SHIPPED)
   */
  async shipOrder(orderId: string, ordererCompanyId: string, dto: ShipOrderDto) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.ordererCompanyId !== ordererCompanyId) {
      throw new NotFoundError('Order', orderId);
    }

    if (order.status !== OrderStatus.PROCESSING) {
      throw new ValidationError(`Order must be in PROCESSING status to ship. Current: ${order.status}`);
    }

    // Record shipments in inventory ledger
    for (const item of order.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (product && product.isManaged) {
        await inventoryService.recordShipment(orderId, item.productId, item.quantity);
      }
    }

    // Update order
    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SHIPPED,
        trackingNo: dto.trackingNo,
        shippedAt: dto.shippedAt || new Date(),
      },
      include: { items: true },
    });
  }

  /**
   * Complete order (SHIPPED → COMPLETED)
   */
  async completeOrder(orderId: string, ordererCompanyId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.ordererCompanyId !== ordererCompanyId) {
      throw new NotFoundError('Order', orderId);
    }

    if (order.status !== OrderStatus.SHIPPED) {
      throw new ValidationError(`Order must be in SHIPPED status to complete. Current: ${order.status}`);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: { items: true },
    });
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, companyId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    // Verify access (orderer or farmer)
    if (order.ordererCompanyId !== companyId && order.farmerCompanyId !== companyId) {
      throw new PermissionError('No access to this order');
    }

    return order;
  }

  /**
   * List orders with filters
   */
  async listOrders(
    ordererCompanyId: string,
    filters?: {
      status?: string;
      farmerCompanyId?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ) {
    return prisma.order.findMany({
      where: {
        ordererCompanyId,
        status: filters?.status,
        farmerCompanyId: filters?.farmerCompanyId,
        createdAt: {
          gte: filters?.fromDate,
          lte: filters?.toDate,
        },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

export const orderService = new OrderService();
