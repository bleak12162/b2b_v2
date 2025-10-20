import { FastifyPluginAsync } from 'fastify';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  OrderItemInput,
  OrderWithRelations,
  ShipPayload,
  completeOrder,
  confirmOrder,
  createOrder,
  listOrders,
  shipOrder,
  updateOrder
} from '../services/order.js';

const orderItemResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string().nullable(),
  unit: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  totalPrice: z.string(),
  notes: z.string().nullable()
});

const shipToResponseSchema = z
  .object({
    id: z.string(),
    label: z.string().nullable(),
    address: z.string().nullable(),
    phoneNumber: z.string().nullable()
  })
  .nullable();

const orderResponseSchema = z.object({
  id: z.string(),
  orderCode: z.string(),
  status: z.enum(['NEW', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELED']),
  ordererCompanyId: z.string(),
  farmerCompanyId: z.string(),
  orderedById: z.string(),
  orderedAt: z.string(),
  requestedDelivery: z.string().nullable(),
  notes: z.string().nullable(),
  discountAmount: z.string(),
  totalAmount: z.string(),
  confirmedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  canceledAt: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  shipTo: shipToResponseSchema,
  items: z.array(orderItemResponseSchema)
});

const orderItemBodySchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional()
});

const createOrderBodySchema = z.object({
  farmerCompanyId: z.string(),
  orderedById: z.string(),
  shipToId: z.string(),
  requestedDelivery: z.coerce.date().optional(),
  notes: z.string().optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  items: z.array(orderItemBodySchema).min(1)
});

const updateOrderBodySchema = createOrderBodySchema.omit({ orderedById: true });

const shipBodySchema = z.object({
  trackingNumber: z.string().min(1),
  shippedAt: z.coerce.date().optional()
});

const listQuerySchema = z.object({
  status: z.enum(['NEW', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELED']).optional(),
  farmer: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

type OrderResponse = z.infer<typeof orderResponseSchema>;
type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
type UpdateOrderBody = z.infer<typeof updateOrderBodySchema>;
type ShipBody = z.infer<typeof shipBodySchema>;

type ListQuery = z.infer<typeof listQuerySchema>;

function mapOrder(order: OrderWithRelations): OrderResponse {
  return {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    ordererCompanyId: order.ordererCompanyId,
    farmerCompanyId: order.farmerCompanyId,
    orderedById: order.orderedById,
    orderedAt: order.orderedAt.toISOString(),
    requestedDelivery: order.requestedDelivery?.toISOString() ?? null,
    notes: order.notes ?? null,
    discountAmount: order.discountAmount.toString(),
    totalAmount: order.totalAmount.toString(),
    confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
    shippedAt: order.shippedAt ? order.shippedAt.toISOString() : null,
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    canceledAt: order.canceledAt ? order.canceledAt.toISOString() : null,
    trackingNumber: order.trackingNumber ?? null,
    shipTo: order.shipToId
      ? {
          id: order.shipToId,
          label: order.shipToLabelSnap ?? order.shipTo?.label ?? null,
          address: order.shipToAddressSnap ?? order.shipTo?.address ?? null,
          phoneNumber: order.shipToPhoneSnap ?? order.shipTo?.phoneNumber ?? null
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productNameSnap,
      productSku: item.productSkuSnap,
      unit: item.unit,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
      notes: item.notes ?? null
    }))
  } satisfies OrderResponse;
}

const ordersRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/orders',
    {
      schema: {
        body: createOrderBodySchema,
        response: { 201: z.object({ order: orderResponseSchema }) }
      }
    },
    async (request, reply) => {
      const body = request.body as CreateOrderBody;
      const order = await createOrder(prisma, {
        farmerCompanyId: body.farmerCompanyId,
        orderedById: body.orderedById,
        shipToId: body.shipToId,
        requestedDelivery: body.requestedDelivery ?? null,
        notes: body.notes ?? null,
        discountAmount: body.discountAmount,
        items: body.items as OrderItemInput[]
      });
      reply.code(201);
      return { order: mapOrder(order) };
    }
  );

  app.patch(
    '/orders/:orderId',
    {
      schema: {
        params: z.object({ orderId: z.string() }),
        body: updateOrderBodySchema,
        response: { 200: z.object({ order: orderResponseSchema }) }
      }
    },
    async (request) => {
      const { orderId } = request.params as { orderId: string };
      const body = request.body as UpdateOrderBody;
      const order = await updateOrder(prisma, {
        orderId,
        farmerCompanyId: body.farmerCompanyId,
        shipToId: body.shipToId,
        requestedDelivery: body.requestedDelivery ?? null,
        notes: body.notes ?? null,
        discountAmount: body.discountAmount,
        items: body.items as OrderItemInput[]
      });
      return { order: mapOrder(order) };
    }
  );

  app.post(
    '/orders/:orderId/confirm',
    {
      schema: {
        params: z.object({ orderId: z.string() }),
        response: { 200: z.object({ order: orderResponseSchema }) }
      }
    },
    async (request) => {
      const { orderId } = request.params as { orderId: string };
      const order = await confirmOrder(prisma, orderId);
      return { order: mapOrder(order) };
    }
  );

  app.post(
    '/orders/:orderId/ship',
    {
      schema: {
        params: z.object({ orderId: z.string() }),
        body: shipBodySchema,
        response: { 200: z.object({ order: orderResponseSchema }) }
      }
    },
    async (request) => {
      const { orderId } = request.params as { orderId: string };
      const body = request.body as ShipBody;
      const payload: ShipPayload = {
        trackingNumber: body.trackingNumber,
        shippedAt: body.shippedAt ?? null
      };
      const order = await shipOrder(prisma, orderId, payload);
      return { order: mapOrder(order) };
    }
  );

  app.post(
    '/orders/:orderId/complete',
    {
      schema: {
        params: z.object({ orderId: z.string() }),
        response: { 200: z.object({ order: orderResponseSchema }) }
      }
    },
    async (request) => {
      const { orderId } = request.params as { orderId: string };
      const order = await completeOrder(prisma, orderId);
      return { order: mapOrder(order) };
    }
  );

  app.get(
    '/orders',
    {
      schema: {
        querystring: listQuerySchema,
        response: {
          200: z.object({ orders: z.array(orderResponseSchema) })
        }
      }
    },
    async (request) => {
      const query = request.query as ListQuery;
      const orders = await listOrders(prisma, {
        status: (query.status as OrderStatus | undefined) ?? undefined,
        farmerCompanyId: query.farmer,
        orderedFrom: query.from ?? undefined,
        orderedTo: query.to ?? undefined
      });
      return { orders: orders.map(mapOrder) };
    }
  );
};

export default ordersRoutes;
