import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanupClinicalTestData } from "./helpers/cleanupClinicalTestData";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const userAEmail = process.env.PLAYWRIGHT_USER_A_EMAIL;
const userAPassword = process.env.PLAYWRIGHT_USER_A_PASSWORD;
const userBEmail = process.env.PLAYWRIGHT_USER_B_EMAIL;
const userBPassword = process.env.PLAYWRIGHT_USER_B_PASSWORD;
const allowMutation = process.env.PLAYWRIGHT_RUN_PRODUCTION_MUTATIONS === "true";

function createRunId() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  return `TESTE_CLINICO_FINAL_SEGURO_${stamp.slice(0, 8)}_${stamp.slice(8, 14)}_${randomBytes(4).toString("hex")}`;
}

function createApi() {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function authenticate(api: SupabaseClient, email: string, password: string) {
  const { data, error } = await api.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  const { data: profile, error: profileError } = await api.from("profiles")
    .select("id,company_id,role,active").eq("id", data.user!.id).single();
  expect(profileError).toBeNull();
  expect(profile?.active).toBe(true);
  return profile!;
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel(/^E-mail$/i).fill(email);
  await page.getByLabel(/^Senha$/i).fill(password);
  await page.getByRole("button", { name: /^Entrar$/i }).click();
  await expect(page.getByRole("navigation", { name: /Principal/i })).toBeVisible({ timeout: 30_000 });
}

async function logout(page: Page) {
  await page.getByRole("button", { name: /Sair da conta/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Sair da conta$/i }).click();
  await expect(page.getByRole("heading", { name: /Entrar no sistema/i })).toBeVisible();
}

async function createPatientAndBa(page: Page, runId: string) {
  const patientName = `${runId}_PACIENTE`;
  await page.getByRole("button", { name: /Abertura de atendimento/i }).click();
  await page.locator('input[name="fullName"]').fill(patientName);
  await page.locator('input[name="cpf"]').fill(`000${Date.now().toString().slice(-8)}`);
  await page.locator('input[name="birthDate"]').fill("1988-08-08");
  await page.locator('input[name="phone"]').fill("00900000000");
  await page.locator('textarea[name="initialNotes"]').fill(`${runId}_MULTIEMPRESA`);
  await page.getByRole("button", { name: /Abrir BA/i }).click();
  await expect(page.locator(".toast")).toContainText(/BA aberto com sucesso/i, { timeout: 30_000 });
  return patientName;
}

test("usuarios A e B permanecem isolados por empresa com cleanup independente", async ({ page }, testInfo) => {
  test.skip(!supabaseUrl || !supabaseAnonKey || !userAEmail || !userAPassword || !userBEmail || !userBPassword, "Usuarios A e B ativos sao obrigatorios.");
  test.skip(!allowMutation, "Defina PLAYWRIGHT_RUN_PRODUCTION_MUTATIONS=true para o teste controlado.");
  test.setTimeout(360_000);

  const runA = createRunId();
  const runB = createRunId();
  const apiA = createApi();
  const apiB = createApi();

  try {
    const profileA = await authenticate(apiA, userAEmail!, userAPassword!);
    const profileB = await authenticate(apiB, userBEmail!, userBPassword!);
    expect(profileA.company_id).not.toBe(profileB.company_id);

    await login(page, userAEmail!, userAPassword!);
    const patientNameA = await createPatientAndBa(page, runA);
    const { data: patientA, error: patientAError } = await apiA.from("patients").select("id").eq("full_name", patientNameA).single();
    expect(patientAError).toBeNull();
    const { data: attendanceA, error: attendanceAError } = await apiA.from("attendances").select("id").eq("patient_id", patientA!.id).single();
    expect(attendanceAError).toBeNull();
    await logout(page);

    const { data: forbiddenPatient, error: forbiddenPatientError } = await apiB.from("patients").select("id").eq("id", patientA!.id);
    const { data: forbiddenAttendance, error: forbiddenAttendanceError } = await apiB.from("attendances").select("id").eq("id", attendanceA!.id);
    expect(forbiddenPatientError).toBeNull();
    expect(forbiddenAttendanceError).toBeNull();
    expect(forbiddenPatient).toEqual([]);
    expect(forbiddenAttendance).toEqual([]);

    await login(page, userBEmail!, userBPassword!);
    await page.getByRole("button", { name: /^Pacientes$/i }).click();
    await expect(page.getByText(patientNameA)).toHaveCount(0);
    const patientNameB = await createPatientAndBa(page, runB);
    const { data: patientB, error: patientBError } = await apiB.from("patients").select("id").eq("full_name", patientNameB).single();
    expect(patientBError).toBeNull();
    const { data: forbiddenBFromA, error: forbiddenBError } = await apiA.from("patients").select("id").eq("id", patientB!.id);
    expect(forbiddenBError).toBeNull();
    expect(forbiddenBFromA).toEqual([]);
    await logout(page);

    await testInfo.attach("multitenant-evidence", {
      body: JSON.stringify({ runA, runB, companyA: profileA.company_id, companyB: profileB.company_id, isolated: true }, null, 2),
      contentType: "application/json"
    });
  } finally {
    const cleanupA = await cleanupClinicalTestData(apiA, runA);
    const cleanupB = await cleanupClinicalTestData(apiB, runB);
    await testInfo.attach("multitenant-cleanup-evidence", {
      body: JSON.stringify({ cleanupA, cleanupB }, null, 2),
      contentType: "application/json"
    });
    await apiA.auth.signOut();
    await apiB.auth.signOut();
  }
});
