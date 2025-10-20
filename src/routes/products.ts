import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/client.js';
import { pricingService } from '../services/PricingService.js';
import { NotFoundError } from '../utils/errors.js';

export async function productRoutes(app: FastifyInstance) {
  // GET /farmers/:id/products - Get catalog with effective pricing
  app.get('/farmers/:id/products', async (request, reply) => {
    const { id: farmerId } = request.params as { id: string };

    const company = await prisma.company.findUnique({
      where: { id: farmerId },
    });

    if (!company) {
      throw new NotFoundError('Company', farmerId);
    }

    const products = await prisma.product.findMany({
      where: {
        farmerCompanyId: farmerId,
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

    return {
      farmerId,
      farmerName: company.name,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        unitPrice: p.unitPrice,
        effectivePrice: p.specialPrices[0]?.price || p.unitPrice,
        isSpecial: p.specialPrices.length > 0,
        unit: p.unit,
        isManaged: p.isManaged,
      })),
    };
  });
}
