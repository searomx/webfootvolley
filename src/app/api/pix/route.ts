import QRCode from "qrcode";
import { z } from "zod";
import { calculateAmount, categoryIds } from "@/lib/registration";
import { createPixPayload } from "@/lib/pix";
import { ConfigurationError, requiredSetting } from "@/lib/server/config";
import { HttpError, readJson, errorResponse } from "@/lib/server/http";

const schema = z.object({
  categories: z.array(z.enum(categoryIds)).min(1).max(8)
    .refine((values) => new Set(values).size === values.length),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "Selecione categorias válidas para gerar o Pix.");
    const amountCents = calculateAmount(parsed.data.categories.length);
    let payload: string;
    try {
      payload = createPixPayload({
        key: requiredSetting("PIX_KEY"),
        name: requiredSetting("PIX_MERCHANT_NAME"),
        city: requiredSetting("PIX_MERCHANT_CITY"),
      }, amountCents);
    } catch (error) {
      if (error instanceof z.ZodError) throw new ConfigurationError("PIX_KEY / PIX_MERCHANT_NAME / PIX_MERCHANT_CITY");
      throw error;
    }
    const qrCode = await QRCode.toDataURL(payload, { width: 256, margin: 4, errorCorrectionLevel: "M" });
    return Response.json({ payload, qrCode, amountCents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "pix");
  }
}
