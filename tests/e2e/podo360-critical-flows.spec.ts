import { expect, test, type Page } from "@playwright/test";

const userAEmail = process.env.PLAYWRIGHT_USER_A_EMAIL;
const userAPassword = process.env.PLAYWRIGHT_USER_A_PASSWORD;
const userBEmail = process.env.PLAYWRIGHT_USER_B_EMAIL;
const userBPassword = process.env.PLAYWRIGHT_USER_B_PASSWORD;
const testRunId = Date.now().toString().slice(-8);
let testPatientCounter = 0;

function nextTestPatientName(label = "PACIENTE") {
  testPatientCounter += 1;
  return `TESTE_PRODUCAO_PODO360_${label}_${testRunId}_${testPatientCounter}`;
}

function nextTestCpf() {
  return `${testRunId}${String(testPatientCounter).padStart(3, "0")}`;
}

test.beforeEach(async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log(`[browser:error] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    console.log(`[pageerror] ${error.message}`);
  });
});

async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto("/");
  await expect(page.getByText(/Desenvolvido por: SupremeTech/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Site: https:\/\/www\.supremetechdev\.com\//i })).toHaveAttribute("href", "https://www.supremetechdev.com/");
  await expect(page.getByRole("link", { name: /Falar com suporte/i })).toHaveAttribute("href", "https://wa.me/5511999999999");
  await expect(page.getByText(/@supremetech\.digital/i)).toHaveCount(0);
  await page.getByLabel(/^E-mail$/i).fill(email);
  await page.getByLabel(/^Senha$/i).fill(password);
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Podo360/i })).toBeVisible();
}

async function loginAsConfiguredUser(page: Page) {
  test.skip(!userAEmail || !userAPassword, "Configure PLAYWRIGHT_USER_A_EMAIL e PLAYWRIGHT_USER_A_PASSWORD para executar fluxos clinicos autenticados.");
  await loginWithCredentials(page, userAEmail!, userAPassword!);
}

async function loginAsConfiguredUserB(page: Page) {
  test.skip(!userBEmail || !userBPassword, "Configure PLAYWRIGHT_USER_B_EMAIL e PLAYWRIGHT_USER_B_PASSWORD para executar fluxos multiempresa autenticados.");
  await loginWithCredentials(page, userBEmail!, userBPassword!);
}

async function openActiveAttendance(page: Page) {
  await page.getByRole("button", { name: /^Atendimento$/i }).click();
  const attendanceAction = page.getByRole("button", { name: /Continuar atendimento|Iniciar atendimento/i }).first();

  if (!(await attendanceAction.count())) {
    await createTestBa(page);
    await page.getByRole("button", { name: /^Atendimento$/i }).click();
  }

  await expect(attendanceAction).toBeVisible({ timeout: 15_000 });
  await attendanceAction.click();
  await page.getByRole("button", { name: /^Anamnese$/i }).click();
  await expect(page.locator(".wizard-form")).toBeVisible();
  await expect(page.getByText(/Consulte fichas anteriores por BA/i)).toHaveCount(0);
}

async function createTestBa(page: Page, patientName = nextTestPatientName("PACIENTE_A")) {
  await page.getByRole("button", { name: /Abertura de atendimento/i }).click();
  await expect(page.getByRole("heading", { name: /Abertura de atendimento/i })).toBeVisible();

  await page.locator('input[name="fullName"]').fill(patientName);
  await page.locator('input[name="cpf"]').fill(nextTestCpf());
  await page.locator('input[name="birthDate"]').fill("1980-06-09");
  await page.locator('input[name="phone"]').fill("11988887777");
  await page.getByRole("button", { name: /Abrir BA/i }).click();

  await expect(page.locator(".toast")).toContainText(/BA aberto com sucesso/i, { timeout: 20_000 });
  return patientName;
}

async function openMonofilament(page: Page) {
  await openActiveAttendance(page);
  await page.getByRole("button", { name: /Avaliação de Sensibilidade/i }).click();
  await expect(page.locator(".wizard-form")).toContainText(/Sensibilidade Monofilamento - Pé D/i);
  await expect(page.locator(".wizard-form")).toContainText(/Pé Esquerdo/i);
  await expect(page.locator(".wizard-form")).toContainText(/Sensibilidade vibratória/i);
  await expect(page.locator(".foot-canvas canvas")).toHaveCount(0);
}

async function saveCurrentDraft(page: Page) {
  await page.getByRole("button", { name: /Salvar rascunho/i }).click();
  await expect(page.locator(".toast")).toContainText(/rascunho|salva/i);
  await expect(page).not.toHaveURL(/login/i);
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toHaveCount(0);
}

async function selectWizardRadio(page: Page, fieldsetLabel: RegExp, option: RegExp) {
  await page.locator("fieldset").filter({ hasText: fieldsetLabel }).getByLabel(option).click();
}

test("bloqueia acesso interno sem sessao real", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toHaveCount(0);

  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByText(/Informe seu e-mail profissional|Acesso indisponivel/i)).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toHaveCount(0);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toHaveCount(0);

  await page.goto("/pacientes");
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toHaveCount(0);

  await page.goto("/atendimento");
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toHaveCount(0);

  await page.getByLabel(/^E-mail$/i).fill("usuario-invalido@example.invalid");
  await page.getByLabel(/^Senha$/i).fill("senha-invalida");
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByText(/E-mail ou senha incorretos|Nao foi possivel entrar/i)).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toHaveCount(0);
});

test("Usuario B autentica e nao carrega dados visuais da Empresa A", async ({ page }) => {
  await loginAsConfiguredUserB(page);
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible();
  await expect(page.getByText(/Clinica Pe Saudavel|Cl.nica Pe Saudavel/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Pacientes/i }).click();
  await expect(page.getByRole("heading", { name: /Pesquisar paciente|Pacientes/i })).toBeVisible();
  await expect(page.getByText(/TESTE_PRODUCAO_PODO360_PACIENTE_A/i)).toHaveCount(0);
});

test("Logout encerra sessao e bloqueia rota protegida", async ({ page }) => {
  await loginAsConfiguredUser(page);
  await page.getByRole("button", { name: /Sair da conta/i }).click();
  const logoutDialog = page.getByRole("dialog", { name: /Deseja realmente sair da conta/i });
  await expect(logoutDialog).toBeVisible();
  await logoutDialog.getByRole("button", { name: /^Sair da conta$/i }).click();
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toHaveCount(0);
});

test("Avaliação de Sensibilidade separa pés e mantém fluxo sem 3D", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsConfiguredUser(page);
  await openMonofilament(page);

  await selectWizardRadio(page, /Sensibilidade Monofilamento - Pé D/i, /Presente/i);
  await selectWizardRadio(page, /Sensibilidade vibratória/i, /Presente/i);
  await selectWizardRadio(page, /Sensibilidade térmica/i, /Positivo/i);
  await page.getByLabel(/Observações de sensibilidade/i).fill("Teste automatizado do pé direito.");
  await page.getByRole("button", { name: /Pé Esquerdo/i }).click();
  await selectWizardRadio(page, /Sensibilidade Monofilamento - Pé E/i, /Diminuída/i);
  await selectWizardRadio(page, /Sensibilidade vibratória/i, /Ausente/i);
  await saveCurrentDraft(page);
});

test("Botões de salvar preservam sessão e não redirecionam para login", async ({ page }) => {
  await loginAsConfiguredUser(page);
  await openMonofilament(page);

  await saveCurrentDraft(page);

  await page.locator(".stepper").getByRole("button", { name: /Comparativo de evolu/i }).click();
  await page.getByRole("button", { name: /Salvar rascunho/i }).click();
  await expect(page.locator(".toast")).toContainText(/rascunho|salva/i);
  await expect(page).not.toHaveURL(/login/i);
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toHaveCount(0);
});

test("Administração da Clínica abre criação de usuário em tela ampla e responsiva", async ({ page }) => {
  await loginAsConfiguredUser(page);
  await page.getByRole("button", { name: /Administra/i }).click();
  await page.getByRole("button", { name: /Criar usuario|Criar usuário/i }).click();

  await expect(page.getByRole("heading", { name: /^Criar usu/i }).first()).toBeVisible();
  await expect(page.getByLabel(/^Nome$/i)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^E-mail$/i })).toBeVisible();
  await expect(page.getByLabel(/Perfil/i)).toBeVisible();
  await expect(page.getByText(/convite seguro/i)).toBeVisible();
  await expect(page.locator('select[name="role"]')).not.toContainText(/Super Admin|plataforma/i);
  await expect(page.locator('input[name="temporaryPassword"], input[name="confirmPassword"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Salvar usu/i })).toBeVisible();

  const formBox = await page.locator(".user-management-page").boundingBox();
  expect(formBox?.width ?? 0).toBeGreaterThan(700);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".user-management-page")).toBeVisible();
  const mobileActions = page.locator(".user-management-page__actions");
  await expect(mobileActions).toBeVisible();
  const actionsBox = await mobileActions.boundingBox();
  expect(actionsBox?.width ?? 0).toBeLessThanOrEqual(390);
});

test("Relatório com IA mostra loading/preview amigável e não expõe JSON cru", async ({ page }) => {
  await loginAsConfiguredUser(page);
  await openActiveAttendance(page);

  await page.getByRole("button", { name: /Gerar relatorio com IA|Gerar relatório com IA/i }).click();
  await expect(page.getByRole("heading", { name: /Gerando relat/i })).toBeVisible();
  await expect(page).not.toHaveURL(/login/i);
  await expect(page.locator(".report-editor")).toBeVisible();
  await expect(page.locator(".report-editor")).toHaveValue(/RELATORIO|RELAT.RIO|encaminhamento/i);
  await expect(page.locator(".report-editor")).not.toHaveValue(/"formData"|"anamneses"|\{|\}/i);
  await expect(page.locator(".toast")).toContainText(/Relat.rio com IA gerado|relat.rio/i);
});

test("Curativo usa regioes do pe e cancelar finalizacao mantem atendimento aberto", async ({ page }) => {
  await loginAsConfiguredUser(page);
  await openActiveAttendance(page);

  await expect(page.getByText(/Nascimento/i).first()).toBeVisible();
  await expect(page.getByText(/Idade/i).first()).toBeVisible();

  await page.locator(".stepper").getByRole("button", { name: /Curativo/i }).click();
  const dressingLocation = page.getByLabel(/Local do curativo/i);
  await expect(dressingLocation).toBeVisible();
  await expect(dressingLocation).toContainText(/H.lux D/i);
  await expect(dressingLocation).toContainText(/Calcanhar plantar E/i);

  await dressingLocation.selectOption("right_hallux");
  await expect(dressingLocation).toHaveValue("right_hallux");
  await page.getByRole("button", { name: /Salvar rascunho/i }).click();
  await expect(page.locator(".toast")).toContainText(/rascunho|salva/i);
  await expect(page).not.toHaveURL(/login/i);

  await dressingLocation.selectOption("left_plantar_heel");
  await expect(dressingLocation).toHaveValue("left_plantar_heel");

  await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toBeVisible();
  await page.getByRole("button", { name: /Agora n[aã]o/i }).click();
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Finalizar atendimento/i })).toBeVisible();
  await expect(page.getByText(/Em atendimento/i).first()).toBeVisible();
  await expect(page.locator(".toast")).not.toContainText(/Atendimento finalizado/i);
  await expect(page).not.toHaveURL(/login/i);

  await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Finalizar atendimento/i })).toBeVisible();
  await expect(page.locator(".toast")).not.toContainText(/Atendimento finalizado/i);

  await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Finalizar atendimento/i })).toBeVisible();
  await expect(page.locator(".toast")).not.toContainText(/Atendimento finalizado/i);

  await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
  await page.getByRole("button", { name: /Sim, finalizar/i }).click();
  await expect(page.locator(".toast")).toContainText(/Atendimento finalizado/i);
  await expect(page.getByRole("heading", { name: /Gerar lan/i })).toBeVisible();
});

test("Finalizar no fim da Anamnese abre confirmacao e respeita cancelamento", async ({ page }) => {
  await loginAsConfiguredUser(page);
  await openActiveAttendance(page);

  await page.locator(".stepper").getByRole("button", { name: /Retorno/i }).click();
  await page.locator(".wizard-form").getByRole("button", { name: /Finalizar atendimento/i }).click();
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toBeVisible();
  await page.getByRole("button", { name: /Agora n[aã]o/i }).click();
  await expect(page.getByRole("dialog", { name: /Deseja finalizar este atendimento/i })).toHaveCount(0);
  await expect(page.locator(".toast")).not.toContainText(/Atendimento finalizado/i);
  await expect(page.locator(".wizard-form").getByRole("button", { name: /Finalizar atendimento/i })).toBeVisible();
});

test("Atendimento finalizado bloqueia edicao e Gerenciamento reabre com motivo obrigatorio", async ({ page }) => {
  await loginAsConfiguredUser(page);
  await openActiveAttendance(page);

  await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
  await page.getByRole("button", { name: /Sim, finalizar/i }).click();
  await expect(page.locator(".toast")).toContainText(/Atendimento finalizado/i);
  const skipFinancial = page.getByRole("button", { name: /N[aã]o gerar lan[cç]amento agora/i });
  if (await skipFinancial.count()) await skipFinancial.click();

  await expect(page.getByText(/dispon.vel apenas para consulta/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Salvar rascunho/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Finalizar atendimento/i })).toHaveCount(0);

  await page.getByRole("button", { name: /Gerenciamento de Atendimento/i }).click();
  await expect(page.getByRole("heading", { name: /Gerenciamento de Atendimento/i })).toBeVisible();
  await page.getByRole("button", { name: /Cancelar finaliza/i }).first().click();
  await expect(page.getByRole("dialog", { name: /Cancelar finaliza/i })).toBeVisible();
  await page.getByRole("button", { name: /Confirmar reabertura/i }).click();
  await expect(page.getByText(/Informe o motivo do cancelamento/i)).toBeVisible();
  await page.getByLabel(/Motivo do cancelamento/i).fill("Correção clínica autorizada para complementar anamnese.");
  await page.getByRole("button", { name: /Confirmar reabertura/i }).click();
  await expect(page.locator(".toast")).toContainText(/Atendimento reaberto/i);

  await page.getByRole("button", { name: /^Atendimento$/i }).click();
  await page.getByRole("button", { name: /Continuar atendimento/i }).first().click();
  await expect(page.getByRole("button", { name: /Salvar rascunho/i })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Finalizar atendimento/i })).toBeVisible();
});

test("Abertura de atendimento permanece na tela e prontuário fica somente leitura", async ({ page }) => {
  await loginAsConfiguredUser(page);
  await page.getByRole("button", { name: /Abertura de atendimento/i }).click();
  const patientName = nextTestPatientName("PACIENTE_BA_DUPLICADO");
  const patientCpf = nextTestCpf();

  const puField = page.locator('input[name="uniqueRecordNumber"]');
  await expect(puField).toBeVisible();
  await expect(puField).toHaveAttribute("readonly", "");
  await expect(page.getByText(/Será gerado automaticamente ao abrir o BA/i)).toBeVisible();

  await page.locator('input[name="fullName"]').fill(patientName);
  await page.locator('input[name="cpf"]').fill(patientCpf);
  await page.locator('input[name="birthDate"]').fill("1980-06-09");
  await page.locator('input[name="phone"]').fill("11988887777");
  await page.getByRole("button", { name: /Abrir BA/i }).click();

  await expect(page.locator(".toast")).toContainText(/BA aberto com sucesso/i);
  await expect(page.getByRole("heading", { name: /Abertura de atendimento/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Pesquisar paciente/i })).toHaveCount(0);
  await expect(page.locator('input[name="fullName"]')).toHaveValue("");
  await expect(puField).toHaveValue("");

  await page.locator('input[name="fullName"]').fill(patientName);
  await page.locator('input[name="cpf"]').fill(patientCpf);
  await page.locator('input[name="birthDate"]').fill("1980-06-09");
  await page.locator('input[name="phone"]').fill("11988887777");
  await page.getByRole("button", { name: /Abrir BA/i }).click();
  await expect(page.locator(".toast")).toContainText(/Este paciente ja possui um BA aberto|Este paciente já possui um BA aberto/i);
  await expect(page.locator('input[name="fullName"]')).toHaveValue(patientName);
});
