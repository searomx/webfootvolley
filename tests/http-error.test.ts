import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { errorResponse } from "@/lib/server/http";

afterEach(() => vi.restoreAllMocks());

describe("diagnóstico seguro de erros do servidor", () => {
  it("registra o código Prisma sem expor mensagem ou metadados", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Prisma.PrismaClientKnownRequestError("Detalhes privados do banco", {
      code: "P2022", clientVersion: "test", meta: { column: "coluna privada" },
    });
    const response = errorResponse(error, "registrations");
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "[registrations] Falha interna (PrismaClientKnownRequestError; código P2022).",
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "Não foi possível concluir a operação. Tente novamente.",
    });
  });

  it("preserva o diagnóstico genérico para outros erros", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(errorResponse(new Error("Detalhes privados"), "registrations").status).toBe(500);
    expect(log).toHaveBeenCalledExactlyOnceWith("[registrations] Falha interna (Error).");
  });
});
