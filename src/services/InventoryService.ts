import prisma from '../db/client.js';
import { InsufficientInventoryError } from '../utils/errors.js';

export class InventoryService {
  /**
   * Get current inventory balance for a product
   * balance = (allocated - deallocated)
   */
  async getInventoryBalance(productId: string): Promise<number> {
    const ledger = await prisma.inventoryLedger.groupBy({
      by: ['type'],
      where: { productId },
      _sum: { quantity: true },
    });

    const typeMap = Object.fromEntries(ledger.map(row => [row.type, row._sum.quantity || 0]));
    const allocated = typeMap['allocate'] || 0;
    const deallocated = typeMap['deallocate'] || 0;
    const shipped = typeMap['ship'] || 0;

    // Available = allocated - deallocated - shipped
    // (or: allocated - (deallocated + shipped))
    const available = allocated - deallocated - shipped;

    return Math.max(0, available);
  }

  /**
   * Allocate inventory for an order (new → processing)
   * Throws InsufficientInventoryError if not enough inventory
   */
  async allocateInventory(orderId: string, productId: string, quantity: number): Promise<void> {
    const available = await this.getInventoryBalance(productId);

    if (available < quantity) {
      throw new InsufficientInventoryError(productId, quantity, available);
    }

    // Record allocation in ledger
    await prisma.inventoryLedger.create({
      data: {
        orderId,
        productId,
        type: 'allocate',
        quantity,
      },
    });
  }

  /**
   * Deallocate inventory for canceled order (processing → canceled)
   */
  async deallocateInventory(orderId: string, productId: string, quantity: number): Promise<void> {
    await prisma.inventoryLedger.create({
      data: {
        orderId,
        productId,
        type: 'deallocate',
        quantity,
      },
    });
  }

  /**
   * Record shipment in inventory ledger (processing → shipped)
   */
  async recordShipment(orderId: string, productId: string, quantity: number): Promise<void> {
    await prisma.inventoryLedger.create({
      data: {
        orderId,
        productId,
        type: 'ship',
        quantity,
      },
    });
  }

  /**
   * Get inventory ledger history for an order
   */
  async getOrderInventoryHistory(orderId: string) {
    return prisma.inventoryLedger.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const inventoryService = new InventoryService();
