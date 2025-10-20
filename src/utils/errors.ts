export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`, 404);
  }
}

export class PermissionError extends AppError {
  constructor(message: string = 'Permission denied') {
    super('PERMISSION_DENIED', message, 403);
  }
}

export class InsufficientInventoryError extends AppError {
  constructor(productId: string, required: number, available: number) {
    super(
      'INVENTORY_INSUFFICIENT',
      `Insufficient inventory for product ${productId}. Required: ${required}, Available: ${available}`,
      422,
      { productId, required, available }
    );
  }
}

export class DuplicateError extends AppError {
  constructor(field: string, value: string) {
    super('DUPLICATE', `${field} already exists: ${value}`, 409);
  }
}
