import { afterEach, describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { categoryIds, pixResultSchema } from "@/lib/registration";
import { crc16, createPixPayload } from "@/lib/pix";
import { POST } from "@/app/api/pix/route";

function parseFields(payload: string) {
  const result: Record<string, string> = {};
  let offset = 0;
  while (offset < payload.length) {
    const id = payload.slice(offset, offset + 2);
    const length = Number(payload.slice(offset + 2, offset + 4));
    result[id] = payload.slice(offset + 4, offset + 4 + length);
    offset += length + 4;
  }
  expect(offset).toBe(payload.length);
  return result;
}

afterEach(() => vi.unstubAllEnvs());

describe("Pix BR Code", () => {
  it("confere vetor de teste independente do CRC", () => expect(crc16("123456789")).toBe("29B1"));
  it.each([6000, 10000, 14000, 18000, 22000, 26000, 30000, 34000])("codifica valor %i", (amount) => {
    const payload = createPixPayload({ key: "pix@example.org", name: "Organização", city: "São Paulo" }, amount);
    const fields = parseFields(payload);
    expect(fields["00"]).toBe("01");
    expect(fields["53"]).toBe("986");
    expect(fields["54"]).toBe((amount / 100).toFixed(2));
    expect(fields["58"]).toBe("BR");
    expect(fields["59"]).toBe("ORGANIZACAO");
    expect(fields["60"]).toBe("SAO PAULO");
    expect(parseFields(fields["26"])["01"]).toBe("pix@example.org");
    expect(fields["63"]).toBe(crc16(payload.slice(0, -4)));
  });
  it("não gera cobrança sem valor", () => {
    expect(() => createPixPayload({ key: "pix@example.org", name: "TESTE", city: "TESTE" }, 0)).toThrow();
  });
  it("rejeita nome do recebedor acima do limite, sem truncar", () => {
    expect(() => createPixPayload({ key: "pix@example.org", name: "X".repeat(26), city: "TESTE" }, 6000)).toThrow();
  });
  it.each([1, 2, 8])("decodifica o QR real para %i categorias", async (count) => {
    vi.stubEnv("PIX_KEY", "pix@example.org");
    vi.stubEnv("PIX_MERCHANT_NAME", "ORGANIZACAO TESTE");
    vi.stubEnv("PIX_MERCHANT_CITY", "SAO PAULO");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    const response = await POST(new Request("http://localhost:3000/api/pix", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ categories: categoryIds.slice(0, count) }),
    }));
    expect(response.status).toBe(200);
    const data = pixResultSchema.parse(await response.json());
    const image = PNG.sync.read(Buffer.from(data.qrCode.split(",")[1], "base64"));
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
    expect(decoded?.data).toBe(data.payload);
    expect(parseFields(decoded!.data)["54"]).toBe(((6000 + (count - 1) * 4000) / 100).toFixed(2));
  });
  it("informa erro explícito sem configuração do recebedor", async () => {
    vi.stubEnv("PIX_MERCHANT_NAME", "");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    const response = await POST(new Request("http://localhost:3000/api/pix", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ categories: ["masculino-c"] }),
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty("message");
  });
});
