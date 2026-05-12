"use client";

import { useState } from "react";
import Link from "next/link";
import { formatTurkishDate, todayKey } from "@/lib/date";
import { Mark, Calendar, Clock } from "@/components/Icons";

export default function HistoryPage() {
  const [okulNo, setOkulNo] = useState("");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(null);

  const fetchItems = async (no) => {
    const res = await fetch(
      `/api/permissions/history?okulNo=${encodeURIComponent(no)}`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Hata oluştu");
    return data.items || [];
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setItems(null);
    try {
      const next = await fetchItems(okulNo.trim());
      setItems(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onCancel = async (id) => {
    if (!okulNo.trim()) return;
    if (typeof window !== "undefined" && !window.confirm("Talebini iptal etmek istediğine emin misin?")) {
      return;
    }
    setCancelling(id);
    setError("");
    try {
      const res = await fetch("/api/permissions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id, okulNo: okulNo.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İptal edilemedi.");
      const next = await fetchItems(okulNo.trim());
      setItems(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  const today = todayKey();

  return (
    <main className="min-h-screen">
      <nav className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <Mark size={20} className="text-accent" />
            <span className="text-[11px] text-ink-muted tracking-wider uppercase">
              Geçmiş
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-ink-muted hover:text-ink transition">
              Yeni Talep
            </Link>
            <Link href="/takvim" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink transition">
              <Calendar size={15} />
              <span>Takvim</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-10 pb-16">
        <header className="mb-6 sm:mb-8">
          <p className="eyebrow mb-3">Geçmişim</p>
          <h1 className="display text-3xl sm:text-4xl font-semibold tracking-tight inline-flex items-center gap-3">
            <Clock size={28} className="text-accent shrink-0" />
            <span>Geçmiş talepler</span>
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
                {items.map((i, idx) => {
                  const cancellable =
                    i.status === "beklemede" && i.gun === today;
                  return (
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
                      <div className="flex items-center gap-2 shrink-0">
                        {i.status === "approved" ? (
                          <span className="badge-ok">onaylandı</span>
                        ) : (
                          <span className="badge-warn">beklemede</span>
                        )}
                        {cancellable && (
                          <button
                            type="button"
                            onClick={() => onCancel(i._id)}
                            disabled={cancelling === i._id}
                            className="btn-ghost text-xs text-danger-ink hover:bg-danger-soft disabled:opacity-50"
                          >
                            {cancelling === i._id ? "…" : "Sil"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
