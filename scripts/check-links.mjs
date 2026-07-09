import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
console.log("AUTH USERS:");
for (const u of users.users) {
  console.log(` ${u.email}  id=${u.id}  confirmed=${!!u.email_confirmed_at}  must_change=${u.user_metadata?.must_change_password}`);
}

const { data: profiles } = await admin
  .from("profiles")
  .select("id, full_name, is_admin, active, auth_user_id")
  .order("full_name");
console.log("\nPROFILES:");
for (const p of profiles) {
  console.log(` ${p.full_name}  admin=${p.is_admin}  auth_user_id=${p.auth_user_id ?? "NULL"}`);
}
