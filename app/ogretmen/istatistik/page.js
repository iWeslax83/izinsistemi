"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTurkishDate } from "@/lib/date";

const RANGES = [
  { label: "7 gün", days: 7 },
  { label: "30 gün", days: 30 },
  { label: "90 gün", days: 90 },
  { label: "365 gün", days: 365 },
];

function Bar({ value, max, label, sub }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 sm:w-32 text-xs text-ink-muted truncate" title={label}>
        {label}
      </div>
      <div className="flex-1 h-5 bg-paper rounded overflow-hidden">
        <div
          className="h-full bg-accent/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-20 text-right text-xs text-ink mark-number">
        {value}
        {sub != null && (
          <span className="text-ink-soft text-[10px] ml-1">/{sub}</span>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [authed, setAuthed] = useState(true);
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (d) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/stats?days=${d}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Veri alınamadı");
      setData(j);
      setAuthed(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
  }, [days]);

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 max-w-sm text-center space-y-4">
          <p className="text-sm text-ink-muted">
            Bu sayfa için öğretmen panelinden giriş yapmalısınız.
          </p>
          <Link href="/ogretmen" className="btn-primary inline-flex">
            Panele git
          </Link>
        </div>
      </main>
    );
  }

  const maxDay = Math.max(1, ...(data?.byDay?.map((d) => d.total) || [1]));
  const maxClass = Math.max(1, ...(data?.byClass?.map((c) => c.total) || [1]));
  const maxHour = Math.max(1, ...(data?.byHour?.map((h) => h.total) || [1]));
  const maxLesson = Math.max(
    1,
    ...(data?.byLesson?.map((l) => l.total) || [1])
  );
  const maxReason = Math.max(
    1,
    ...(data?.topReasons?.map((r) => r.total) || [1])
  );

  return (
    <main className="min-h-screen">
      <nav className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/ogretmen" className="flex items-center gap-2.5">
            <span className="text-[11px] text-ink-muted tracking-wider uppercase">
              İstatistik
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/takvim" className="btn-ghost">Takvim</Link>
            <Link href="/ogretmen" className="btn-ghost">← Panel</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 pt-6 sm:pt-10 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="eyebrow mb-2">Analiz</p>
            <h1 className="display text-3xl sm:text-4xl font-semibold tracking-tight">
              İzin istatistikleri
            </h1>
            {data && (
              <p className="text-sm text-ink-muted mt-2">
                {formatTurkishDate(data.since)} — {formatTurkishDate(data.until)}{" "}
                · <span className="mark-number">{data.totals.records}</span>{" "}
                kayıt · <span className="mark-number">{data.totals.approved}</span>{" "}
                onaylı
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={
                  days === r.days
                    ? "btn-primary"
                    : "btn-ghost"
                }
                disabled={loading}
              >
                {r.label}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
            {error}
          </div>
        )}

        {loading && !data ? (
          <p className="card p-12 text-center text-ink-muted text-sm">
            Yükleniyor…
          </p>
        ) : !data || data.totals.records === 0 ? (
          <p className="card p-12 text-center text-ink-muted text-sm">
            Bu dönemde kayıt yok.
          </p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">
            <section className="card p-5">
              <h2 className="font-semibold mb-3">Günlük talep</h2>
              <div className="space-y-0.5">
                {data.byDay.slice(-30).map((d) => (
                  <Bar
                    key={d.gun}
                    label={formatTurkishDate(d.gun)}
                    value={d.total}
                    sub={d.approved}
                    max={maxDay}
                  />
                ))}
              </div>
              <p className="text-[11px] text-ink-soft mt-3">
                Sağdaki sayı: toplam / onaylı
              </p>
            </section>

            <section className="card p-5">
              <h2 className="font-semibold mb-3">En çok izin alan sınıflar</h2>
              <div className="space-y-0.5">
                {data.byClass.slice(0, 12).map((c) => (
                  <Bar
                    key={c.label}
                    label={c.label}
                    value={c.total}
                    sub={c.approved}
                    max={maxClass}
                  />
                ))}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="font-semibold mb-3">Saat dağılımı</h2>
              <div className="space-y-0.5">
                {data.byHour
                  .filter((h) => h.total > 0)
                  .map((h) => (
                    <Bar
                      key={h.hour}
                      label={`${String(h.hour).padStart(2, "0")}:00`}
                      value={h.total}
                      max={maxHour}
                    />
                  ))}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="font-semibold mb-3">Başlangıç dersi</h2>
              <div className="space-y-0.5">
                {data.byLesson.map((l) => (
                  <Bar
                    key={l.lesson}
                    label={`${l.lesson}. ders`}
                    value={l.total}
                    max={maxLesson}
                  />
                ))}
              </div>
            </section>

            <section className="card p-5 lg:col-span-2">
              <h2 className="font-semibold mb-3">
                Popüler nedenler (kelime sayımı)
              </h2>
              {data.topReasons.length === 0 ? (
                <p className="text-sm text-ink-muted">Yeterli veri yok.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.topReasons.map((r) => (
                    <Bar
                      key={r.word}
                      label={r.word}
                      value={r.total}
                      max={maxReason}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
