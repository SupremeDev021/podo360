/**
 * Example only. Do not put real passwords or service_role keys in this file.
 *
 * Copy this file to:
 *   scripts/setup/create-initial-user.local.ts
 *
 * The local file is ignored by Git. Run it only on your machine with environment
 * variables set outside the repository.
 *
 * Required environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   INITIAL_USER_EMAIL
 *   INITIAL_USER_PASSWORD
 *   INITIAL_USER_FULL_NAME
 *   INITIAL_USER_COMPANY_ID
 *
 * Optional:
 *   INITIAL_USER_ROLE=company_admin
 *   INITIAL_PLATFORM_ROLE=owner
 */

import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INITIAL_USER_EMAIL",
  "INITIAL_USER_PASSWORD",
  "INITIAL_USER_FULL_NAME",
  "INITIAL_USER_COMPANY_ID"
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const role = process.env.INITIAL_USER_ROLE || "company_admin";

const { data: userData, error: userError } = await supabase.auth.admin.createUser({
  email: process.env.INITIAL_USER_EMAIL!,
  password: process.env.INITIAL_USER_PASSWORD!,
  email_confirm: true
});

if (userError) {
  throw userError;
}

const userId = userData.user.id;

const { error: profileError } = await supabase.from("profiles").upsert({
  id: userId,
  company_id: process.env.INITIAL_USER_COMPANY_ID!,
  full_name: process.env.INITIAL_USER_FULL_NAME!,
  email: process.env.INITIAL_USER_EMAIL!,
  role,
  active: true
});

if (profileError) {
  throw profileError;
}

if (process.env.INITIAL_PLATFORM_ROLE) {
  const { error: platformError } = await supabase.from("platform_admin_users").upsert({
    user_id: userId,
    role: process.env.INITIAL_PLATFORM_ROLE,
    active: true
  });

  if (platformError) {
    throw platformError;
  }
}

console.log("Initial user created and linked successfully.");
