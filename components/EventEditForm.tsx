"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";

export type EditableEvent = {
  id: string;
  name: string;
  host: string | null;
  place: string | null;
  event_date_start: string | null;
  event_date_end: string | null;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  max_invited_koco: number | null;
};

const T = {
  es: {
    name: "Nombre del evento", host: "Organizador", place: "Lugar",
    dateStart: "Fecha inicio", dateEnd: "Fecha fin (opcional)",
    timeStart: "Hora inicio", timeEnd: "Hora fin",
    description: "Descripción", maxAttendees: "Cupos (máx. asistentes)",
    noLimit: "Sin límite si queda vacío",
    save: "Guardar cambios", saving: "Guardando...", cancel: "Cancelar",
    required: "Nombre y fecha de inicio son obligatorios.",
    failed: "No se pudo guardar. Puede que el registro ya no esté abierto.",
  },
  en: {
    name: "Event name", host: "Host", place: "Place",
    dateStart: "Start date", dateEnd: "End date (optional)",
    timeStart: "Start time", timeEnd: "End time",
    description: "Description", maxAttendees: "Spots (max attendees)",
    noLimit: "No limit if left empty",
    save: "Save changes", saving: "Saving...", cancel: "Cancel",
    required: "Name and start date are required.",
    failed: "Couldn't save. Registration may no longer be open.",
  },
  ko: {
    name: "행사 이름", host: "주최", place: "장소",
    dateStart: "시작일", dateEnd: "종료일 (선택)",
    timeStart: "시작 시간", timeEnd: "종료 시간",
    description: "설명", maxAttendees: "정원 (최대 인원)",
    noLimit: "비워 두면 제한 없음",
    save: "변경사항 저장", saving: "저장 중...", cancel: "취소",
    required: "이름과 시작일은 필수예요.",
    failed: "저장하지 못했어요. 신청이 이미 마감됐을 수 있어요.",
  },
} as const;

/**
 * Edit an existing event's details — name, place, schedule, description,
 * capacity. Shared by the admin panel and the volunteer who proposed the
 * event, because both are allowed to touch exactly the same fields: the
 * database (migration 30) draws the real line, restricting a non-admin to
 * their own event while registration_status is 'open', and forbidding either
 * of them from changing approval_status, registration_status or ownership
 * through this path. If the update is rejected — most likely because someone
 * closed registration in the meantime — this reports failure rather than
 * pretending it saved.
 */
export default function EventEditForm({
  event,
  onCancel,
  onSaved,
}: {
  event: EditableEvent;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { locale } = useLocale();
  const L = T[locale];
  const router = useRouter();

  const [name, setName] = useState(event.name);
  const [host, setHost] = useState(event.host ?? "");
  const [place, setPlace] = useState(event.place ?? "");
  const [dateStart, setDateStart] = useState(event.event_date_start ?? "");
  const [dateEnd, setDateEnd] = useState(event.event_date_end ?? "");
  const [timeStart, setTimeStart] = useState(event.start_time?.slice(0, 5) ?? "");
  const [timeEnd, setTimeEnd] = useState(event.end_time?.slice(0, 5) ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [maxAttendees, setMaxAttendees] = useState<number | "">(event.max_invited_koco ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle = { backgroundColor: "#FFFFFF", border: "1.5px solid #DDD0C4", color: "#1C1C1C" };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !dateStart) { setError(L.required); return; }

    setSaving(true);
    const { error: updateError } = await createClient()
      .from("events")
      .update({
        name: name.trim(),
        host: host.trim() || null,
        place: place.trim() || null,
        event_date_start: dateStart,
        event_date_end: dateEnd || null,
        start_time: timeStart || null,
        end_time: timeEnd || null,
        description: description.trim() || null,
        max_invited_koco: maxAttendees === "" ? null : Number(maxAttendees),
      })
      .eq("id", event.id);
    setSaving(false);

    if (updateError) { setError(L.failed); return; }
    router.refresh();
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl p-4 space-y-3 anim-pop" style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E8DCCF" }}>
      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.name} *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.host}</label>
          <input value={host} onChange={(e) => setHost(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.place}</label>
          <input value={place} onChange={(e) => setPlace(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.dateStart} *</label>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.dateEnd}</label>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.timeStart}</label>
          <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.timeEnd}</label>
          <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.description}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none" style={inputStyle} />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.maxAttendees}</label>
        <input
          type="number" min={1}
          value={maxAttendees}
          onChange={(e) => setMaxAttendees(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full sm:w-40 px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle}
        />
        <p className="text-xs" style={{ color: "#888" }}>{L.noLimit}</p>
      </div>

      {error && <p className="text-xs anim-pop" style={{ color: "#E2693E" }}>{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="text-xs font-bold px-4 py-2 rounded-lg text-white btn-hover"
          style={{ backgroundColor: "#38B39E", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? L.saving : L.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium px-4 py-2 rounded-lg"
          style={{ color: "#6B6258" }}
        >
          {L.cancel}
        </button>
      </div>
    </form>
  );
}
