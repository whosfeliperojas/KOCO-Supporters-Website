import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIdentifier } from "@/lib/ratelimit";
import { generateTempPassword } from "@/lib/temp-password";
import { NextRequest, NextResponse } from "next/server";

type Action = "offboard" | "reactivate" | "reset-password";
const ACTIONS: Action[] = ["offboard", "reactivate", "reset-password"];

/**
 * PATCH /api/admin/users/[id]
 * Body: { action: "offboard" | "reactivate" | "reset-password" }
 * [id] is a public.profiles id (NOT an auth user id).
 *
 * offboard       — deletes the auth user so the login stops working, and marks
 *                  the profile inactive. Points, RSVPs and posts are untouched:
 *                  every FK to profiles(id) is NO ACTION, and the historical
 *                  scoring record is what decides standing against the 80-point
 *                  milestone. Nothing here deletes a profile.
 * reactivate     — flips active back on. Does not restore a login; the admin
 *                  re-issues access with POST /api/admin/users + linkProfileId.
 * reset-password — new temp password + must_change_password, for a forgotten one.
 *
 * Admin-only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profileId } = await params;

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
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  // 2. Validate input
  const body = await request.json();
  const action = body.action as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // An admin must never be able to lock themselves out.
  if (profileId === callerProfile.id) {
    return NextResponse.json(
      { error: "You cannot run this action on your own account" },
      { status: 400 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 3. Load the target profile (service role bypasses RLS)
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, full_name, active, auth_user_id")
    .eq("id", profileId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // The permanent superadmin account is protected from other admins.
  if (target.auth_user_id) {
    const { data: targetAuth } = await admin.auth.admin.getUserById(target.auth_user_id);
    if (targetAuth?.user?.app_metadata?.superadmin && target.auth_user_id !== user.id) {
      return NextResponse.json(
        { error: "This account is protected and cannot be modified" },
        { status: 403 }
      );
    }
  }

  const before = { active: target.active, auth_user_id: target.auth_user_id };
  let after: Record<string, unknown> = {};
  let tempPassword: string | undefined;

  // 4. Perform the action
  if (action === "offboard") {
    // Deleting the auth user nulls profiles.auth_user_id via ON DELETE SET NULL.
    if (target.auth_user_id) {
      const { error: delError } = await admin.auth.admin.deleteUser(target.auth_user_id);
      if (delError) {
        return NextResponse.json({ error: delError.message }, { status: 500 });
      }
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ active: false })
      .eq("id", profileId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    after = { active: false, auth_user_id: null };

  } else if (action === "reactivate") {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ active: true })
      .eq("id", profileId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    after = { active: true, auth_user_id: target.auth_user_id };

  } else {
    // reset-password
    if (!target.auth_user_id) {
      return NextResponse.json(
        { error: "This profile has no linked account yet — create access instead" },
        { status: 409 }
      );
    }

    const { data: existing } = await admin.auth.admin.getUserById(target.auth_user_id);
    tempPassword = generateTempPassword();

    const { error: updateError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
      password: tempPassword,
      user_metadata: { ...existing?.user?.user_metadata, must_change_password: true },
    });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    after = { must_change_password: true };
  }

  // 5. Record it. audit_log is insert-only by design.
  // The action has already happened, so a failed audit write must not fail the
  // request — but it must not vanish silently either.
  const { error: auditError } = await admin.from("audit_log").insert({
    actor_id: callerProfile.id,
    action,
    target_type: "profile",
    target_id: profileId,
    old_value: before,
    new_value: after,
  });
  if (auditError) {
    console.error("[admin/users] audit_log write failed", {
      action,
      profileId,
      error: auditError.message,
    });
  }

  return NextResponse.json({
    ok: true,
    profileId,
    tempPassword,
    auditLogged: !auditError,
  });
}
