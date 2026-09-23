import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const { id, attachmentId } = params;
  if (!id || !attachmentId || !/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(attachmentId)) {
    return new Response('Archivo no encontrado', { status: 404 });
  }

  const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
  const response = await fetch(`${baseUrl}/tasks/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`);
  if (!response.ok) return new Response('Archivo no disponible', { status: response.status });

  const headers = new Headers();
  for (const name of ['content-type', 'content-length', 'content-disposition', 'x-content-type-options']) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('cache-control', 'private, max-age=300');
  return new Response(response.body, { status: 200, headers });
};
