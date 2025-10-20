import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { orderService, CreateOrderDto } from '../services/OrderService.js';
import { ShipOrderDto } from '../services/OrderService.js';

// Validation schemas
const createOrderSchema = z.object({
  farmerCompanyId: z.string(),
  shipToId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })
  ),
  discountAmount: z.number().nonnegative().optional(),
});

const shipOrderSchema = z.object({
  trackingNo: z.string(),
  shippedAt: z.string().datetime().optional(),
});

export async function orderRoutes(app: FastifyInstance) {
  // POST /orders - Create order
  app.post('/orders', async (request, reply) => {
    const data = createOrderSchema.parse(request.body);
    const ordererCompanyId = process.env.ORDERER_COMPANY_ID || '00000000-0000-0000-0000-000000000001';

    const order = await orderService.createOrder(ordererCompanyId, data as CreateOrderDto);
    return { data: order };
  });

  // GET /orders - List orders
  app.get('/orders', async (request, reply) => {
    const { status, farmerCompanyId, fromDate, toDate } = request.query as Record<string, string>;
    const ordererCompanyId = process.env.ORDERER_COMPANY_ID || '00000000-0000-0000-0000-000000000001';

    const orders = await orderService.listOrders(ordererCompanyId, {
      status,
      farmerCompanyId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    return { data: orders };
  });

  // GET /orders/:id - Get order by ID
  app.get('/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ordererCompanyId = process.env.ORDERER_COMPANY_ID || '00000000-0000-0000-0000-000000000001';

    const order = await orderService.getOrder(id, ordererCompanyId);
    return { data: order };
  });

  // POST /orders/:id/confirm - Confirm order
  app.post('/orders/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ordererCompanyId = process.env.ORDERER_COMPANY_ID || '00000000-0000-0000-0000-000000000001';

    const order = await orderService.confirmOrder(id, ordererCompanyId);
    reply.code(200);
    return { data: order };
  });

  // POST /orders/:id/ship - Ship order
  app.post('/orders/:id/ship', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ordererCompanyId = process.env.ORDERER_COMPANY_ID || '00000000-0000-0000-0000-000000000001';

    const data = shipOrderSchema.parse(request.body);
    const order = await orderService.shipOrder(id, ordererCompanyId, {
      trackingNo: data.trackingNo,
      shippedAt: data.shippedAt ? new Date(data.shippedAt) : undefined,
    } as ShipOrderDto);

    reply.code(200);
    return { data: order };
  });

  // POST /orders/:id/complete - Complete order
  app.post('/orders/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ordererCompanyId = process.env.ORDERER_COMPANY_ID || '00000000-0000-0000-0000-000000000001';

    const order = await orderService.completeOrder(id, ordererCompanyId);
    reply.code(200);
    return { data: order };
  });
}
