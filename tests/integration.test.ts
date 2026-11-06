import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { PDFDocument } from "pdf-lib";
import { getDb } from "@/lib/server/db";
import { POST } from "@/app/api/registrations/route";
import { registrationResultSchema } from "@/lib/registration";

const messages: Buffer[] = [];
let failEmail = false;
const smtp = new SMTPServer({
  disabledCommands: ["STARTTLS"],
  allowInsecureAuth: true,
  onAuth(auth, _session, callback) {
    if (auth.username !== "test-user" || auth.password !== "test-password") {
      return callback(new Error("Credenciais de teste inválidas."));
    }
    callback(null, { user: "test-user" });
  },
  onData(stream, _session, callback) {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => {
      if (failEmail) return callback(Object.assign(new Error("Falha SMTP simulada."), { responseCode: 550 }));
      messages.push(Buffer.concat(chunks));
      callback();
    });
    stream.on("error", callback);
  },
});

const athlete = {
  fullName: "João Atleta Teste", nickname: "Teste", address: "Rua de Teste, 100",
  trainingPlace: "Arena Teste", birthDate: "2000-02-29", phone: "(11) 99999-1234", email: "athlete@example.org",
  stages: ["Primeira", "Terceira"], categories: ["masculino-c", "misto-b"],
};

function request(requestId = randomUUID(), patch = {}) {
  return new Request("http://localhost:3000/api/registrations", {
    method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ requestId, athlete: { ...athlete, ...patch }, website: "" }),
  });
}

beforeAll(async () => {
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/footvolley_test");
  smtp.listen(0, "127.0.0.1");
  await once(smtp.server, "listening");
  const address = smtp.server.address();
  if (!address || typeof address === "string") throw new Error("Endereço SMTP de teste inválido.");
  vi.stubEnv("SMTP_HOST", "127.0.0.1");
  vi.stubEnv("SMTP_PORT", String(address.port));
  vi.stubEnv("SMTP_SECURE", "false");
  vi.stubEnv("SMTP_USER", "test-user");
  vi.stubEnv("SMTP_PASS", "test-password");
  vi.stubEnv("SMTP_FROM", "sender@example.org");
  vi.stubEnv("REGISTRATION_EMAIL", "organization@example.org");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
});

beforeEach(async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.now());
  messages.length = 0;
  failEmail = false;
  await getDb().registration.deleteMany();
  await getDb().requestBucket.deleteMany();
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await new Promise<void>((resolve) => smtp.close(resolve));
  await getDb().$disconnect();
  vi.unstubAllEnvs();
});

describe("inscrição com PostgreSQL e SMTP reais isolados", () => {
  it("persiste dados, calcula valor e envia PDF ao destinatário da organização", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const result = registrationResultSchema.parse(await response.json());
    expect(result.emailStatus).toBe("SENT");
    expect(result.amountCents).toBe(10000);
    const saved = await getDb().registration.findUniqueOrThrow({ where: { id: result.id } });
    expect(saved.paymentStatus).toBe("PENDING");
    expect(saved.fullName).toBe(athlete.fullName);
    expect(saved.phone).toBe(athlete.phone);
    expect(saved.emailStatus).toBe("SENT");
    expect(saved.birthDate.toISOString().slice(0, 10)).toBe("2000-02-29");
    expect(saved.stages).toEqual(athlete.stages);
    expect(messages).toHaveLength(1);
    const email = await simpleParser(messages[0]);
    expect(email.to).toMatchObject({ value: [{ address: "organization@example.org" }] });
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0].contentType).toBe("application/pdf");
    const document = await PDFDocument.load(email.attachments[0].content);
    expect(document.getTitle()).toBe("Inscrição Footvolley 2026");
    expect(document.getPageCount()).toBeGreaterThan(0);
  });
  it("submissões concorrentes não duplicam inscrição nem envio", async () => {
    const id = randomUUID();
    const responses = await Promise.all([POST(request(id)), POST(request(id))]);
    expect(responses.every((response) => [200, 202].includes(response.status))).toBe(true);
    expect(await getDb().registration.count()).toBe(1);
    expect(messages).toHaveLength(1);
    const retry = await POST(request(id));
    expect(retry.status).toBe(200);
    expect(messages).toHaveLength(1);
  });
  it("preserva inscrição na falha SMTP e permite reenvio sem novo cadastro", async () => {
    const id = randomUUID();
    failEmail = true;
    const response = await POST(request(id));
    expect(response.status).toBe(202);
    const result = registrationResultSchema.parse(await response.json());
    expect(result.emailStatus).toBe("FAILED");
    expect(await getDb().registration.count()).toBe(1);
    failEmail = false;
    const retry = await POST(request(id));
    const retried = registrationResultSchema.parse(await retry.json());
    expect(retried.id).toBe(result.id);
    expect(retried.emailStatus).toBe("SENT");
    expect(messages).toHaveLength(1);
    expect(await getDb().registration.count()).toBe(1);
  });
  it("rejeita alteração dos dados de uma operação já registrada", async () => {
    const id = randomUUID();
    await POST(request(id));
    expect((await POST(request(id, { fullName: "Outro Atleta Teste" }))).status).toBe(409);
    expect(await getDb().registration.count()).toBe(1);
  });
  it("não aceita total informado pelo cliente nem categorias duplicadas", async () => {
    expect((await POST(request(randomUUID(), { amountCents: 1 }))).status).toBe(400);
    expect((await POST(request(randomUUID(), { categories: ["masculino-c", "masculino-c"] }))).status).toBe(400);
    expect(await getDb().registration.count()).toBe(0);
  });
  it("bloqueia origem externa, corpo excessivo e abuso de reenvio", async () => {
    const external = new Request(request(), { headers: { origin: "https://external.example.org", "content-type": "application/json" } });
    expect((await POST(external)).status).toBe(403);
    const oversized = new Request("http://localhost:3000/api/registrations", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ data: "X".repeat(17000) }),
    });
    expect((await POST(oversized)).status).toBe(413);
    const id = randomUUID();
    for (let attempt = 0; attempt < 30; attempt++) await POST(request(id));
    expect((await POST(request(id))).status).toBe(429);
    expect(messages).toHaveLength(1);
  });
});
