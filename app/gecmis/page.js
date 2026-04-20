"use client";

import { useState } from "react";
import Link from "next/link";
import { formatTurkishDate } from "@/lib/date";

export default function HistoryPage() {
  const [okulNo, setOkulNo] = useState("");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setItems(null);
    try {
      const res = await fetch(
        `/api/permissions/history?okulNo=${encodeURIComponent(okulNo.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata oluştu");
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <nav className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="display text-[22px] font-bold leading-none">
              atölye<span className="text-accent">.</span>
            </span>
            <span className="text-[11px] text-ink-muted tracking-wider uppercase">
              Geçmiş
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-ink-muted hover:text-ink transition">
              Yeni Talep
            </Link>
            <Link href="/takvim" className="text-ink-muted hover:text-ink transition">
              Takvim
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-8">
          <p className="eyebrow mb-3">Geçmişim</p>
          <h1 className="display text-4xl font-semibold tracking-tight">
            Geçmiş talepler
          </h1>
          <p className="text-sm text-ink-muted mt-2 max-w-md">
            Okul numaranı gir, son 50 talebini tarihe göre listele.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="card p-5 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end"
        >
          <div className="flex-1">
            <label className="field-label">Okul No</label>
            <input
              className="field-input"
              value={okulNo}
              onChange={(e) => setOkulNo(e.target.value)}
              placeholder="1234"
              required
            />
          </div>
          <button type="submit" className="btn-primary sm:w-auto" disabled={loading}>
            {loading ? "Aranıyor…" : "Sorgula"}
          </button>
        </form>

        {error && (
          <div className="mb-5 rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
            {error}
          </div>
        )}

        {items !== null && (
          <>
            {items.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-ink-muted">
                  Bu okul numarasıyla kayıt bulunamadı.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((i, idx) => (
                  <li key={i._id} className="flex items-center gap-4 py-3">
                    <span className="mark-number text-xs text-ink-soft w-8 tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{i.adSoyad}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        <span className="mark-number">
                          {formatTurkishDate(i.gun)}
                        </span>
                        <span className="mx-1.5 text-ink-soft">·</span>
                        {i.sinif}-{i.sube}
                        <span className="mx-1.5 text-ink-soft">·</span>
                        {i.baslangicDersi}. - {i.bitisDersi}. ders
                      </p>
                      {i.neden && (
                        <p className="text-xs text-ink-soft mt-1 italic">
                          “{i.neden}”
                        </p>
                      )}
                    </div>
                    {i.status === "approved" ? (
                      <span className="badge-ok">onaylandı</span>
                    ) : (
                      <span className="badge-warn">beklemede</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
