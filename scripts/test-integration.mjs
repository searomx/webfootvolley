import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const name = `footvolley-test-${randomBytes(6).toString("hex")}`;
const password = randomBytes(24).toString("hex");
let started = false;

function run(command, args, env = process.env, capture = false) {
  const result = spawnSync(command, args, { env, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} falhou (código ${result.status}). ${capture ? result.stderr : ""}`);
  return result.stdout?.trim();
}

try {
  run("docker", ["run", "--detach", "--name", name, "--env", "POSTGRES_PASSWORD",
    "--env", "POSTGRES_USER=footvolley", "--env", "POSTGRES_DB=footvolley_test",
    "--publish", "127.0.0.1::5432", "postgres:18.6"], { ...process.env, POSTGRES_PASSWORD: password });
  started = true;
  const mapping = run("docker", ["port", name, "5432/tcp"], process.env, true);
  const port = mapping.split(":").at(-1);
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://footvolley:${password}@127.0.0.1:${port}/footvolley_test`,
    RUN_INTEGRATION: "true",
  };
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const probe = spawnSync("docker", ["exec", name, "pg_isready", "-U", "footvolley", "-d", "footvolley_test"], { stdio: "ignore" });
    if (probe.status === 0) { ready = true; break; }
    await setTimeout(500);
  }
  if (!ready) throw new Error("Banco de teste não ficou pronto.");
  run("npx", ["prisma", "migrate", "deploy"], env);
  run("npx", ["vitest", "run", "tests/integration.test.ts"], env);
} finally {
  if (started) run("docker", ["rm", "--force", name]);
}
