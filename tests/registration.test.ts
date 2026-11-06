import { describe, expect, it } from "vitest";
import { calculateAmount, categoryIds, registrationSchema } from "@/lib/registration";

const valid = {
  fullName: "Atleta Teste", nickname: "", address: "Rua de Teste, 100",
  trainingPlace: "Arena Teste", birthDate: "2000-01-31", email: "athlete@example.org",
  stages: [], categories: ["masculino-c"],
};

describe("preço", () => {
  it("aceita zero sem gerar cobrança", () => expect(calculateAmount(0)).toBe(0));
  it.each([6000, 10000, 14000, 18000, 22000, 26000, 30000, 34000])(
    "calcula o valor da quantidade de categorias: %i centavos",
    (amount) => expect(calculateAmount((amount - 6000) / 4000 + 1)).toBe(amount),
  );
  it.each([-1, 9, 1.5, NaN, Infinity])("rejeita quantidade inválida %s", (count) => {
    expect(() => calculateAmount(count)).toThrow();
  });
});

describe("validação de inscrição", () => {
  it("aceita dados válidos sem apelido nem etapas", () => expect(registrationSchema.safeParse(valid).success).toBe(true));
  it("aceita todas as oito categorias", () => expect(registrationSchema.safeParse({ ...valid, categories: categoryIds }).success).toBe(true));
  it.each(["2026-02-30", "2025-02-29", "2999-01-01", "1899-12-31", "2026-13-01", ""])(
    "rejeita nascimento inválido %s", (birthDate) => expect(registrationSchema.safeParse({ ...valid, birthDate }).success).toBe(false),
  );
  it("aceita dia bissexto real", () => expect(registrationSchema.safeParse({ ...valid, birthDate: "2000-02-29" }).success).toBe(true));
  it.each([
    { fullName: "Atleta" }, { fullName: "" }, { email: "invalido" }, { categories: [] },
    { categories: ["inexistente"] }, { categories: ["masculino-c", "masculino-c"] },
    { stages: ["Primeira", "Primeira"] }, { stages: ["Quarta"] },
    { trainingPlace: "" }, { address: "" }, { fullName: "Atleta\nTeste" }, { amountCents: 1 },
  ])("rejeita dados inválidos %j", (patch) => expect(registrationSchema.safeParse({ ...valid, ...patch }).success).toBe(false));
});
