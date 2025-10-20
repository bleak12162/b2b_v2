import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';
import { listFarmerProductsWithEffectivePrice } from '../services/price.js';

const productResponseSchema = z.object({
  id: z.string(),
  farmerId: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  unit: z.string(),
  unitPrice: z.string(),
  effectivePrice: z.string(),
  specialPriceId: z.string().nullable()
});

type ProductResponse = z.infer<typeof productResponseSchema>;

function serializeProduct(product: ProductResponse): ProductResponse {
  return product;
}

const productsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/farmers/:farmerId/products',
    {
      schema: {
        params: z.object({ farmerId: z.string() }),
        response: {
          200: z.object({
            products: z.array(productResponseSchema)
          })
        }
      }
    },
    async (request) => {
      const { farmerId } = request.params as { farmerId: string };
      const farmer = await prisma.company.findUnique({ where: { id: farmerId } });
      if (!farmer || farmer.type !== 'FARMER') {
        throw notFound('FARMER_NOT_FOUND', 'Farmer company not found.');
      }

      const products = await listFarmerProductsWithEffectivePrice(prisma, farmerId);
      const payload: ProductResponse[] = products.map((product) => ({
        id: product.id,
        farmerId: product.farmerId,
        name: product.name,
        sku: product.sku,
        description: product.description,
        unit: product.unit,
        unitPrice: product.unitPrice.toString(),
        effectivePrice: product.effectivePrice.toString(),
        specialPriceId: product.specialPriceId
      }));

      return { products: payload.map(serializeProduct) };
    }
  );
};

export default productsRoutes;
