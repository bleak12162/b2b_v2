import prisma from '../db/client.js';
import { EffectivePrice } from '../types/index.js';

export class PricingService {
  /**
   * Get effective price for a product at a given time
   * Consider special prices first, then base price
   */
  async getEffectivePrice(productId: string, atDate: Date = new Date()): Promise<EffectivePrice> {
    // Fetch product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        specialPrices: {
          where: {
            validFrom: { lte: atDate },
            validTo: { gte: atDate },
          },
        },
      },
    });

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Check for active special price
    const specialPrice = product.specialPrices[0]?.price;

    return {
      basePrice: product.unitPrice,
      specialPrice,
      effectivePrice: specialPrice || product.unitPrice,
      isSpecial: !!specialPrice,
    };
  }

  /**
   * Calculate order total from items
   */
  calculateOrderTotal(items: Array<{ quantity: number; unitPrice: number }>, discountAmount: number = 0): number {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return Math.max(0, subtotal - discountAmount);
  }
}

export const pricingService = new PricingService();
