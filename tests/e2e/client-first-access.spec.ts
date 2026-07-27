import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const runProductionMutations = process.env.PLAYWRIGHT_RUN_CLIENT_ACCESS_MUTATIONS === "true";
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const adminEmail = process.env.PLAYWRIGHT_PLATFORM_ADMIN_EMAIL;
const adminPassword = process.env.PLAYWRIGHT_PLATFORM_ADMIN_PASSWORD;
const adminBaseUrl = process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "https://podoadmin360.supremetechdev.com";
const registrationBaseUrl = process.env.PLAYWRIGHT_CLIENT_REGISTRATION_BASE_URL;
const clinicBaseUrl = process.env.PLAYWRIGHT_CLINIC_BASE_URL ?? "https://podo360.supremetechdev.com";

test.describe("primeiro acesso do cliente aprovado", () => {
  test.skip(!runProductionMutations, "Defina PLAYWRIGHT_RUN_CLIENT_ACCESS_MUTATIONS=true para permitir dados ficticios controlados.");
  test.skip(!supabaseUrl || !supabaseAnonKey, "Ambiente publico do servico nao configurado.");
  test.skip(!adminEmail || !adminPassword, "Credenciais locais do Admin Global nao configuradas.");
  test.skip(!registrationBaseUrl, "URL local ou publica do Cadastro Cliente nao configurada.");

  test("converte solicitacao, cria acesso real e bloqueia Admin Global", async ({ browser }) => {
    const runId = Date.now().toString(36);
    const clinicName = `TESTE_CLIENT_ACCESS_${runId}`;
    const clientEmail = `podo360.client.${runId}@example.com`;
    const clientPassword = `Px!${crypto.randomUUID()}9a`;
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { error: requestError } = await supabase.from("platform_client_registration_requests").insert({
      clinic_name: clinicName,
      clinic_type: "Podologia",
      city: "Cidade Teste",
      state: "RJ",
      responsible_name: "Cliente Primeiro Acesso",
      responsible_email: clientEmail,
      responsible_phone: "(00) 90000-0000",
      desired_admin_name: "Administrador Primeiro Acesso",
      desired_admin_email: clientEmail,
      interested_plan: "start",
      estimated_users: 1,
      estimated_professionals: 1,
      wants_white_label: false,
      source: "playwright-client-first-access",
      notes: "Registro ficticio controlado para validacao do primeiro acesso.",
      status: "pending"
    });
    expect(requestError).toBeNull();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto(adminBaseUrl);
    await adminPage.getByLabel("E-mail").fill(adminEmail!);
    await adminPage.getByLabel("Senha").fill(adminPassword!);
    await adminPage.getByRole("button", { name: "Entrar" }).click();
    await expect(adminPage.getByText("Dashboard administrativo da plataforma.")).toBeVisible();
    await adminPage.getByRole("button", { name: "Solicitacoes de Cadastro" }).click();

    const requestCard = adminPage.locator("article.company-card").filter({ hasText: clinicName });
    await expect(requestCard).toBeVisible();
    await requestCard.locator("summary").filter({ hasText: "Converter em clinica" }).click();
    const conversionForm = requestCard.locator("form").filter({ hasText: "Limite de usuarios" });
    await conversionForm.getByLabel("Status inicial").selectOption("trial");
    await conversionForm.getByLabel("Plano").selectOption({ index: 1 });
    await conversionForm.getByLabel("Limite de usuarios").fill("1");
    await conversionForm.getByLabel("Nome do admin").fill("Administrador Primeiro Acesso");
    await conversionForm.getByLabel("E-mail do admin").fill(clientEmail);
    await conversionForm.getByRole("button", { name: "Converter em clinica" }).click();

    const accessLinkInput = requestCard.getByLabel("Link de uso unico");
    await expect(accessLinkInput).toBeVisible();
    const generatedAccessUrl = await accessLinkInput.inputValue();
    const tokenFragment = new URL(generatedAccessUrl).hash;
    expect(tokenFragment.startsWith("#token=")).toBeTruthy();
    expect(new URL(generatedAccessUrl).search).toBe("");

    const registrationContext = await browser.newContext();
    const registrationPage = await registrationContext.newPage();
    await registrationPage.goto(`${registrationBaseUrl}/criar-acesso${tokenFragment}`);
    await expect(registrationPage.getByText(`Clinica vinculada`)).toBeVisible();
    await expect(registrationPage.getByText(clinicName)).toBeVisible();
    await expect(registrationPage.getByLabel("E-mail autorizado")).toHaveValue(clientEmail);
    await expect(registrationPage.getByLabel("E-mail autorizado")).toHaveAttribute("readonly", "");
    await registrationPage.getByLabel("Nome completo").fill("Administrador Primeiro Acesso");
    const passwordInputs = registrationPage.locator('input[autocomplete="new-password"]');
    await passwordInputs.nth(0).fill(clientPassword);
    await passwordInputs.nth(1).fill(clientPassword);
    await registrationPage.getByText(/Confirmo que sou o responsavel/).click();
    await registrationPage.getByRole("button", { name: "Criar acesso" }).click();
    await expect(registrationPage.getByText("Seu acesso foi criado com sucesso.")).toBeVisible();

    const usedLinkPage = await registrationContext.newPage();
    await usedLinkPage.goto(`${registrationBaseUrl}/criar-acesso${tokenFragment}`);
    await expect(usedLinkPage.getByText("Este acesso ja foi criado. Faca login para continuar.")).toBeVisible();

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: clientEmail,
      password: clientPassword
    });
    expect(loginError).toBeNull();
    expect(loginData.user).toBeTruthy();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id,role,active")
      .eq("id", loginData.user!.id)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.role).toBe("company_admin");
    expect(profile?.active).toBe(true);

    const { data: platformAdmin } = await supabase
      .from("platform_admin_users")
      .select("user_id")
      .eq("user_id", loginData.user!.id)
      .maybeSingle();
    expect(platformAdmin).toBeNull();
    await supabase.auth.signOut();

    const clinicContext = await browser.newContext();
    const clinicPage = await clinicContext.newPage();
    await clinicPage.goto(clinicBaseUrl);
    await clinicPage.getByLabel("E-mail").fill(clientEmail);
    await clinicPage.locator('input[name="password"]').fill(clientPassword);
    await clinicPage.getByRole("button", { name: "Entrar" }).click();
    await expect(clinicPage.getByText("Dashboard", { exact: true }).first()).toBeVisible();

    const deniedAdminContext = await browser.newContext();
    const deniedAdminPage = await deniedAdminContext.newPage();
    await deniedAdminPage.goto(adminBaseUrl);
    await deniedAdminPage.getByLabel("E-mail").fill(clientEmail);
    await deniedAdminPage.getByLabel("Senha").fill(clientPassword);
    await deniedAdminPage.getByRole("button", { name: "Entrar" }).click();
    await expect(deniedAdminPage.getByText(/nao possui permissao de Admin Global ativa/i)).toBeVisible();

    await requestCard.getByRole("button", { name: "Gerar novo link" }).click();
    await expect(accessLinkInput).not.toHaveValue(generatedAccessUrl);
    const replacementAccessUrl = await accessLinkInput.inputValue();
    const replacementTokenFragment = new URL(replacementAccessUrl).hash;
    await requestCard.getByRole("button", { name: "Cancelar convite" }).click();
    const cancelledLinkPage = await registrationContext.newPage();
    await cancelledLinkPage.goto(`${registrationBaseUrl}/criar-acesso${replacementTokenFragment}`);
    await expect(cancelledLinkPage.getByText("Este link foi cancelado. Solicite um novo acesso ao suporte Podo360.")).toBeVisible();

    const invalidLinkPage = await registrationContext.newPage();
    await invalidLinkPage.goto(`${registrationBaseUrl}/criar-acesso#token=token-invalido-controlado`);
    await expect(invalidLinkPage.getByText("Este link nao e valido. Solicite um novo acesso ao suporte Podo360.")).toBeVisible();

    await Promise.all([
      adminContext.close(),
      registrationContext.close(),
      clinicContext.close(),
      deniedAdminContext.close()
    ]);
  });
});
