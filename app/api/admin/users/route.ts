import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIdentifier } from "@/lib/ratelimit";
import { generateTempPassword } from "@/lib/temp-password";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/users
 * Body: { email, firstName, lastName, groupId?, isAdmin?, linkProfileId? }
 *
 * Creates (or finds) the auth user with a temporary password and
 * must_change_password metadata, then creates a new profile or links
 * an existing unlinked profile. Admin-only.
 */
export async function POST(request: NextRequest) {
  // 1. Verify the caller is an authenticated admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("auth_user_id", user.id)
    .single();

  if (!callerProfile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rl = await checkRateLimit("adminUsers", clientIdentifier(request, user.id));
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
  }

  // 2. Validate input
  const body = await request.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const groupId = body.groupId || null;
  const isAdmin = Boolean(body.isAdmin);
  const linkProfileId = body.linkProfileId || null;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!linkProfileId && (!firstName || !lastName)) {
    return NextResponse.json({ error: "First and last name required" }, { status: 400 });
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const tempPassword = generateTempPassword();

  // 3. Create or find the auth user (service role)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let authUserId: string;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { must_change_password: true, full_name: fullName || undefined },
  });

  if (createError) {
    // Already registered → find and reset to temp password
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    // The permanent superadmin account cannot be reset by other admins
    if (existing.app_metadata?.superadmin && existing.id !== user.id) {
      return NextResponse.json({ error: "This account is protected and cannot be modified" }, { status: 403 });
    }
    authUserId = existing.id;
    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
      password: tempPassword,
      user_metadata: { ...existing.user_metadata, must_change_password: true },
    });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    authUserId = created.user.id;
  }

  // 4. Link an existing profile, or create a new one (service role bypasses RLS)
  let profileId: string;

  if (linkProfileId) {
    // Only unlinked profiles can be linked — prevents hijacking a live account
    const { data: target } = await admin
      .from("profiles")
      .select("id, auth_user_id")
      .eq("id", linkProfileId)
      .single();
    if (!target) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (target.auth_user_id) {
      return NextResponse.json({ error: "Profile is already linked to an account" }, { status: 409 });
    }

    const { data: linked, error: linkError } = await admin
      .from("profiles")
      .update({ auth_user_id: authUserId })
      .eq("id", linkProfileId)
      .select("id")
      .single();
    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
    profileId = linked.id;
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("profiles")
      .insert({
        auth_user_id: authUserId,
        full_name: fullName,
        display_name: firstName,
        group_id: groupId,
        is_admin: isAdmin,
        locale: "es",
        active: true,
      })
      .select("id")
      .single();
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    profileId = inserted.id;
  }

  return NextResponse.json({
    ok: true,
    profileId,
    authUserId,
    tempPassword,
  });
}
