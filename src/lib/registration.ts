import { z } from "zod";

export const categories = [
  { id: "masculino-c", date: "28/11", time: "09h", name: "Masculino C" },
  { id: "masculino-b", date: "28/11", time: "12h", name: "Masculino B" },
  { id: "masculino-a", date: "28/11", time: "13h", name: "Masculino A" },
  { id: "misto-b", date: "28/11", time: "15h", name: "Misto B" },
  { id: "feminino-c", date: "29/11", time: "09h", name: "Feminino C" },
  { id: "feminino-b", date: "29/11", time: "11h", name: "Feminino B" },
  { id: "feminino-a", date: "29/11", time: "12h", name: "Feminino A" },
  { id: "misto-a", date: "29/11", time: "13h30", name: "Misto A" },
] as const;

export const categoryIds = categories.map((category) => category.id);
export const stageNames = ["Primeira", "Segunda", "Terceira"] as const;
export type CategoryId = (typeof categoryIds)[number];

const text = (min: number, max: number) => z.string().trim()
  .min(min, `Informe pelo menos ${min} caracteres.`)
  .max(max, `Use no máximo ${max} caracteres.`)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Remova os caracteres de controle.");

const partnerSchema = z.object({
  categoryId: z.enum(categoryIds),
  player1Id: text(0, 150).refine(
    (value) => value === "" || (value.length >= 3 && value.split(/\s+/).length >= 2),
    "Informe nome e sobrenome do parceiro.",
  ),
}).strict();

export const registrationSchema = z.object({
  fullName: text(3, 150).refine((value) => value.split(/\s+/).length >= 2, "Informe nome e sobrenome."),
  nickname: text(0, 80),
  address: text(5, 300),
  trainingPlace: text(2, 150),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value &&
        value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10);
    }, "Informe uma data de nascimento válida, não futura."),
  phone: text(0, 20).default(""),
  email: z.email("Informe um e-mail válido.").max(254),
  stages: z.array(z.enum(stageNames)).max(3)
    .refine((values) => new Set(values).size === values.length, "Etapas duplicadas."),
  categories: z.array(z.enum(categoryIds)).min(1, "Selecione pelo menos uma categoria.").max(8)
    .refine((values) => new Set(values).size === values.length, "Categorias duplicadas."),
  partners: z.array(partnerSchema).max(8).default([]),
}).strict().superRefine((athlete, context) => {
  const seen = new Set<CategoryId>();
  athlete.partners.forEach((partner, index) => {
    if (!athlete.categories.includes(partner.categoryId) || seen.has(partner.categoryId)) {
      context.addIssue({
        code: "custom",
        path: ["partners", index, "player1Id"],
        message: "Informe apenas um parceiro por categoria selecionada.",
      });
    }
    seen.add(partner.categoryId);
  });
});

export const submissionSchema = z.object({
  requestId: z.uuid(),
  athlete: registrationSchema,
  website: z.literal(""),
}).strict();

export type Athlete = z.infer<typeof registrationSchema>;

export function calculateAmount(count: number) {
  if (!Number.isInteger(count) || count < 0 || count > categories.length) {
    throw new RangeError("Quantidade de categorias inválida.");
  }
  return count === 0 ? 0 : 6000 + (count - 1) * 4000;
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export const registrationResultSchema = z.object({
  id: z.string(),
  amountCents: z.number().int(),
  emailStatus: z.enum(["SENT", "FAILED", "SENDING"]),
  message: z.string(),
});
export type RegistrationResult = z.infer<typeof registrationResultSchema>;

export const pixResultSchema = z.object({
  payload: z.string(),
  qrCode: z.string().startsWith("data:image/png;base64,"),
  amountCents: z.number().int(),
});
