import { expect, test, type Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Podo360/i })).toBeVisible();
}

async function openActiveAttendance(page: Page) {
  await page.getByRole("button", { name: /^Atendimentos$/i }).click();
  const continueButton = page.getByRole("button", { name: /Continuar atendimento/i }).first();
  const startButton = page.getByRole("button", { name: /Iniciar atendimento/i }).first();
  if (await continueButton.count()) {
    await continueButton.click();
  } else {
    await startButton.click();
  }
  await page.getByRole("button", { name: /^Anamnese$/i }).click();
  await expect(page.getByRole("heading", { name: /Anamneses do paciente/i })).toBeVisible();
}

async function openMonofilament(page: Page) {
  await openActiveAttendance(page);
  await page.getByRole("button", { name: /Sensibilidade Monofilamento/i }).click();
  await expect(page.locator(".foot-canvas canvas")).toBeVisible();
  await expect(page.getByText(/Carregando modelo 3D/i)).toHaveCount(0);
  await expect(page.locator(".foot-sensitivity-form")).toContainText(/Regi/i);
}

async function saveCurrentMarking(page: Page) {
  await page.locator(".foot-sensitivity-form .primary-button").click();
  await expect(page.locator(".toast")).toContainText(/salva|atualizada/i);
  await expect(page).not.toHaveURL(/login/i);
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toHaveCount(0);
}

test("Sensibilidade Monofilamento mantém fallback por select, marcador visual e salvamento", async ({ page }) => {
  test.setTimeout(180_000);
  await enterDemo(page);
  await openMonofilament(page);

  await page.getByRole("button", { name: /direito/i }).click();
  await page.locator(".foot-sensitivity-form select").selectOption("hallux");
  await expect(page.locator(".foot-sensitivity-form .section-heading")).toContainText(/H.lux D/i);
  await page.getByRole("button", { name: /Presente/i }).click();
  await saveCurrentMarking(page);

  await page.locator(".foot-sensitivity-form select").selectOption("second_toe");
  await expect(page.locator(".foot-sensitivity-form .section-heading")).toContainText(/2. dedo D/i);

  await page.locator(".foot-sensitivity-form select").selectOption("plantar_heel");
  await expect(page.locator(".foot-sensitivity-form .section-heading")).toContainText(/Calcanhar plantar D/i);
  await page.getByRole("button", { name: /Diminu/i }).click();
  await saveCurrentMarking(page);
  await expect(page.locator(".compact-list--clinical").first()).toContainText(/Calcanhar plantar D/i);

  await page.getByRole("button", { name: /esquerdo/i }).click();
  await page.locator(".foot-sensitivity-form select").selectOption("hallux");
  await expect(page.locator(".foot-sensitivity-form .section-heading")).toContainText(/H.lux E/i);
  await saveCurrentMarking(page);
});

test("Botões de salvar preservam sessão e não redirecionam para login", async ({ page }) => {
  await enterDemo(page);
  await openMonofilament(page);

  await page.locator(".foot-sensitivity-form select").selectOption("plantar_heel");
  await saveCurrentMarking(page);

  await page.locator(".stepper").getByRole("button", { name: /Comparativo de evolu/i }).click();
  await page.getByRole("button", { name: /Salvar rascunho/i }).click();
  await expect(page.locator(".toast")).toContainText(/rascunho|salva/i);
  await expect(page).not.toHaveURL(/login/i);
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toHaveCount(0);
});

test("Administração da Clínica abre criação de usuário em tela ampla e responsiva", async ({ page }) => {
  await enterDemo(page);
  await page.getByRole("button", { name: /Administra/i }).click();
  await page.getByRole("button", { name: /Criar usuario|Criar usuário/i }).click();

  await expect(page.getByRole("heading", { name: /^Criar usu/i }).first()).toBeVisible();
  await expect(page.getByLabel(/^Nome$/i)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^E-mail$/i })).toBeVisible();
  await expect(page.getByLabel(/Perfil/i)).toBeVisible();
  await expect(page.getByLabel(/Senha de primeiro acesso/i)).toBeVisible();
  await expect(page.getByLabel(/Confirmar senha/i)).toBeVisible();
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
  await enterDemo(page);
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
  await enterDemo(page);
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
  await page.getByRole("button", { name: /Agora nao/i }).click();
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

test("Atendimento finalizado bloqueia edicao e Gerenciamento reabre com motivo obrigatorio", async ({ page }) => {
  await enterDemo(page);
  await openActiveAttendance(page);

  await page.getByRole("button", { name: /Finalizar atendimento/i }).click();
  await page.getByRole("button", { name: /Sim, finalizar/i }).click();
  await expect(page.locator(".toast")).toContainText(/Atendimento finalizado/i);
  const skipFinancial = page.getByRole("button", { name: /Nao gerar lancamento agora/i });
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

  await page.getByRole("button", { name: /^Atendimentos$/i }).click();
  await page.getByRole("button", { name: /Continuar atendimento/i }).first().click();
  await expect(page.getByRole("button", { name: /Salvar rascunho/i })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Finalizar atendimento/i })).toBeVisible();
});

test("Abertura de BA permanece na tela e PU fica somente leitura", async ({ page }) => {
  await enterDemo(page);
  await page.getByRole("button", { name: /Abertura de BA/i }).click();

  const puField = page.locator('input[name="uniqueRecordNumber"]');
  await expect(puField).toBeVisible();
  await expect(puField).toHaveAttribute("readonly", "");
  await expect(page.getByText(/Sera gerado automaticamente ao abrir o BA/i)).toBeVisible();

  await page.locator('input[name="fullName"]').fill("Paciente Novo BA");
  await page.locator('input[name="cpf"]').fill("12345678909");
  await page.locator('input[name="birthDate"]').fill("1980-06-09");
  await page.locator('input[name="phone"]').fill("11988887777");
  await page.locator('input[name="whatsapp"]').fill("11988887777");
  await page.locator('textarea[name="chiefComplaint"]').fill("Dor plantar");
  await page.getByRole("button", { name: /Abrir BA/i }).click();

  await expect(page.locator(".toast")).toContainText(/BA aberto com sucesso/i);
  await expect(page.getByRole("heading", { name: /Abertura de BA/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Pesquisar paciente/i })).toHaveCount(0);
  await expect(page.locator('input[name="fullName"]')).toHaveValue("");
  await expect(puField).toHaveValue("");
});
