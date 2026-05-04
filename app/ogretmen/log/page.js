"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ACTORS = ["", "ogrenci", "ogretmen", "sistem"];
const ACTIONS = [
  "", "submit", "cancel", "rate_blocked",
  "login_success", "login_fail", "login_locked", "approve",
  "archive_run", "archive_fail",
];

export default function AuditLogPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({ actor: "", action: "", actorRef: "", from: "", to: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPage(1, filters);
  }, []);

  const fetchPage = async (p, f) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (f.actor) qs.set("actor", f.actor);
      if (f.action) qs.set("action", f.action);
      if (f.actorRef) qs.set("actorRef", f.actorRef);
      if (f.from) qs.set("from", f.from);
      if (f.to) qs.set("to", f.to);
      qs.set("page", String(p));
      const res = await fetch(`/api/admin/audit?${qs.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      setItems(data.items || []);
      setTotal(data.total || 0);
      setHasMore(!!data.hasMore);
      setPage(p);
      setAuthed(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password, role: "admin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Giriş yapılamadı.");
        return;
      }
      setPassword("");
      await fetchPage(1, filters);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onFilter = (e) => {
    e.preventDefault();
    fetchPage(1, filters);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-p${page}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={onLogin} className="card p-7 space-y-4 w-full max-w-sm">
          <div>
            <p className="eyebrow mb-2">Yönetici · Log</p>
            <h1 className="display text-2xl font-semibold">Log paneli</h1>
          </div>
          <div>
            <label className="field-label">Yönetici Şifresi</label>
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Doğrulanıyor…" : "Giriş"}
          </button>
          {error && (
            <div className="rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
              {error}
            </div>
          )}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <nav className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/ogretmen" className="flex items-center gap-2.5">
            <span className="display text-[22px] font-bold leading-none">
              atölye<span className="text-accent">.</span>
            </span>
            <span className="text-[11px] text-ink-muted tracking-wider uppercase">
              Log
            </span>
          </Link>
          <Link href="/ogretmen" className="btn-ghost">← Panel</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 pt-8 pb-16">
        <header className="mb-6">
          <p className="eyebrow mb-2">Audit</p>
          <h1 className="display text-3xl font-semibold">Sistem kayıtları</h1>
          <p className="text-sm text-ink-muted mt-1">Toplam {total} kayıt · sayfa {page}</p>
        </header>

        <form onSubmit={onFilter} className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            className="field-input"
            value={filters.actor}
            onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
          >
            {ACTORS.map((a) => (
              <option key={a} value={a}>{a || "tüm aktörler"}</option>
            ))}
          </select>
          <select
            className="field-input"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a || "tüm aksiyonlar"}</option>
            ))}
          </select>
          <input
            className="field-input sm:col-span-2 lg:col-span-1"
            placeholder="okulNo"
            value={filters.actorRef}
            onChange={(e) => setFilters({ ...filters, actorRef: e.target.value })}
          />
          <input
            type="datetime-local"
            className="field-input"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            type="datetime-local"
            className="field-input"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
          <div className="sm:col-span-2 lg:col-span-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button type="button" onClick={exportJson} className="btn-secondary">
              JSON indir
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Yükleniyor…" : "Filtrele"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-5 rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
            {error}
          </div>
        )}

        <div className="card overflow-x-auto -mx-4 sm:mx-0 sm:rounded-2xl">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[11px] text-ink-muted uppercase tracking-wider border-b border-line bg-paper">
                <th className="p-3 text-left font-medium">Zaman</th>
                <th className="p-3 text-left font-medium">Aktör</th>
                <th className="p-3 text-left font-medium">Ref</th>
                <th className="p-3 text-left font-medium">Aksiyon</th>
                <th className="p-3 text-left font-medium">IP</th>
                <th className="p-3 text-left font-medium">Meta</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-ink-muted" colSpan={6}>
                    Kayıt yok.
                  </td>
                </tr>
              ) : items.map((i) => (
                <tr key={i._id} className="border-b border-line/60 last:border-0 align-top">
                  <td className="p-3 text-ink-muted mark-number whitespace-nowrap">
                    {new Date(i.at).toLocaleString("tr-TR")}
                  </td>
                  <td className="p-3">{i.actor}</td>
                  <td className="p-3 text-ink-muted mark-number">{i.actorRef || "—"}</td>
                  <td className="p-3 font-medium">{i.action}</td>
                  <td className="p-3 text-ink-muted mark-number">{i.ip || "—"}</td>
                  <td className="p-3 text-xs text-ink-soft max-w-md">
                    <code className="break-words">{JSON.stringify(i.meta || {})}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between mt-5">
          <button
            className="btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => fetchPage(page - 1, filters)}
          >
            ← Önceki
          </button>
          <button
            className="btn-secondary"
            disabled={!hasMore || loading}
            onClick={() => fetchPage(page + 1, filters)}
          >
            Sonraki →
          </button>
        </div>
      </div>
    </main>
  );
}
