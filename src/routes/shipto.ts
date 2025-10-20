import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { badRequest, notFound } from '../errors.js';

const shipToSchema = z.object({
  id: z.string(),
  label: z.string(),
  postalCode: z.string().nullable(),
  address: z.string(),
  phoneNumber: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const shipToResponseSchema = z.object({ shipTos: z.array(shipToSchema) });

const createBodySchema = z.object({
  label: z.string().min(1),
  postalCode: z.string().optional(),
  address: z.string().min(1),
  phoneNumber: z.string().optional(),
  isActive: z.boolean().optional()
});

const updateBodySchema = createBodySchema.partial().extend({
  label: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});

const shipToParamsSchema = z.object({ id: z.string() });

function mapShipTo(record: {
  id: string;
  label: string;
  postalCode: string | null;
  address: string;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    label: record.label,
    postalCode: record.postalCode,
    address: record.address,
    phoneNumber: record.phoneNumber,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

const shipToRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/ship-tos',
    {
      schema: {
        response: { 200: shipToResponseSchema }
      }
    },
    async () => {
      const shipTos = await prisma.shipTo.findMany({
        where: { companyId: env.ORDERER_COMPANY_ID },
        orderBy: { createdAt: 'asc' }
      });
      return { shipTos: shipTos.map(mapShipTo) };
    }
  );

  app.post(
    '/ship-tos',
    {
      schema: {
        body: createBodySchema,
        response: { 201: z.object({ shipTo: shipToSchema }) }
      }
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createBodySchema>;
      const existing = await prisma.shipTo.findFirst({
        where: { companyId: env.ORDERER_COMPANY_ID, label: body.label }
      });
      if (existing) {
        throw badRequest('SHIP_TO_DUPLICATE', 'Ship-to label already exists.');
      }

      const shipTo = await prisma.shipTo.create({
        data: {
          companyId: env.ORDERER_COMPANY_ID,
          label: body.label,
          postalCode: body.postalCode ?? null,
          address: body.address,
          phoneNumber: body.phoneNumber ?? null,
          isActive: body.isActive ?? true
        }
      });
      reply.code(201);
      return { shipTo: mapShipTo(shipTo) };
    }
  );

  app.patch(
    '/ship-tos/:id',
    {
      schema: {
        params: shipToParamsSchema,
        body: updateBodySchema,
        response: { 200: z.object({ shipTo: shipToSchema }) }
      }
    },
    async (request) => {
      const { id } = request.params as z.infer<typeof shipToParamsSchema>;
      const body = request.body as z.infer<typeof updateBodySchema>;

      const target = await prisma.shipTo.findUnique({ where: { id } });
      if (!target || target.companyId !== env.ORDERER_COMPANY_ID) {
        throw notFound('SHIP_TO_NOT_FOUND', 'Ship-to destination not found.');
      }

      if (body.label && body.label !== target.label) {
        const duplicate = await prisma.shipTo.findFirst({
          where: {
            companyId: env.ORDERER_COMPANY_ID,
            label: body.label,
            NOT: { id }
          }
        });
        if (duplicate) {
          throw badRequest('SHIP_TO_DUPLICATE', 'Ship-to label already exists.');
        }
      }

      const shipTo = await prisma.shipTo.update({
        where: { id },
        data: {
          label: body.label ?? target.label,
          postalCode: body.postalCode ?? target.postalCode,
          address: body.address ?? target.address,
          phoneNumber: body.phoneNumber ?? target.phoneNumber,
          isActive: body.isActive ?? target.isActive
        }
      });

      return { shipTo: mapShipTo(shipTo) };
    }
  );

  app.delete(
    '/ship-tos/:id',
    {
      schema: {
        params: shipToParamsSchema,
        response: { 200: z.object({ shipTo: shipToSchema }) }
      }
    },
    async (request) => {
      const { id } = request.params as z.infer<typeof shipToParamsSchema>;
      const target = await prisma.shipTo.findUnique({ where: { id } });
      if (!target || target.companyId !== env.ORDERER_COMPANY_ID) {
        throw notFound('SHIP_TO_NOT_FOUND', 'Ship-to destination not found.');
      }

      const shipTo = await prisma.shipTo.update({
        where: { id },
        data: { isActive: false }
      });

      return { shipTo: mapShipTo(shipTo) };
    }
  );
};

export default shipToRoutes;
