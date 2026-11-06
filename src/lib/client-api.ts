import { z } from "zod";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }

  get allowsCorrection() {
    return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429;
  }
}

export async function postJson(url: string, body: unknown, signal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 55000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      let message = "Resposta inesperada do servidor. Tente novamente ou contate a organização.";
      if (response.headers.get("content-type")?.includes("application/json")) {
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
          throw new ApiError(response.status, "O servidor enviou uma resposta inválida. Tente novamente ou contate a organização.");
        }
        const parsed = z.object({ message: z.string() }).safeParse(data);
        if (parsed.success) message = parsed.data.message;
      }
      throw new ApiError(response.status, message);
    }
    return await response.json() as unknown;
  } catch (error) {
    if (timedOut) {
      throw new Error("O servidor demorou para responder. Tente novamente; o mesmo protocolo será utilizado.");
    }
    if (error instanceof SyntaxError) {
      throw new Error("O servidor enviou uma resposta inválida. Tente novamente ou contate a organização.");
    }
    if (error instanceof TypeError) {
      throw new Error("Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
