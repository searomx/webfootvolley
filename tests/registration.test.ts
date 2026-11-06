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
  it("aceita parceiros opcionais e normaliza nomes", () => {
    expect(registrationSchema.parse(valid).partners).toEqual([]);
    expect(registrationSchema.parse({
      ...valid, partners: [{ categoryId: "masculino-c", player1Id: "  Parceiro Teste  " }],
    }).partners[0].player1Id).toBe("Parceiro Teste");
    expect(registrationSchema.safeParse({
      ...valid, partners: [{ categoryId: "masculino-c", player1Id: "" }],
    }).success).toBe(true);
  });
  it.each(["Parceiro", "A B".repeat(51), "Parceiro\nTeste"])("rejeita nome de parceiro inválido %s", (player1Id) => {
    const result = registrationSchema.safeParse({
      ...valid, partners: [{ categoryId: "masculino-c", player1Id }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["partners", 0, "player1Id"]);
  });
  it("aceita nome no limite de 150 caracteres", () => {
    expect(registrationSchema.safeParse({
      ...valid, partners: [{ categoryId: "masculino-c", player1Id: `A ${"B".repeat(148)}` }],
    }).success).toBe(true);
  });
  it.each([
    [{ categoryId: "misto-b", player1Id: "Parceiro Teste" }],
    [{ categoryId: "inexistente", player1Id: "Parceiro Teste" }],
    [
      { categoryId: "masculino-c", player1Id: "Parceiro Um" },
      { categoryId: "masculino-c", player1Id: "Parceiro Dois" },
    ],
  ])("rejeita parceiros em categorias não selecionadas ou duplicadas %j", (...partners) => {
    expect(registrationSchema.safeParse({ ...valid, partners }).success).toBe(false);
  });
  it("aceita dados válidos sem apelido nem etapas", () => expect(registrationSchema.safeParse(valid).success).toBe(true));
  it("aceita telefone opcional ausente ou em branco", () => {
    expect(registrationSchema.parse(valid).phone).toBe("");
    expect(registrationSchema.parse({ ...valid, phone: "" }).phone).toBe("");
  });
  it("aceita telefone informado dentro do limite", () => {
    expect(registrationSchema.parse({ ...valid, phone: "(11) 99999-1234" }).phone).toBe("(11) 99999-1234");
  });
  it("rejeita telefone acima do limite", () => {
    expect(registrationSchema.safeParse({ ...valid, phone: "1".repeat(21) }).success).toBe(false);
  });
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
