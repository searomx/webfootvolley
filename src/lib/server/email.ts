import "server-only";
import nodemailer from "nodemailer";
import { ConfigurationError, emailSetting, requiredSetting } from "./config";
import { createRegistrationPdf } from "./pdf";
import type { Registration } from "@/generated/prisma/client";

export async function sendRegistrationEmail(registration: Registration) {
  const port = Number(requiredSetting("SMTP_PORT"));
  const secure = requiredSetting("SMTP_SECURE");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigurationError("SMTP_PORT");
  if (secure !== "true" && secure !== "false") throw new ConfigurationError("SMTP_SECURE");
  const from = emailSetting("SMTP_FROM");
  const to = emailSetting("REGISTRATION_EMAIL");
  const pdf = await createRegistrationPdf(registration);
  const transporter = nodemailer.createTransport({
    host: requiredSetting("SMTP_HOST"),
    port,
    secure: secure === "true",
    requireTLS: secure === "false" && process.env.NODE_ENV === "production",
    auth: { user: requiredSetting("SMTP_USER"), pass: requiredSetting("SMTP_PASS") },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
  const info = await transporter.sendMail({
    from, to,
    messageId: `<registration-${registration.id}@${from.split("@")[1]}>`,
    subject: `Inscrição Footvolley 2026 - ${registration.id}`,
    text: "Nova inscrição registrada. O PDF segue em anexo. Status: pagamento pendente. Este envio não confirma pagamento.",
    attachments: [{ filename: `inscricao-${registration.id}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  if (!info.accepted.some((address: string) => address.toLowerCase() === to.toLowerCase())) {
    throw new Error("Servidor SMTP não aceitou o destinatário.");
  }
}
