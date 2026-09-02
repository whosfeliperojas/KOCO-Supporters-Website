"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";

type Profile = {
  id: string;
  full_name: string;
  display_name: string | null;
  is_admin: boolean;
  active: boolean;
  auth_user_id: string | null;
  group: { code: string; name: string } | null;
};

type Group = { id: string; code: string; name: string };

export default function AdminUsersClient({
  profiles,
  pointTotals,
  groups,
  locale: initialLocale,
}: {
  profiles: Profile[];
  pointTotals: Record<string, number>;
  groups: Group[];
  locale: "es" | "en" | "ko";
}) {
  const { locale } = useLocale();
  const router = useRouter();

  const T = {
    es: {
      title: "Usuarios", name: "Nombre", group: "Grupo", points: "Puntos", role: "Rol",
      linked: "Cuenta", admin: "Admin", volunteer: "Voluntario/a",
      pending: "Sin vincular", linked_ok: "Vinculado",
      volunteersLabel: "Voluntarios", adminsLabel: "Administradores",
      createTitle: "Crear acceso de usuario",
      createDesc: "Crea la cuenta con una contraseña temporal. En su primer ingreso, la persona deberá cambiarla.",
      firstName: "Nombre", lastName: "Apellido", email: "Correo electrónico",
      groupLabel: "Grupo", isAdminLabel: "Es administrador/a",
      linkExisting: "Vincular a perfil existente (opcional)",
      newProfile: "— Crear perfil nuevo —",
      createBtn: "Crear acceso", creating: "Creando...",
      successMsg: "Cuenta creada. Contraseña temporal:",
      shareHint: "Compártela con la persona; deberá cambiarla en su primer ingreso.",
      required: "Completa nombre, apellido y correo.",
      selectGroup: "Sin grupo",
      actions: "Acciones",
      resetBtn: "Restablecer clave",
      offboardBtn: "Retirar acceso",
      reactivateBtn: "Reactivar",
      inactiveLabel: "Retirados",
      inactiveDesc: "Sin acceso a la plataforma. Sus puntos y contenidos se conservan.",
      confirmOffboard: "¿Retirar el acceso de {name}?",
      confirmOffboardDesc:
        "Se elimina su cuenta de acceso y no podrá volver a entrar. Sus puntos, asistencias y contenidos se conservan intactos. Puedes reactivarla más adelante.",
      confirmYes: "Sí, retirar acceso",
      confirmNo: "Cancelar",
      resetMsg: "Contraseña temporal nueva para {name}:",
      noAccount: "Sin cuenta",
      working: "Procesando...",
    },
    en: {
      title: "Users", name: "Name", group: "Group", points: "Points", role: "Role",
      linked: "Account", admin: "Admin", volunteer: "Volunteer",
      pending: "Not linked", linked_ok: "Linked",
      volunteersLabel: "Volunteers", adminsLabel: "Admins",
      createTitle: "Create user access",
      createDesc: "Creates the account with a temporary password. On first login the person must change it.",
      firstName: "First name", lastName: "Last name", email: "Email address",
      groupLabel: "Group", isAdminLabel: "Is admin",
      linkExisting: "Link to existing profile (optional)",
      newProfile: "— Create new profile —",
      createBtn: "Create access", creating: "Creating...",
      successMsg: "Account created. Temporary password:",
      shareHint: "Share it with the person; they must change it on first login.",
      required: "Fill in first name, last name and email.",
      selectGroup: "No group",
      actions: "Actions",
      resetBtn: "Reset password",
      offboardBtn: "Revoke access",
      reactivateBtn: "Reactivate",
      inactiveLabel: "Offboarded",
      inactiveDesc: "No access to the platform. Their points and content are kept.",
      confirmOffboard: "Revoke access for {name}?",
      confirmOffboardDesc:
        "Their login is deleted and they will not be able to sign in again. Their points, attendance and content are kept intact. You can reactivate them later.",
      confirmYes: "Yes, revoke access",
      confirmNo: "Cancel",
      resetMsg: "New temporary password for {name}:",
      noAccount: "No account",
      working: "Working...",
    },
    ko: {
      title: "멤버", name: "이름", group: "소속", points: "포인트", role: "역할",
      linked: "계정", admin: "관리자", volunteer: "서포터즈",
      pending: "미연동", linked_ok: "연동 완료",
      volunteersLabel: "서포터즈", adminsLabel: "관리자",
      createTitle: "사용자 계정 만들기",
      createDesc: "임시 비밀번호로 계정을 만들어요. 첫 로그인 때 비밀번호를 변경해야 해요.",
      firstName: "이름", lastName: "성", email: "이메일 주소",
      groupLabel: "소속", isAdminLabel: "관리자 권한",
      linkExisting: "기존 프로필에 연동 (선택)",
      newProfile: "— 새 프로필 만들기 —",
      createBtn: "계정 만들기", creating: "만드는 중...",
      successMsg: "계정을 만들었어요. 임시 비밀번호:",
      shareHint: "본인에게 전달해 주세요. 첫 로그인 때 변경해야 해요.",
      required: "이름, 성, 이메일을 입력해 주세요.",
      selectGroup: "소속 없음",
      actions: "관리",
      resetBtn: "비밀번호 재설정",
      offboardBtn: "접근 권한 해제",
      reactivateBtn: "다시 활성화",
      inactiveLabel: "활동 종료",
      inactiveDesc: "플랫폼에 접근할 수 없어요. 포인트와 콘텐츠는 그대로 남아요.",
      confirmOffboard: "{name} 님의 접근 권한을 해제할까요?",
      confirmOffboardDesc:
        "로그인 계정이 삭제되어 다시 로그인할 수 없어요. 포인트, 참여 기록, 콘텐츠는 그대로 유지돼요. 나중에 다시 활성화할 수 있어요.",
      confirmYes: "네, 해제할게요",
      confirmNo: "취소",
      resetMsg: "{name} 님의 새 임시 비밀번호:",
      noAccount: "계정 없음",
      working: "처리 중...",
    },
  } as const;
  const L = T[locale];

  // ── Create form state ────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [groupId, setGroupId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [linkProfileId, setLinkProfileId] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Per-user action state ────────────────────────────────────────
  // `busyId` is the profile currently mid-request; `confirmId` is the one
  // showing its offboard confirmation.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<{ name: string; tempPassword: string } | null>(null);

  const unlinked = profiles.filter((p) => !p.auth_user_id);

  async function runAction(profile: Profile, action: "offboard" | "reactivate" | "reset-password") {
    setError(null);
    setResult(null);
    setResetFor(null);
    setBusyId(profile.id);

    const res = await fetch(`/api/admin/users/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();

    setBusyId(null);
    setConfirmId(null);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }
    if (action === "reset-password" && data.tempPassword) {
      setResetFor({ name: profile.full_name, tempPassword: data.tempPassword });
    }
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!linkProfileId && (!firstName.trim() || !lastName.trim())) { setError(L.required); return; }
    if (!email.trim()) { setError(L.required); return; }

    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        groupId: groupId || null,
        isAdmin,
        linkProfileId: linkProfileId || null,
      }),
    });
    const data = await res.json();
    setCreating(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }
    setResult({ tempPassword: data.tempPassword });
    setFirstName(""); setLastName(""); setEmail(""); setGroupId(""); setIsAdmin(false); setLinkProfileId("");
    router.refresh();
  }

  const inputStyle = { backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" };

  const actionBtn = {
    border: "1.5px solid #E8DCCF",
    backgroundColor: "#F8F0DE",
    color: "#1C1C1C",
  };

  function UserTable({
    users,
    label,
    description,
    variant = "active",
  }: {
    users: Profile[];
    label: string;
    description?: string;
    variant?: "active" | "inactive";
  }) {
    return (
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{label}</h2>
          {description && (
            <p className="text-xs mt-1" style={{ color: "#6B6258" }}>{description}</p>
          )}
        </div>
        <div className="rounded-2xl overflow-hidden shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
          <div
            className="grid grid-cols-12 px-4 py-2 text-xs font-bold uppercase tracking-wider"
            style={{ backgroundColor: "#ECA040", color: "white" }}
          >
            <span className="col-span-3">{L.name}</span>
            <span className="col-span-1">{L.group}</span>
            <span className="col-span-1 text-right">{L.points}</span>
            <span className="col-span-2">{L.role}</span>
            <span className="col-span-2">{L.linked}</span>
            <span className="col-span-3 text-right">{L.actions}</span>
          </div>

          <div className="divide-y" style={{ borderColor: "#E8DCCF" }}>
            {users.map((p, i) => (
              <div key={p.id}>
                <div
                  className="grid grid-cols-12 px-4 py-3 items-center text-sm"
                  style={{
                    backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F8F0DE",
                    opacity: variant === "inactive" ? 0.75 : 1,
                  }}
                >
                  <div className="col-span-3 min-w-0">
                    <p className="font-medium truncate" style={{ color: "#1C1C1C" }}>{p.full_name}</p>
                    {p.display_name && (
                      <p className="text-xs truncate" style={{ color: "#6B6258" }}>{p.display_name}</p>
                    )}
                  </div>
                  <span className="col-span-1 text-xs font-medium" style={{ color: "#38B39E" }}>
                    {p.group?.code ?? "—"}
                  </span>
                  <span className="col-span-1 text-right font-bold" style={{ color: "#6E7A00" }}>
                    {pointTotals[p.id] ?? 0}
                  </span>
                  <span className="col-span-2 text-xs" style={{ color: p.is_admin ? "#E2693E" : "#6B6258" }}>
                    {p.is_admin ? L.admin : L.volunteer}
                  </span>
                  <span
                    className="col-span-2 text-xs font-medium"
                    style={{ color: p.auth_user_id ? "#38B39E" : "#B07A1A" }}
                  >
                    {p.auth_user_id ? L.linked_ok : variant === "inactive" ? L.noAccount : L.pending}
                  </span>

                  <div className="col-span-3 flex flex-wrap gap-1.5 justify-end">
                    {busyId === p.id ? (
                      <span className="text-xs" style={{ color: "#6B6258" }}>{L.working}</span>
                    ) : variant === "inactive" ? (
                      <button
                        onClick={() => runAction(p, "reactivate")}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ ...actionBtn, color: "#38B39E" }}
                      >
                        {L.reactivateBtn}
                      </button>
                    ) : (
                      <>
                        {p.auth_user_id && (
                          <button
                            onClick={() => runAction(p, "reset-password")}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                            style={actionBtn}
                          >
                            {L.resetBtn}
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmId(confirmId === p.id ? null : p.id)}
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                          style={{ ...actionBtn, color: "#E2693E" }}
                        >
                          {L.offboardBtn}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {confirmId === p.id && (
                  <div className="px-4 py-3 space-y-2" style={{ backgroundColor: "#FCD4C1" }}>
                    <p className="text-sm font-bold" style={{ color: "#1C1C1C" }}>
                      {L.confirmOffboard.replace("{name}", p.full_name)}
                    </p>
                    <p className="text-xs" style={{ color: "#6B6258" }}>{L.confirmOffboardDesc}</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => runAction(p, "offboard")}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: "#E2693E", color: "#FFFFFF" }}
                      >
                        {L.confirmYes}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={actionBtn}
                      >
                        {L.confirmNo}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const volunteers = profiles.filter((p) => !p.is_admin && p.active);
  const admins = profiles.filter((p) => p.is_admin && p.active);
  const inactive = profiles.filter((p) => !p.active);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold anim-in" style={{ color: "#1C1C1C" }}>{L.title}</h1>

      {/* Create access form */}
      <section className="rounded-2xl p-5 shadow-koco space-y-4 anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 1 } as React.CSSProperties}>
        <div>
          <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.createTitle}</h2>
          <p className="text-xs mt-1" style={{ color: "#6B6258" }}>{L.createDesc}</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Link to existing */}
          {unlinked.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.linkExisting}</label>
              <select
                value={linkProfileId}
                onChange={(e) => setLinkProfileId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                style={inputStyle}
              >
                <option value="">{L.newProfile}</option>
                {unlinked.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name} {p.group ? `(${p.group.code})` : ""}</option>
                ))}
              </select>
            </div>
          )}

          {!linkProfileId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.firstName}</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.lastName}</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.email}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
          </div>

          {!linkProfileId && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.groupLabel}</label>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle}>
                  <option value="">{L.selectGroup}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 pb-2.5 cursor-pointer">
                <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="w-4 h-4" style={{ accentColor: "#E2693E" }} />
                <span className="text-sm" style={{ color: "#1C1C1C" }}>{L.isAdminLabel}</span>
              </label>
            </div>
          )}

          {error && <p className="text-xs anim-pop" style={{ color: "#E2693E" }}>{error}</p>}

          {result && (
            <div className="rounded-lg px-4 py-3 anim-pop" style={{ backgroundColor: "rgba(56,179,158,0.12)" }}>
              <p className="text-sm font-medium" style={{ color: "#1F7A6E" }}>
                {L.successMsg} <code className="font-bold text-base">{result.tempPassword}</code>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#1F7A6E" }}>{L.shareHint}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="text-sm font-bold px-5 py-2.5 rounded-lg text-white btn-hover"
            style={{ backgroundColor: "#38B39E", opacity: creating ? 0.6 : 1 }}
          >
            {creating ? L.creating : L.createBtn}
          </button>
        </form>
      </section>

      {/* Result of a per-row action (reset / offboard / reactivate) */}
      {resetFor && (
        <div className="rounded-lg px-4 py-3 anim-pop" style={{ backgroundColor: "rgba(56,179,158,0.12)" }}>
          <p className="text-sm font-medium" style={{ color: "#1F7A6E" }}>
            {L.resetMsg.replace("{name}", resetFor.name)}{" "}
            <code className="font-bold text-base">{resetFor.tempPassword}</code>
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#1F7A6E" }}>{L.shareHint}</p>
        </div>
      )}

      <div className="anim-in" style={{ "--i": 2 } as React.CSSProperties}>
        <UserTable users={volunteers} label={`${L.volunteersLabel} (${volunteers.length})`} />
      </div>
      {admins.length > 0 && (
        <div className="anim-in" style={{ "--i": 3 } as React.CSSProperties}>
          <UserTable users={admins} label={`${L.adminsLabel} (${admins.length})`} />
        </div>
      )}
      {inactive.length > 0 && (
        <div className="anim-in" style={{ "--i": 4 } as React.CSSProperties}>
          <UserTable
            users={inactive}
            label={`${L.inactiveLabel} (${inactive.length})`}
            description={L.inactiveDesc}
            variant="inactive"
          />
        </div>
      )}
    </div>
  );
}
