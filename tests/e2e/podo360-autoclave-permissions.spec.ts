import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const userEmail = process.env.PLAYWRIGHT_USER_A_EMAIL;
const userPassword = process.env.PLAYWRIGHT_USER_A_PASSWORD;
const allowProductionMutation = process.env.PLAYWRIGHT_RUN_PRODUCTION_MUTATIONS === "true";

test("company admin registra e remove ciclo de autoclave com RLS", async () => {
  test.skip(!supabaseUrl || !supabaseAnonKey || !userEmail || !userPassword, "Ambiente autenticado local nao configurado.");
  test.skip(!allowProductionMutation, "Defina PLAYWRIGHT_RUN_PRODUCTION_MUTATIONS=true para o teste controlado.");

  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const id = randomUUID();

  try {
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email: userEmail!,
      password: userPassword!
    });
    expect(authError).toBeNull();
    expect(authData.user).toBeTruthy();

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, company_id, role, active")
      .eq("id", authData.user!.id)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.active).toBe(true);
    expect(["super_admin", "company_admin", "professional", "stock"]).toContain(profile?.role);

    const { data: created, error: createError } = await client
      .from("autoclave_records")
      .insert({
        id,
        company_id: profile!.company_id,
        cycle_date: new Date().toISOString().slice(0, 10),
        start_time: "08:00",
        end_time: "08:30",
        cycle_number: `TESTE_AUTOCLAVE_${Date.now()}`,
        sterilization_lot: "TESTE_AUTOCLAVE_RLS",
        responsible_user_id: profile!.id,
        responsible_name: "TESTE AUTOCLAVE",
        autoclave_name: "AUTOCLAVE FICTICIA",
        cycle_type: "instruments",
        chemical_indicator_result: "approved",
        biological_indicator_result: "not_used",
        integrator_result: "approved",
        bowie_dick_result: "not_used",
        final_result: "approved",
        status: "approved",
        created_by: profile!.id,
        updated_by: profile!.id
      })
      .select("id, company_id")
      .single();

    expect(createError).toBeNull();
    expect(created).toEqual({ id, company_id: profile!.company_id });
  } finally {
    await client.from("autoclave_records").delete().eq("id", id);
    await client.auth.signOut();
  }
});
