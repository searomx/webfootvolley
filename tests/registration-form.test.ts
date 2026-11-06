// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "@/components/registration-form";
import { RegistrationProvider } from "@/components/registration-provider";
import { operationStorageKey } from "@/lib/operation-id";
import type { Athlete } from "@/lib/registration";

type Submission = { requestId: string; athlete: Athlete; website: string };
let submissions: Submission[];
let respond: () => Response | Promise<Response>;

beforeEach(() => {
  sessionStorage.clear();
  submissions = [];
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url === "/api/pix") return Response.json({ message: "Pix indisponível no teste." }, { status: 503 });
    submissions.push(JSON.parse(String(init.body)));
    return respond();
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fillForm() {
  const user = userEvent.setup();
  render(createElement(RegistrationProvider, null, createElement(RegistrationForm)));
  await user.type(screen.getByLabelText("Nome completo", { exact: false }), "Atleta Teste");
  await user.type(screen.getByLabelText("Endereço", { exact: false }), "Rua de Teste, 100");
  await user.type(screen.getByLabelText("Onde treina", { exact: false }), "Arena Teste");
  await user.type(screen.getByLabelText("E-mail", { exact: false }), "atleta@example.test");
  fireEvent.change(screen.getByLabelText("Data de nascimento", { exact: false }), { target: { value: "1990-01-01" } });
  await user.click(screen.getByRole("checkbox", { name: /Masculino C/ }));
  return user;
}

describe("recuperação da inscrição", () => {
  it("exibe um parceiro por categoria e remove somente o valor da categoria desmarcada", async () => {
    respond = () => Response.json({
      id: "protocolo", amountCents: 10000, emailStatus: "SENT", message: "PDF enviado.",
    });
    const user = await fillForm();
    const firstCheckbox = screen.getByRole("checkbox", { name: /Masculino C/ });
    const secondCheckbox = screen.getByRole("checkbox", { name: /Masculino B/ });
    expect(screen.queryByLabelText(/Nome do parceiro.*Masculino B/)).toBeNull();
    const first = screen.getByLabelText<HTMLInputElement>(/Nome do parceiro.*Masculino C/);
    expect(first.required).toBe(false);
    await user.type(first, "Parceiro Primeiro");
    await user.click(secondCheckbox);
    await user.type(screen.getByLabelText(/Nome do parceiro.*Masculino B/), "Parceiro Segundo");
    await user.click(firstCheckbox);
    expect(screen.queryByLabelText(/Nome do parceiro.*Masculino C/)).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(/Nome do parceiro.*Masculino B/).value).toBe("Parceiro Segundo");
    await user.click(firstCheckbox);
    expect(screen.getByLabelText<HTMLInputElement>(/Nome do parceiro.*Masculino C/).value).toBe("");
    await user.type(screen.getByLabelText(/Nome do parceiro.*Masculino C/), "Parceiro Novo");
    await user.click(screen.getByRole("button", { name: "Enviar inscrição" }));
    await screen.findByText("PDF enviado.");
    expect(submissions[0].athlete.partners).toEqual([
      { categoryId: "masculino-b", player1Id: "Parceiro Segundo" },
      { categoryId: "masculino-c", player1Id: "Parceiro Novo" },
    ]);
    expect(firstCheckbox.closest("fieldset")?.disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Cadastrar outro atleta" }));
    expect(screen.queryByLabelText(/Nome do parceiro/)).toBeNull();
    await user.click(firstCheckbox);
    expect(screen.getByLabelText<HTMLInputElement>(/Nome do parceiro.*Masculino C/).value).toBe("");
  });

  it("associa erros de nome ao input e não envia dados inválidos", async () => {
    const user = await fillForm();
    const partner = screen.getByLabelText<HTMLInputElement>(/Nome do parceiro.*Masculino C/);
    await user.type(partner, "Parceiro");
    await user.click(screen.getByRole("button", { name: "Enviar inscrição" }));
    await screen.findByText("Informe nome e sobrenome do parceiro.");
    expect(partner.getAttribute("aria-invalid")).toBe("true");
    expect(partner.getAttribute("aria-describedby")).toBe("partner-masculino-c-error");
    expect(submissions).toHaveLength(0);
  });

  it("permite telefone opcional e envia o valor informado", async () => {
    respond = () => Response.json({
      id: "protocolo", amountCents: 6000, emailStatus: "SENT", message: "PDF enviado.",
    });
    const user = await fillForm();
    const phone = screen.getByLabelText<HTMLInputElement>("Telefone (opcional)");
    expect(phone.type).toBe("tel");
    expect(phone.required).toBe(false);
    await user.type(phone, "(11) 99999-1234");
    await user.click(screen.getByRole("button", { name: "Enviar inscrição" }));
    await screen.findByText("PDF enviado.");
    expect(submissions[0].athlete.phone).toBe("(11) 99999-1234");
  });

  it.each([400, 409])("permite corrigir HTTP %s sem trocar o protocolo", async (status) => {
    respond = () => Response.json({ message: "Reenvie os dados originais." }, { status });
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Enviar inscrição" }));
    await screen.findByText("Reenvie os dados originais.");
    const name = screen.getByLabelText<HTMLInputElement>("Nome completo", { exact: false });
    expect(name.disabled).toBe(false);
    expect(name.closest("fieldset")?.disabled).toBe(false);
    await user.clear(name);
    await user.type(name, "Atleta Original");
    respond = () => Response.json({ id: "protocolo", amountCents: 6000, emailStatus: "SENT", message: "PDF enviado." });
    await user.click(screen.getByRole("button", { name: "Enviar inscrição" }));
    await screen.findByText("PDF enviado.");
    expect(submissions).toHaveLength(2);
    expect(submissions[1].requestId).toBe(submissions[0].requestId);
    expect(submissions[1].athlete.fullName).toBe("Atleta Original");
    expect(sessionStorage.getItem(operationStorageKey)).toBe(submissions[0].requestId);
    await user.click(screen.getByRole("button", { name: "Cadastrar outro atleta" }));
    expect(sessionStorage.getItem(operationStorageKey)).toBeNull();
    expect(name.value).toBe("");
    expect(name.closest("fieldset")?.disabled).toBe(false);
    expect(screen.getByRole("checkbox", { name: /Masculino C/ }).getAttribute("data-state")).toBe("unchecked");
  });

  it.each(["network", "invalid", "429", "500"])("preserva snapshot e protocolo após %s", async (failure) => {
    respond = () => {
      if (failure === "network") throw new TypeError("Failed to fetch");
      if (failure === "invalid") return new Response("{");
      return Response.json({ message: "Servidor indisponível." }, { status: Number(failure) });
    };
    const user = await fillForm();
    await user.type(screen.getByLabelText(/Nome do parceiro.*Masculino C/), "Parceiro Preservado");
    await user.click(screen.getByRole("button", { name: "Enviar inscrição" }));
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Tentar envio novamente" }).disabled).toBe(false));
    const name = screen.getByLabelText<HTMLInputElement>("Nome completo", { exact: false });
    expect(name.closest("fieldset")?.disabled).toBe(true);
    respond = () => Response.json({ id: "protocolo", amountCents: 6000, emailStatus: "FAILED", message: "Falha ao enviar PDF." });
    await user.click(screen.getByRole("button", { name: "Tentar envio novamente" }));
    await screen.findByText("Falha ao enviar PDF.");
    expect(submissions[1]).toEqual(submissions[0]);
    expect(submissions[1].athlete.partners[0].player1Id).toBe("Parceiro Preservado");
    respond = () => Response.json({ id: "protocolo", amountCents: 6000, emailStatus: "SENT", message: "PDF enviado." });
    await user.click(screen.getByRole("button", { name: "Tentar envio novamente" }));
    await screen.findByText("PDF enviado.");
    expect(submissions[2]).toEqual(submissions[0]);
  });
});
