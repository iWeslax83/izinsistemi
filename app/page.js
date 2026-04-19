"use client";

import { useEffect, useRef, useState } from "react";

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
  });
  const [status, setStatus] = useState({ state: "idle", msg: "" });
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ state: "loading", msg: "" });
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
      setForm({
        adSoyad: "",
        okulNo: "",
        sinif: "",
        sube: "",
        baslangicDersi: "",
        bitisDersi: "",
      });
      fetchList();
    } catch (err) {
      setStatus({ state: "error", msg: err.message });
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-6">
        <div className="card lg:col-span-2 p-8 h-fit">
        <header className="mb-8 border-b border-charcoal-600 pb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-amber">
            TOFAŞ FEN LİSESİ
          </p>
          <h1 className="text-2xl mt-1 font-bold text-gray-100">
            İnovasyon Atölyesi İzin Formu
          </h1>
          <p className="text-sm text-charcoal-400 mt-2">
            Yoklamada yok yazılmaması için talebinizi iletin.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="relative" ref={suggestionsRef}>
            <label className="field-label">Ad Soyad</label>
            <input
              className="field-input"
              name="adSoyad"
              value={form.adSoyad}
              onChange={onChange}
              onKeyDown={onAdSoyadKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Ör: Ahmet Yılmaz"
              autoComplete="off"
              required
            />
            {showSuggestions && (
              <ul className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-charcoal-600 bg-charcoal-800 shadow-lg">
                {suggestions.map((s, idx) => (
                  <li
                    key={`${s.adSoyad}-${s.okulNo}`}
                    className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer text-sm transition-colors ${
                      idx === activeSuggestion
                        ? "bg-amber/20 text-amber"
                        : "text-gray-200 hover:bg-charcoal-700"
                    }`}
                    onMouseDown={() => selectSuggestion(s)}
                    onMouseEnter={() => setActiveSuggestion(idx)}
                  >
                    <span className="font-medium truncate">{s.adSoyad}</span>
                    <span className="text-xs text-charcoal-400 whitespace-nowrap">
                      {s.sinif}-{s.sube} | No: {s.okulNo}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Sınıf</label>
              <select
                className="field-input"
                name="sinif"
                value={form.sinif}
                onChange={onChange}
                required
              >
                <option value="">Seçiniz</option>
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
                <option value="">Seçiniz</option>
                {SUBELER.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Başlangıç Dersi</label>
              <select
                className="field-input"
                name="baslangicDersi"
                value={form.baslangicDersi}
                onChange={onChange}
                required
              >
                <option value="">Seçiniz</option>
                {DERSLER.map((d) => (
                  <option key={d} value={d}>
                    {d}. Ders
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Bitiş Dersi</label>
              <select
                className="field-input"
                name="bitisDersi"
                value={form.bitisDersi}
                onChange={onChange}
                required
              >
                <option value="">Seçiniz</option>
                {DERSLER.map((d) => (
                  <option key={d} value={d}>
                    {d}. Ders
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn-amber w-full"
            disabled={status.state === "loading"}
          >
            {status.state === "loading" ? "Gönderiliyor..." : "Talebi Gönder"}
          </button>

          {status.state === "success" && (
            <p className="text-sm text-green-400 text-center">{status.msg}</p>
          )}
          {status.state === "error" && (
            <p className="text-sm text-red-400 text-center">{status.msg}</p>
          )}
        </form>
        </div>

        <section className="card lg:col-span-3 p-6">
          <div className="flex items-center justify-between mb-4 border-b border-charcoal-600 pb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber">
                Bugünkü Talepler
              </p>
              <h2 className="text-lg font-bold mt-1">
                İnovasyon Atölyesi Listesi
              </h2>
            </div>
            <button
              type="button"
              onClick={fetchList}
              className="btn-ghost text-xs"
              disabled={listLoading}
            >
              {listLoading ? "Yükleniyor..." : "Yenile"}
            </button>
          </div>

          {listLoading && list.length === 0 ? (
            <p className="text-sm text-charcoal-400 py-8 text-center">
              Yükleniyor...
            </p>
          ) : list.length === 0 ? (
            <p className="text-sm text-charcoal-400 py-8 text-center">
              Bugün henüz talep yok.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-amber uppercase text-xs tracking-wider">
                  <tr className="border-b border-charcoal-600">
                    <th className="p-2 text-left">Ad Soyad</th>
                    <th className="p-2 text-left">Sınıf</th>
                    <th className="p-2 text-left">Dersler</th>
                    <th className="p-2 text-left">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => (
                    <tr
                      key={i._id}
                      className="border-b border-charcoal-700/50 hover:bg-charcoal-700/30"
                    >
                      <td className="p-2">{i.adSoyad}</td>
                      <td className="p-2">
                        {i.sinif}-{i.sube}
                      </td>
                      <td className="p-2 text-charcoal-400">
                        {i.baslangicDersi}. - {i.bitisDersi}.
                      </td>
                      <td className="p-2">
                        {i.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30">
                            Onaylandı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/30">
                            Beklemede
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
