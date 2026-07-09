// Trilingual strings for the KOCO Supporters app (es / en / ko)
// Korean strings produced with the korean-humanizer skill:
// natural product voice (해요체 for sentences, noun-form labels),
// Korean workflow vocabulary (반려, 임시 저장, 모집 중, 서포터즈, 회차).

export type Locale = "es" | "en" | "ko";

/** BCP-47 tags for date/number formatting per app locale */
export const DATE_LOCALE: Record<Locale, string> = {
  es: "es-CO",
  en: "en-US",
  ko: "ko-KR",
};

export const LOCALE_META: { code: Locale; label: string; name: string }[] = [
  { code: "es", label: "ES", name: "Español" },
  { code: "en", label: "EN", name: "English" },
  { code: "ko", label: "한", name: "한국어" },
];

export const translations = {
  nav: {
    dashboard:  { es: "Inicio",        en: "Dashboard",  ko: "홈" },
    content:    { es: "Contenidos",    en: "Content",    ko: "콘텐츠" },
    events:     { es: "Eventos",       en: "Events",     ko: "행사" },
    points:     { es: "Mis puntos",    en: "My points",  ko: "내 포인트" },
    admin:      { es: "Administrar",   en: "Admin",      ko: "관리" },
    signOut:    { es: "Cerrar sesión", en: "Sign out",   ko: "로그아웃" },
  },
  status: {
    draft:        { es: "Borrador",    en: "Draft",       ko: "임시 저장" },
    submitted:    { es: "Enviado",     en: "Submitted",   ko: "제출됨" },
    in_review:    { es: "En revisión", en: "In review",   ko: "검토 중" },
    approved:     { es: "Aprobado",    en: "Approved",    ko: "승인됨" },
    published:    { es: "Publicado",   en: "Published",   ko: "게시됨" },
    rejected:     { es: "Rechazado",   en: "Rejected",    ko: "반려됨" },
    cancelled:    { es: "Cancelado",   en: "Cancelled",   ko: "취소됨" },
    rescheduled:  { es: "Reagendado",  en: "Rescheduled", ko: "일정 변경" },
  },
  dashboard: {
    greeting:      { es: "Hola",                en: "Hello",             ko: "안녕하세요" },
    totalPoints:   { es: "Puntos totales",      en: "Total points",      ko: "전체 포인트" },
    postsMonth:    { es: "Contenidos este mes", en: "Posts this month",  ko: "이번 달 콘텐츠" },
    recentPoints:  { es: "Actividad reciente",  en: "Recent activity",   ko: "최근 활동" },
    upcomingEvents:{ es: "Próximos eventos",    en: "Upcoming events",   ko: "다가오는 행사" },
    myContent:     { es: "Mis contenidos",      en: "My content",        ko: "내 콘텐츠" },
    noActivity:    { es: "Sin actividad aún",   en: "No activity yet",   ko: "아직 활동 내역이 없어요" },
    noEvents:      { es: "Sin eventos próximos",en: "No upcoming events",ko: "예정된 행사가 없어요" },
    viewAll:       { es: "Ver todos",           en: "View all",          ko: "전체 보기" },
  },
  common: {
    save:     { es: "Guardar",         en: "Save",           ko: "저장" },
    cancel:   { es: "Cancelar",        en: "Cancel",         ko: "취소" },
    loading:  { es: "Cargando...",     en: "Loading...",     ko: "불러오는 중..." },
    error:    { es: "Ocurrió un error",en: "An error occurred", ko: "오류가 발생했어요" },
    required: { es: "Campo requerido", en: "Required field", ko: "필수 항목" },
    select:   { es: "Seleccionar...",  en: "Select...",      ko: "선택하세요" },
  },
} as const;

export type TranslationsShape = typeof translations;

/** Returns a locale-aware accessor for a namespace */
export function useTranslations<K extends keyof TranslationsShape>(
  namespace: K,
  locale: Locale
): { [key in keyof TranslationsShape[K]]: string } {
  const ns = translations[namespace];
  return Object.fromEntries(
    Object.entries(ns).map(([k, v]) => [k, (v as Record<Locale, string>)[locale]])
  ) as { [key in keyof TranslationsShape[K]]: string };
}
