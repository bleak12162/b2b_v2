import { Prisma, PrismaClient } from '@prisma/client';

export type ProductWithEffectivePrice = {
  id: string;
  farmerId: string;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string;
  unitPrice: Prisma.Decimal;
  isActive: boolean;
  effectivePrice: Prisma.Decimal;
  specialPriceId: string | null;
};

export async function listFarmerProductsWithEffectivePrice(
  prisma: PrismaClient,
  farmerId: string,
  asOf: Date = new Date()
): Promise<ProductWithEffectivePrice[]> {
  const products = await prisma.product.findMany({
    where: {
      farmerId,
      isActive: true
    },
    include: {
      specialPrices: {
        where: {
          startAt: { lte: asOf },
          OR: [{ endAt: null }, { endAt: { gte: asOf } }]
        },
        orderBy: { startAt: 'desc' },
        take: 1
      }
    }
  });

  return products.map((product) => {
    const specialPrice = product.specialPrices[0];
    const effectivePrice = specialPrice?.price ?? product.unitPrice;

    return {
      id: product.id,
      farmerId: product.farmerId,
      name: product.name,
      sku: product.sku,
      description: product.description,
      unit: product.unit,
      unitPrice: product.unitPrice,
      isActive: product.isActive,
      effectivePrice,
      specialPriceId: specialPrice?.id ?? null
    } satisfies ProductWithEffectivePrice;
  });
}

export async function resolveEffectiveUnitPrice(
  prisma: PrismaClient,
  productId: string,
  asOf: Date = new Date()
): Promise<{ unitPrice: Prisma.Decimal; specialPriceId: string | null }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      specialPrices: {
        where: {
          startAt: { lte: asOf },
          OR: [{ endAt: null }, { endAt: { gte: asOf } }]
        },
        orderBy: { startAt: 'desc' },
        take: 1
      }
    }
  });

  if (!product || !product.isActive) {
    throw new Error('Product not found or inactive');
  }

  const specialPrice = product.specialPrices[0];

  return {
    unitPrice: specialPrice?.price ?? product.unitPrice,
    specialPriceId: specialPrice?.id ?? null
  };
}

export function calculateLineTotal(
  unitPrice: Prisma.Decimal,
  quantity: Prisma.Decimal | number
): Prisma.Decimal {
  const qtyDecimal = quantity instanceof Prisma.Decimal ? quantity : new Prisma.Decimal(quantity);
  return unitPrice.mul(qtyDecimal);
}
