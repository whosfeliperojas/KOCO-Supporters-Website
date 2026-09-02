"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { companionReact } from "@/components/Companion";
import { COMPLETION_TARGET_POINTS } from "@/lib/points";

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

  const groupVolunteers = volunteers.filter((v) => v.group_id === groupId);
  const groupCriteria = criteria.filter((c) => c.group_id === groupId || c.group_id === null);
  const groupEntries = entries.filter((e) => groupVolunteers.some((v) => v.id === e.volunteer_id));

  const selectedCriteria = criteria.find((c) => c.id === criteriaId);

  const T = {
    es: {
      title: "Registrar puntos", volunteer: "Voluntario/a", criteria: "Criterio", date: "Fecha", points: "Puntos",
      notes: "Nota", save: "Registrar", saving: "Registrando...", saved: "¡Registrado!",
      required: "Requerido", select: "Seleccionar...", recent: "Entradas recientes",
      suggested: "Puntos sugeridos", noRecent: "Sin entradas recientes",
      group: "Grupo", editing: "Editando entrada", cancelEdit: "Cancelar edición",
      update: "Actualizar", updating: "Actualizando...", updated: "¡Actualizado!",
      summary: "Resumen por voluntario/a", toGo: "faltan {n} pts para llegar a 80",
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
      summary: "Summary by volunteer", toGo: "{n} pts to go to reach 80",
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
      summary: "서포터즈별 요약", toGo: "80점까지 {n}점 남았어요",
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

    if (editingId) {
      await supabase.from("point_log_entries").update(payload).eq("id", editingId);
    } else {
      await supabase.from("point_log_entries").insert({ ...payload, recorded_by: adminId });
    }

    setSaving(false);
    setSuccess(true);
    companionReact("celebrate");
    resetForm();
    setTimeout(() => setSuccess(false), 3000);
    router.refresh();
  }

  function inputStyle(key: string) {
    return {
      backgroundColor: "#F8F0DE",
      border: `1.5px solid ${errors[key] ? "#E2693E" : "#DDD0C4"}`,
      color: "#1C1C1C",
    };
  }

  const volName = (id: string) => volunteers.find((v) => v.id === id)?.full_name ?? id;

  const totalsByVolunteer: Record<string, number> = {};
  for (const e of entries) totalsByVolunteer[e.volunteer_id] = (totalsByVolunteer[e.volunteer_id] ?? 0) + e.points_earned;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <h1 className="text-2xl font-bold" style={{ color: "#1C1C1C" }}>{L.title}</h1>

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
                className="relative z-10 py-1.5 text-xs font-bold rounded-full text-center transition-colors"
                style={{ color: groupId === g.id ? "#FFFFFF" : "#38B39E", transitionDuration: "200ms" }}
              >
                {g.code}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="rounded-2xl p-5 shadow-koco space-y-4 anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 1 } as React.CSSProperties}>
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
              {L.volunteer} <span style={{ color: "#38B39E" }}>*</span>
            </label>
            <select
              value={volunteerId}
              onChange={(e) => { setVolunteerId(e.target.value); setCriteriaId(""); }}
              className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
              style={inputStyle("volunteerId")}
            >
              <option value="">{L.select}</option>
              {groupVolunteers.map((v) => <option key={v.id} value={v.id}>{v.full_name}</option>)}
            </select>
            {errors.volunteerId && <p className="text-xs" style={{ color: "#E2693E" }}>{errors.volunteerId}</p>}
          </div>

          {/* Criteria */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
              {L.criteria} <span style={{ color: "#38B39E" }}>*</span>
            </label>
            <select
              value={criteriaId}
              onChange={(e) => {
                setCriteriaId(e.target.value);
                const c = criteria.find((c) => c.id === e.target.value);
                if (c) setPoints(c.points_per_unit);
              }}
              className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
              style={inputStyle("criteriaId")}
            >
              <option value="">{L.select}</option>
              {groupCriteria.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.type === "core" ? "Core" : "Extra"}] {c.category} ({c.points_per_unit} pts)
                </option>
              ))}
            </select>
            {selectedCriteria && (
              <p className="text-xs" style={{ color: "#38B39E" }}>
                {L.suggested}: {selectedCriteria.points_per_unit} pts
                {(() => {
                  const d = locale === "es"
                    ? (selectedCriteria.description_es ?? selectedCriteria.description_en)
                    : (selectedCriteria.description_en ?? selectedCriteria.description_es);
                  return d ? <span style={{ color: "#75695C" }}> · {d}</span> : null;
                })()}
              </p>
            )}
            {errors.criteriaId && <p className="text-xs" style={{ color: "#E2693E" }}>{errors.criteriaId}</p>}
          </div>

          {/* Date + Points row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
                {L.date} <span style={{ color: "#38B39E" }}>*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                style={inputStyle("date")}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
                {L.points} <span style={{ color: "#38B39E" }}>*</span>
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
              {errors.points && <p className="text-xs" style={{ color: "#E2693E" }}>{errors.points}</p>}
            </div>
          </div>

          {/* Notes — mandatory, keeps a record of the reason for every point */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
              {L.notes} <span style={{ color: "#38B39E" }}>*</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
              style={inputStyle("notes")}
            />
            {errors.notes && <p className="text-xs" style={{ color: "#E2693E" }}>{errors.notes}</p>}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-lg font-bold text-sm text-white btn-hover"
            style={{
              backgroundColor: success ? "#38B39E" : "#ECA040",
              opacity: saving ? 0.7 : 1,
              transition: "background-color 0.2s var(--ease-out-quart)",
            }}
          >
            <span key={success ? "ok" : "idle"} className={success ? "anim-pop inline-block" : undefined}>
              {success
                ? (editingId ? L.updated : L.saved)
                : saving
                ? (editingId ? L.updating : L.saving)
                : (editingId ? L.update : L.save)}
            </span>
          </button>
        </div>

        {/* Recent entries — click to edit */}
        <div className="space-y-3 anim-in" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{L.recent}</h2>
            <span className="text-xs" style={{ color: "#AAA" }}>{L.clickToEdit}</span>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
            {groupEntries.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#888" }}>{L.noRecent}</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "#E8DCCF" }}>
                {groupEntries.slice(0, 12).map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => startEdit(e)}
                    className="w-full flex items-start justify-between px-4 py-3 text-left transition-colors hover:bg-koco-blush/30"
                    style={{ backgroundColor: editingId === e.id ? "rgba(236,160,64,0.14)" : i % 2 === 0 ? "#FFFFFF" : "#F8F0DE" }}
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-xs font-medium truncate" style={{ color: "#1C1C1C" }}>
                        {volName(e.volunteer_id)}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#888" }}>
                        {e.criteria?.category ?? "—"} · {e.date ?? "—"}
                      </p>
                      {(() => {
                        const d = locale === "es"
                          ? (e.criteria?.description_es ?? e.criteria?.description_en)
                          : (e.criteria?.description_en ?? e.criteria?.description_es);
                        const reason = [d, e.notes].filter(Boolean).join(" — ");
                        return reason ? (
                          <p className="text-xs mt-0.5" style={{ color: "#75695C" }}>{reason}</p>
                        ) : null;
                      })()}
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: "#CDD909" }}>
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
        <div className="rounded-2xl overflow-hidden shadow-koco divide-y" style={{ backgroundColor: "#F8F0DE", borderColor: "#E8DCCF" }}>
          {groupVolunteers.map((v, i) => {
            const total = totalsByVolunteer[v.id] ?? 0;
            const met = total >= COMPLETION_TARGET_POINTS;
            const pct = Math.min(100, (total / COMPLETION_TARGET_POINTS) * 100);
            return (
              <div key={v.id} className="flex items-center gap-4 px-4 py-3" style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F8F0DE" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{v.full_name}</p>
                    <p className="text-sm font-bold shrink-0" style={{ color: "#CDD909" }}>{total} pts</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ backgroundColor: "rgba(0,0,0,0.06)" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        backgroundColor: met ? "#38B39E" : "#CDD909",
                        transition: "width 400ms var(--ease-out-quart)",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: met ? "#1F7A6E" : "#888" }}>
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
