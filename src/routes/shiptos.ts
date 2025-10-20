import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/client.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const createShipToSchema = z.object({
  label: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().optional(),
});

const updateShipToSchema = z.object({
  label: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function shipToRoutes(app: FastifyInstance) {
  const ordererCompanyId = process.env.ORDERER_COMPANY_ID || '00000000-0000-0000-0000-000000000001';

  // GET /ship-tos - List shipping addresses
  app.get('/ship-tos', async (request, reply) => {
    const shipTos = await prisma.shipTo.findMany({
      where: {
        ordererCompanyId,
        isActive: true,
      },
    });

    return { data: shipTos };
  });

  // POST /ship-tos - Create shipping address
  app.post('/ship-tos', async (request, reply) => {
    const data = createShipToSchema.parse(request.body);

    const shipTo = await prisma.shipTo.create({
      data: {
        ordererCompanyId,
        ...data,
      },
    });

    reply.code(201);
    return { data: shipTo };
  });

  // PATCH /ship-tos/:id - Update shipping address
  app.patch('/ship-tos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateShipToSchema.parse(request.body);

    const shipTo = await prisma.shipTo.findUnique({
      where: { id },
    });

    if (!shipTo || shipTo.ordererCompanyId !== ordererCompanyId) {
      throw new NotFoundError('ShipTo', id);
    }

    const updated = await prisma.shipTo.update({
      where: { id },
      data,
    });

    return { data: updated };
  });
}
