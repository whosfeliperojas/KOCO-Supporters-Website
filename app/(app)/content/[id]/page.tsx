import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ContentForm from "@/components/ContentForm";
import AdminReviewPanel from "@/components/AdminReviewPanel";
import type { Profile, ContentPost, ContentStatus } from "@/lib/types";

const STATUS_LABEL: Record<ContentStatus, { es: string; en: string; ko: string }> = {
  draft:        { es: "Borrador",    en: "Draft",       ko: "임시 저장" },
  submitted:    { es: "Enviado",     en: "Submitted",   ko: "제출됨" },
  in_review:    { es: "En revisión", en: "In review",   ko: "검토 중" },
  approved:     { es: "Aprobado",    en: "Approved",    ko: "승인됨" },
  published:    { es: "Publicado",   en: "Published",   ko: "게시됨" },
  rejected:     { es: "Rechazado",   en: "Rejected",    ko: "반려됨" },
  cancelled:    { es: "Cancelado",   en: "Cancelled",   ko: "취소됨" },
  rescheduled:  { es: "Reagendado",  en: "Rescheduled", ko: "일정 변경" },
};

const PANEL_T = {
  es: {
    statusTitle: "Estado de tu propuesta", pubDate: "Fecha de publicación",
    channel: "Canal", format: "Formato", comments: "Comentarios del equipo",
    noComments: "Aún no hay comentarios del equipo.", noDate: "Por definir",
  },
  en: {
    statusTitle: "Your proposal status", pubDate: "Publication date",
    channel: "Channel", format: "Format", comments: "Team comments",
    noComments: "No team comments yet.", noDate: "To be defined",
  },
  ko: {
    statusTitle: "제안 진행 상황", pubDate: "게시일",
    channel: "채널", format: "포맷", comments: "팀 피드백",
    noComments: "아직 팀 피드백이 없어요.", noDate: "미정",
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

  const isOwner = post.responsible_id === profile.id;
  const canEdit = profile.is_admin || (isOwner && ["draft", "submitted", "rejected"].includes(post.status));

  if (!canEdit && !isOwner && !profile.is_admin) redirect("/content");

  const T = PANEL_T[profile.locale];
  const feedback = [post.admin_notes, post.review_feedback].filter(Boolean).join("\n\n");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
