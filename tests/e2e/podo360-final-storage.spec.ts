import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const userAEmail = process.env.PLAYWRIGHT_USER_A_EMAIL;
const userAPassword = process.env.PLAYWRIGHT_USER_A_PASSWORD;
const userBEmail = process.env.PLAYWRIGHT_USER_B_EMAIL;
const userBPassword = process.env.PLAYWRIGHT_USER_B_PASSWORD;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const companyAId = "d4666e95-0278-4cfb-b805-0b93b6bc4d4a";
const companyBId = "b7cd6131-5565-406a-ac9c-eb5f0cce21f1";
const bucketName = "company-assets";

function requireFinalStorageEnv() {
  test.skip(!supabaseUrl || !supabaseAnonKey, "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY localmente.");
  test.skip(!userAEmail || !userAPassword, "Configure PLAYWRIGHT_USER_A_EMAIL e PLAYWRIGHT_USER_A_PASSWORD localmente.");
  test.skip(!userBEmail || !userBPassword, "Configure PLAYWRIGHT_USER_B_EMAIL e PLAYWRIGHT_USER_B_PASSWORD localmente.");
}

function createSupabaseClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

async function authenticatedClient(email: string, password: string) {
  const client = createSupabaseClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error, `login Supabase direto falhou para ${email}`).toBeNull();
  return client;
}

async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel(/^E-mail$/i).fill(email);
  await page.getByLabel(/^Senha$/i).fill(password);
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible();
}

async function uploadLogoThroughUi(page: Page, fileName: string) {
  await page.getByRole("button", { name: /^Identidade$/i }).click();
  await expect(page.getByRole("heading", { name: /Configuracoes da empresa|Configura/i })).toBeVisible();

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="#0f766e"/><text x="48" y="54" text-anchor="middle" font-family="Arial" font-size="16" fill="#fff">P360</text></svg>`
  );

  await page.locator('.logo-upload-button input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "image/svg+xml",
    buffer: svg
  });
  await expect(page.locator(".toast")).toContainText(/Logo enviada/i, { timeout: 20_000 });
}

async function findUploadedTestPath(client: SupabaseClient, companyId: string, fileNameFragment: string) {
  const { data, error } = await client.storage.from(bucketName).list(`${companyId}/logo`, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" }
  });
  expect(error, `listagem do Storage falhou para ${companyId}`).toBeNull();

  const file = (data ?? []).find((item) => item.name.includes(fileNameFragment));
  expect(file, `arquivo ${fileNameFragment} nao encontrado em ${companyId}/logo`).toBeTruthy();
  return `${companyId}/logo/${file!.name}`;
}

async function expectCannotListCompanyPrefix(client: SupabaseClient, companyId: string) {
  const { data, error } = await client.storage.from(bucketName).list(`${companyId}/logo`, { limit: 100 });
  expect(error || (data ?? []).length === 0).toBeTruthy();
}

async function cleanupStoragePaths(paths: Array<{ client: SupabaseClient; path: string }>) {
  for (const item of paths) {
    await item.client.storage.from(bucketName).remove([item.path]);
  }
}

test("upload real de logo fica isolado por empresa no bucket company-assets", async ({ page }) => {
  requireFinalStorageEnv();
  test.setTimeout(180_000);
  const createdPaths: Array<{ client: SupabaseClient; path: string }> = [];

  const clientA = await authenticatedClient(userAEmail!, userAPassword!);
  const clientB = await authenticatedClient(userBEmail!, userBPassword!);
  const anonClient = createSupabaseClient();

  try {
    await loginWithCredentials(page, userAEmail!, userAPassword!);
    await uploadLogoThroughUi(page, "TESTE_PRODUCAO_PODO360_LOGO_A.svg");
    const pathA = await findUploadedTestPath(clientA, companyAId, "TESTE_PRODUCAO_PODO360_LOGO_A");
    createdPaths.push({ client: clientA, path: pathA });

    await expectCannotListCompanyPrefix(clientB, companyAId);

    await page.getByRole("button", { name: /Sair da conta/i }).click();
    await page.getByRole("dialog", { name: /Deseja realmente sair da conta/i }).getByRole("button", { name: /^Sair da conta$/i }).click();
    await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();

    await loginWithCredentials(page, userBEmail!, userBPassword!);
    await uploadLogoThroughUi(page, "TESTE_PRODUCAO_PODO360_LOGO_B.svg");
    const pathB = await findUploadedTestPath(clientB, companyBId, "TESTE_PRODUCAO_PODO360_LOGO_B");
    createdPaths.push({ client: clientB, path: pathB });

    await expectCannotListCompanyPrefix(clientA, companyBId);
    await expectCannotListCompanyPrefix(anonClient, companyAId);
    await expectCannotListCompanyPrefix(anonClient, companyBId);
  } finally {
    await cleanupStoragePaths(createdPaths);
  }
});

test("Empresa B suspensa bloqueia login com mensagem amigavel", async ({ page }) => {
  requireFinalStorageEnv();
  test.skip(process.env.PLAYWRIGHT_EXPECT_USER_B_SUSPENDED !== "true", "Defina PLAYWRIGHT_EXPECT_USER_B_SUSPENDED=true somente durante o teste controlado de status suspended.");

  await page.goto("/");
  await page.getByLabel(/^E-mail$/i).fill(userBEmail!);
  await page.getByLabel(/^Senha$/i).fill(userBPassword!);
  await page.getByRole("button", { name: /^Entrar$/i }).click();

  await expect(page.getByText(/O acesso da sua cl.nica est. temporariamente indispon.vel/i)).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Podo360/i })).toHaveCount(0);
});
