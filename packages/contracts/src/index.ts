import { z } from 'zod';

/** Contratos compartidos por la API, la web y el adaptador MCP. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
