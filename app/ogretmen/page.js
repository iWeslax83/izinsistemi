"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { generatePermissionPdf } from "@/lib/pdf";

export default function TeacherPanelPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [gun, setGun] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchItems = async (pwd) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/permissions", {
        headers: { "x-teacher-password": pwd },
      });
      if (res.status === 401) {
        setAuthed(false);
        setError("Şifre hatalı.");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Liste alınamadı");
      setItems(data.items || []);
      setGun(data.gun);
      setSelected(new Set((data.items || []).map((i) => i._id)));
      setAuthed(true);
      try {
        sessionStorage.setItem("teacher-pwd", pwd);
      } catch {}
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("teacher-pwd");
      if (saved) {
        setPassword(saved);
        fetchItems(saved);
      }
    } catch {}
  }, []);

  const onLogin = (e) => {
    e.preventDefault();
    fetchItems(password);
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
        headers: {
          "Content-Type": "application/json",
          "x-teacher-password": password,
        },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onay hatası");

      await fetchItems(password);
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/icon-192.png"
              alt="atölye"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-[11px] text-ink-muted tracking-wider uppercase">
              Öğretmen
            </span>
          </Link>
          <Link href="/ogretmen/log" className="btn-ghost">Log</Link>
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem("teacher-pwd");
              } catch {}
              setAuthed(false);
              setPassword("");
            }}
            className="btn-ghost"
          >
            Çıkış
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-10 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-6 mb-8">
          <div>
            <p className="eyebrow mb-3">Bekleyen Talepler</p>
            <h1 className="display text-4xl font-semibold tracking-tight">
              Günün talepleri
            </h1>
            <p className="text-sm text-ink-muted mt-2">
              <span className="mark-number">{gun}</span> · {items.length} talep ·{" "}
              {selected.size} seçili
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => fetchItems(password)}
              disabled={loading}
            >
              Yenile
            </button>
            <button
              className="btn-accent"
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
          )}
        </div>
      </div>
    </main>
  );
}
