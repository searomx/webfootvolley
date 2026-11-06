import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const password = randomBytes(24).toString("hex");
const template = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const content = template
  .replace("POSTGRES_PASSWORD=\n", `POSTGRES_PASSWORD=${password}\n`)
  .replace("DATABASE_URL=\n", `DATABASE_URL=postgresql://footvolley:${password}@127.0.0.1:5433/footvolley\n`);

await writeFile(new URL("../.env", import.meta.url), content, { flag: "wx", mode: 0o600 });
console.log("Arquivo .env criado com senha local aleatória. Configure Pix e SMTP antes de utilizar em produção.");
