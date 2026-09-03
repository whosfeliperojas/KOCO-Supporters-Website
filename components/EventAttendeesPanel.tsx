"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";

export type EventSignup = {
  id: string;
  event_id: string;
  volunteer_id: string;
  role: "attendee" | "support";
  /** NULL until an admin records whether they actually turned up. */
  attended: boolean | null;
  rsvp: "accepted" | "declined";
  signed_up_at: string;
  name: string;
  group_code: string | null;
};

const T = {
  es: {
    registered: "inscritos/as",
    show: "Ver inscritos/as",
    hide: "Ocultar",
    none: "Nadie se ha inscrito todavía.",
    declined: "No asistirá",
    support: "Apoyo",
    attendee: "Asistente",
    attendance: "Asistencia",
    came: "Asistió",
    missed: "No asistió",
    unset: "Sin registrar",
    remove: "Quitar",
    removeConfirm: "¿Quitar a esta persona del evento?",
    add: "Agregar persona",
    addHint: "Para quien se sumó sobre la marcha o se inscribió por fuera.",
    choose: "Elegir persona...",
    allIn: "Todo el equipo activo ya está en la lista.",
    saving: "Guardando...",
    failed: "No se pudo guardar. Intenta de nuevo.",
    summary: "asistieron",
  },
  en: {
    registered: "registered",
    show: "See who registered",
    hide: "Hide",
    none: "Nobody has registered yet.",
    declined: "Not coming",
    support: "Support",
    attendee: "Attendee",
    attendance: "Attendance",
    came: "Attended",
    missed: "Did not attend",
    unset: "Not recorded",
    remove: "Remove",
    removeConfirm: "Remove this person from the event?",
    add: "Add a person",
    addHint: "For someone who joined on the day or signed up elsewhere.",
    choose: "Choose a person...",
    allIn: "Everyone active is already on the list.",
    saving: "Saving...",
    failed: "Couldn't save. Try again.",
    summary: "attended",
  },
  ko: {
    registered: "명 신청",
    show: "신청자 보기",
    hide: "접기",
    none: "아직 신청자가 없어요.",
    declined: "불참",
    support: "지원",
    attendee: "참가자",
    attendance: "출석",
    came: "참석함",
    missed: "불참함",
    unset: "미기록",
    remove: "삭제",
    removeConfirm: "이 사람을 행사에서 삭제할까요?",
    add: "사람 추가",
    addHint: "당일 합류했거나 외부에서 신청한 경우에 사용하세요.",
    choose: "사람 선택...",
    allIn: "활동 중인 팀원이 모두 목록에 있어요.",
    saving: "저장 중...",
    failed: "저장하지 못했어요. 다시 시도해 주세요.",
    summary: "명 참석",
  },
} as const;

export default function EventAttendeesPanel({
  eventId,
  signups,
  roster,
}: {
  eventId: string;
  signups: EventSignup[];
  roster: { id: string; full_name: string }[];
}) {
  const { locale } = useLocale();
  const L = T[locale];
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const signedUp = new Set(signups.map((s) => s.volunteer_id));
  const addable = roster.filter((p) => !signedUp.has(p.id));
  const attendedCount = signups.filter((s) => s.attended === true).length;
  const recorded = signups.some((s) => s.attended !== null);

  async function run(id: string, fn: () => Promise<{ error: unknown }>) {
    setBusyId(id);
    setFailed(false);
    const { error } = await fn();
    setBusyId(null);
    if (error) { setFailed(true); return; }
    router.refresh();
  }

  // Three states, not a checkbox: "not recorded" has to stay distinguishable
  // from "recorded as absent", because 110 of the existing signups have never
  // had attendance taken and those two must not look the same.
  function setAttended(s: EventSignup, value: boolean | null) {
    run(s.id, async () =>
      createClient().from("event_attendees").update({ attended: value }).eq("id", s.id),
    );
  }

  function removeSignup(s: EventSignup) {
    setConfirmRemoveId(null);
    run(s.id, async () =>
      createClient().from("event_attendees").delete().eq("id", s.id),
    );
  }

  function addPerson(profileId: string) {
    if (!profileId) return;
    run("add", async () =>
      createClient()
        .from("event_attendees")
        .insert({ event_id: eventId, volunteer_id: profileId, role: "attendee", rsvp: "accepted" }),
    );
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid #E8DCCF" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-xs font-bold btn-hover px-2 py-1 -ml-2 rounded-lg"
        style={{ color: "#1F7A6E" }}
      >
        {open ? `▾ ${L.hide}` : `▸ ${L.show} (${signups.length})`}
        {!open && recorded && (
          <span className="ml-1.5" style={{ color: "#888", fontWeight: 400 }}>
            · {attendedCount} {L.summary}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2 anim-in">
          {signups.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "#888" }}>{L.none}</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E8DCCF" }}>
              {signups.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 flex-wrap"
                  style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FBF6EA" }}
                >
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: s.rsvp === "declined" ? "#9A8F84" : "#1C1C1C",
                        textDecoration: s.rsvp === "declined" ? "line-through" : undefined,
                      }}
                    >
                      {s.name}
                    </span>
                    {s.group_code && (
                      <span className="text-xs" style={{ color: "#9A8F84" }}>{s.group_code}</span>
                    )}
                    {s.role === "support" && (
                      <span
                        className="label-style text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(236,160,64,0.15)", color: "#B07A1A" }}
                      >
                        {L.support}
                      </span>
                    )}
                    {s.rsvp === "declined" && (
                      <span
                        className="label-style text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#888" }}
                      >
                        {L.declined}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <AttendanceToggle
                      value={s.attended}
                      disabled={busyId === s.id}
                      labels={{ came: L.came, missed: L.missed, unset: L.unset }}
                      onChange={(v) => setAttended(s, v)}
                    />
                    {confirmRemoveId === s.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => removeSignup(s)}
                          className="text-xs font-bold px-2 py-1 rounded-lg text-white btn-hover"
                          style={{ backgroundColor: "#E2693E" }}
                        >
                          {L.remove}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs font-bold px-2 py-1 rounded-lg btn-hover"
                          style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#1C1C1C" }}
                        >
                          ✕
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(s.id)}
                        title={L.removeConfirm}
                        aria-label={`${L.remove}: ${s.name}`}
                        disabled={busyId === s.id}
                        className="text-sm px-1.5 leading-none btn-hover rounded"
                        style={{ color: "#B0A79C" }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-medium" style={{ color: "#6B6258" }}>{L.add}:</label>
            <select
              value=""
              disabled={busyId === "add" || addable.length === 0}
              onChange={(e) => addPerson(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg outline-none"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1.5px solid #DDD0C4",
                color: "#1C1C1C",
                opacity: busyId === "add" ? 0.6 : 1,
              }}
            >
              <option value="">
                {busyId === "add" ? L.saving : addable.length === 0 ? L.allIn : L.choose}
              </option>
              {addable.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <span className="text-xs" style={{ color: "#9A8F84" }}>{L.addHint}</span>
          </div>

          {failed && <p className="text-xs" style={{ color: "#E2693E" }}>{L.failed}</p>}
        </div>
      )}
    </div>
  );
}

function AttendanceToggle({
  value,
  disabled,
  labels,
  onChange,
}: {
  value: boolean | null;
  disabled: boolean;
  labels: { came: string; missed: string; unset: string };
  onChange: (v: boolean | null) => void;
}) {
  const options: { v: boolean | null; text: string; label: string; on: string }[] = [
    { v: true,  text: "✓", label: labels.came,   on: "#38B39E" },
    { v: false, text: "✕", label: labels.missed, on: "#E2693E" },
    { v: null,  text: "–", label: labels.unset,  on: "#9A8F84" },
  ];
  return (
    <span
      role="radiogroup"
      aria-label={labels.came}
      className="inline-flex rounded-lg overflow-hidden"
      style={{ border: "1px solid #E8DCCF", opacity: disabled ? 0.5 : 1 }}
    >
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={String(o.v)}
            role="radio"
            aria-checked={active}
            title={o.label}
            disabled={disabled}
            onClick={() => onChange(o.v)}
            className="px-2 py-1 text-xs font-bold transition-colors"
            style={{
              backgroundColor: active ? o.on : "transparent",
              color: active ? "#FFFFFF" : "#B0A79C",
            }}
          >
            {o.text}
          </button>
        );
      })}
    </span>
  );
}
