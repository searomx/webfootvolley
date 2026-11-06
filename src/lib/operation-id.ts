import { z } from "zod";

export const operationStorageKey = "footvolley-registration-operation";

export function getOperationId(storage: Pick<Storage, "getItem" | "setItem">) {
  const existing = storage.getItem(operationStorageKey);
  if (existing) {
    if (!z.uuid().safeParse(existing).success) {
      throw new Error("Protocolo local inválido. Contate a organização antes de reenviar.");
    }
    return existing;
  }
  const id = crypto.randomUUID();
  storage.setItem(operationStorageKey, id);
  return id;
}
