import { z } from "zod";

function field(id: string, value: string) {
  const length = Buffer.byteLength(value, "utf8");
  if (length > 99) throw new Error("Campo Pix excedeu o tamanho permitido.");
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

export function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const pixConfigSchema = z.object({
  key: z.string().trim().min(1).max(77),
  name: z.string().trim().min(1).max(25).regex(/^[A-Z0-9 $%*+\-./:]+$/),
  city: z.string().trim().min(1).max(15).regex(/^[A-Z0-9 $%*+\-./:]+$/),
});

export function createPixPayload(config: { key: string; name: string; city: string }, amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Valor Pix inválido.");
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const parsed = pixConfigSchema.parse({
    ...config, name: normalized(config.name), city: normalized(config.city),
  });
  const account = field("00", "BR.GOV.BCB.PIX") + field("01", parsed.key);
  const payload = field("00", "01") + field("26", account) + field("52", "0000") +
    field("53", "986") + field("54", (amountCents / 100).toFixed(2)) +
    field("58", "BR") + field("59", parsed.name) + field("60", parsed.city) +
    field("62", field("05", "***")) + "6304";
  return payload + crc16(payload);
}
