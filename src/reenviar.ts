import { BadGatewayException, HttpException } from '@nestjs/common';

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Reenvía la petición con el mismo Authorization y devuelve el cuerpo JSON.
// Si el servicio responde con error, se propaga el mismo código (409 sigue siendo 409).
export async function reenviar<T = unknown>(
  baseUrl: string,
  metodo: Metodo,
  ruta: string,
  authorization: string | undefined,
  cuerpo?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${ruta}`, {
      method: metodo,
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    throw new BadGatewayException(`No se pudo contactar ${baseUrl}: ${motivo}`);
  }
  const texto = await res.text();
  let datos: unknown = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }
  if (!res.ok) throw new HttpException(datos ?? res.statusText, res.status);
  return datos as T;
}