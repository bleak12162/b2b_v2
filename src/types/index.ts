// Error types
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// API Response types
export interface SuccessResponse<T> {
  data: T;
}

// Order status enum
export enum OrderStatus {
  NEW = 'new',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

// Pricing types
export interface EffectivePrice {
  basePrice: number;
  specialPrice?: number;
  effectivePrice: number;
  isSpecial: boolean;
}

// Inventory types
export interface InventoryOperation {
  type: 'allocate' | 'deallocate' | 'ship';
  quantity: number;
}
