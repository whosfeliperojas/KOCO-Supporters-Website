"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import type { Contributor } from "@/lib/types";

const T = {
  es: {
    heading: "Quién trabajó en esto",
    lead: "Responsable",
    none: "Solo la persona responsable.",
    noneAtAll: "Nadie acreditado todavía.",
    add: "Agregar colaborador/a",
    select: "Elegir persona...",
    saving: "Guardando...",
    remove: "Quitar",
    fromSheet: "Recuperado de la parrilla",
    fromTeam: "Crédito de equipo",
    lockedHint: "Viene de la parrilla; solo un admin puede quitarlo.",
    failed: "No se pudo guardar. Intenta de nuevo.",
  },
  en: {
    heading: "Who worked on this",
    lead: "Lead",
    none: "Just the person responsible.",
    noneAtAll: "Nobody credited yet.",
    add: "Add a collaborator",
    select: "Choose a person...",
    saving: "Saving...",
    remove: "Remove",
    fromSheet: "Recovered from the grid",
    fromTeam: "Team credit",
    lockedHint: "Came from the grid; only an admin can remove it.",
    failed: "Couldn't save. Try again.",
  },
  ko: {
    heading: "참여한 사람",
    lead: "담당자",
    none: "담당자만 참여했어요.",
    noneAtAll: "아직 등록된 참여자가 없어요.",
    add: "협업자 추가",
    select: "사람 선택...",
    saving: "저장 중...",
    remove: "삭제",
    fromSheet: "시트에서 복원됨",
    fromTeam: "팀 크레딧",
    lockedHint: "시트에서 가져온 기록이라 관리자만 삭제할 수 있어요.",
    failed: "저장하지 못했어요. 다시 시도해 주세요.",
  },
} as const;

const SOURCE_HINT = { sheet_comment: "fromSheet", team_credit: "fromTeam" } as const;

export default function ContributorsPanel({
  postId,
  contributors: initial,
  canEdit,
  isAdmin,
}: {
  postId: string;
  contributors: Contributor[];
  /** Admins always; the lead only while the post is still editable. */
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const { locale } = useLocale();
  const L = T[locale];
  const router = useRouter();

  const [roster, setRoster] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Rendered straight from the prop, with no mirrored state: every add and
  // remove ends in router.refresh(), so the server is always the one source
  // of what the list holds. Copying it into state only added a render pass
  // and a way for the two to disagree.
  const rows = initial;

  useEffect(() => {
    if (!canEdit) return;
    createClient()
      .rpc("list_roster")
      .then(({ data }) => setRoster((data as { id: string; name: string }[]) ?? []));
  }, [canEdit]);

  const credited = new Set(rows.map((r) => r.profile_id));
  const addable = roster.filter((p) => !credited.has(p.id));

  async function add(profileId: string) {
    if (!profileId) return;
    setBusy(true);
    setFailed(false);
    const { error } = await createClient()
      .from("content_post_contributors")
      .insert({ content_post_id: postId, profile_id: profileId, role: "collaborator", source: "app" });
    setBusy(false);
    if (error) { setFailed(true); return; }
    router.refresh();
  }

  async function remove(profileId: string) {
    setBusy(true);
    setFailed(false);
    const { error } = await createClient()
      .from("content_post_contributors")
      .delete()
      .eq("content_post_id", postId)
      .eq("profile_id", profileId);
    setBusy(false);
    if (error) { setFailed(true); return; }
    router.refresh();
  }

  const lead = rows.find((r) => r.role === "lead");
  const others = rows.filter((r) => r.role !== "lead");

  return (
    <div className="rounded-2xl p-5 shadow-koco space-y-3 anim-in" style={{ backgroundColor: "#F8F0DE" }}>
      <h2 className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{L.heading}</h2>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "#888" }}>{L.noneAtAll}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lead && (
            <Chip
              label={lead.name}
              tag={L.lead}
              accent
              // Removing the lead would contradict responsible_id; reassign the
              // post instead, which the trigger mirrors here.
              onRemove={null}
              lockedHint={null}
            />
          )}
          {others.map((c) => {
            const imported = c.source !== "app";
            const removable = canEdit && (isAdmin || !imported);
            return (
              <Chip
                key={c.profile_id}
                label={c.name}
                tag={imported ? L[SOURCE_HINT[c.source as keyof typeof SOURCE_HINT]] : null}
                accent={false}
                onRemove={removable && !busy ? () => remove(c.profile_id) : null}
                lockedHint={canEdit && imported && !isAdmin ? L.lockedHint : null}
                removeLabel={L.remove}
              />
            );
          })}
          {others.length === 0 && lead && (
            <span className="text-xs self-center" style={{ color: "#888" }}>{L.none}</span>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-2 pt-1">
          <label className="text-xs font-medium" style={{ color: "#6B6258" }}>{L.add}:</label>
          <select
            value=""
            disabled={busy || addable.length === 0}
            onChange={(e) => add(e.target.value)}
            className="px-2 py-1.5 text-xs rounded-lg outline-none"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1.5px solid #DDD0C4",
              color: "#1C1C1C",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <option value="">{busy ? L.saving : L.select}</option>
            {addable.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {failed && <p className="text-xs" style={{ color: "#E2693E" }}>{L.failed}</p>}
    </div>
  );
}

function Chip({
  label,
  tag,
  accent,
  onRemove,
  lockedHint,
  removeLabel,
}: {
  label: string;
  tag: string | null;
  accent: boolean;
  onRemove: (() => void) | null;
  lockedHint: string | null;
  removeLabel?: string;
}) {
  return (
    <span
      title={lockedHint ?? tag ?? undefined}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
      style={{
        backgroundColor: accent ? "rgba(56,179,158,0.15)" : "#FFFFFF",
        color: accent ? "#1F7A6E" : "#1C1C1C",
        border: accent ? "none" : "1.5px solid #E8DCCF",
      }}
    >
      {label}
      {tag && <span style={{ color: accent ? "#1F7A6E" : "#9A8F84", fontWeight: 400 }}>· {tag}</span>}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`${removeLabel}: ${label}`}
          className="ml-0.5 leading-none"
          style={{ color: "#B0A79C", fontSize: 14 }}
        >
          ×
        </button>
      )}
    </span>
  );
}
