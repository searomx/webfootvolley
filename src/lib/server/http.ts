import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { ConfigurationError } from "./config";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function readJson(request: Request) {
  const expectedOrigin = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin) {
    throw new HttpError(403, "Origem da requisição não permitida.");
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "Envie dados em formato JSON.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Requisição sem conteúdo.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new HttpError(413, "Formulário excedeu o tamanho permitido.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}

export async function limitRequests(request: Request, scope: string, limit: number) {
  const minute = Math.floor(Date.now() / 60000);
  const trustedAddress = process.env.TRUST_PROXY === "true"
    ? request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    : undefined;
  const identity = createHash("sha256").update(trustedAddress || "global").digest("hex");
  const db = getDb();
  const bucket = await db.requestBucket.upsert({
    where: { key: `${scope}:${identity}:${minute}` },
    create: { key: `${scope}:${identity}:${minute}`, expiresAt: new Date((minute + 2) * 60000) },
    update: { count: { increment: 1 } },
  });
  await db.requestBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  if (bucket.count > limit) throw new HttpError(429, "Muitas tentativas. Aguarde um minuto e tente novamente.");
}

export function errorResponse(error: unknown, operation: string) {
  if (error instanceof HttpError) {
    console.warn(`[${operation}] Requisição rejeitada: HTTP ${error.status}.`);
    return Response.json({ message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof ConfigurationError) {
    console.error(`[${operation}] Configuração inválida: ${error.setting}.`);
    return Response.json({ message: "Serviço não configurado. Entre em contato com a organização." }, { status: 503 });
  }
  console.error(`[${operation}] Falha interna (${error instanceof Error ? error.name : "UnknownError"}).`);
  return Response.json({ message: "Não foi possível concluir a operação. Tente novamente." }, { status: 500 });
}
