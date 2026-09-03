import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ContentForm from "@/components/ContentForm";
import AdminReviewPanel from "@/components/AdminReviewPanel";
import ContributorsPanel from "@/components/ContributorsPanel";
import { fetchContributors } from "@/lib/contributors";
import { CONTENT_STATUS_LABEL as STATUS_LABEL } from "@/lib/i18n";
import type { Profile, ContentPost, ContentStatus } from "@/lib/types";


const PANEL_T = {
  es: {
    statusTitle: "Estado de tu propuesta", pubDate: "Fecha de publicación",
    channel: "Canal", format: "Formato", comments: "Comentarios del equipo",
    noComments: "Aún no hay comentarios del equipo.", noDate: "Por definir",
    back: "← Volver a contenidos",
  },
  en: {
    statusTitle: "Your proposal status", pubDate: "Publication date",
    channel: "Channel", format: "Format", comments: "Team comments",
    noComments: "No team comments yet.", noDate: "To be defined",
    back: "← Back to content",
  },
  ko: {
    statusTitle: "제안 진행 상황", pubDate: "게시일",
    channel: "채널", format: "포맷", comments: "팀 피드백",
    noComments: "아직 팀 피드백이 없어요.", noDate: "미정",
    back: "← 콘텐츠로 돌아가기",
  },
} as const;

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [profileRes, postRes, cyclesRes] = await Promise.all([
    supabase.from("profiles").select("id, is_admin, locale, full_name").eq("auth_user_id", user.id).single(),
    supabase.from("content_posts").select("*, reel_specs(*), responsible:profiles!responsible_id(full_name)").eq("id", id).single(),
    supabase.from("publication_cycles").select("id, label, cycle_number, final_deadline").order("cycle_number"),
  ]);

  const profile = profileRes.data as Pick<Profile, "id" | "is_admin" | "locale" | "full_name"> | null;
  if (!profile) redirect("/auth/login");

  const post = postRes.data as ContentPost | null;
  if (!post) notFound();

  // Everyone credited on the post, lead first. RLS already let this request
  // through, so anyone reaching here may see the credit list.
  const contributorMap = await fetchContributors(supabase, [post.id]);
  const contributors = contributorMap[post.id] ?? [];

  const isOwner = post.responsible_id === profile.id;
  const isContributor = contributors.some((c) => c.profile_id === profile.id);
  // Must mirror posts_update_own exactly (migration 19). An admin asking for
  // changes sends a post to in_progress; if that were missing here the
  // volunteer would be told to fix it and given no way to.
  const EDITABLE_STATUSES = ["draft", "not_started", "in_progress", "submitted", "rejected"];
  const canEdit = profile.is_admin || (isOwner && EDITABLE_STATUSES.includes(post.status));

  // A collaborator can read the post they worked on, but not edit it — editing
  // stays with the lead and admins, matching posts_update_own.
  if (!canEdit && !isOwner && !isContributor && !profile.is_admin) redirect("/content");

  // Opening the post is what "seen" means. Goes through mark_post_seen because
  // writing volunteer_seen_at directly would need UPDATE on the row, which
  // posts_update_own withholds once a post is approved or published — exactly
  // the states a decision badge points at.
  if (!profile.is_admin && isOwner) {
    await supabase.rpc("mark_post_seen", { p_post_id: post.id });
  }

  const T = PANEL_T[profile.locale];
  const feedback = [post.admin_notes, post.review_feedback].filter(Boolean).join("\n\n");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Returning through this link restores the list's scroll position, so a
          post opened from the middle of ~90 rows does not send you back to the
          top (see lib/use-scroll-restoration). */}
      <Link
        href={profile.is_admin ? "/admin/content" : "/content"}
        className="inline-block text-sm font-bold btn-hover"
        style={{ color: "#38B39E" }}
      >
        {T.back}
      </Link>

      {/* Admin: full review controls */}
      {profile.is_admin && (
        <AdminReviewPanel post={post} locale={profile.locale} />
      )}

      {/* Volunteer: status + team comments panel */}
      {!profile.is_admin && (
        <div className="rounded-2xl p-5 shadow-koco space-y-3 anim-in" style={{ backgroundColor: "#F8F0DE" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{T.statusTitle}</h2>
            <span className={`chip-${post.status} label-style px-3 py-0.5 rounded-full whitespace-nowrap`}>
              {STATUS_LABEL[post.status as ContentStatus][profile.locale]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: "#555" }}>
            <p><span className="font-medium" style={{ color: "#1C1C1C" }}>{T.pubDate}:</span> {post.publication_date ?? T.noDate}</p>
            {post.channel && <p><span className="font-medium" style={{ color: "#1C1C1C" }}>{T.channel}:</span> {post.channel}</p>}
            {post.format && <p><span className="font-medium" style={{ color: "#1C1C1C" }}>{T.format}:</span> {post.format}</p>}
          </div>

          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: feedback ? "rgba(56,179,158,0.08)" : "rgba(0,0,0,0.03)" }}>
            <p className="text-xs font-bold mb-1" style={{ color: feedback ? "#1F7A6E" : "#888" }}>{T.comments}</p>
            <p className="text-sm whitespace-pre-line" style={{ color: feedback ? "#1C1C1C" : "#888" }}>
              {feedback || T.noComments}
            </p>
          </div>
        </div>
      )}

      {/* Credit list — visible to everyone who can open the post. The lead can
          edit it while the post is still editable; admins always can. */}
      <ContributorsPanel
        postId={post.id}
        contributors={contributors}
        canEdit={canEdit}
        isAdmin={profile.is_admin}
      />

      {canEdit ? (
        <ContentForm
          profileId={profile.id}
          locale={profile.locale}
          cycles={cyclesRes.data ?? []}
          post={post}
        />
      ) : (
        <div className="rounded-2xl p-6 shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 1 } as React.CSSProperties}>
          <h1 className="text-xl font-bold mb-3" style={{ color: "#1C1C1C" }}>{post.title}</h1>
          <div className="space-y-2 text-sm" style={{ color: "#555" }}>
            {post.caption && <p className="whitespace-pre-line">{post.caption}</p>}
            {post.script && <p className="whitespace-pre-line text-xs" style={{ color: "#888" }}>{post.script}</p>}
            {post.hashtags && <p className="text-xs" style={{ color: "#38B39E" }}>{post.hashtags}</p>}
            {post.design_url && (
              <a href={post.design_url} target="_blank" rel="noreferrer" className="inline-block text-xs font-bold underline" style={{ color: "#38B39E" }}>
                {post.design_url}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
