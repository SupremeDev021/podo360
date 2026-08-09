import { expect, test } from "@playwright/test";

const productionUrl = process.env.PLAYWRIGHT_PRODUCTION_URL ?? "https://supremedev021.github.io/podo360/";
const userEmail = process.env.PLAYWRIGHT_USER_A_EMAIL;
const userPassword = process.env.PLAYWRIGHT_USER_A_PASSWORD;

test("GitHub Pages autentica e encerra a sessao clinica", async ({ page }) => {
  test.skip(!userEmail || !userPassword, "Credenciais clinicas locais nao configuradas.");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(productionUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();

  await page.getByLabel(/^E-mail$/i).fill(userEmail!);
  await page.getByLabel(/^Senha$/i).fill(userPassword!);
  await page.getByRole("button", { name: /^Entrar$/i }).click();

  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Sair da conta/i })).toBeVisible();
  expect(pageErrors).toEqual([]);

  await page.getByRole("button", { name: /Sair da conta/i }).click();
  const dialog = page.getByRole("dialog", { name: /Deseja realmente sair da conta/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^Sair da conta$/i }).click();
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();
});
