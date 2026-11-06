import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, postJson } from "@/lib/client-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("comunicação com o servidor", () => {
  it.each([400, 409, 422])("preserva HTTP %s e permite correção", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "Corrija os dados." }, { status })));
    const error = await postJson("/api/registrations", {}).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, message: "Corrija os dados.", allowsCorrection: true });
  });

  it.each([408, 429, 500, 503])("não libera operação incerta ou limitada: HTTP %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "Tente novamente." }, { status })));
    await expect(postJson("/api/registrations", {})).rejects.toMatchObject({ status, allowsCorrection: false });
  });

  it("explica resposta malformada sem perder a rejeição HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{", {
      status: 409, headers: { "Content-Type": "application/json" },
    })));
    await expect(postJson("/api/registrations", {})).rejects.toMatchObject({
      status: 409, allowsCorrection: true, message: expect.stringContaining("resposta inválida"),
    });
  });

  it("explica sucesso com corpo inválido sem alegar confirmação", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>erro</html>")));
    await expect(postJson("/api/registrations", {})).rejects.toThrow("resposta inválida");
  });

  it("explica erro de conexão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(postJson("/api/registrations", {})).rejects.toThrow("Confira sua conexão");
  });

  it("limita a espera a 55 segundos e orienta retry com o mesmo protocolo", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const request = expect(postJson("/api/registrations", {})).rejects.toThrow("mesmo protocolo");
    await vi.advanceTimersByTimeAsync(55000);
    await request;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("encaminha cancelamento externo e remove temporizadores", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const request = expect(postJson("/api/pix", {}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await request;
    expect(vi.getTimerCount()).toBe(0);
  });
});
