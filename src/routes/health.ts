import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (request, reply) => {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
    };
  });
}
