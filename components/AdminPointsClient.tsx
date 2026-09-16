"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { companionReact } from "@/components/Companion";
import { COMPLETION_TARGET_POINTS } from "@/lib/points";
import GlassSelect from "@/components/glass/GlassSelect";
import GlassDatePicker from "@/components/glass/GlassDatePicker";
import Button from "@/components/ui/Button";

type Group     = { id: string; code: string; name: string };
type Volunteer = { id: string; full_name: string; group_id: string | null };
type Criteria  = { id: string; category: string; description_es: string | null; description_en: string | null; type: string; points_per_unit: number; group_id: string | null };
type Entry     = {
  id: string;
  volunteer_id: string;
  criteria_id: string;
  date: string;
  points_earned: number;
  notes: string | null;
  criteria: { category: string; description_es: string | null; description_en: string | null } | null;
};

export default function AdminPointsClient({
  groups,
  volunteers,
  criteria,
  entries,
  adminId,
  locale: initialLocale,
}: {
  groups: Group[];
  volunteers: Volunteer[];
  criteria: Criteria[];
  entries: Entry[];
  adminId: string;
  locale: "es" | "en" | "ko";
}) {
  const { locale } = useLocale();
  const router = useRouter();

  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [volunteerId, setVolunteerId] = useState("");
  const [criteriaId, setCriteriaId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [points, setPoints] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Which volunteer the *views* below are narrowed to - separate from
  // volunteerId, which is who the form is about to award points to. Picking
  // someone to look at should not silently pre-fill who gets the next award.
  const [viewVolunteerId, setViewVolunteerId] = useState("");

  const groupVolunteers = volunteers.filter((v) => v.group_id === groupId);
  const groupCriteria = criteria.filter((c) => c.group_id === groupId || c.group_id === null);
  const groupEntries = entries.filter((e) => groupVolunteers.some((v) => v.id === e.volunteer_id));

  // The group toggle answers "which programme"; this answers "whose record".
  // Both narrow the recent entries and the roster below.
  const shownVolunteers = viewVolunteerId
    ? groupVolunteers.filter((v) => v.id === viewVolunteerId)
    : groupVolunteers;
  const shownEntries = viewVolunteerId
    ? groupEntries.filter((e) => e.volunteer_id === viewVolunteerId)
    : groupEntries;

  const selectedCriteria = criteria.find((c) => c.id === criteriaId);

  const T = {
    es: {
      title: "Registrar puntos", volunteer: "Voluntario/a", criteria: "Criterio", date: "Fecha", points: "Puntos",
      notes: "Nota", save: "Registrar", saving: "Registrando...", saved: "¡Registrado!",
      required: "Requerido", select: "Seleccionar...", recent: "Entradas recientes",
      suggested: "Puntos sugeridos", noRecent: "Sin entradas recientes",
      group: "Grupo", editing: "Editando entrada", cancelEdit: "Cancelar edición",
      update: "Actualizar", updating: "Actualizando...", updated: "¡Actualizado!",
      summary: "Resumen por voluntario/a", allVolunteers: "Todo el grupo",
      failed: "No se pudo registrar. Revisa tu conexión e inténtalo de nuevo.", toGo: "faltan {n} pts para llegar a 80",
      met: "¡Requisito cumplido! Sigue sumando puntos extra",
      clickToEdit: "Toca una entrada para editarla",
    },
    en: {
      title: "Log points", volunteer: "Volunteer", criteria: "Criteria", date: "Date", points: "Points",
      notes: "Note", save: "Log", saving: "Logging...", saved: "Logged!",
      required: "Required", select: "Select...", recent: "Recent entries",
      suggested: "Suggested points", noRecent: "No recent entries",
      group: "Group", editing: "Editing entry", cancelEdit: "Cancel edit",
      update: "Update", updating: "Updating...", updated: "Updated!",
      summary: "Summary by volunteer", allVolunteers: "Whole group",
      failed: "Couldn’t log it. Check your connection and try again.", toGo: "{n} pts to go to reach 80",
      met: "Completion requirement met! Keep earning extra points",
      clickToEdit: "Click an entry to edit it",
    },
    ko: {
      title: "포인트 등록", volunteer: "서포터즈", criteria: "기준", date: "날짜", points: "포인트",
      notes: "메모", save: "등록하기", saving: "등록 중...", saved: "등록 완료!",
      required: "필수 항목", select: "선택하세요", recent: "최근 등록 내역",
      suggested: "기본 포인트", noRecent: "최근 내역이 없어요",
      group: "그룹", editing: "항목 수정 중", cancelEdit: "수정 취소",
      update: "수정하기", updating: "수정 중...", updated: "수정 완료!",
      summary: "서포터즈별 요약", allVolunteers: "그룹 전체",
      failed: "등록하지 못했어요. 연결을 확인하고 다시 시도해 주세요.", toGo: "80점까지 {n}점 남았어요",
      met: "이수 조건을 달성했어요! 추가 포인트는 계속 쌓을 수 있어요",
      clickToEdit: "항목을 눌러서 수정할 수 있어요",
    },
  } as const;
  const L = T[locale];

  function toGoText(n: number) {
    return L.toGo.replace("{n}", String(n));
  }

  function resetForm() {
    setVolunteerId(""); setCriteriaId(""); setPoints(""); setNotes(""); setEditingId(null);
  }

  function onGroupChange(id: string) {
    setGroupId(id);
    setViewVolunteerId("");
    resetForm();
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setVolunteerId(entry.volunteer_id);
    setCriteriaId(entry.criteria_id);
    setDate(entry.date ?? "");
    setPoints(entry.points_earned);
    setNotes(entry.notes ?? "");
    setErrors({});
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!volunteerId) errs.volunteerId = L.required;
    if (!criteriaId)  errs.criteriaId  = L.required;
    if (!date)        errs.date        = L.required;
    if (points === "" || Number(points) < 0) errs.points = L.required;
    if (!notes.trim()) errs.notes = L.required;
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const supabase = createClient();
    const payload = {
      volunteer_id: volunteerId,
      criteria_id: criteriaId,
      date,
      points_earned: Number(points),
      notes: notes.trim(),
    };

    const { error } = editingId
      ? await supabase.from("point_log_entries").update(payload).eq("id", editingId)
      : await supabase.from("point_log_entries").insert({ ...payload, recorded_by: adminId });

    setSaving(false);
    if (error) {
      // This used to fall straight through to "¡Registrado!", the celebration
      // and resetForm() - so a refused write looked like a success AND threw
      // away everything the admin had typed.
      console.error("point_log_entries write failed:", error);
      setErrors({ form: L.failed });
      return;
    }
    setSuccess(true);
    companionReact("celebrate");
    resetForm();
    setTimeout(() => setSuccess(false), 3000);
    router.refresh();
  }

  function inputStyle(key: string) {
    return {
      backgroundColor: "#FDFAF3",
      border: `1.5px solid ${errors[key] ? "#E2693E" : "#DDD0C4"}`,
      color: "#1C1C1C",
    };
  }

  const volName = (id: string) => volunteers.find((v) => v.id === id)?.full_name ?? id;

  const totalsByVolunteer: Record<string, number> = {};
  for (const e of entries) totalsByVolunteer[e.volunteer_id] = (totalsByVolunteer[e.volunteer_id] ?? 0) + e.points_earned;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <h1 className="text-2xl font-bold" style={{ color: "#1C1C1C" }}>{L.title}</h1>

        <div className="flex flex-wrap items-center gap-3">
        {/* One volunteer's record, rather than the whole group's. Sits beside
            the group toggle because the two answer the same kind of question
            and narrow the same two lists. */}
        <GlassSelect
          variant="pill"
          ariaLabel={L.volunteer}
          value={viewVolunteerId}
          onChange={setViewVolunteerId}
          active={!!viewVolunteerId}
          options={[
            { value: "", label: L.allVolunteers },
            ...groupVolunteers.map((v) => ({ value: v.id, label: v.full_name })),
          ]}
        />

        {/* Group toggle — scopes volunteers, criteria, roster and recent entries */}
        {groups.length > 1 && (
          <div
            role="radiogroup"
            aria-label={L.group}
            className="relative grid rounded-full p-1"
            style={{ backgroundColor: "rgba(56,179,158,0.10)", gridTemplateColumns: `repeat(${groups.length}, minmax(0,1fr))`, width: groups.length * 100 }}
          >
            <span
              aria-hidden
              className="absolute top-1 bottom-1 rounded-full"
              style={{
                width: `calc((100% - ${(groups.length + 1) * 4}px) / ${groups.length})`,
                left: 4,
                transform: `translateX(${groups.findIndex((g) => g.id === groupId) * 100}%)`,
                backgroundColor: "#38B39E",
                transition: "transform 200ms var(--ease-out-quart)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
              }}
            />
            {groups.map((g) => (
              <button
                key={g.id}
                role="radio"
                aria-checked={groupId === g.id}
                onClick={() => onGroupChange(g.id)}
                className="relative z-10 py-2.5 text-xs font-bold rounded-full text-center transition-colors"
                style={{ color: groupId === g.id ? "#0E3F37" : "#1F7A6E", transitionDuration: "200ms" }}
              >
                {g.code}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="rounded-2xl p-5 shadow-koco space-y-4 anim-in" style={{ backgroundColor: "#FDFAF3", "--i": 1 } as React.CSSProperties}>
          {editingId && (
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(236,160,64,0.14)" }}>
              <span className="text-xs font-bold" style={{ color: "#B07A1A" }}>{L.editing}</span>
              <button onClick={resetForm} className="text-xs font-medium underline" style={{ color: "#B07A1A" }}>
                {L.cancelEdit}
              </button>
            </div>
          )}

          {/* Volunteer */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
              {L.volunteer} <span style={{ color: "#1F7A6E" }}>*</span>
            </label>
            <GlassSelect
              ariaLabel={L.volunteer}
              value={volunteerId}
              onChange={(v) => { setVolunteerId(v); setCriteriaId(""); }}
              hasError={!!errors.volunteerId}
              placeholder={L.select}
              options={groupVolunteers.map((v) => ({ value: v.id, label: v.full_name }))}
            />
            {errors.volunteerId && <p role="alert" className="text-xs font-medium" style={{ color: "#8C3010" }}>{errors.volunteerId}</p>}
          </div>

          {/* Criteria */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
              {L.criteria} <span style={{ color: "#1F7A6E" }}>*</span>
            </label>
            <GlassSelect
              ariaLabel={L.criteria}
              value={criteriaId}
              onChange={(v) => {
                setCriteriaId(v);
                const c = criteria.find((c) => c.id === v);
                if (c) setPoints(c.points_per_unit);
              }}
              hasError={!!errors.criteriaId}
              placeholder={L.select}
              panelMinWidth={300}
              options={groupCriteria.map((c) => ({
                value: c.id,
                label: `[${c.type === "core" ? "Core" : "Extra"}] ${c.category}`,
                hint: `${c.points_per_unit} pts`,
              }))}
            />
            {selectedCriteria && (
              <p className="text-xs" style={{ color: "#1F7A6E" }}>
                {L.suggested}: {selectedCriteria.points_per_unit} pts
                {(() => {
                  const d = locale === "es"
                    ? (selectedCriteria.description_es ?? selectedCriteria.description_en)
                    : (selectedCriteria.description_en ?? selectedCriteria.description_es);
                  return d ? <span style={{ color: "#6B6258" }}> · {d}</span> : null;
                })()}
              </p>
            )}
            {errors.criteriaId && <p role="alert" className="text-xs font-medium" style={{ color: "#8C3010" }}>{errors.criteriaId}</p>}
          </div>

          {/* Date + Points row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
                {L.date} <span style={{ color: "#1F7A6E" }}>*</span>
              </label>
              <GlassDatePicker
                ariaLabel={L.date}
                value={date}
                onChange={setDate}
                hasError={!!errors.date}
                required
              />
              {errors.date && <p role="alert" className="text-xs font-medium" style={{ color: "#8C3010" }}>{errors.date}</p>}
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
                {L.points} <span style={{ color: "#1F7A6E" }}>*</span>
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={points}
                onChange={(e) => setPoints(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                style={inputStyle("points")}
              />
              {errors.points && <p role="alert" className="text-xs font-medium" style={{ color: "#8C3010" }}>{errors.points}</p>}
            </div>
          </div>

          {/* Notes — mandatory, keeps a record of the reason for every point */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
              {L.notes} <span style={{ color: "#1F7A6E" }}>*</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
              style={inputStyle("notes")}
            />
            {errors.notes && <p role="alert" className="text-xs font-medium" style={{ color: "#8C3010" }}>{errors.notes}</p>}
          </div>

          {errors.form && (
            <p role="alert" className="text-sm font-medium" style={{ color: "#8C3010" }}>{errors.form}</p>
          )}

          <Button
            variant={success ? "confirm" : "primary"}
            size="lg"
            onClick={handleSave}
            loading={saving}
            loadingLabel={editingId ? L.updating : L.saving}
            disabled={saving}
          >
            <span key={success ? "ok" : "idle"} className={success ? "anim-pop inline-block" : undefined}>
              {success
                ? (editingId ? L.updated : L.saved)
                : saving
                ? (editingId ? L.updating : L.saving)
                : (editingId ? L.update : L.save)}
            </span>
          </Button>
        </div>

        {/* Recent entries — click to edit */}
        <div className="space-y-3 anim-in" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{L.recent}</h2>
            <span className="text-xs" style={{ color: "#6B6258" }}>{L.clickToEdit}</span>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-koco" style={{ backgroundColor: "#FDFAF3" }}>
            {shownEntries.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#6B6258" }}>{L.noRecent}</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "#EFE6D9" }}>
                {shownEntries.slice(0, 12).map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => startEdit(e)}
                    className="w-full flex items-start justify-between px-4 py-3 text-left transition-colors hover:bg-koco-blush/30"
                    style={{ backgroundColor: editingId === e.id ? "rgba(236,160,64,0.14)" : i % 2 === 0 ? "#FFFFFF" : "#FDFAF3" }}
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-xs font-medium truncate" style={{ color: "#1C1C1C" }}>
                        {volName(e.volunteer_id)}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#6B6258" }}>
                        {e.criteria?.category ?? "—"} · {e.date ?? "—"}
                      </p>
                      {(() => {
                        const d = locale === "es"
                          ? (e.criteria?.description_es ?? e.criteria?.description_en)
                          : (e.criteria?.description_en ?? e.criteria?.description_es);
                        const reason = [d, e.notes].filter(Boolean).join(" — ");
                        return reason ? (
                          <p className="text-xs mt-0.5" style={{ color: "#6B6258" }}>{reason}</p>
                        ) : null;
                      })()}
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: "#6E7A00" }}>
                      +{e.points_earned}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Roster — progress toward the 80-point completion milestone, per volunteer */}
      <section className="anim-in space-y-3" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{L.summary}</h2>
        <div className="rounded-2xl overflow-hidden shadow-koco divide-y" style={{ backgroundColor: "#FDFAF3", borderColor: "#EFE6D9" }}>
          {shownVolunteers.map((v, i) => {
            const total = totalsByVolunteer[v.id] ?? 0;
            const met = total >= COMPLETION_TARGET_POINTS;
            const pct = Math.min(100, (total / COMPLETION_TARGET_POINTS) * 100);
            return (
              <div key={v.id} className="flex items-center gap-4 px-4 py-3" style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FDFAF3" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{v.full_name}</p>
                    <p className="text-sm font-bold shrink-0" style={{ color: "#6E7A00" }}>{total} pts</p>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(total)}
                    aria-valuemin={0}
                    aria-valuemax={COMPLETION_TARGET_POINTS}
                    aria-label={v.full_name}
                    className="h-1.5 rounded-full overflow-hidden mt-1.5"
                    style={{ backgroundColor: "#EFE6D9" }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        transformOrigin: "left center",
                        transform: `scaleX(${pct / 100})`,
                        backgroundColor: met ? "#38B39E" : "#CDD909",
                        transition: "transform 400ms var(--ease-out-quart)",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: met ? "#1F7A6E" : "#6B6258" }}>
                    {met ? L.met : toGoText(Math.ceil(COMPLETION_TARGET_POINTS - total))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
