/** Las mutaciones de la web solo aceptan formularios enviados desde su mismo origen. */
export function isSameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('origin') === url.origin;
}
