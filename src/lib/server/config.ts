import "server-only";
import { z } from "zod";

export class ConfigurationError extends Error {
  constructor(public readonly setting: string) {
    super(`Configuração ausente ou inválida: ${setting}.`);
  }
}

export function requiredSetting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigurationError(name);
  return value;
}

export function emailSetting(name: string) {
  const value = requiredSetting(name);
  if (!z.email().safeParse(value).success) throw new ConfigurationError(name);
  return value;
}
