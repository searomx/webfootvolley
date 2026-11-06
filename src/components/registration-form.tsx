"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Copy, LoaderCircle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegistrationStore } from "./registration-provider";
import { getOperationId, operationStorageKey } from "@/lib/operation-id";
import { ApiError, postJson } from "@/lib/client-api";
import {
  categories, stageNames, registrationSchema, registrationResultSchema, pixResultSchema,
  calculateAmount, formatMoney, type Athlete, type RegistrationResult,
} from "@/lib/registration";

const fields = [
  { name: "fullName", label: "Nome completo", placeholder: "Nome e sobrenome", autoComplete: "name", max: 150, wide: true },
  { name: "nickname", label: "Apelido", placeholder: "Como você é conhecido na quadra", autoComplete: "nickname", max: 80 },
  { name: "birthDate", label: "Data de nascimento", type: "date", autoComplete: "bday" },
  { name: "address", label: "Endereço", placeholder: "Rua, número, bairro e cidade", autoComplete: "street-address", max: 300, wide: true },
  { name: "trainingPlace", label: "Onde treina", placeholder: "Arena, clube ou local de treino", max: 150 },
  { name: "email", label: "E-mail", type: "email", placeholder: "seu@email.com", autoComplete: "email", max: 254 },
] as const;

export function RegistrationForm() {
  const selected = useRegistrationStore((state) => state.selectedCategories);
  const setSelected = useRegistrationStore((state) => state.setSelectedCategories);
  const form = useForm<Athlete>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "", nickname: "", address: "", trainingPlace: "", birthDate: "", email: "",
      stages: [], categories: [],
    },
  });
  const [pixResponse, setPixResponse] = useState<{
    key: string; data?: z.infer<typeof pixResultSchema>; error?: string;
  }>();
  const [result, setResult] = useState<RegistrationResult>();
  const [submitError, setSubmitError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [pixAttempt, setPixAttempt] = useState(0);
  const snapshot = useRef<{ requestId: string; athlete: Athlete } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const key = selected.join(",");
  const amount = calculateAmount(selected.length);
  const pix = pixResponse?.key === key ? pixResponse.data : undefined;
  const pixError = pixResponse?.key === key ? pixResponse.error : undefined;
  const copyMessage = copyStatus.startsWith(`${key}:`) ? copyStatus.slice(key.length + 1) : "";

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await postJson("/api/pix", { categories: key.split(",") }, controller.signal);
        const parsed = pixResultSchema.safeParse(response);
        if (!parsed.success) throw new Error("O servidor retornou um Pix inválido. Tente gerar o código novamente.");
        const data = parsed.data;
        if (data.amountCents !== calculateAmount(key.split(",").length)) {
          throw new Error("O valor do Pix não corresponde às categorias.");
        }
        if (!controller.signal.aborted) setPixResponse({ key, data });
      } catch (error) {
        if (!controller.signal.aborted) {
          setPixResponse({ key, error: error instanceof Error ? error.message : "Não foi possível gerar o Pix." });
        }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, pixAttempt]);

  async function submit(athlete: Athlete) {
    setSubmitError("");
    try {
      snapshot.current ??= { requestId: getOperationId(sessionStorage), athlete: structuredClone(athlete) };
      setHasSubmitted(true);
      const data = await postJson("/api/registrations", {
        ...snapshot.current, website: honeypot.current?.value || "",
      });
      const parsed = registrationResultSchema.safeParse(data);
      if (!parsed.success) throw new Error("Não foi possível confirmar o resultado. Tente novamente com o mesmo protocolo.");
      setResult(parsed.data);
    } catch (error) {
      if (error instanceof ApiError && error.allowsCorrection) {
        snapshot.current = null;
        setHasSubmitted(false);
      }
      setSubmitError(error instanceof Error ? error.message : "Falha de comunicação. Tente novamente.");
    }
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  function startAnotherRegistration() {
    try {
      sessionStorage.removeItem(operationStorageKey);
      snapshot.current = null;
      form.reset();
      setSelected([]);
      setResult(undefined);
      setPixResponse(undefined);
      setCopyStatus("");
      setSubmitError("");
      setHasSubmitted(false);
      requestAnimationFrame(() => form.setFocus("fullName"));
    } catch {
      setSubmitError("Não foi possível limpar o protocolo no navegador. Não inicie outra inscrição antes de contatar a organização.");
    }
  }

  async function copyPix() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.payload);
      setCopyStatus(`${key}:Código Pix copiado.`);
    } catch {
      setCopyStatus(`${key}:Não foi possível copiar. Selecione e copie o código abaixo manualmente.`);
    }
  }

  return (
    <form noValidate aria-busy={form.formState.isSubmitting} onSubmit={(event) => { void form.handleSubmit(submit)(event); }} className="registration-grid">
      <div className="form-sections">
        <fieldset disabled={hasSubmitted || form.formState.isSubmitting} className="form-panel">
          <legend><h2>Dados do atleta</h2></legend>
          <p className="section-description">Preencha seus dados. Os campos com * são obrigatórios.</p>
          <div className="athlete-fields">
            {fields.map((field) => {
              const error = form.formState.errors[field.name];
              const optional = field.name === "nickname";
              return (
                <div key={field.name} className={`form-field ${"wide" in field ? "wide" : ""}`}>
                  <Label htmlFor={field.name}>{field.label}{!optional && <span aria-hidden="true"> *</span>}</Label>
                  <Input
                    id={field.name}
                    type={"type" in field ? field.type : "text"}
                    placeholder={"placeholder" in field ? field.placeholder : undefined}
                    autoComplete={"autoComplete" in field ? field.autoComplete : undefined}
                    maxLength={"max" in field ? field.max : undefined}
                    min={field.name === "birthDate" ? "1900-01-01" : undefined}
                    required={!optional}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${field.name}-error` : undefined}
                    {...form.register(field.name)}
                  />
                  {error && <p id={`${field.name}-error`} className="field-error">{error.message}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>
        <fieldset disabled={hasSubmitted || form.formState.isSubmitting} className="form-panel">
          <legend><h2>Sua participação em 2026</h2></legend>
          <p className="section-description">Quais etapas da liga interna você jogou? Deixe em branco se não participou.</p>
          <Controller control={form.control} name="stages" render={({ field }) => (
            <div className="stage-choices">
              {stageNames.map((stage) => (
                <div className="stage-choice" key={stage}>
                  <Checkbox
                    id={`stage-${stage}`} checked={field.value.includes(stage)}
                    onBlur={field.onBlur}
                    onCheckedChange={(checked) => field.onChange(checked === true
                      ? [...field.value, stage] : field.value.filter((value) => value !== stage))}
                  />
                  <Label htmlFor={`stage-${stage}`}>{stage}</Label>
                </div>
              ))}
            </div>
          )} />
        </fieldset>
        <fieldset disabled={hasSubmitted || form.formState.isSubmitting} className="form-panel">
          <legend><h2>Escolha suas categorias *</h2></legend>
          <p className="section-description" id="category-help">Primeira categoria: R$ 60,00. Cada adicional: R$ 40,00.</p>
          <Controller control={form.control} name="categories" render={({ field }) => (
            <>
              {["28/11", "29/11"].map((date) => (
                <div className="category-day" key={date}>
                  <h3>{date === "28/11" ? "Sábado" : "Domingo"} <span>{date}/2026</span></h3>
                  <div className="category-choices">
                    {categories.filter((category) => category.date === date).map((category, index) => (
                      <div className={`category-choice ${field.value.includes(category.id) ? "selected" : ""}`} key={category.id}>
                        <Checkbox
                          id={category.id}
                          ref={date === "28/11" && index === 0 ? field.ref : undefined}
                          checked={field.value.includes(category.id)}
                          onBlur={field.onBlur}
                          aria-invalid={Boolean(form.formState.errors.categories)}
                          aria-describedby={`category-help${form.formState.errors.categories ? " category-error" : ""}`}
                          onCheckedChange={(checked) => {
                            const values = checked === true ? [...field.value, category.id]
                              : field.value.filter((value) => value !== category.id);
                            field.onChange(values);
                            setSelected(values);
                          }}
                        />
                        <Label htmlFor={category.id}><span className="category-time">{category.time}</span>{category.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )} />
          {form.formState.errors.categories && <p id="category-error" className="field-error">{form.formState.errors.categories.message}</p>}
        </fieldset>
      </div>
      <aside className="payment-panel" aria-label="Resumo da inscrição">
        <div className="summary-heading"><Trophy aria-hidden="true" size={20} /><h2>Sua inscrição</h2></div>
        <span className="payment-badge">Pagamento pendente</span>
        <div className="summary-line"><span>Categorias selecionadas</span><strong>{selected.length}</strong></div>
        <div aria-live="polite" aria-atomic="true" className="payment-total">{formatMoney(amount)}</div>
        {selected.length ? (
          <div className="pix-section">
            {pix ? (
              <Image src={pix.qrCode} alt={`QR Code Pix de ${formatMoney(amount)}`} width={256} height={256} unoptimized className="pix-image" />
            ) : pixError ? (
              <div className="service-error"><p role="alert">{pixError}</p>
                <Button type="button" variant="outline" className="full-button" onClick={() => {
                  setPixResponse(undefined);
                  setPixAttempt((attempt) => attempt + 1);
                }}>Tentar gerar Pix novamente</Button>
              </div>
            ) : <p className="pix-loading" role="status"><LoaderCircle className="loading-icon" size={18} aria-hidden="true" />Gerando Pix…</p>}
            {pix && (
              <>
                <Button type="button" variant="outline" onClick={copyPix} className="full-button"><Copy size={16} aria-hidden="true" />Copiar código Pix</Button>
                <Label htmlFor="pix-code" className="pix-label">Pix copia e cola</Label>
                <textarea id="pix-code" readOnly value={pix.payload} rows={3} onFocus={(event) => event.currentTarget.select()} />
                <p role="status" className="copy-status">{copyMessage}</p>
                <p className="small-note">Confira o recebedor e o valor no aplicativo do seu banco antes de pagar.</p>
              </>
            )}
          </div>
        ) : <p className="empty-payment">Selecione pelo menos uma categoria para visualizar o Pix.</p>}
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input ref={honeypot} id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <Button type="submit" className="full-button submit-button" disabled={form.formState.isSubmitting || result?.emailStatus === "SENT"}>
          {form.formState.isSubmitting ? <><LoaderCircle className="loading-icon" size={16} aria-hidden="true" />Enviando…</>
            : result?.emailStatus === "SENT" ? <><Check size={16} aria-hidden="true" />Inscrição registrada</>
              : hasSubmitted ? result?.emailStatus === "SENDING" ? "Consultar envio do PDF" : "Tentar envio novamente" : "Enviar inscrição"}
        </Button>
        <p className="small-note">A organização receberá um PDF com seus dados. A inscrição será registrada com pagamento pendente.</p>
        {result?.emailStatus === "SENT" && <Button type="button" variant="outline" className="full-button" onClick={startAnotherRegistration}>Cadastrar outro atleta</Button>}
        {(result || submitError) && (
          <div ref={statusRef} tabIndex={-1} role={submitError ? "alert" : "status"} className={`registration-status ${submitError || result?.emailStatus === "FAILED" ? "status-warning" : ""}`}>
            <p>{submitError || result?.message}</p>
            {result && <p className="registration-id">Protocolo: {result.id}</p>}
            {submitError && hasSubmitted && <p>Os dados foram preservados. Uma falha de comunicação pode ocorrer após o cadastro; tentar novamente não duplica esta operação.</p>}
            {submitError && !hasSubmitted && <p>Você pode corrigir os campos e reenviar. O protocolo será mantido; se esta operação já foi registrada, use os dados originais.</p>}
          </div>
        )}
        <p className="privacy-note">Seus dados serão utilizados pela organização para processar esta inscrição. Não compartilhe informações sensíveis adicionais.</p>
        <p className="small-note">Se recarregar esta aba após uma falha, preencha novamente os mesmos dados para recuperar a operação. Apenas o protocolo é mantido no navegador.</p>
      </aside>
    </form>
  );
}
