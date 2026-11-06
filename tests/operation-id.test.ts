import { describe, expect, it } from "vitest";
import { getOperationId, operationStorageKey } from "@/lib/operation-id";

describe("protocolo de operação sem dados pessoais", () => {
  it("preserva o mesmo identificador após recarregar a página", () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
    };
    const firstPage = getOperationId(storage);
    expect(getOperationId(storage)).toBe(firstPage);
    expect([...entries.keys()]).toEqual([operationStorageKey]);
    expect(firstPage).toMatch(/^[0-9a-f-]{36}$/);
    entries.delete(operationStorageKey);
    expect(getOperationId(storage)).not.toBe(firstPage);
  });
  it("informa protocolo corrompido em vez de criar uma operação duplicada", () => {
    const storage = { getItem: () => "invalid", setItem: () => {} };
    expect(() => getOperationId(storage)).toThrow("Protocolo local inválido");
  });
  it("não envia inscrição sem poder preservar o protocolo", () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("Storage indisponível"); } };
    expect(() => getOperationId(storage)).toThrow("Storage indisponível");
  });
});
