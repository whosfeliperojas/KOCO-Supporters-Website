import { CONTENT_STATUS_LABEL as STATUS_LABEL, type Locale } from "@/lib/i18n";
import type { ContentPost, ContentStatus } from "@/lib/types";

/**
 * Where a volunteer's proposal stands, told in words rather than in colour.
 *
 * The page used to hand them a 12px coral pill reading "Rechazado" and nothing
 * else - no sentence, no cause, no next step - inside a box tinted with the
 * teal this design system reserves for success. The single most consequential
 * message the product sends was left entirely to a CSS class.
 *
 * Lifted out of the detail page so it can be rendered and looked at on its
 * own; the page was a server component and this markup could not be seen
 * without a login.
 */

const MEANS = {
  submitted:   { es: "Enviada. El equipo KOICA la revisará pronto.",                      en: "Sent. The KOICA team will review it soon.",                  ko: "제출됐어요. KOICA 팀이 곧 검토할 거예요." },
  in_review:   { es: "El equipo la está revisando.",                                      en: "The team is reviewing it.",                                  ko: "팀이 검토하고 있어요." },
  in_progress: { es: "Te toca a ti: ajusta lo que pide el equipo y vuelve a enviarla.",   en: "Your turn: make the changes the team asked for and resend.",  ko: "이제 여러분 차례예요. 요청된 부분을 고쳐서 다시 보내 주세요." },
  rejected:    { es: "Esta vez no avanzó. Revisa los comentarios, ajústala y reenvíala.", en: "It didn't go through this time. Read the comments, adjust it and send it again.", ko: "이번에는 통과하지 못했어요. 피드백을 확인하고 수정해서 다시 보내 주세요." },
  approved:    { es: "¡Aprobada! Ya está lista para publicarse.",                         en: "Approved! It's ready to go out.",                            ko: "승인됐어요! 게시 준비가 끝났어요." },
  published:   { es: "¡Publicada! Gracias por crearla.",                                  en: "Published! Thanks for making it.",                           ko: "게시됐어요! 만들어 줘서 고마워요." },
  rescheduled: { es: "Se movió a otra fecha.",                                            en: "Moved to another date.",                                     ko: "다른 날짜로 옮겼어요." },
  cancelled:   { es: "Ya no está en el calendario.",                                      en: "No longer on the calendar.",                                 ko: "캘린더에서 빠졌어요." },
  draft:       { es: "Es un borrador. Envíala cuando la tengas lista.",                   en: "It's a draft. Send it when you're ready.",                   ko: "임시 저장 상태예요. 준비되면 보내 주세요." },
  not_started: { es: "Aún sin empezar.",                                                  en: "Not started yet.",                                           ko: "아직 시작 전이에요." },
} as const;

/**
 * The tint behind the team's comments follows the verdict. It was teal
 * whenever feedback existed - the colour DESIGN.md assigns to success - so a
 * rejection arrived wearing the success colour.
 */
const FEEDBACK_TINT: Record<string, { bg: string; label: string }> = {
  rejected:    { bg: "rgba(226,105,62,0.10)", label: "#8C3010" },
  in_progress: { bg: "rgba(236,160,64,0.16)", label: "#7A4E00" },
};

export default function PostStatusPanel({
  post,
  locale,
  t,
}: {
  post: ContentPost;
  locale: Locale;
  t: {
    statusTitle: string; pubDate: string; channel: string; format: string;
    comments: string; noComments: string; noDate: string;
  };
}) {
  const feedback = [post.admin_notes, post.review_feedback].filter(Boolean).join("\n\n");
  const means = MEANS[post.status as keyof typeof MEANS];
  const tint = FEEDBACK_TINT[post.status];

  return (
    <div className="rounded-2xl p-5 shadow-koco space-y-3 anim-in" style={{ backgroundColor: "#FDFAF3" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{t.statusTitle}</h2>
        <span className={`chip-${post.status} label-style px-3 py-0.5 rounded-full whitespace-nowrap`}>
          {STATUS_LABEL[post.status as ContentStatus][locale]}
        </span>
      </div>

      {/* The chip names the state; this says what it means for you and what
          happens next. A pill alone made the reader infer both. */}
      {means && <p className="text-sm measure" style={{ color: "#1C1C1C" }}>{means[locale]}</p>}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: "#555" }}>
        <p><span className="font-medium" style={{ color: "#1C1C1C" }}>{t.pubDate}:</span> {post.publication_date ?? t.noDate}</p>
        {post.channel && <p><span className="font-medium" style={{ color: "#1C1C1C" }}>{t.channel}:</span> {post.channel}</p>}
        {post.format && <p><span className="font-medium" style={{ color: "#1C1C1C" }}>{t.format}:</span> {post.format}</p>}
      </div>

      <div
        className="rounded-lg px-4 py-3"
        style={{ backgroundColor: feedback ? (tint?.bg ?? "rgba(56,179,158,0.08)") : "rgba(0,0,0,0.03)" }}
      >
        <p className="text-xs font-bold mb-1" style={{ color: feedback ? (tint?.label ?? "#1F7A6E") : "#6B6258" }}>
          {t.comments}
        </p>
        <p className="text-sm whitespace-pre-line measure" style={{ color: feedback ? "#1C1C1C" : "#6B6258" }}>
          {feedback || t.noComments}
        </p>
      </div>
    </div>
  );
}
