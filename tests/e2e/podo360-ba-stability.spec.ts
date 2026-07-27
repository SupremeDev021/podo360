import { expect, test } from "@playwright/test";

const userEmail = process.env.PLAYWRIGHT_USER_A_EMAIL;
const userPassword = process.env.PLAYWRIGHT_USER_A_PASSWORD;
const allowProductionMutation = process.env.PLAYWRIGHT_RUN_PRODUCTION_MUTATIONS === "true";
const runId = Date.now().toString().slice(-10);
const patientName = `TESTE_PRODUCAO_BA_INSTABILIDADE_${runId}`;

test("abertura de BA confirma persistencia e bloqueia envio duplicado", async ({ page }) => {
  test.skip(!userEmail || !userPassword, "Credenciais clinicas locais nao configuradas.");
  test.skip(!allowProductionMutation, "Defina PLAYWRIGHT_RUN_PRODUCTION_MUTATIONS=true para o teste controlado.");
  test.setTimeout(120_000);

  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");
  await page.getByLabel(/^E-mail$/i).fill(userEmail!);
  await page.getByLabel(/^Senha$/i).fill(userPassword!);
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /Abertura de atendimento/i }).click();
  const form = page.locator("form.ba-form");
  await form.locator('input[name="fullName"]').fill(patientName);
  await form.locator('input[name="cpf"]').fill(`${runId}11`);
  await form.locator('input[name="birthDate"]').fill("1988-07-27");
  await form.locator('input[name="phone"]').fill("21900000000");

  await form.evaluate((node) => {
    const target = node as HTMLFormElement;
    target.requestSubmit();
    target.requestSubmit();
  });

  const successToast = page.locator(".toast").filter({ hasText: /BA aberto com sucesso/i });
  await expect(successToast).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".toast")).not.toContainText(/sincronizar o novo BA|instabilidade de conexao/i);

  await page.reload();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Abertura de atendimento/i }).click();
  await form.locator('input[name="fullName"]').fill(patientName);
  await form.locator('input[name="cpf"]').fill(`${runId}11`);
  await form.locator('input[name="birthDate"]').fill("1988-07-27");
  await form.locator('input[name="phone"]').fill("21900000000");
  await form.getByRole("button", { name: /Abrir BA/i }).click();

  await expect(page.locator(".toast")).toContainText(/Este paciente ja possui um BA aberto|Este paciente já possui um BA aberto/i);
  expect(browserErrors).toEqual([]);
});
