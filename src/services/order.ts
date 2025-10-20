import { randomBytes } from 'crypto';
import {
  InventoryMovementType,
  OrderStatus,
  Prisma,
  PrismaClient
} from '@prisma/client';
import { format } from 'date-fns';
import { env } from '../env.js';
import {
  AppError,
  badRequest,
  forbidden,
  notFound,
  unprocessable
} from '../errors.js';
import {
  ProductWithEffectivePrice,
  calculateLineTotal,
  resolveEffectiveUnitPrice
} from './price.js';
import {
  buildOrderCompletedMessage,
  buildOrderConfirmedMessage,
  buildOrderCreatedMessage,
  buildOrderShippedMessage
} from './lineMessages.js';
import { createLineClient, isLinePushEnabled, sendLineMessage } from './line.js';

const ORDER_CODE_PREFIX = 'ORD';

const lineClient = createLineClient();

const orderInclude = Prisma.validator<Prisma.OrderInclude>()({
  items: true,
  shipTo: true
});

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export interface OrderItemInput {
  productId: string;
  quantity: number;
  notes?: string | null;
}

export interface CreateOrderInput {
  farmerCompanyId: string;
  orderedById: string;
  shipToId: string;
  requestedDelivery?: Date | null;
  notes?: string | null;
  discountAmount?: number | string | Prisma.Decimal;
  items: OrderItemInput[];
}

export interface UpdateOrderInput extends Omit<CreateOrderInput, 'orderedById'> {
  orderId: string;
}

export interface ShipPayload {
  trackingNumber: string;
  shippedAt?: Date | null;
}

async function assertOrdererUser(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== env.ORDERER_COMPANY_ID) {
    throw forbidden('USER_FORBIDDEN', 'User does not belong to the orderer company.');
  }
}

async function fetchFarmer(prisma: PrismaClient, farmerCompanyId: string) {
  const farmer = await prisma.company.findUnique({ where: { id: farmerCompanyId } });
  if (!farmer) {
    throw notFound('FARMER_NOT_FOUND', 'Farmer company not found.');
  }
  if (farmer.type !== 'FARMER') {
    throw badRequest('INVALID_FARMER', 'Target company is not marked as FARMER.');
  }
  return farmer;
}

async function fetchShipTo(prisma: PrismaClient, shipToId: string, farmerCompanyId: string) {
  const shipTo = await prisma.shipTo.findUnique({ where: { id: shipToId } });
  if (!shipTo || shipTo.companyId !== env.ORDERER_COMPANY_ID || !shipTo.isActive) {
    throw notFound('SHIP_TO_NOT_FOUND', 'Ship-to destination not available.');
  }

  const route = await prisma.shipToFarmerRoute.findUnique({
    where: {
      shipToId_farmerCompanyId: {
        shipToId,
        farmerCompanyId
      }
    }
  });

  if (route && !route.isEnabled) {
    throw forbidden('ROUTE_DISABLED', 'Ship-to is disabled for the farmer.');
  }

  return shipTo;
}

function normalizeDiscount(discount: number | string | Prisma.Decimal | undefined) {
  const decimal = new Prisma.Decimal(discount ?? 0);
  if (decimal.lt(0)) {
    throw badRequest('NEGATIVE_DISCOUNT', 'Discount must be zero or positive.');
  }
  return decimal;
}

function buildOrderCode(now: Date = new Date()) {
  const datePart = format(now, 'yyyyMMdd');
  const randomPart = randomBytes(3).toString('hex').toUpperCase();
  return `${ORDER_CODE_PREFIX}-${datePart}-${randomPart}`;
}

async function ensureProducts(
  prisma: PrismaClient,
  farmerCompanyId: string,
  items: OrderItemInput[],
  asOf: Date
) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      farmerId: farmerCompanyId,
      isActive: true
    }
  });

  if (products.length !== productIds.length) {
    throw badRequest('INVALID_PRODUCTS', 'One or more products are not available for the farmer.');
  }

  const pricingMap = new Map<string, ProductWithEffectivePrice>();
  for (const product of products) {
    const { unitPrice, specialPriceId } = await resolveEffectiveUnitPrice(prisma, product.id, asOf);
    pricingMap.set(product.id, {
      ...product,
      effectivePrice: unitPrice,
      specialPriceId
    });
  }

  return pricingMap;
}

async function getAvailableInventory(
  prisma: PrismaClient,
  farmerCompanyId: string,
  productId: string
): Promise<Prisma.Decimal> {
  const aggregate = await prisma.inventoryLedger.aggregate({
    where: {
      farmerCompanyId,
      productId
    },
    _sum: { quantity: true }
  });

  return new Prisma.Decimal(aggregate._sum.quantity ?? 0);
}

function assertHasItems(items: OrderItemInput[]) {
  if (!items.length) {
    throw badRequest('EMPTY_ITEMS', 'Orders must contain at least one item.');
  }
}

function ensureOrderEditable(order: OrderWithRelations) {
  if (order.status !== OrderStatus.NEW) {
    throw forbidden('ORDER_NOT_EDITABLE', 'Only NEW orders can be edited.');
  }
}

type OrderLifecycleEvent = 'created' | 'confirmed' | 'shipped' | 'completed';

const lineMessageBuilders: Record<OrderLifecycleEvent, (order: OrderWithRelations) => string> = {
  created: buildOrderCreatedMessage,
  confirmed: buildOrderConfirmedMessage,
  shipped: buildOrderShippedMessage,
  completed: buildOrderCompletedMessage
};

interface BuiltOrderItems {
  records: Prisma.OrderItemCreateWithoutOrderInput[];
  subtotal: Prisma.Decimal;
}

function buildOrderItems(
  pricing: Map<string, ProductWithEffectivePrice>,
  items: OrderItemInput[]
): BuiltOrderItems {
  const records: Prisma.OrderItemCreateWithoutOrderInput[] = items.map((item) => {
    const product = pricing.get(item.productId);
    if (!product) {
      throw new AppError(500, 'PRICING_NOT_FOUND', 'Pricing table lookup failed.');
    }

    const quantity = new Prisma.Decimal(item.quantity);
    if (quantity.lte(0)) {
      throw badRequest('INVALID_QUANTITY', 'Quantity must be greater than zero.');
    }

    const totalPrice = calculateLineTotal(product.effectivePrice, quantity);
    return {
      productId: product.id,
      productNameSnap: product.name,
      productSkuSnap: product.sku,
      unit: product.unit,
      quantity,
      unitPrice: product.effectivePrice,
      totalPrice,
      notes: item.notes ?? null
    } satisfies Prisma.OrderItemCreateWithoutOrderInput;
  });

  const subtotal = records.reduce(
    (sum, record) => sum.add(record.totalPrice as Prisma.Decimal),
    new Prisma.Decimal(0)
  );

  return { records, subtotal };
}

function computeTotalAmount(subtotal: Prisma.Decimal, discount: Prisma.Decimal) {
  const total = subtotal.sub(discount);
  if (total.lt(0)) {
    throw badRequest('DISCOUNT_EXCEEDS_SUBTOTAL', 'Discount exceeds order subtotal.');
  }
  return total;
}

async function notifyOrderLifecycle(
  prisma: PrismaClient,
  order: OrderWithRelations,
  event: OrderLifecycleEvent
) {
  if (!isLinePushEnabled()) {
    return;
  }

  const recipients = await prisma.userSetting.findMany({
    where: {
      lineEnabled: true,
      lineUserId: { not: null },
      user: {
        companyId: env.ORDERER_COMPANY_ID,
        isActive: true
      }
    },
    select: { lineUserId: true }
  });

  if (!recipients.length) {
    return;
  }

  const message = lineMessageBuilders[event](order);
  const tasks = recipients
    .map((recipient) => recipient.lineUserId)
    .filter((id): id is string => Boolean(id))
    .map((lineUserId) =>
      sendLineMessage(lineClient, {
        to: lineUserId,
        messages: [message]
      })
    );

  await Promise.all(tasks);
}

export async function createOrder(
  prisma: PrismaClient,
  input: CreateOrderInput
): Promise<OrderWithRelations> {
  assertHasItems(input.items);
  const discount = normalizeDiscount(input.discountAmount);
  const now = new Date();

  const order = await prisma.$transaction(async (tx) => {
    await assertOrdererUser(tx, input.orderedById);
    await fetchFarmer(tx, input.farmerCompanyId);
    const shipTo = await fetchShipTo(tx, input.shipToId, input.farmerCompanyId);
    const pricing = await ensureProducts(tx, input.farmerCompanyId, input.items, now);
    const orderCode = buildOrderCode(now);
    const { records, subtotal } = buildOrderItems(pricing, input.items);
    const totalAmount = computeTotalAmount(subtotal, discount);

    const order = await tx.order.create({
      data: {
        orderCode,
        status: OrderStatus.NEW,
        ordererCompanyId: env.ORDERER_COMPANY_ID,
        farmerCompanyId: input.farmerCompanyId,
        orderedById: input.orderedById,
        requestedDelivery: input.requestedDelivery ?? null,
        notes: input.notes ?? null,
        discountAmount: discount,
        totalAmount,
        shipToId: shipTo.id,
        shipToLabelSnap: shipTo.label,
        shipToAddressSnap: shipTo.address,
        shipToPhoneSnap: shipTo.phoneNumber,
        items: {
          create: records
        }
      },
      include: orderInclude
    });

    return order;
  });

  await notifyOrderLifecycle(prisma, order, 'created');
  return order;
}

export async function updateOrder(
  prisma: PrismaClient,
  input: UpdateOrderInput
): Promise<OrderWithRelations> {
  assertHasItems(input.items);
  const discount = normalizeDiscount(input.discountAmount);
  const now = new Date();

  const order = await prisma.$transaction(async (tx) => {
    await fetchFarmer(tx, input.farmerCompanyId);
    const shipTo = await fetchShipTo(tx, input.shipToId, input.farmerCompanyId);
    const pricing = await ensureProducts(tx, input.farmerCompanyId, input.items, now);
    const { records, subtotal } = buildOrderItems(pricing, input.items);
    const totalAmount = computeTotalAmount(subtotal, discount);
    const existing = await tx.order.findUnique({
      where: { id: input.orderId },
      include: orderInclude
    });

    if (!existing) {
      throw notFound('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (existing.ordererCompanyId !== env.ORDERER_COMPANY_ID) {
      throw forbidden('ORDER_FORBIDDEN', 'Order does not belong to the orderer company.');
    }

    ensureOrderEditable(existing);

    const updated = await tx.order.update({
      where: { id: input.orderId },
      data: {
        requestedDelivery: input.requestedDelivery ?? null,
        notes: input.notes ?? null,
        farmerCompanyId: input.farmerCompanyId,
        shipToId: shipTo.id,
        shipToLabelSnap: shipTo.label,
        shipToAddressSnap: shipTo.address,
        shipToPhoneSnap: shipTo.phoneNumber,
        discountAmount: discount,
        totalAmount,
        items: {
          deleteMany: {},
          create: records
        }
      },
      include: orderInclude
    });

    return updated;
  });

  return order;
}

export async function confirmOrder(
  prisma: PrismaClient,
  orderId: string
): Promise<OrderWithRelations> {
  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) {
      throw notFound('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (order.ordererCompanyId !== env.ORDERER_COMPANY_ID) {
      throw forbidden('ORDER_FORBIDDEN', 'Order does not belong to the orderer company.');
    }

    if (order.status !== OrderStatus.NEW) {
      throw forbidden('ORDER_CONFIRM_FORBIDDEN', 'Only NEW orders can be confirmed.');
    }

    if (!order.items.length) {
      throw badRequest('ORDER_NO_ITEMS', 'Orders must have at least one item.');
    }

    for (const item of order.items) {
      const available = await getAvailableInventory(tx, order.farmerCompanyId, item.productId);
      if (available.lt(item.quantity)) {
        throw unprocessable('INSUFFICIENT_STOCK', 'Insufficient stock to confirm order.', {
          productId: item.productId,
          required: item.quantity.toString(),
          available: available.toString()
        });
      }
    }

    await tx.inventoryLedger.createMany({
      data: order.items.map((item) => ({
        productId: item.productId,
        farmerCompanyId: order.farmerCompanyId,
        orderId: order.id,
        orderItemId: item.id,
        movementType: InventoryMovementType.ALLOCATE,
        quantity: item.quantity.mul(-1).toString()
      }))
    });

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PROCESSING,
        confirmedAt: new Date()
      },
      include: orderInclude
    });

    return updated;
  });

  await notifyOrderLifecycle(prisma, order, 'confirmed');
  return order;
}

export async function shipOrder(
  prisma: PrismaClient,
  orderId: string,
  payload: ShipPayload
): Promise<OrderWithRelations> {
  if (!payload.trackingNumber) {
    throw badRequest('TRACKING_REQUIRED', 'Tracking number is required to ship an order.');
  }

  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) {
      throw notFound('ORDER_NOT_FOUND', 'Order not found.');
    }

    if (order.ordererCompanyId !== env.ORDERER_COMPANY_ID) {
      throw forbidden('ORDER_FORBIDDEN', 'Order does not belong to the orderer company.');
    }

    if (order.status !== OrderStatus.PROCESSING) {
      throw forbidden('ORDER_SHIP_FORBIDDEN', 'Only PROCESSING orders can be shipped.');
    }

    await tx.inventoryLedger.createMany({
      data: order.items.flatMap((item) => {
        const quantity = item.quantity;
        return [
          {
            productId: item.productId,
            farmerCompanyId: order.farmerCompanyId,
            orderId: order.id,
            orderItemId: item.id,
            movementType: InventoryMovementType.DEALLOCATE,
            quantity: quantity.toString()
          },
          {
            productId: item.productId,
            farmerCompanyId: order.farmerCompanyId,
            orderId: order.id,
            orderItemId: item.id,
            movementType: InventoryMovementType.SHIP,
            quantity: quantity.mul(-1).toString()
          }
        ];
      })
    });

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SHIPPED,
        shippedAt: payload.shippedAt ?? new Date(),
        trackingNumber: payload.trackingNumber
      },
      include: orderInclude
    });

    return updated;
  });

  await notifyOrderLifecycle(prisma, order, 'shipped');
  return order;
}

export async function completeOrder(
  prisma: PrismaClient,
  orderId: string
): Promise<OrderWithRelations> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) {
    throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  }

  if (order.ordererCompanyId !== env.ORDERER_COMPANY_ID) {
    throw forbidden('ORDER_FORBIDDEN', 'Order does not belong to the orderer company.');
  }

  if (order.status !== OrderStatus.SHIPPED) {
    throw forbidden('ORDER_COMPLETE_FORBIDDEN', 'Only SHIPPED orders can be completed.');
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.COMPLETED,
      completedAt: new Date()
    },
    include: orderInclude
  });

  await notifyOrderLifecycle(prisma, updated, 'completed');
  return updated;
}

export interface ListOrdersFilters {
  status?: OrderStatus;
  farmerCompanyId?: string;
  orderedFrom?: Date;
  orderedTo?: Date;
}

export async function listOrders(
  prisma: PrismaClient,
  filters: ListOrdersFilters
): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    where: {
      ordererCompanyId: env.ORDERER_COMPANY_ID,
      status: filters.status,
      farmerCompanyId: filters.farmerCompanyId,
      orderedAt: {
        gte: filters.orderedFrom ?? undefined,
        lte: filters.orderedTo ?? undefined
      }
    },
    include: orderInclude,
    orderBy: { orderedAt: 'desc' }
  });
}

export async function getOrderById(
  prisma: PrismaClient,
  orderId: string
): Promise<OrderWithRelations> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) {
    throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  }
  if (order.ordererCompanyId !== env.ORDERER_COMPANY_ID) {
    throw forbidden('ORDER_FORBIDDEN', 'Order does not belong to the orderer company.');
  }
  return order;
}
