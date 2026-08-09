import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { cleanupClinicalTestData, type CleanupReport } from "./helpers/cleanupClinicalTestData";

const email = process.env.PLAYWRIGHT_USER_A_EMAIL;
const password = process.env.PLAYWRIGHT_USER_A_PASSWORD;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const allowMutation = process.env.PLAYWRIGHT_RUN_PRODUCTION_MUTATIONS === "true";
const runDate = new Date();
const stamp = runDate.toISOString().replace(/[-:T]/g, "").slice(0, 15);
const runId = `TESTE_CLINICO_FINAL_SEGURO_${stamp.slice(0, 8)}_${stamp.slice(8, 14)}_${randomBytes(4).toString("hex")}`;
const patientName = `${runId}_PACIENTE`;

const modules = [
  /Identifica/i, /Queixa/i, /Medicamentos/i, /Hist.rico/i, /Avalia..o Podal/i,
  /Edema/i, /Sensibilidade/i, /ITB/i, /IHB/i, /Glicemia/i, /EVA/i,
  /Diagn.stico/i, /Procedimento/i, /Curativo/i, /Indica..o/i, /Home Care/i,
  /Imagem/i, /Comparativo/i, /Retorno/i
];

function client() {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function authenticate(api: SupabaseClient) {
  const { data, error } = await api.auth.signInWithPassword({ email: email!, password: password! });
  expect(error, "login direto do usuario A").toBeNull();
  expect(data.user).toBeTruthy();
  return data.user!;
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel(/^E-mail$/i).fill(email!);
  await page.getByLabel(/^Senha$/i).fill(password!);
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible({ timeout: 30_000 });
}

async function fillVisibleControls(form: Locator, marker: string) {
  for (const fieldset of await form.locator("fieldset").all()) {
    const radio = fieldset.locator('input[type="radio"]:not(:disabled)').first();
    const checkbox = fieldset.locator('input[type="checkbox"]:not(:disabled)').first();
    if (await radio.count()) await radio.click({ force: true });
    if (await checkbox.count()) await checkbox.click({ force: true });
  }
  for (const input of await form.locator('input:not([type="hidden"]):not([type="file"]):not([type="radio"]):not([type="checkbox"]):not(:disabled):not([readonly])').all()) {
    const type = (await input.getAttribute("type")) ?? "text";
    if (type === "date") await input.fill("2026-08-09");
    else if (type === "number") await input.fill("12");
    else await input.fill(marker);
  }
  for (const textarea of await form.locator("textarea:not(:disabled)").all()) await textarea.fill(marker);
  for (const select of await form.locator("select:not(:disabled)").all()) {
    const option = await select.locator("option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).find(Boolean));
    if (option) await select.selectOption(option);
  }
}

test("fluxo clinico final persiste, exporta e limpa todos os dados da rodada", async ({ page }, testInfo) => {
  test.skip(!email || !password || !supabaseUrl || !supabaseAnonKey, "Credenciais seguras do usuario A nao configuradas.");
  test.skip(!allowMutation, "Defina PLAYWRIGHT_RUN_PRODUCTION_MUTATIONS=true para executar a rodada controlada.");
  test.setTimeout(900_000);

  const api = client();
  const browserErrors: string[] = [];
  const failedResponses: string[] = [];
  let cleanupReport: CleanupReport | undefined;
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

  try {
    await authenticate(api);
    await login(page);

    await page.getByRole("button", { name: /Abertura de atendimento/i }).click();
    await page.locator('input[name="fullName"]').fill(patientName);
    await page.locator('input[name="cpf"]').fill(`000${Date.now().toString().slice(-8)}`);
    await page.locator('input[name="birthDate"]').fill("1985-07-13");
    await page.locator('input[name="phone"]').fill("00900000000");
    await page.locator('textarea[name="initialNotes"]').fill(`${runId}_OBS_INICIAL`);
    expect(await page.locator('input[name="fullName"]').inputValue()).toBe(patientName);
    expect((await page.locator('input[name="cpf"]').inputValue()).replace(/\D/g, "")).not.toBe("");
    await page.getByRole("button", { name: /Abrir BA/i }).click();
    await expect(page.locator(".toast")).toContainText(/BA aberto com sucesso/i, { timeout: 30_000 });

    const { data: attendance, error: attendanceError } = await api.from("attendances")
      .select("id,patient_id,ba_number,status,unique_medical_record_id")
      .like("initial_notes", `${runId}%`).single();
    expect(attendanceError).toBeNull();
    const { data: patient, error: patientError } = await api.from("patients")
      .select("id,company_id,unique_medical_record_id,unique_record_number,full_name")
      .eq("id", attendance!.patient_id).single();
    expect(patientError).toBeNull();
    expect(patient?.full_name).toBe(patientName);
    expect(attendance?.ba_number).toMatch(/^BA-/);
    expect(attendance?.unique_medical_record_id).toBe(patient?.unique_medical_record_id);

    await page.getByRole("button", { name: /^Atendimento$/i }).click();
    await page.getByRole("button", { name: /Iniciar atendimento|Continuar atendimento/i }).first().click();
    await page.getByRole("button", { name: /^Anamnese$/i }).click();
    await expect(page.locator(".wizard-form")).toBeVisible();

    for (const [index, module] of modules.entries()) {
      await page.locator(".stepper").getByRole("button", { name: module }).click();
      await fillVisibleControls(page.locator(".wizard-form"), `${runId}_MODULO_${index + 1}`);
      await page.getByRole("button", { name: /Salvar rascunho/i }).click();
      await expect(page.locator(".toast")).toContainText(/rascunho|salva/i);
    }

    await page.locator(".stepper").getByRole("button", { name: /Imagem/i }).click();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
    await page.locator('input[name="woundImage"]').setInputFiles({ name: `${runId}.png`, mimeType: "image/png", buffer: png });
    await page.locator('textarea[name="clinicalNotes"]').fill(`${runId}_IMAGEM`);
    await page.getByRole("button", { name: /Salvar evolu/i }).click();
    await expect(page.locator(".toast")).toContainText(/Evolu..o por imagem salva/i);

    const { data: image, error: imageError } = await api.from("attendance_images").select("id,file_url").eq("attendance_id", attendance!.id).single();
    expect(imageError).toBeNull();
    expect(image?.file_url).toContain(`/attendance-images/${attendance!.id}/`);
    expect(image?.file_url).not.toMatch(/^(blob:|data:)/);
    const { data: downloaded, error: downloadError } = await api.storage.from("clinical-images").download(image!.file_url);
    expect(downloadError).toBeNull();
    expect(downloaded?.size).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Pacientes$/i }).click();
    await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 30_000 });
    const { data: persisted } = await api.from("anamnesis_records").select("form_data").eq("attendance_id", attendance!.id).single();
    expect(JSON.stringify(persisted?.form_data)).toContain(runId);

    await page.getByRole("button", { name: /^Atendimento$/i }).click();
    await page.getByRole("button", { name: /Continuar atendimento/i }).first().click();
    await page.getByRole("button", { name: /^Anamnese$/i }).click();
    await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
    await page.getByRole("button", { name: /Agora n.o/i }).click();
    const { data: afterCancel } = await api.from("attendances").select("status").eq("id", attendance!.id).single();
    expect(afterCancel?.status).toBe("in_progress");

    await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
    await page.getByRole("button", { name: /Sim, finalizar/i }).click();
    await expect(page.locator(".toast")).toContainText(/Atendimento finalizado/i);
    const skipFinancial = page.getByRole("button", { name: /N.o gerar lan.amento agora/i });
    if (await skipFinancial.count()) await skipFinancial.click();
    const { data: finalized } = await api.from("attendances").select("status,finished_at").eq("id", attendance!.id).single();
    expect(finalized?.status).toBe("completed");
    expect(finalized?.finished_at).toBeTruthy();

    await page.getByRole("button", { name: /Gerenciamento de Atendimento/i }).click();
    await page.getByRole("button", { name: /Cancelar finaliza/i }).first().click();
    await page.getByRole("button", { name: /Confirmar reabertura/i }).click();
    await page.getByLabel(/Motivo do cancelamento/i).fill(`${runId}_JUSTIFICATIVA_REABERTURA`);
    await page.getByRole("button", { name: /Confirmar reabertura/i }).click();
    await expect(page.locator(".toast")).toContainText(/Atendimento reaberto/i);
    const { data: reopened } = await api.from("attendances").select("status,reopen_reason").eq("id", attendance!.id).single();
    expect(reopened?.status).toBe("in_progress");
    expect(reopened?.reopen_reason).toContain(runId);

    await page.getByRole("button", { name: /^Atendimento$/i }).click();
    await page.getByRole("button", { name: /Continuar atendimento/i }).first().click();
    await page.getByRole("button", { name: /^Relat.rio?s$/i }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: /Exportar BA atual/i }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup.locator("body")).toContainText(patientName);
    await popup.close();

    await page.getByRole("button", { name: /Sair da conta/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Sair da conta$/i }).click();
    await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();

    expect(browserErrors, "console/page errors").toEqual([]);
    expect(failedResponses.filter((entry) => !entry.includes("favicon")), "respostas 4xx/5xx").toEqual([]);
    await testInfo.attach("clinical-run-evidence", {
      body: JSON.stringify({ runId, patientId: patient!.id, attendanceId: attendance!.id, baNumber: attendance!.ba_number, uniqueRecordNumber: patient!.unique_record_number }, null, 2),
      contentType: "application/json"
    });
  } finally {
    cleanupReport = await cleanupClinicalTestData(api, runId);
    await testInfo.attach("clinical-cleanup-evidence", {
      body: JSON.stringify(cleanupReport, null, 2),
      contentType: "application/json"
    });
    await api.auth.signOut();
  }
});
