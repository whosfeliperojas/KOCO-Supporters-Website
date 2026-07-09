"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { companionReact } from "@/components/Companion";
import type { ContentPost } from "@/lib/types";

// Stored values stay canonical (existing DB rows use them); labels localize per language
const FORMATS: { value: string; es: string; en: string; ko: string }[] = [
  { value: "Reel",          es: "Reel",          en: "Reel",        ko: "릴스" },
  { value: "Carrusel",      es: "Carrusel",      en: "Carousel",    ko: "캐러셀" },
  { value: "Post estático", es: "Post estático", en: "Static post", ko: "일반 게시물" },
  { value: "Historia",      es: "Historia",      en: "Story",       ko: "스토리" },
  { value: "Video",         es: "Video",         en: "Video",       ko: "영상" },
  { value: "Otro",          es: "Otro",          en: "Other",       ko: "기타" },
];
const CHANNELS: { value: string; es: string; en: string; ko: string }[] = [
  { value: "Instagram", es: "Instagram", en: "Instagram", ko: "인스타그램" },
  { value: "Facebook",  es: "Facebook",  en: "Facebook",  ko: "페이스북" },
  { value: "TikTok",    es: "TikTok",    en: "TikTok",    ko: "틱톡" },
  { value: "LinkedIn",  es: "LinkedIn",  en: "LinkedIn",  ko: "링크드인" },
  { value: "Twitter/X", es: "Twitter/X", en: "Twitter/X", ko: "X (트위터)" },
  { value: "YouTube",   es: "YouTube",   en: "YouTube",   ko: "유튜브" },
];
const CONTENT_TYPES: { value: string; es: string; en: string; ko: string }[] = [
  { value: "Informativo", es: "Informativo", en: "Informative", ko: "정보성" },
  { value: "Cultural",    es: "Cultural",    en: "Cultural",    ko: "문화" },
  { value: "Testimonial", es: "Testimonial", en: "Testimonial", ko: "후기" },
  { value: "Evento",      es: "Evento",      en: "Event",       ko: "행사" },
  { value: "Campaña",     es: "Campaña",     en: "Campaign",    ko: "캠페인" },
  { value: "Otro",        es: "Otro",        en: "Other",       ko: "기타" },
];

type Cycle = { id: string; label: string | null; cycle_number: number; final_deadline: string | null };

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
        {label}
        {required && <span className="ml-1" style={{ color: "#38B39E" }}>*</span>}
      </label>
      {children}
      {error && <p className="text-xs" style={{ color: "#E2693E" }}>{error}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  const { hasError, ...rest } = props;
  return (
    <input
      {...rest}
      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all"
      style={{
        backgroundColor: "#F8F0DE",
        border: `1.5px solid ${hasError ? "#E2693E" : "#DDD0C4"}`,
        color: "#1C1C1C",
      }}
      onFocus={(e) => { e.target.style.borderColor = "#E2693E"; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = hasError ? "#E2693E" : "#DDD0C4"; props.onBlur?.(e); }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }) {
  const { hasError, ...rest } = props;
  return (
    <textarea
      {...rest}
      rows={3}
      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all resize-none"
      style={{
        backgroundColor: "#F8F0DE",
        border: `1.5px solid ${hasError ? "#E2693E" : "#DDD0C4"}`,
        color: "#1C1C1C",
      }}
      onFocus={(e) => { e.target.style.borderColor = "#E2693E"; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = hasError ? "#E2693E" : "#DDD0C4"; props.onBlur?.(e); }}
    />
  );
}

function Select({ children, value, onChange, hasError }: {
  children: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
      style={{
        backgroundColor: "#F8F0DE",
        border: `1.5px solid ${hasError ? "#E2693E" : "#DDD0C4"}`,
        color: "#1C1C1C",
      }}
    >
      {children}
    </select>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded"
        style={{ accentColor: "#38B39E" }}
      />
      <span className="text-sm" style={{ color: "#1C1C1C" }}>{label}</span>
    </label>
  );
}

export default function ContentForm({
  profileId,
  locale: initialLocale,
  cycles,
  post,
}: {
  profileId: string;
  locale: "es" | "en" | "ko";
  cycles: Cycle[];
  post: ContentPost | null;
}) {
  const { locale } = useLocale();
  const router = useRouter();

  const [title, setTitle] = useState(post?.title ?? "");
  const [format, setFormat] = useState(post?.format ?? "");
  const [channel, setChannel] = useState(post?.channel ?? "");
  const [contentType, setContentType] = useState(post?.content_type ?? "");
  const [cycleId, setCycleId] = useState(post?.publication_cycle_id ?? "");
  const [pubDate, setPubDate] = useState(post?.publication_date ?? "");
  const [designUrl, setDesignUrl] = useState(post?.design_url ?? "");
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [script, setScript] = useState(post?.script ?? "");
  const [hashtags, setHashtags] = useState(post?.hashtags ?? "");

  // Reel specs
  const [reelDuration, setReelDuration] = useState<number | "">(post?.reel_specs?.duration_seconds ?? "");
  const [reelAspect, setReelAspect] = useState(post?.reel_specs?.aspect_ratio_confirmed ?? false);
  const [reelAudio, setReelAudio] = useState(post?.reel_specs?.audio_clean_confirmed ?? false);
  const [reelFraming, setReelFraming] = useState(post?.reel_specs?.subject_framing_ok ?? false);
  const [reelMargins, setReelMargins] = useState(post?.reel_specs?.safe_margins_ok ?? false);
  const [reelSubtitles, setReelSubtitles] = useState(post?.reel_specs?.subtitles_included ?? false);
  const [reelSubtitleNote, setReelSubtitleNote] = useState(post?.reel_specs?.subtitle_note ?? "");
  const [reelNoMusic, setReelNoMusic] = useState(post?.reel_specs?.music_not_embedded ?? false);
  const [reelCover, setReelCover] = useState(post?.reel_specs?.cover_designed ?? false);
  const [reelHeadline, setReelHeadline] = useState(post?.reel_specs?.cover_headline ?? "");
  const [reelTypo, setReelTypo] = useState(post?.reel_specs?.brand_typography_ok ?? false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isReel = format === "Reel";

  const T = {
    es: {
      editTitle: "Editar contenido", newTitle: "Nuevo contenido",
      title: "Título", format: "Formato", channel: "Canal", type: "Tipo de contenido",
      cycle: "Ciclo de publicación", pubDate: "Fecha de publicación", designUrl: "Enlace del diseño (URL)",
      caption: "Caption / Copy", script: "Guión o descripción (mín. 80 caracteres)", hashtags: "Hashtags",
      reelSection: "Especificaciones de Reel (obligatorio)", duration: "Duración en segundos (7–58)",
      aspectRatio: "Confirmé que el video es 9:16 vertical", audioClean: "El audio es limpio, sin distorsión",
      framing: "El sujeto principal está centrado y bien encuadrado",
      margins: "Los márgenes seguros están respetados (250px arriba, 350px abajo, 120px lados)",
      subtitles: "El Reel tiene subtítulos (obligatorio)", subtitleNote: "Nota sobre subtítulos",
      noMusic: "La música NO está embebida en el video", cover: "La portada/thumbnail fue diseñada intencionalmente",
      headline: "Titular de portada (3–6 palabras)", typography: "La portada usa tipografía oficial KOCO",
      saveDraft: "Guardar borrador", submit: "Enviar para revisión", saving: "Guardando...",
      select: "Seleccionar...", required: "Campo requerido", minChars: "Mínimo 80 caracteres",
      urlFormat: "Debe ser una URL válida (https://...)", durationRange: "Debe estar entre 7 y 58 segundos",
      headlineWords: "Máximo 6 palabras", hashtagsLimit: "Máximo 3 hashtags",
      titleTaken: "Este título ya está en uso", similarFound: "Ideas similares ya propuestas",
      similarHint: "Revisa que tu idea no repita una existente antes de enviar.",
      checking: "Buscando ideas similares...",
    },
    en: {
      editTitle: "Edit content", newTitle: "New post",
      title: "Title", format: "Format", channel: "Channel", type: "Content type",
      cycle: "Publication cycle", pubDate: "Publication date", designUrl: "Design link (URL)",
      caption: "Caption / Copy", script: "Script or description (min. 80 characters)", hashtags: "Hashtags",
      reelSection: "Reel specifications (required)", duration: "Duration in seconds (7–58)",
      aspectRatio: "I confirm the video is 9:16 vertical", audioClean: "Audio is clean, no distortion",
      framing: "Main subject is centered and well framed",
      margins: "Safe margins respected (250px top, 350px bottom, 120px sides)",
      subtitles: "Reel has subtitles (required)", subtitleNote: "Subtitle note",
      noMusic: "Music is NOT embedded in the video", cover: "Cover/thumbnail was intentionally designed",
      headline: "Cover headline (3–6 words)", typography: "Cover uses official KOCO typography",
      saveDraft: "Save draft", submit: "Submit for review", saving: "Saving...",
      select: "Select...", required: "Required field", minChars: "Minimum 80 characters",
      urlFormat: "Must be a valid URL (https://...)", durationRange: "Must be between 7 and 58 seconds",
      headlineWords: "Maximum 6 words", hashtagsLimit: "Maximum 3 hashtags",
      titleTaken: "This title is already taken", similarFound: "Similar ideas already proposed",
      similarHint: "Make sure your idea doesn't repeat an existing one before submitting.",
      checking: "Checking for similar ideas...",
    },
    ko: {
      editTitle: "콘텐츠 수정", newTitle: "새 콘텐츠",
      title: "제목", format: "포맷", channel: "채널", type: "콘텐츠 유형",
      cycle: "게시 회차", pubDate: "게시일", designUrl: "디자인 링크 (URL)",
      caption: "캡션 / 카피", script: "스크립트 또는 설명 (최소 80자)", hashtags: "해시태그",
      reelSection: "릴스 사양 (필수)", duration: "영상 길이(초, 7–58)",
      aspectRatio: "9:16 세로 영상임을 확인했어요", audioClean: "오디오가 깨끗하고 왜곡이 없어요",
      framing: "주요 피사체가 중앙에 잘 잡혀 있어요",
      margins: "안전 여백을 지켰어요 (위 250px, 아래 350px, 좌우 120px)",
      subtitles: "자막이 들어가 있어요 (필수)", subtitleNote: "자막 메모",
      noMusic: "음악이 영상에 삽입되어 있지 않아요", cover: "커버(썸네일)를 직접 디자인했어요",
      headline: "커버 문구 (3–6단어)", typography: "커버에 KOCO 공식 서체를 사용했어요",
      saveDraft: "임시 저장", submit: "검토 요청", saving: "저장 중...",
      select: "선택하세요", required: "필수 항목", minChars: "최소 80자",
      urlFormat: "올바른 URL이어야 해요 (https://...)", durationRange: "7–58초 사이여야 해요",
      headlineWords: "최대 6단어", hashtagsLimit: "해시태그는 최대 3개까지예요",
      titleTaken: "이미 사용 중인 제목이에요", similarFound: "비슷한 아이디어가 이미 있어요",
      similarHint: "제출 전에 기존 아이디어와 겹치지 않는지 확인해 주세요.",
      checking: "비슷한 아이디어 찾는 중...",
    },
  } as const;
  const Lx = T[locale];
  const L = { ...Lx, pageTitle: post ? Lx.editTitle : Lx.newTitle };

  function validate(submitting: boolean): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = L.required;
    if (!format) errs.format = L.required;
    if (!channel) errs.channel = L.required;

    const hashtagCount = hashtags.trim() ? hashtags.trim().split(/\s+/).filter(Boolean).length : 0;
    if (hashtagCount > 3) errs.hashtags = L.hashtagsLimit;

    if (submitting) {
      if (!cycleId) errs.cycleId = L.required;
      if (!pubDate) errs.pubDate = L.required;
      if (!designUrl.trim()) errs.designUrl = L.required;
      else if (!/^https?:\/\/.+/.test(designUrl)) errs.designUrl = L.urlFormat;
      if (script && script.trim().length < 80) errs.script = L.minChars;
      if (!script.trim()) errs.script = L.required;

      if (isReel) {
        if (!reelDuration || reelDuration < 7 || reelDuration > 58) errs.reelDuration = L.durationRange;
        if (!reelAspect) errs.reelAspect = L.required;
        if (!reelAudio) errs.reelAudio = L.required;
        if (!reelSubtitles) errs.reelSubtitles = L.required;
        if (!reelNoMusic) errs.reelNoMusic = L.required;
        if (!reelCover) errs.reelCover = L.required;
        if (reelHeadline && reelHeadline.trim().split(/\s+/).length > 6) errs.reelHeadline = L.headlineWords;
        if (!reelHeadline.trim()) errs.reelHeadline = L.required;
      }
    } else {
      if (!designUrl.trim()) errs.designUrl = L.required;
      else if (!/^https?:\/\/.+/.test(designUrl)) errs.designUrl = L.urlFormat;
    }
    return errs;
  }

  // ── Similar-idea detection ──────────────────────────────────────
  type TitleMatch = { id: string; title: string; responsible_name: string | null; sim: number };
  type SimilarIdea = { id: string; title: string; status: string; responsible_name: string | null; similarity: number };
  const [titleMatches, setTitleMatches] = useState<TitleMatch[]>([]);
  const [similarIdeas, setSimilarIdeas] = useState<SimilarIdea[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);

  async function checkSimilar(): Promise<{ titleMatches: TitleMatch[]; similar: SimilarIdea[] }> {
    if (!title.trim()) return { titleMatches: [], similar: [] };
    setCheckingSimilar(true);
    try {
      const res = await fetch("/api/similar-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          text: [caption, script].filter(Boolean).join("\n"),
          excludeId: post?.id ?? null,
        }),
      });
      if (!res.ok) return { titleMatches: [], similar: [] };
      const data = await res.json();
      setTitleMatches(data.titleMatches ?? []);
      setSimilarIdeas(data.similar ?? []);
      return { titleMatches: data.titleMatches ?? [], similar: data.similar ?? [] };
    } catch {
      return { titleMatches: [], similar: [] };
    } finally {
      setCheckingSimilar(false);
    }
  }

  async function save(submitForReview: boolean) {
    const errs = validate(submitForReview);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Block near-duplicate titles (another volunteer already used it)
    const { titleMatches: matches } = await checkSimilar();
    const duplicate = matches.find((m) => m.sim >= 0.6);
    if (duplicate) {
      setErrors({ title: `${L.titleTaken} — "${duplicate.title}"${duplicate.responsible_name ? ` (${duplicate.responsible_name})` : ""}` });
      return;
    }

    setErrors({});
    setSaving(true);

    const supabase = createClient();
    const postData = {
      title: title.trim(),
      format: format || null,
      channel: channel || null,
      content_type: contentType || null,
      publication_cycle_id: cycleId || null,
      publication_date: pubDate || null,
      design_url: designUrl || null,
      caption: caption || null,
      script: script || null,
      hashtags: hashtags || null,
      status: submitForReview ? "submitted" : "draft",
      responsible_id: profileId,
      ...(submitForReview ? { submitted_at: new Date().toISOString() } : {}),
    };

    let postId = post?.id;
    if (post) {
      await supabase.from("content_posts").update(postData).eq("id", post.id);
    } else {
      const { data } = await supabase.from("content_posts").insert(postData).select("id").single();
      postId = data?.id;
    }

    // Upsert reel specs if Reel format
    if (isReel && postId) {
      await supabase.from("reel_specs").upsert({
        content_post_id: postId,
        duration_seconds: reelDuration || null,
        aspect_ratio_confirmed: reelAspect,
        audio_clean_confirmed: reelAudio,
        subject_framing_ok: reelFraming,
        safe_margins_ok: reelMargins,
        subtitles_included: reelSubtitles,
        subtitle_note: reelSubtitleNote || null,
        music_not_embedded: reelNoMusic,
        cover_designed: reelCover,
        cover_headline: reelHeadline || null,
        brand_typography_ok: reelTypo,
      }, { onConflict: "content_post_id" });
    }

    // Index the idea for future similarity searches (fire-and-forget)
    if (postId) {
      fetch("/api/embed-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      }).catch(() => {});
    }

    setSaving(false);
    companionReact("celebrate");
    router.push("/content");
  }

  const headlineWordCount = reelHeadline.trim() ? reelHeadline.trim().split(/\s+/).length : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: "#1C1C1C" }}>{L.pageTitle}</h1>

      <div className="rounded-2xl p-6 shadow-koco space-y-5" style={{ backgroundColor: "#F8F0DE" }}>
        {/* Title — checks for duplicates when the field loses focus */}
        <Field label={L.title} required error={errors.title}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title.trim().length >= 4) checkSimilar(); }}
            hasError={!!errors.title}
          />
        </Field>

        {checkingSimilar && (
          <p className="text-xs" style={{ color: "#888" }}>{L.checking}</p>
        )}

        {/* Similar ideas panel — informational, appears when matches exist */}
        {(titleMatches.length > 0 || similarIdeas.length > 0) && !checkingSimilar && (
          <div className="rounded-xl px-4 py-3 space-y-2 anim-in" style={{ backgroundColor: "rgba(236,160,64,0.10)" }}>
            <p className="text-xs font-bold" style={{ color: "#B07A1A" }}>{L.similarFound}</p>
            <ul className="space-y-1">
              {[...titleMatches.map((m) => ({ id: m.id, title: m.title, who: m.responsible_name, pct: Math.round(m.sim * 100) })),
                ...similarIdeas.filter((s) => !titleMatches.some((m) => m.id === s.id))
                  .map((s) => ({ id: s.id, title: s.title, who: s.responsible_name, pct: Math.round(s.similarity * 100) }))]
                .map((item) => (
                <li key={item.id} className="text-xs flex items-baseline gap-2" style={{ color: "#6B4A38" }}>
                  <span className="font-bold shrink-0" style={{ color: "#B07A1A" }}>{item.pct}%</span>
                  <span className="truncate">"{item.title}"{item.who ? ` — ${item.who}` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs" style={{ color: "#8C6B55" }}>{L.similarHint}</p>
          </div>
        )}

        {/* Format + Channel row */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={L.format} required error={errors.format}>
            <Select value={format} onChange={setFormat} hasError={!!errors.format}>
              <option value="">{L.select}</option>
              {FORMATS.map((f) => <option key={f.value} value={f.value}>{f[locale]}</option>)}
            </Select>
          </Field>
          <Field label={L.channel} required error={errors.channel}>
            <Select value={channel} onChange={setChannel} hasError={!!errors.channel}>
              <option value="">{L.select}</option>
              {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c[locale]}</option>)}
            </Select>
          </Field>
        </div>

        {/* Content type */}
        <Field label={L.type}>
          <Select value={contentType} onChange={setContentType}>
            <option value="">{L.select}</option>
            {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t[locale]}</option>)}
          </Select>
        </Field>

        {/* Cycle + Date row */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={L.cycle} error={errors.cycleId}>
            <Select value={cycleId} onChange={setCycleId} hasError={!!errors.cycleId}>
              <option value="">{L.select}</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label ?? (locale === "es" ? `Ciclo ${c.cycle_number}` : locale === "ko" ? `${c.cycle_number}회차` : `Cycle ${c.cycle_number}`)}
                  {c.final_deadline ? ` (${c.final_deadline})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={L.pubDate} error={errors.pubDate}>
            <Input type="date" value={pubDate} onChange={(e) => setPubDate(e.target.value)} hasError={!!errors.pubDate} />
          </Field>
        </div>

        {/* Design URL */}
        <Field label={L.designUrl} required error={errors.designUrl}>
          <Input
            type="url"
            placeholder="https://drive.google.com/..."
            value={designUrl}
            onChange={(e) => setDesignUrl(e.target.value)}
            hasError={!!errors.designUrl}
          />
        </Field>

        {/* Caption */}
        <Field label={L.caption}>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} />
        </Field>

        {/* Script */}
        <Field label={L.script} required error={errors.script}>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={4}
            hasError={!!errors.script}
          />
          <p className="text-xs mt-1" style={{ color: script.length >= 80 ? "#38B39E" : "#AAA" }}>
            {script.length}/80
          </p>
        </Field>

        {/* Hashtags — max 3 */}
        <Field label={L.hashtags} error={errors.hashtags}>
          <Input
            placeholder="#koico #koicacolombia"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            hasError={!!errors.hashtags}
          />
          <p
            className="text-xs mt-1"
            style={{ color: hashtags.trim().split(/\s+/).filter(Boolean).length > 3 ? "#E2693E" : "#AAA" }}
          >
            {hashtags.trim() ? hashtags.trim().split(/\s+/).filter(Boolean).length : 0}/3
          </p>
        </Field>
      </div>

      {/* ── Reel Specs ────────────────────────────────────────── */}
      {isReel && (
        <div className="rounded-2xl p-6 shadow-koco space-y-4" style={{ backgroundColor: "#F8F0DE", borderLeft: "4px solid #38B39E" }}>
          <h2 className="text-base font-bold" style={{ color: "#38B39E" }}>{L.reelSection}</h2>

          <Field label={L.duration} required error={errors.reelDuration}>
            <Input
              type="number"
              min={7}
              max={58}
              value={reelDuration}
              onChange={(e) => setReelDuration(e.target.value === "" ? "" : Number(e.target.value))}
              hasError={!!errors.reelDuration}
            />
          </Field>

          <div className="space-y-3">
            {[
              { key: "reelAspect",   state: reelAspect,   set: setReelAspect,   label: L.aspectRatio },
              { key: "reelAudio",    state: reelAudio,    set: setReelAudio,    label: L.audioClean },
              { key: "reelFraming",  state: reelFraming,  set: setReelFraming,  label: L.framing },
              { key: "reelMargins",  state: reelMargins,  set: setReelMargins,  label: L.margins },
              { key: "reelSubtitles",state: reelSubtitles,set: setReelSubtitles,label: L.subtitles },
            ].map(({ key, state, set, label }) => (
              <div key={key}>
                <Checkbox checked={state} onChange={set} label={label} />
                {errors[key] && <p className="text-xs ml-7 mt-0.5" style={{ color: "#E2693E" }}>{errors[key]}</p>}
              </div>
            ))}

            {/* Subtitle note */}
            {reelSubtitles && (
              <div className="ml-7">
                <Field label={L.subtitleNote}>
                  <Input value={reelSubtitleNote} onChange={(e) => setReelSubtitleNote(e.target.value)} />
                </Field>
              </div>
            )}

            {[
              { key: "reelNoMusic", state: reelNoMusic, set: setReelNoMusic, label: L.noMusic },
              { key: "reelCover",   state: reelCover,   set: setReelCover,   label: L.cover },
            ].map(({ key, state, set, label }) => (
              <div key={key}>
                <Checkbox checked={state} onChange={set} label={label} />
                {errors[key] && <p className="text-xs ml-7 mt-0.5" style={{ color: "#E2693E" }}>{errors[key]}</p>}
              </div>
            ))}

            {/* Cover headline */}
            {reelCover && (
              <div className="ml-7">
                <Field label={L.headline} required error={errors.reelHeadline}>
                  <Input value={reelHeadline} onChange={(e) => setReelHeadline(e.target.value)} hasError={!!errors.reelHeadline} />
                  <p className="text-xs mt-1" style={{ color: headlineWordCount > 6 ? "#E2693E" : "#AAA" }}>
                    {headlineWordCount}/6 {locale === "es" ? "palabras" : "words"}
                  </p>
                </Field>
              </div>
            )}

            <div>
              <Checkbox checked={reelTypo} onChange={setReelTypo} label={L.typography} />
            </div>
          </div>
        </div>
      )}

      {/* ── Action buttons ──────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={() => save(false)}
          disabled={saving}
          className="flex-1 py-3 rounded-lg font-bold text-sm btn-hover"
          style={{ backgroundColor: "transparent", border: "2px solid #38B39E", color: "#38B39E" }}
        >
          {saving ? L.saving : L.saveDraft}
        </button>
        <button
          onClick={() => save(true)}
          disabled={saving}
          className="flex-1 py-3 rounded-lg font-bold text-sm text-white btn-hover"
          style={{ backgroundColor: "#ECA040" }}
        >
          {saving ? L.saving : L.submit}
        </button>
      </div>
    </div>
  );
}
