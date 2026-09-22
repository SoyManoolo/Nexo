import { NexoApiError } from '@nexo/api-client';

export function formError(error: unknown, invalidMessage: string): { status: number; message: string } {
  if (error instanceof NexoApiError) {
    if (error.status === 400) return { status: 400, message: invalidMessage };
    if (error.status === 404) return { status: 404, message: 'El recurso ya no existe. Actualiza la página.' };
    if (error.status === 409) return { status: 409, message: 'Los datos entran en conflicto con otro cambio. Actualiza la página.' };
  }

  if (error instanceof Error && (error.name === 'ZodError' || error instanceof RangeError)) {
    return { status: 400, message: invalidMessage };
  }

  return { status: 503, message: 'El servicio no está disponible. Vuelve a intentarlo en unos momentos.' };
}
