import Fastify from 'fastify';
import { healthRoutes } from './routes/health.js';
import { productRoutes } from './routes/products.js';
import { orderRoutes } from './routes/orders.js';
import { shipToRoutes } from './routes/shiptos.js';
import { AppError } from './utils/errors.js';
import type { ErrorResponse } from './types/index.js';

const app = Fastify({
  logger: true,
});

// Register routes
await healthRoutes(app);
await productRoutes(app);
await orderRoutes(app);
await shipToRoutes(app);

// Global error handler
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    } as ErrorResponse);
  } else if (error.name === 'ZodError') {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: (error as any).issues,
      },
    } as ErrorResponse);
  } else {
    app.log.error(error);
    reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? { message: error.message } : undefined,
      },
    } as ErrorResponse);
  }
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`Server running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
