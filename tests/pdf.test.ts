import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import { createRegistrationPdf, type RegistrationWithPartners } from "@/lib/server/pdf";

const registration: RegistrationWithPartners = {
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
  categoryPartners: [],
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

  describe("parceiros por categoria no PDF", () => {
    it("mostra cada parceiro na categoria correspondente e indica parceiros ausentes", async () => {
      const drawText = vi.spyOn(PDFPage.prototype, "drawText");
      await createRegistrationPdf({
        ...registration,
        categories: ["masculino-c", "misto-b", "feminino-c"],
        categoryPartners: [
          {
            id: "pair-1", player1Id: "Parceiro Masculino", categoryId: "masculino-c",
            registrationId: registration.id, createdAt: registration.createdAt, updatedAt: registration.updatedAt,
          },
          {
            id: "pair-2", player1Id: "Parceira Misto", categoryId: "misto-b",
            registrationId: registration.id, createdAt: registration.createdAt, updatedAt: registration.updatedAt,
          },
        ],
      });
      const lines = drawText.mock.calls.map(([text]) => text);
      expect(lines[lines.indexOf("28/11/2026 - 09h - Masculino C") + 1]).toBe("Parceiro: Parceiro Masculino");
      expect(lines[lines.indexOf("28/11/2026 - 15h - Misto B") + 1]).toBe("Parceiro: Parceira Misto");
      expect(lines[lines.indexOf("29/11/2026 - 09h - Feminino C") + 1]).toBe("Parceiro: Não informado");
    });
  });
});
