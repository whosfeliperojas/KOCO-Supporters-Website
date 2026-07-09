import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContentForm from "@/components/ContentForm";
import type { Profile } from "@/lib/types";

export default async function NewContentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [profileRes, cyclesRes] = await Promise.all([
    supabase.from("profiles").select("id, is_admin, locale, full_name, group_id").eq("auth_user_id", user.id).single(),
    supabase.from("publication_cycles").select("id, label, cycle_number, final_deadline").order("cycle_number"),
  ]);

  const profile = profileRes.data as Pick<Profile, "id" | "is_admin" | "locale" | "full_name" | "group_id"> | null;
  if (!profile) redirect("/auth/login");

  return (
    <ContentForm
      profileId={profile.id}
      locale={profile.locale}
      cycles={cyclesRes.data ?? []}
      post={null}
    />
  );
}
