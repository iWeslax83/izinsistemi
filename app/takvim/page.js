"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTurkishDate, todayKey } from "@/lib/date";

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const GUN_KISALTMALARI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function dayKey(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function buildGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dayCounts, setDayCounts] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayItems, setDayItems] = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);

  const year = current.getFullYear();
  const month = current.getMonth();
  const today = todayKey();

  useEffect(() => {
    let cancelled = false;
    const fetchMonth = async () => {
      setLoadingMonth(true);
      try {
        const res = await fetch(`/api/permissions/calendar?ay=${monthKey(current)}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const map = {};
          (data.days || []).forEach((d) => {
            map[d.gun] = { count: d.count, approved: d.approved };
          });
          setDayCounts(map);
        }
      } catch {}
      if (!cancelled) setLoadingMonth(false);
    };
    fetchMonth();
    return () => {
      cancelled = true;
    };
  }, [current]);

  useEffect(() => {
    if (!selectedDay) {
      setDayItems([]);
      return;
    }
    let cancelled = false;
    const fetchDay = async () => {
      setLoadingDay(true);
      try {
        const res = await fetch(`/api/permissions/public?gun=${selectedDay}`, {
          cache: "no-store",
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setDayItems(data.items || []);
        }
      } catch {}
      if (!cancelled) setLoadingDay(false);
    };
    fetchDay();
    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  const prevMonth = () => {
    setCurrent(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrent(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const grid = buildGrid(year, month);
  const totalThisMonth = Object.values(dayCounts).reduce(
    (sum, v) => sum + v.count,
    0
  );

  return (
    <main className="min-h-screen">
      <nav className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="display text-[22px] font-bold leading-none">
              atölye<span className="text-accent">.</span>
            </span>
            <span className="text-[11px] text-ink-muted tracking-wider uppercase">
              Takvim
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-ink-muted hover:text-ink transition">
              Yeni Talep
            </Link>
            <Link href="/gecmis" className="text-ink-muted hover:text-ink transition">
              Geçmişim
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-8">
          <p className="eyebrow mb-3">Takvim</p>
          <h1 className="display text-4xl font-semibold tracking-tight">
            Aylık görünüm
          </h1>
          <p className="text-sm text-ink-muted mt-2">
            Bir güne tıkla, o günün talep listesini gör.
          </p>
        </header>

        <div className="card p-5 sm:p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="display text-2xl font-semibold">
                {AY_ADLARI[month]}{" "}
                <span className="mark-number text-ink-muted font-normal">
                  {year}
                </span>
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                {totalThisMonth} talep bu ay
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={prevMonth}
                className="btn-secondary !px-3"
                aria-label="Önceki ay"
              >
                ←
              </button>
              <button
                onClick={nextMonth}
                className="btn-secondary !px-3"
                aria-label="Sonraki ay"
              >
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {GUN_KISALTMALARI.map((g) => (
              <div
                key={g}
                className="text-center text-[11px] font-medium uppercase tracking-wider text-ink-soft py-2"
              >
                {g}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((day, idx) => {
              if (!day) {
                return <div key={idx} className="aspect-square" />;
              }
              const key = dayKey(year, month, day);
              const data = dayCounts[key];
              const isToday = key === today;
              const isSelected = key === selectedDay;
              const hasItems = data && data.count > 0;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  className={`aspect-square rounded-xl border text-left p-2 transition relative ${
                    isSelected
                      ? "border-accent bg-accent-soft"
                      : isToday
                      ? "border-ink bg-surface"
                      : "border-line hover:border-ink-soft hover:bg-paper"
                  }`}
                >
                  <div
                    className={`mark-number text-sm ${
                      isToday ? "font-bold" : ""
                    }`}
                  >
                    {day}
                  </div>
                  {hasItems && (
                    <div className="absolute bottom-1.5 right-1.5 mark-number text-[10px] font-semibold text-accent">
                      {data.count}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {loadingMonth && (
            <p className="text-xs text-ink-muted text-center mt-3">
              Yükleniyor…
            </p>
          )}
        </div>

        {selectedDay && (
          <div className="mt-6 card overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-paper">
              <div>
                <p className="eyebrow mb-1">Gün</p>
                <h3 className="display text-xl font-semibold">
                  {formatTurkishDate(selectedDay)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="btn-ghost"
              >
                kapat
              </button>
            </div>

            {loadingDay ? (
              <p className="p-12 text-center text-ink-muted text-sm">
                Yükleniyor…
              </p>
            ) : dayItems.length === 0 ? (
              <p className="p-12 text-center text-ink-muted text-sm">
                Bu gün talep yok.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {dayItems.map((i, idx) => (
                  <li
                    key={i._id}
                    className="flex items-center gap-4 px-6 py-3"
                  >
                    <span className="mark-number text-xs text-ink-soft w-6 tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{i.adSoyad}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {i.sinif}-{i.sube} · {i.baslangicDersi}. - {i.bitisDersi}. ders
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
          </div>
        )}
      </div>
    </main>
  );
}
