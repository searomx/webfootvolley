import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { categories, formatMoney } from "@/lib/registration";
import type { Registration } from "@/generated/prisma/client";

export async function createRegistrationPdf(registration: Registration) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const bytes = await readFile(path.join(
    process.cwd(), "node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff",
  ));
  const font = await document.embedFont(bytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  let page = document.addPage([595.28, 841.89]);
  let y = 788;

  function line(value: string, size = 11) {
    for (const char of value) {
      if (!supported.has(char.codePointAt(0)!)) {
        throw new Error("O PDF não suporta um dos caracteres informados.");
      }
    }
    let current = "";
    const lines: string[] = [];
    for (const word of value.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= 490) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(current + char, size) > 490) {
            lines.push(current);
            current = "";
          }
          current += char;
        }
      }
    }
    if (current) lines.push(current);
    for (const text of lines) {
      if (y < 60) { page = document.addPage([595.28, 841.89]); y = 788; }
      page.drawText(text, { x: 50, y, size, font, color: rgb(0.09, 0.19, 0.17) });
      y -= size + 9;
    }
  }

  document.setTitle("Inscrição Footvolley 2026");
  line("Inscrição Footvolley 2026", 22);
  line("PAGAMENTO PENDENTE", 13);
  line("Este documento registra a inscrição. Não é comprovante de pagamento.");
  y -= 12;
  line(`Inscrição: ${registration.id}`);
  line(`Data: ${registration.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  line(`Nome completo: ${registration.fullName}`);
  line(`Apelido: ${registration.nickname || "Não informado"}`);
  line(`Endereço: ${registration.address}`);
  line(`Onde treina: ${registration.trainingPlace}`);
  line(`Nascimento: ${registration.birthDate.toISOString().slice(0, 10).split("-").reverse().join("/")}`);
  line(`Telefone: ${registration.phone || "Não informado"}`);
  line(`E-mail: ${registration.email}`);
  line(`Etapas em 2026: ${registration.stages.join(", ") || "Não participou"}`);
  y -= 12;
  line("Categorias selecionadas", 14);
  for (const category of categories.filter((item) => registration.categories.includes(item.id))) {
    line(`${category.date}/2026 - ${category.time} - ${category.name}`);
  }
  y -= 12;
  line(`Total: ${formatMoney(registration.amountCents)}`, 16);
  line("Primeira categoria: R$ 60,00. Cada categoria adicional: R$ 40,00.");
  return Buffer.from(await document.save());
}
