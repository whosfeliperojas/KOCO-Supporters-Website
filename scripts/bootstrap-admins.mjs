// One-time bootstrap: creates the initial admin accounts (a permanent
// superadmin + named admins) and optionally links an existing volunteer
// profile to its auth account once that person has signed in at least once.
// Fully configured via environment variables — no real names, emails, or
// IDs are hardcoded here, so this script is safe to keep in a public repo
// and reusable for any future onboarding round.
//
// Configure in .env.local (only needed if you actually run this):
//   BOOTSTRAP_SUPERADMIN_EMAIL   (required) — the one permanent, protected admin
//   BOOTSTRAP_SUPERADMIN_NAME
//   BOOTSTRAP_ADMIN_2_EMAIL / _NAME
//   BOOTSTRAP_ADMIN_3_EMAIL / _NAME / _PROFILE_ID   (PROFILE_ID links to an
//     existing seeded profile row instead of creating a new one)
//   BOOTSTRAP_VOLUNTEER_EMAIL / _PROFILE_ID          (optional — links one
//     already-signed-in volunteer's auth account to their seeded profile)
//
// Run from the web/ folder:  node scripts/bootstrap-admins.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.join(here, "..", ".env.local"), "utf8");
const env = Object.fromEntries(
  envFile.split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function generateTempPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}
const TEMP_PASSWORD = generateTempPassword();

const SUPERADMIN_EMAIL = env.BOOTSTRAP_SUPERADMIN_EMAIL;
const SUPERADMIN_NAME  = env.BOOTSTRAP_SUPERADMIN_NAME || "Superadmin";

const ADMIN_2_EMAIL = env.BOOTSTRAP_ADMIN_2_EMAIL || null;
const ADMIN_2_NAME  = env.BOOTSTRAP_ADMIN_2_NAME  || "Admin";

const ADMIN_3_EMAIL      = env.BOOTSTRAP_ADMIN_3_EMAIL || null;
const ADMIN_3_NAME       = env.BOOTSTRAP_ADMIN_3_NAME  || "Admin";
const ADMIN_3_PROFILE_ID = env.BOOTSTRAP_ADMIN_3_PROFILE_ID || null;

const VOLUNTEER_EMAIL      = env.BOOTSTRAP_VOLUNTEER_EMAIL || null;
const VOLUNTEER_PROFILE_ID = env.BOOTSTRAP_VOLUNTEER_PROFILE_ID || null;

if (!SUPERADMIN_EMAIL) {
  console.error("Set BOOTSTRAP_SUPERADMIN_EMAIL (and friends) in .env.local before running this script.");
  console.error("See the comment block at the top of this file for the full list.");
  process.exit(1);
}

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("listUsers: " + error.message);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureAdminAuthUser({ email, fullName, superadmin = false }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: TEMP_PASSWORD,
      user_metadata: { ...existing.user_metadata, must_change_password: true, full_name: fullName },
      app_metadata: superadmin ? { ...existing.app_metadata, superadmin: true } : existing.app_metadata,
    });
    if (error) throw new Error(email + " update: " + error.message);
    console.log(`= ${email} already existed — password reset to temp, metadata updated`);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { must_change_password: true, full_name: fullName },
    app_metadata: superadmin ? { superadmin: true } : undefined,
  });
  if (error) throw new Error(email + " create: " + error.message);
  console.log(`+ ${email} created`);
  return data.user.id;
}

async function ensureAdminProfile({ authUserId, fullName, displayName, linkProfileId = null }) {
  const { data: linked } = await admin.from("profiles").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (linked) {
    await admin.from("profiles").update({ is_admin: true, active: true }).eq("id", linked.id);
    console.log(`= profile ${linked.id} already linked — ensured admin flag`);
    return;
  }

  if (linkProfileId) {
    const { error } = await admin
      .from("profiles")
      .update({ auth_user_id: authUserId, is_admin: true, active: true })
      .eq("id", linkProfileId);
    if (error) throw new Error("link profile: " + error.message);
    console.log(`+ linked existing profile ${linkProfileId} (${fullName})`);
    return;
  }

  const { error } = await admin.from("profiles").insert({
    auth_user_id: authUserId,
    full_name: fullName,
    display_name: displayName,
    group_id: null,
    is_admin: true,
    locale: "es",
    active: true,
  });
  if (error) throw new Error("insert profile: " + error.message);
  console.log(`+ created admin profile for ${fullName}`);
}

async function main() {
  // 1. Superadmin (permanent, protected)
  const superId = await ensureAdminAuthUser({
    email: SUPERADMIN_EMAIL,
    fullName: SUPERADMIN_NAME,
    superadmin: true,
  });
  await ensureAdminProfile({ authUserId: superId, fullName: SUPERADMIN_NAME, displayName: SUPERADMIN_NAME });

  // 2. Second admin (optional)
  if (ADMIN_2_EMAIL) {
    const id = await ensureAdminAuthUser({ email: ADMIN_2_EMAIL, fullName: ADMIN_2_NAME });
    await ensureAdminProfile({ authUserId: id, fullName: ADMIN_2_NAME, displayName: ADMIN_2_NAME });
  }

  // 3. Third admin (optional) — can link to an existing seeded profile
  if (ADMIN_3_EMAIL) {
    const id = await ensureAdminAuthUser({ email: ADMIN_3_EMAIL, fullName: ADMIN_3_NAME });
    await ensureAdminProfile({
      authUserId: id,
      fullName: ADMIN_3_NAME,
      displayName: ADMIN_3_NAME,
      linkProfileId: ADMIN_3_PROFILE_ID,
    });
  }

  // 4. Link one already-signed-in volunteer to their seeded profile (optional)
  if (VOLUNTEER_EMAIL && VOLUNTEER_PROFILE_ID) {
    const volunteer = await findUserByEmail(VOLUNTEER_EMAIL);
    if (!volunteer) {
      console.warn(`! ${VOLUNTEER_EMAIL} has no auth user yet — they need to log in once first, then re-run this script.`);
    } else {
      const { error } = await admin
        .from("profiles")
        .update({ auth_user_id: volunteer.id, is_admin: false, active: true })
        .eq("id", VOLUNTEER_PROFILE_ID);
      if (error) throw new Error("volunteer link: " + error.message);
      console.log(`+ linked ${VOLUNTEER_EMAIL} to their volunteer profile (password untouched)`);
    }
  }

  console.log("\nDone. Temp password for any newly created admin account:", TEMP_PASSWORD);
  console.log("Each admin must change it on first login.");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
