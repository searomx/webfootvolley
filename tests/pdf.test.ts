import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import type { Registration } from "@/generated/prisma/client";
import { createRegistrationPdf } from "@/lib/server/pdf";

const registration: Registration = {
  id: "registration-id",
  requestId: "00000000-0000-4000-8000-000000000001",
  fingerprint: "fingerprint",
  fullName: "Atleta Teste",
  nickname: "",
  address: "Rua de Teste, 100",
  trainingPlace: "Arena Teste",
  birthDate: new Date("2000-01-01T00:00:00.000Z"),
  phone: null,
  email: "atleta@example.org",
  stages: [],
  categories: ["masculino-c"],
  pairOfPlayersId: null,
  amountCents: 6000,
  paymentStatus: "PENDING",
  emailStatus: "SENT",
  emailLeaseAt: null,
  emailSentAt: null,
  createdAt: new Date("2026-11-06T12:00:00.000Z"),
  updatedAt: new Date("2026-11-06T12:00:00.000Z"),
};

afterEach(() => vi.restoreAllMocks());

describe("telefone no PDF da inscrição", () => {
  it.each([
    ["(11) 99999-1234", "Telefone: (11) 99999-1234"],
    [null, "Telefone: Não informado"],
  ])("inclui %s no documento", async (phone, expectedLine) => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    await createRegistrationPdf({ ...registration, phone });
    expect(drawText.mock.calls.map(([text]) => text)).toContain(expectedLine);
  });
});
