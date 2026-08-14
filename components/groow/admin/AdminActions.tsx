"use client";

// Ações globais do admin (tema, notificações, perfil/logout).
// Usado na Sidebar (desktop, menus abrem pra direita) e no TopNav mobile (abrem pra baixo).
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, X, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/groow/admin/ThemeToggle";

interface AdminProfile { nome: string; email: string; foto: string | null }

const menuItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  padding: "11px 16px", background: "none", border: "none", cursor: "pointer",
  fontSize: 13.5, fontWeight: 500, color: "var(--ed2-ink)", textAlign: "left",
};

function ProfileModal({ profile, onClose, onSaved }: { profile: AdminProfile; onClose: () => void; onSaved: (p: AdminProfile) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError(""); setOkMsg("");
    const fd = new FormData(e.currentTarget);
    const novaSenha = String(fd.get("senha") || "");
    if (novaSenha && novaSenha.length < 8) { setError("A nova senha precisa de ao menos 8 caracteres."); setSaving(false); return; }
    const payload = {
      nome: String(fd.get("nome") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      senha: novaSenha || undefined,
    };
    try {
      const res = await fetch("/api/admin/perfil", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      setOkMsg("Perfil atualizado!");
      onSaved({ nome: payload.nome, email: payload.email, foto: profile.foto });
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 10, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 13, boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--ed2-card)", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Editar perfil</h3>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={lStyle}>Nome</label><input name="nome" defaultValue={profile.nome} placeholder="Seu nome" style={iStyle} /></div>
          <div><label style={lStyle}>Email</label><input name="email" type="email" defaultValue={profile.email} placeholder="email@enderecodigital.com" style={iStyle} /></div>
          <div><label style={lStyle}>Nova senha (deixe vazio pra manter)</label><input name="senha" type="password" placeholder="••••••••" style={iStyle} /></div>
        </div>
        {error ? <p style={{ padding: "0 22px", color: "#c8261c", fontSize: 12 }}>{error}</p> : null}
        {okMsg ? <p style={{ padding: "0 22px", color: "#1d8a3a", fontSize: 12 }}>{okMsg}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13 }}>Fechar</button>
          <button type="submit" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#C9A961", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminActions({ dropdownSide = "bottom", onDark = false }: { dropdownSide?: "bottom" | "right"; onDark?: boolean }) {
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profile, setProfile] = useState<AdminProfile>({ nome: "Admin", email: "", foto: null });
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/perfil").then((r) => r.json()).then((d) => {
      if (d.perfil) setProfile(d.perfil);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!bellOpen && !profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen, profileOpen]);

  const initials = (profile.nome || "Admin").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "AD";

  const onLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/operacao/login";
  };

  // popover: pra baixo (topbar) ou pra direita (sidebar)
  const popPos: React.CSSProperties =
    dropdownSide === "right"
      ? { position: "absolute", left: "calc(100% + 12px)", top: 0, zIndex: 130 }
      : { position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 130 };

  const iconBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 99,
    background: onDark ? "rgba(255,255,255,0.08)" : "var(--ed2-surface)",
    color: onDark ? "rgba(255,255,255,0.72)" : "var(--ed2-ink-2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", border: "none",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <ThemeToggle onDark={onDark} />
      <div ref={bellRef} style={{ position: "relative" }}>
        <button type="button" aria-label="Notificações" onClick={() => setBellOpen((v) => !v)} style={iconBtn}>
          <Bell size={15} strokeWidth={1.6} aria-hidden="true" />
        </button>
        {bellOpen && (
          <div style={{ ...popPos, background: "var(--ed2-card)", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", border: "1px solid var(--ed2-hair)", width: 280, overflow: "hidden", color: "var(--ed2-ink)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--ed2-hair)", fontSize: 14, fontWeight: 600 }}>Notificações</div>
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ed2-ink-2)", fontSize: 13 }}>
              <Bell size={28} strokeWidth={1.4} style={{ margin: "0 auto 8px", display: "block", color: "var(--ed2-ink-3)" }} aria-hidden />
              Tudo em dia, sem notificações
            </div>
          </div>
        )}
      </div>

      <div ref={profileRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          aria-label="Perfil"
          style={{
            width: 32, height: 32, borderRadius: 99,
            background: onDark ? "linear-gradient(135deg,#C9A961,#a8893d)" : "linear-gradient(135deg,#0B1838,#1d2d56)",
            color: onDark ? "#0B1838" : "#fff", fontWeight: 700, fontSize: 11.5,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer",
          }}
        >
          {initials}
        </button>
        {profileOpen && (
          <div style={{ ...popPos, background: "var(--ed2-card)", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", border: "1px solid var(--ed2-hair)", width: 240, overflow: "hidden", color: "var(--ed2-ink)" }}>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 99, background: "linear-gradient(135deg,#0B1838,#1d2d56)", color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.nome || "Admin"}</div>
                <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email || "sem email"}</div>
              </div>
            </div>
            <button type="button" onClick={() => { setProfileOpen(false); setProfileModalOpen(true); }}
              style={menuItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ed2-surface-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="5" r="2.5" /><path d="M3 13a5 5 0 0 1 10 0" /></svg>
              Editar perfil
            </button>
            <button type="button" onClick={() => { setProfileOpen(false); setProfileModalOpen(true); }}
              style={menuItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ed2-surface-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>
              Alterar senha
            </button>
            <div style={{ height: 1, background: "var(--ed2-hair)" }} />
            <button type="button" onClick={onLogout}
              style={{ ...menuItemStyle, color: "#c8261c" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,59,48,0.06)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <LogOut size={15} aria-hidden="true" />
              Sair
            </button>
          </div>
        )}
      </div>

      {profileModalOpen && (
        <ProfileModal profile={profile} onClose={() => setProfileModalOpen(false)} onSaved={(p) => { setProfile(p); setProfileModalOpen(false); }} />
      )}
    </div>
  );
}
