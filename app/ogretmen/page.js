"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { generatePermissionPdf } from "@/lib/pdf";

const REFRESH_INTERVAL_MS = 30_000;

export default function TeacherPanelPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [gun, setGun] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const prevIdsRef = useRef(new Set());
  const authedRef = useRef(false);

  useEffect(() => {
    authedRef.current = authed;
  }, [authed]);

  const fetchItems = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const res = await fetch("/api/permissions", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Liste alınamadı");
      const newItems = data.items || [];
      const prevIds = prevIdsRef.current;
      prevIdsRef.current = new Set(newItems.map((i) => i._id));
      setItems(newItems);
      setGun(data.gun);
      if (silent) {
        setSelected((prev) => {
          const next = new Set();
          for (const item of newItems) {
            if (prevIds.has(item._id)) {
              if (prev.has(item._id)) next.add(item._id);
            } else {
              next.add(item._id);
            }
          }
          return next;
        });
      } else {
        setSelected(new Set(newItems.map((i) => i._id)));
      }
      setAuthed(true);
    } catch (e) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const tick = () => {
      if (
        authedRef.current &&
        document.visibilityState === "visible" &&
        navigator.onLine
      ) {
        fetchItems({ silent: true });
      }
    };
    const interval = setInterval(tick, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const onLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password, role: "teacher" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Giriş yapılamadı.");
        return;
      }
      setPassword("");
      await fetchItems();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    setAuthed(false);
    setItems([]);
    setSelected(new Set());
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i._id)));
  };

  const onApprove = async () => {
    if (selected.size === 0) return;
    setProcessing(true);
    setError("");
    try {
      const ids = Array.from(selected);
      const chosen = items.filter((i) => selected.has(i._id));

      await generatePermissionPdf({ students: chosen, gun });

      const res = await fetch("/api/permissions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setAuthed(false);
        throw new Error(data.error || "Onay hatası");
      }

      await fetchItems();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-ink-muted hover:text-ink mb-6"
          >
            ← ana sayfa
          </Link>
          <form onSubmit={onLogin} className="card p-7 space-y-4">
            <div>
              <p className="eyebrow mb-2">Öğretmen</p>
              <h1 className="display text-2xl font-semibold">
                Panele giriş
              </h1>
            </div>
            <div>
              <label className="field-label">Şifre</label>
              <input
                type="password"
                className="field-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Doğrulanıyor…" : "Giriş"}
            </button>
            {error && (
              <div className="rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
                {error}
              </div>
            )}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <nav className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-[11px] text-ink-muted tracking-wider uppercase">
              Öğretmen
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/ogretmen/log" className="btn-ghost">Log</Link>
            <button onClick={onLogout} className="btn-ghost">
              Çıkış
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-6 sm:pt-10 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <p className="eyebrow mb-3">Bekleyen Talepler</p>
            <h1 className="display text-3xl sm:text-4xl font-semibold tracking-tight">
              Günün talepleri
            </h1>
            <p className="text-sm text-ink-muted mt-2">
              <span className="mark-number">{gun}</span> · {items.length} talep ·{" "}
              {selected.size} seçili
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              className="btn-secondary flex-1 sm:flex-none"
              onClick={() => fetchItems(password)}
              disabled={loading}
            >
              Yenile
            </button>
            <button
              className="btn-accent flex-1 sm:flex-none"
              onClick={onApprove}
              disabled={processing || selected.size === 0}
            >
              {processing
                ? "İşleniyor…"
                : `Onayla & PDF (${selected.size})`}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
            {error}
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <p className="p-12 text-center text-ink-muted text-sm">Yükleniyor…</p>
          ) : items.length === 0 ? (
            <p className="p-12 text-center text-ink-muted text-sm">
              Bugün için bekleyen talep yok.
            </p>
          ) : (
            <>
              <div className="sm:hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-paper text-[11px] uppercase tracking-wider text-ink-muted">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length}
                    onChange={toggleAll}
                    className="accent-accent w-5 h-5"
                  />
                  <span>Tümünü seç</span>
                </div>
                <ul>
                  {items.map((i) => (
                    <li
                      key={i._id}
                      className="border-b border-line/60 last:border-0 px-4 py-3 flex items-start gap-3 active:bg-paper"
                      onClick={() => toggle(i._id)}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(i._id)}
                        onChange={() => toggle(i._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-accent w-5 h-5 mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-medium truncate">{i.adSoyad}</p>
                          <span className="text-[11px] text-ink-soft mark-number whitespace-nowrap">
                            {new Date(i.createdAt).toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted mt-0.5">
                          <span className="mark-number">{i.okulNo}</span>
                          <span className="mx-1.5 text-ink-soft">·</span>
                          {i.sinif}-{i.sube}
                          <span className="mx-1.5 text-ink-soft">·</span>
                          {i.baslangicDersi}. - {i.bitisDersi}. ders
                        </p>
                        {i.neden && (
                          <p className="text-xs text-ink-soft mt-1 italic break-words">
                            “{i.neden}”
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-ink-muted uppercase tracking-wider border-b border-line bg-paper">
                      <th className="p-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selected.size === items.length}
                          onChange={toggleAll}
                          className="accent-accent w-4 h-4"
                        />
                      </th>
                      <th className="p-3 text-left font-medium">Ad Soyad</th>
                      <th className="p-3 text-left font-medium">Okul No</th>
                      <th className="p-3 text-left font-medium">Sınıf</th>
                      <th className="p-3 text-left font-medium">Dersler</th>
                      <th className="p-3 text-left font-medium">Neden</th>
                      <th className="p-3 text-left font-medium">Saat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr
                        key={i._id}
                        className="border-b border-line/60 last:border-0 hover:bg-paper"
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(i._id)}
                            onChange={() => toggle(i._id)}
                            className="accent-accent w-4 h-4"
                          />
                        </td>
                        <td className="p-3 font-medium">{i.adSoyad}</td>
                        <td className="p-3 text-ink-muted mark-number">{i.okulNo}</td>
                        <td className="p-3 text-ink-muted">
                          {i.sinif}-{i.sube}
                        </td>
                        <td className="p-3 text-ink-muted">
                          {i.baslangicDersi}. - {i.bitisDersi}.
                        </td>
                        <td
                          className="p-3 text-ink-muted max-w-[20rem] truncate"
                          title={i.neden}
                        >
                          {i.neden}
                        </td>
                        <td className="p-3 text-ink-muted mark-number">
                          {new Date(i.createdAt).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
