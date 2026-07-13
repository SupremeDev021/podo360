import { expect, test, type Locator, type Page } from "@playwright/test";

const userAEmail = process.env.PLAYWRIGHT_USER_A_EMAIL;
const userAPassword = process.env.PLAYWRIGHT_USER_A_PASSWORD;
const runId = Date.now().toString().slice(-8);
const testPrefix = `TESTE_PRODUCAO_PODO360_FLUXO_CLINICO_${runId}`;

const anamnesisModules: Array<{ label: RegExp; title: RegExp }> = [
  { label: /Identifica/i, title: /Identifica/i },
  { label: /Queixa/i, title: /Queixa principal/i },
  { label: /Medicamentos/i, title: /Medicamentos/i },
  { label: /Hist.rico/i, title: /Hist.rico de Sa/i },
  { label: /Avalia..o Podal/i, title: /Avalia..o Podal/i },
  { label: /Edema/i, title: /Edema/i },
  { label: /Sensibilidade/i, title: /Avalia..o de Sensibilidade/i },
  { label: /ITB/i, title: /ITB/i },
  { label: /IHB/i, title: /IHB/i },
  { label: /Glicemia/i, title: /Glicemia/i },
  { label: /EVA/i, title: /Escala EVA/i },
  { label: /Diagn.stico/i, title: /Diagn.stico Ungueal/i },
  { label: /Procedimento/i, title: /Procedimento/i },
  { label: /Curativo/i, title: /Curativo/i },
  { label: /Indica..o/i, title: /Indica..o de tratamento/i },
  { label: /Home Care/i, title: /Orienta..es Home Care/i },
  { label: /Imagem/i, title: /Evolu..o por Imagem/i },
  { label: /Comparativo/i, title: /Comparativo de evolu/i },
  { label: /Retorno/i, title: /Retorno/i }
];

test.beforeEach(async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`[browser:error] ${message.text()}`);
  });
  page.on("pageerror", (error) => console.log(`[pageerror] ${error.message}`));
});

async function login(page: Page) {
  test.skip(!userAEmail || !userAPassword, "Configure PLAYWRIGHT_USER_A_EMAIL e PLAYWRIGHT_USER_A_PASSWORD localmente.");
  await page.goto("/");
  await page.getByLabel(/^E-mail$/i).fill(userAEmail!);
  await page.getByLabel(/^Senha$/i).fill(userAPassword!);
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible({ timeout: 30_000 });
}

async function createBa(page: Page) {
  const patientName = `${testPrefix}_PACIENTE`;
  await page.getByRole("button", { name: /Abertura de atendimento/i }).click();
  await expect(page.getByRole("heading", { name: /Abertura de atendimento/i })).toBeVisible();

  await page.locator('input[name="fullName"]').fill(patientName);
  await page.locator('input[name="cpf"]').fill(`${runId}123`);
  await page.locator('input[name="birthDate"]').fill("1985-07-13");
  await page.locator('input[name="phone"]').fill("11977776666");
  await page.locator('textarea[name="initialNotes"]').fill(`${testPrefix}_OBS_INICIAL`);
  await page.getByRole("button", { name: /Abrir BA/i }).click();

  await expect(page.locator(".toast")).toContainText(/BA aberto com sucesso/i, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Abertura de atendimento/i })).toBeVisible();

  await page.locator('input[name="fullName"]').fill(patientName);
  await page.locator('input[name="cpf"]').fill(`${runId}123`);
  await page.locator('input[name="birthDate"]').fill("1985-07-13");
  await page.locator('input[name="phone"]').fill("11977776666");
  await page.getByRole("button", { name: /Abrir BA/i }).click();
  await expect(page.locator(".toast")).toContainText(/Este paciente ja possui um BA aberto|Este paciente j. possui um BA aberto/i);
  return patientName;
}

async function openAnamnesis(page: Page) {
  await page.getByRole("button", { name: /^Atendimento$/i }).click();
  const action = page.getByRole("button", { name: /Continuar atendimento|Iniciar atendimento/i }).first();
  await expect(action).toBeVisible();
  await action.click();
  await page.getByRole("button", { name: /^Anamnese$/i }).click();
  await expect(page.locator(".wizard-form")).toBeVisible();
}

async function chooseRadio(fieldset: Locator, option: RegExp) {
  const target = fieldset.getByLabel(option).first();
  if (await target.count()) await target.click();
}

async function fillVisibleWizardControls(page: Page, marker: string) {
  const form = page.locator(".wizard-form");

  for (const fieldset of await form.locator("fieldset").all()) {
    const radios = fieldset.locator('input[type="radio"]:not(:disabled)');
    const checkboxes = fieldset.locator('input[type="checkbox"]:not(:disabled)');
    if (await radios.count()) {
      await radios.first().click({ force: true });
    }
    if (await checkboxes.count()) {
      await checkboxes.first().click({ force: true });
    }
  }

  for (const input of await form.locator('input:not([type="hidden"]):not([type="file"]):not([type="radio"]):not([type="checkbox"]):not(:disabled):not([readonly])').all()) {
    const type = (await input.getAttribute("type")) ?? "text";
    if (type === "date") await input.fill("2026-07-13");
    else if (type === "number") await input.fill("12");
    else await input.fill(marker);
  }

  for (const textarea of await form.locator("textarea:not(:disabled)").all()) {
    await textarea.fill(marker);
  }

  for (const select of await form.locator("select:not(:disabled)").all()) {
    const options = await select.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean)
    );
    if (options[0]) await select.selectOption(options[0]);
  }
}

async function validateConditionalFields(page: Page) {
  await page.locator(".stepper").getByRole("button", { name: /Medicamentos/i }).click();
  await chooseRadio(page.locator("fieldset").filter({ hasText: /Medicamentos em uso/i }), /Sim/i);
  await expect(page.getByLabel(/Quais medica/i)).toBeVisible();
  await page.getByLabel(/Quais medica/i).fill(`${testPrefix}_MEDICAMENTO`);
  await chooseRadio(page.locator("fieldset").filter({ hasText: /Medicamentos em uso/i }), /N.o/i);
  await expect(page.getByLabel(/Quais medica/i)).toHaveCount(0);
  await chooseRadio(page.locator("fieldset").filter({ hasText: /Medicamentos em uso/i }), /Sim/i);
  await page.getByLabel(/Quais medica/i).fill(`${testPrefix}_MEDICAMENTO_FINAL`);

  await page.locator(".stepper").getByRole("button", { name: /Hist.rico/i }).click();
  await chooseRadio(page.locator("fieldset").filter({ hasText: /^Cirurgia/i }), /Sim/i);
  await expect(page.getByLabel(/Descri..o da cirurgia/i)).toBeVisible();
  await page.getByLabel(/Descri..o da cirurgia/i).fill(`${testPrefix}_CIRURGIA`);
  await chooseRadio(page.locator("fieldset").filter({ hasText: /^Cirurgia/i }), /N.o/i);
  await expect(page.getByLabel(/Descri..o da cirurgia/i)).toHaveCount(0);
  await chooseRadio(page.locator("fieldset").filter({ hasText: /^Cirurgia/i }), /Sim/i);
  await page.getByLabel(/Descri..o da cirurgia/i).fill(`${testPrefix}_CIRURGIA_FINAL`);

  await page.locator(".stepper").getByRole("button", { name: /Edema/i }).click();
  await chooseRadio(page.locator("fieldset").filter({ hasText: /^Edema/i }), /Sim/i);
  await expect(page.locator("fieldset").filter({ hasText: /^Grau/i })).toBeVisible();
  await chooseRadio(page.locator("fieldset").filter({ hasText: /^Grau/i }), /Grau 1/i);
  await chooseRadio(page.locator("fieldset").filter({ hasText: /^Edema/i }), /N.o/i);
  await expect(page.locator("fieldset").filter({ hasText: /^Grau/i })).toHaveCount(0);
  await chooseRadio(page.locator("fieldset").filter({ hasText: /^Edema/i }), /Sim/i);
}

async function expectNoRawArtifacts(page: Page) {
  await expect(page.getByText(/undefined|null|\[object Object\]/i)).toHaveCount(0);
}

async function openPrimaryView(page: Page, route: RegExp) {
  const viewportWidth = page.viewportSize()?.width ?? 1366;
  if (viewportWidth < 900) {
    const sidebarOpen = await page.locator(".sidebar.is-open").count();
    if (!sidebarOpen) {
      const menuButton = page.getByRole("button", { name: /Abrir menu/i });
      if (await menuButton.isVisible()) await menuButton.click();
    }
  }
  await page.getByRole("navigation", { name: /Principal/i }).getByRole("button", { name: route }).click();
}

test("fluxo clinico completo: anamnese, finalizacao, reabertura, PDF e responsividade", async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  const patientName = await createBa(page);
  await openAnamnesis(page);

  await validateConditionalFields(page);

  for (const [index, module] of anamnesisModules.entries()) {
    await page.locator(".stepper").getByRole("button", { name: module.label }).click();
    await expect(page.locator("main").getByRole("heading", { name: module.title }).first()).toBeVisible();
    await fillVisibleWizardControls(page, `${testPrefix}_MODULO_${index + 1}`);
    await page.getByRole("button", { name: /Salvar rascunho/i }).click();
    await expect(page.locator(".toast")).toContainText(/rascunho|salva/i);
    await expectNoRawArtifacts(page);
  }

  await page.locator(".stepper").getByRole("button", { name: /Imagem/i }).click();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
  await page.locator('input[name="woundImage"]').first().setInputFiles({ name: `${testPrefix}_imagem.png`, mimeType: "image/png", buffer: png });
  await page.locator('textarea[name="clinicalNotes"]').fill(`${testPrefix}_IMAGEM_OBS`);
  await page.getByRole("button", { name: /Salvar evolu/i }).click();
  await expect(page.locator(".toast")).toContainText(/Imagem salva|evolu/i);

  await page.locator(".stepper").getByRole("button", { name: /Queixa/i }).click();
  const hasPersistedPrefix = await page.locator(".wizard-form").locator("input, textarea").evaluateAll(
    (fields, prefix) => fields.some((field) => (field as HTMLInputElement | HTMLTextAreaElement).value.includes(prefix)),
    testPrefix
  );
  expect(hasPersistedPrefix, "anamnese deve recarregar os dados preenchidos").toBeTruthy();

  await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toBeVisible();
  await page.getByRole("button", { name: /Agora n.o/i }).click();
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toHaveCount(0);

  await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
  await page.getByRole("button", { name: /Sim, finalizar/i }).click();
  await expect(page.locator(".toast")).toContainText(/Atendimento finalizado/i);
  const skipFinancial = page.getByRole("button", { name: /N.o gerar lan.amento agora/i });
  if (await skipFinancial.count()) await skipFinancial.click();
  await expect(page.getByText(/dispon.vel apenas para consulta/i)).toBeVisible();

  await page.getByRole("button", { name: /Gerenciamento de Atendimento/i }).click();
  await page.getByRole("button", { name: /Cancelar finaliza/i }).first().click();
  await expect(page.getByRole("dialog", { name: /Cancelar finaliza/i })).toBeVisible();
  await page.getByRole("button", { name: /Confirmar reabertura/i }).click();
  await expect(page.getByText(/Informe o motivo do cancelamento/i)).toBeVisible();
  await page.getByLabel(/Motivo do cancelamento/i).fill(`${testPrefix}_JUSTIFICATIVA_REABERTURA`);
  await page.getByRole("button", { name: /Confirmar reabertura/i }).click();
  await expect(page.locator(".toast")).toContainText(/Atendimento reaberto/i);

  await page.getByRole("button", { name: /^Atendimento$/i }).click();
  await page.getByRole("button", { name: /Continuar atendimento/i }).first().click();
  await expect(page.getByRole("button", { name: /Salvar rascunho/i })).toBeEnabled();

  await page.locator("main").getByRole("button", { name: /^Relat.rio?s$/i }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: /Exportar BA atual/i }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator("body")).toContainText(patientName);
  await expect(popup.locator("body")).toContainText(/Anamnese|Prontu.rio de Evolu/i);
  await popup.close();

  for (const viewport of [{ width: 1366, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of [/Dashboard/i, /Pacientes/i, /Abertura de atendimento/i, /^Atendimento$/i, /Gerenciamento de Atendimento/i, /Relat.rio/i]) {
      await openPrimaryView(page, route);
      await expect(page.locator("main").first()).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
      expect(hasHorizontalOverflow, `overflow horizontal em ${String(route)} ${viewport.width}x${viewport.height}`).toBeFalsy();
    }
  }
});
