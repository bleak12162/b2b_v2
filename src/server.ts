import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  ZodTypeProvider,
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod';
import { ZodError, z } from 'zod';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import { AppError } from './errors.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import shipToRoutes from './routes/shipto.js';

export const buildServer = () => {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug'
    }
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn({ err: error }, 'application_error');
      return reply.status(error.statusCode).send({ error: error.toPayload() });
    }

    if (error instanceof ZodError) {
      request.log.warn({ err: error }, 'validation_error');
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten()
        }
      });
    }

    request.log.error({ err: error }, 'unhandled_error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected error occurred'
      }
    });
  });

  app.get(
    '/health',
    {
      schema: {
        response: {
          200: z.object({ ok: z.boolean() })
        }
      }
    },
    async () => ({ ok: true })
  );

  app.register(productsRoutes);
  app.register(ordersRoutes);
  app.register(shipToRoutes);

  return app;
};

export type AppServer = ReturnType<typeof buildServer>;

const isMain = (() => {
  if (!process.argv[1]) return false;
  const currentPath = fileURLToPath(import.meta.url);
  return currentPath === process.argv[1];
})();

if (isMain) {
  const app = buildServer();
  const port = env.PORT;
  const host = '0.0.0.0';

  app
    .listen({ port, host })
    .then(() => {
      app.log.info(`Server running on http://${host}:${port}`);
    })
    .catch((error) => {
      app.log.error(error, 'Failed to start server');
      process.exit(1);
    });
}
