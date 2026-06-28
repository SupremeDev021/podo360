import { expect, test, type Page } from "@playwright/test";

const clinicUserEmail = process.env.PLAYWRIGHT_USER_B_EMAIL;
const clinicUserPassword = process.env.PLAYWRIGHT_USER_B_PASSWORD;
const platformAdminEmail = process.env.PLAYWRIGHT_PLATFORM_ADMIN_EMAIL;
const platformAdminPassword = process.env.PLAYWRIGHT_PLATFORM_ADMIN_PASSWORD;

async function adminLogin(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel(/^E-mail$/i).fill(email);
  await page.getByLabel(/^Senha$/i).fill(password);
  await page.getByRole("button", { name: /^Entrar$/i }).click();
}

test.beforeEach(async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`[browser:error] ${message.text()}`);
  });
});

test("Admin Global sem sessao exibe login e nao carrega dashboard", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /Entrar no Admin Global/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Admin Global/i })).toHaveCount(0);

  await page.goto("/admin/empresas");
  await expect(page.getByRole("heading", { name: /Entrar no Admin Global/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Admin Global/i })).toHaveCount(0);
});

test("Admin Global bloqueia campos vazios e credenciais invalidas", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByText(/Informe seu e-mail administrativo/i)).toBeVisible();
  await page.getByLabel(/^E-mail$/i).fill("admin-invalido@example.invalid");
  await page.getByLabel(/^Senha$/i).fill("senha-invalida");
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByText(/E-mail ou senha invalidos/i)).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Admin Global/i })).toHaveCount(0);
});

test("Usuario clinico autenticado nao acessa Admin Global", async ({ page }) => {
  test.skip(!clinicUserEmail || !clinicUserPassword, "Configure PLAYWRIGHT_USER_B_EMAIL e PLAYWRIGHT_USER_B_PASSWORD para validar bloqueio de usuario clinico.");
  await adminLogin(page, clinicUserEmail!, clinicUserPassword!);
  await expect(page.getByText(/nao possui permissao para acessar o Admin Global/i)).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Admin Global/i })).toHaveCount(0);
});

test("Platform admin acessa dados reais do Dashboard Global", async ({ page }) => {
  test.skip(!platformAdminEmail || !platformAdminPassword, "Configure PLAYWRIGHT_PLATFORM_ADMIN_EMAIL e PLAYWRIGHT_PLATFORM_ADMIN_PASSWORD para validar platform admin real.");
  await adminLogin(page, platformAdminEmail!, platformAdminPassword!);
  await expect(page.getByRole("navigation", { name: /Admin Global/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
  await expect(page.getByText(/Total de empresas/i)).toBeVisible();
  await page.getByRole("button", { name: /Empresas/i }).click();
  await expect(page.getByRole("heading", { name: /Empresas/i })).toBeVisible();
  const companyCards = page.locator(".admin-data-card");
  const emptyCompanies = page.getByText(/Nenhuma empresa cadastrada/i);
  await expect(companyCards.first().or(emptyCompanies)).toBeVisible();
});
