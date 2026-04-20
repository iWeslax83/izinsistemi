"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { countQueue, enqueuePermission, requestSync } from "@/lib/offlineQueue";

const SINIFLAR = [9, 10, 11, 12];
const SUBELER = ["A", "B", "C", "D", "E", "F", "G"];
const DERSLER = [1, 2, 3, 4, 5, 6, 7, 8];

export default function StudentFormPage() {
  const [form, setForm] = useState({
    adSoyad: "",
    okulNo: "",
    sinif: "",
    sube: "",
    baslangicDersi: "",
    bitisDersi: "",
    neden: "",
  });
  const [status, setStatus] = useState({ state: "idle", msg: "" });
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchList = async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/permissions/public", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setList(data.items || []);
      }
    } catch {}
    setListLoading(false);
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setMounted(true);
    setOnline(navigator.onLine);
    const refreshCount = async () => setPendingCount(await countQueue());
    refreshCount();

    const onOnline = () => {
      setOnline(true);
      requestSync();
    };
    const onOffline = () => setOnline(false);
    const onSwMessage = (e) => {
      if (e.data && e.data.type === "queue-flushed") {
        refreshCount();
        fetchList();
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, []);

  const fetchSuggestions = (query) => {
    clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/permissions/students?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.students || []);
          setShowSuggestions((data.students || []).length > 0);
          setActiveSuggestion(-1);
        }
      } catch {}
    }, 250);
  };

  const selectSuggestion = (student) => {
    setForm((f) => ({
      ...f,
      adSoyad: student.adSoyad,
      okulNo: student.okulNo,
      sinif: String(student.sinif),
      sube: student.sube,
    }));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const onAdSoyadKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (name === "adSoyad") {
      fetchSuggestions(value);
    }
  };

  const resetForm = () =>
    setForm({
      adSoyad: "",
      okulNo: "",
      sinif: "",
      sube: "",
      baslangicDersi: "",
      bitisDersi: "",
      neden: "",
    });

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ state: "loading", msg: "" });

    if (!navigator.onLine) {
      try {
        await enqueuePermission(form);
        await requestSync();
        setPendingCount(await countQueue());
        setStatus({
          state: "success",
          msg: "Çevrimdışısınız. Talebiniz bağlantı kurulunca otomatik gönderilecek.",
        });
        resetForm();
      } catch (err) {
        setStatus({ state: "error", msg: "Talep kaydedilemedi." });
      }
      return;
    }

    try {
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata oluştu");
      setStatus({
        state: "success",
        msg: "Talebiniz alındı. İyi çalışmalar!",
      });
      resetForm();
      fetchList();
    } catch (err) {
      setStatus({ state: "error", msg: err.message });
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
              İzin Sistemi
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/gecmis" className="text-ink-muted hover:text-ink transition">
              Geçmişim
            </Link>
            <Link href="/takvim" className="text-ink-muted hover:text-ink transition">
              Takvim
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-10 max-w-2xl">
          <p className="eyebrow mb-3">TOFAŞ Fen Lisesi · İnovasyon Atölyesi</p>
          <h1 className="display text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-tight">
            Atölyede olduğunu,
            <br />
            <span className="italic text-accent">yoklamaya söyle.</span>
          </h1>
          <p className="mt-4 text-[15px] text-ink-muted leading-relaxed max-w-lg">
            Yoklamada yok yazılmaman için talebini aşağıdan ilet. Öğretmen
            onayladıktan sonra idareye iletilir.
          </p>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="card p-6 sm:p-7">
              <form onSubmit={onSubmit} className="space-y-4">
                {mounted && !online && (
                  <div className="rounded-lg bg-warn-soft border border-warn/20 px-3 py-2.5 text-[13px] text-warn-ink">
                    Çevrimdışısın. Talep sıraya alınır, bağlantı gelince gönderilir.
                  </div>
                )}
                {mounted && pendingCount > 0 && (
                  <div className="rounded-lg bg-accent-soft border border-accent/20 px-3 py-2.5 text-[13px] text-warn-ink">
                    {pendingCount} talep gönderilmek üzere sırada.
                  </div>
                )}

                <div className="relative" ref={suggestionsRef}>
                  <label className="field-label">Ad Soyad</label>
                  <input
                    className="field-input"
                    name="adSoyad"
                    value={form.adSoyad}
                    onChange={onChange}
                    onKeyDown={onAdSoyadKeyDown}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Ahmet Yılmaz"
                    autoComplete="off"
                    required
                  />
                  {showSuggestions && (
                    <ul className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface shadow-pop py-1">
                      {suggestions.map((s, idx) => (
                        <li
                          key={`${s.adSoyad}-${s.okulNo}`}
                          className={`flex items-center justify-between gap-2 px-3 py-2 mx-1 cursor-pointer text-sm transition-colors rounded-lg ${
                            idx === activeSuggestion
                              ? "bg-accent-soft"
                              : "hover:bg-bg"
                          }`}
                          onMouseDown={() => selectSuggestion(s)}
                          onMouseEnter={() => setActiveSuggestion(idx)}
                        >
                          <span className="font-medium truncate">{s.adSoyad}</span>
                          <span className="text-[11px] text-ink-muted whitespace-nowrap">
                            {s.sinif}-{s.sube} · {s.okulNo}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="field-label">Okul No</label>
                  <input
                    className="field-input"
                    name="okulNo"
                    value={form.okulNo}
                    onChange={onChange}
                    placeholder="1234"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Sınıf</label>
                    <select
                      className="field-input"
                      name="sinif"
                      value={form.sinif}
                      onChange={onChange}
                      required
                    >
                      <option value="">—</option>
                      {SINIFLAR.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Şube</label>
                    <select
                      className="field-input"
                      name="sube"
                      value={form.sube}
                      onChange={onChange}
                      required
                    >
                      <option value="">—</option>
                      {SUBELER.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Başlangıç</label>
                    <select
                      className="field-input"
                      name="baslangicDersi"
                      value={form.baslangicDersi}
                      onChange={onChange}
                      required
                    >
                      <option value="">—</option>
                      {DERSLER.map((d) => (
                        <option key={d} value={d}>
                          {d}. ders
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Bitiş</label>
                    <select
                      className="field-input"
                      name="bitisDersi"
                      value={form.bitisDersi}
                      onChange={onChange}
                      required
                    >
                      <option value="">—</option>
                      {DERSLER.map((d) => (
                        <option key={d} value={d}>
                          {d}. ders
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="field-label flex items-center justify-between">
                    <span>Neden</span>
                    <span className="text-[11px] text-ink-soft font-normal mark-number">
                      {form.neden.length}/200
                    </span>
                  </label>
                  <textarea
                    className="field-input resize-none"
                    name="neden"
                    value={form.neden}
                    onChange={onChange}
                    placeholder="İzin nedenini kısaca açıkla"
                    rows={3}
                    maxLength={200}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full mt-2"
                  disabled={status.state === "loading"}
                >
                  {status.state === "loading" ? "Gönderiliyor…" : "Talebi gönder"}
                </button>

                {status.state === "success" && (
                  <div className="rounded-lg bg-ok-soft border border-ok/20 px-3 py-2.5 text-[13px] text-ok-ink">
                    {status.msg}
                  </div>
                )}
                {status.state === "error" && (
                  <div className="rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
                    {status.msg}
                  </div>
                )}
              </form>
            </div>
          </div>

          <section className="lg:col-span-7">
            <div className="flex items-baseline justify-between mb-5 pb-3 border-b border-line">
              <div className="flex items-baseline gap-3">
                <h2 className="display text-2xl font-semibold">Bugün</h2>
                <span className="text-ink-muted text-sm">
                  {list.length} talep
                </span>
              </div>
              <button
                type="button"
                onClick={fetchList}
                className="btn-ghost"
                disabled={listLoading}
              >
                {listLoading ? "…" : "Yenile"}
              </button>
            </div>

            {listLoading && list.length === 0 ? (
              <p className="text-sm text-ink-muted py-12 text-center">
                Yükleniyor…
              </p>
            ) : list.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-ink-muted">
                  Henüz kimse atölyede değil.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((i, idx) => (
                  <li
                    key={i._id}
                    className="flex items-center gap-4 py-3 group"
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
                        <p className="text-xs text-ink-soft mt-1 italic truncate">
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
          </section>
        </div>
      </div>

      <footer className="border-t border-line mt-10">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
          <span>TOFAŞ Fen Lisesi İnovasyon Atölyesi</span>
          <span className="mark-number">© 2026</span>
        </div>
      </footer>
    </main>
  );
}
