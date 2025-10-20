import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PricingService } from '../PricingService.js';
import * as db from '../../db/client.js';

vi.mock('../../db/client.js');

describe('PricingService', () => {
  let service: PricingService;
  let mockPrisma: any;

  beforeEach(() => {
    service = new PricingService();
    mockPrisma = db.default;
  });

  describe('calculateOrderTotal', () => {
    it('should calculate total correctly without discount', () => {
      const items = [
        { quantity: 2, unitPrice: 100 },
        { quantity: 3, unitPrice: 50 },
      ];

      const result = service.calculateOrderTotal(items, 0);

      expect(result).toBe(350);
    });

    it('should calculate total with discount', () => {
      const items = [{ quantity: 2, unitPrice: 100 }];
      const discountAmount = 50;

      const result = service.calculateOrderTotal(items, discountAmount);

      expect(result).toBe(150);
    });

    it('should not go below zero with large discount', () => {
      const items = [{ quantity: 1, unitPrice: 50 }];
      const discountAmount = 100;

      const result = service.calculateOrderTotal(items, discountAmount);

      expect(result).toBe(0);
    });

    it('should handle empty items array', () => {
      const result = service.calculateOrderTotal([], 0);
      expect(result).toBe(0);
    });
  });
});
