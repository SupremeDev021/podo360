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
  const patientRequestIds: string[] = [];
  const attendanceRequestIds: string[] = [];
  let simulatedPatientConnectionFailure = false;
  let simulatedConnectionFailure = false;
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.route("**/rest/v1/patients*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const body = request.postDataJSON() as { id?: string };
    if (body.id) patientRequestIds.push(body.id);
    if (!simulatedPatientConnectionFailure) {
      simulatedPatientConnectionFailure = true;
      return route.abort("connectionfailed");
    }
    return route.continue();
  });
  await page.route("**/rest/v1/attendances*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const body = request.postDataJSON() as { id?: string };
    if (body.id) attendanceRequestIds.push(body.id);
    if (!simulatedConnectionFailure) {
      simulatedConnectionFailure = true;
      return route.abort("connectionfailed");
    }
    return route.continue();
  });

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
  expect(simulatedPatientConnectionFailure).toBe(true);
  expect(patientRequestIds.length).toBe(2);
  expect(new Set(patientRequestIds).size).toBe(1);
  expect(patientRequestIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(simulatedConnectionFailure).toBe(true);
  expect(attendanceRequestIds.length).toBe(2);
  expect(new Set(attendanceRequestIds).size).toBe(1);
  expect(attendanceRequestIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

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
