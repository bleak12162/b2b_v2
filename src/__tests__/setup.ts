import { vi } from 'vitest';

// Mock Prisma for testing
export const mockPrisma = {
  company: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  productSpecialPrice: {
    findMany: vi.fn(),
  },
  order: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  orderItem: {
    findMany: vi.fn(),
  },
  inventoryLedger: {
    create: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  shipTo: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

export function resetAllMocks() {
  Object.values(mockPrisma).forEach(module => {
    Object.values(module).forEach(fn => {
      if (typeof fn === 'object' && 'mockReset' in fn) {
        (fn as any).mockReset();
      }
    });
  });
}
