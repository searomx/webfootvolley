import "server-only";
import { createHash } from "node:crypto";
import { calculateAmount, type Athlete, type RegistrationResult } from "@/lib/registration";
import { getDb } from "./db";
import { HttpError } from "./http";
import { ConfigurationError } from "./config";
import { sendRegistrationEmail } from "./email";

export async function registerAthlete(requestId: string, athlete: Athlete): Promise<RegistrationResult> {
  const db = getDb();
  const { partners: submittedPartners, ...athleteData } = athlete;
  const partners = submittedPartners.filter((partner) => partner.player1Id !== "")
    .sort((left, right) => left.categoryId.localeCompare(right.categoryId));
  const fingerprint = createHash("sha256").update(JSON.stringify({
    ...athleteData, stages: [...athlete.stages].sort(), categories: [...athlete.categories].sort(),
    ...(partners.length ? { partners } : {}),
  })).digest("hex");
  const registration = await db.$transaction(async (transaction) => {
    const created = await transaction.registration.createMany({
      data: {
        ...athleteData,
        phone: athlete.phone || null,
        requestId,
        fingerprint,
        birthDate: new Date(`${athlete.birthDate}T00:00:00.000Z`),
        amountCents: calculateAmount(athlete.categories.length),
      },
      skipDuplicates: true,
    });
    const saved = await transaction.registration.findUniqueOrThrow({ where: { requestId } });
    if (saved.fingerprint !== fingerprint) {
      throw new HttpError(409, "Esta operação já registrou outros dados. Reenvie os dados originais.");
    }
    if (created.count && partners.length) {
      await transaction.pairOfPlayers.createMany({
        data: partners.map((partner) => ({ ...partner, registrationId: saved.id })),
      });
    }
    return transaction.registration.findUniqueOrThrow({
      where: { requestId }, include: { categoryPartners: true },
    });
  });
  const result = { id: registration.id, amountCents: registration.amountCents };
  if (registration.emailStatus === "SENT") {
    return { ...result, emailStatus: "SENT", message: "Inscrição registrada e PDF aceito pelo servidor de e-mail da organização. Pagamento pendente." };
  }
  const lease = new Date();
  const claimed = await db.registration.updateMany({
    where: {
      id: registration.id,
      OR: [
        { emailStatus: { in: ["PENDING", "FAILED"] } },
        { emailStatus: "SENDING", emailLeaseAt: { lt: new Date(lease.getTime() - 120000) } },
      ],
    },
    data: { emailStatus: "SENDING", emailLeaseAt: lease },
  });
  if (!claimed.count) {
    return { ...result, emailStatus: "SENDING", message: "Inscrição salva. O envio do PDF está em andamento. Aguarde e consulte novamente pelo botão." };
  }
  try {
    await sendRegistrationEmail(registration);
    const sent = await db.registration.updateMany({
      where: { id: registration.id, emailStatus: "SENDING", emailLeaseAt: lease },
      data: { emailStatus: "SENT", emailSentAt: new Date(), emailLeaseAt: null },
    });
    if (sent.count !== 1) throw new Error("A reserva do envio foi alterada antes da confirmação.");
    return { ...result, emailStatus: "SENT", message: "Inscrição registrada e PDF aceito pelo servidor de e-mail da organização. Pagamento pendente." };
  } catch (error) {
    console.error(`[registration-email] ${registration.id}: ${error instanceof ConfigurationError ? error.setting : error instanceof Error ? error.name : "UnknownError"}.`);
    await db.registration.updateMany({
      where: { id: registration.id, emailStatus: "SENDING", emailLeaseAt: lease },
      data: { emailStatus: "FAILED", emailLeaseAt: null },
    });
    return { ...result, emailStatus: "FAILED", message: "Inscrição salva, mas o PDF não foi enviado. Use o botão para tentar novamente ou contate a organização. Pagamento pendente." };
  }
}
