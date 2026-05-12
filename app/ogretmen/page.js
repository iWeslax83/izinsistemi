"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { generatePermissionPdf } from "@/lib/pdf";
import { formatTurkishDate } from "@/lib/date";
import { ArrowLeft, Chevron, Bell, Info } from "@/components/Icons";

const REFRESH_INTERVAL_MS = 30_000;
const PAST_DAYS = 30;

export default function TeacherPanelPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [gun, setGun] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [pastDays, setPastDays] = useState([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState("");
  const [pastSelected, setPastSelected] = useState({});
  const [pastExpanded, setPastExpanded] = useState({});
  const [pastBusy, setPastBusy] = useState({});
  const [pastItems, setPastItems] = useState({});
  const [pastItemsLoading, setPastItemsLoading] = useState({});
  const [pastQuery, setPastQuery] = useState("");
  const [pastBatchBusy, setPastBatchBusy] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [newArrived, setNewArrived] = useState(0);
  const [studentHistory, setStudentHistory] = useState(null);
  const prevIdsRef = useRef(new Set());
  const authedRef = useRef(false);
  const audioCtxRef = useRef(null);
  const dingTimerRef = useRef(null);

  useEffect(() => {
    authedRef.current = authed;
  }, [authed]);

  const playDing = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = audioCtxRef.current = new Ctx();
      }
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
    } catch {}
  };

  const flashNew = (count) => {
    setNewArrived(count);
    if (dingTimerRef.current) clearTimeout(dingTimerRef.current);
    dingTimerRef.current = setTimeout(() => setNewArrived(0), 4500);
  };

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
        const newOnes = newItems.filter((i) => !prevIds.has(i._id));
        if (newOnes.length > 0 && prevIds.size > 0) {
          playDing();
          flashNew(newOnes.length);
        }
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

  const fetchPast = async () => {
    setPastLoading(true);
    setPastError("");
    try {
      const res = await fetch(`/api/permissions/past?days=${PAST_DAYS}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Geçmiş alınamadı");
      setPastDays(data.days || []);
    } catch (e) {
      setPastError(e.message);
    } finally {
      setPastLoading(false);
    }
  };

  const fetchPastItems = async (gun) => {
    setPastItemsLoading((p) => ({ ...p, [gun]: true }));
    try {
      const res = await fetch(
        `/api/permissions/past?gun=${encodeURIComponent(gun)}`,
        { credentials: "same-origin", cache: "no-store" }
      );
      if (res.status === 401) {
        setAuthed(false);
        return [];
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gün alınamadı");
      const items = data.items || [];
      setPastItems((prev) => ({ ...prev, [gun]: items }));
      setPastSelected((prev) => ({
        ...prev,
        [gun]: new Set(items.map((i) => i._id)),
      }));
      return items;
    } catch (e) {
      setPastError(e.message);
      return [];
    } finally {
      setPastItemsLoading((p) => ({ ...p, [gun]: false }));
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchPast();
  }, [authed]);

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
    setPastDays([]);
    setPastSelected({});
    setPastExpanded({});
    setPastBusy({});
    setPastError("");
    setPastItems({});
    setPastItemsLoading({});
    setPastQuery("");
    setPastBatchBusy(false);
    if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    setPdfPreview(null);
    setStudentHistory(null);
    setNewArrived(0);
  };

  const togglePastItem = (gun, id) => {
    setPastSelected((prev) => {
      const cur = new Set(prev[gun] || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...prev, [gun]: cur };
    });
  };

  const togglePastAll = (gun, allIds) => {
    setPastSelected((prev) => {
      const cur = prev[gun] || new Set();
      const next =
        cur.size === allIds.length ? new Set() : new Set(allIds);
      return { ...prev, [gun]: next };
    });
  };

  const togglePastExpanded = (gun) => {
    setPastExpanded((prev) => {
      const next = { ...prev, [gun]: !prev[gun] };
      return next;
    });
    if (!pastItems[gun] && !pastItemsLoading[gun]) {
      fetchPastItems(gun);
    }
  };

  const onPastProcess = async (gun) => {
    const dayItems = pastItems[gun] || [];
    const sel = pastSelected[gun] || new Set();
    const chosen = dayItems.filter((i) => sel.has(i._id));
    if (chosen.length === 0) return;
    const pendingIds = chosen
      .filter((i) => i.status === "beklemede")
      .map((i) => i._id);

    setPastBusy((p) => ({ ...p, [gun]: true }));
    setPastError("");
    try {
      const { blob, filename } = await generatePermissionPdf({
        students: chosen,
        gun,
        output: "blob",
      });
      const url = URL.createObjectURL(blob);
      setPdfPreview({
        url,
        blob,
        filename,
        gun,
        pendingApproveIds: pendingIds,
        scope: "past",
      });
    } catch (e) {
      setPastError(e.message);
    } finally {
      setPastBusy((p) => ({ ...p, [gun]: false }));
    }
  };

  const openStudentHistory = async (student) => {
    setStudentHistory({
      student,
      items: [],
      cluster: null,
      loading: true,
      error: "",
    });
    try {
      const [histRes, clusterRes] = await Promise.all([
        fetch(
          `/api/permissions/history?okulNo=${encodeURIComponent(student.okulNo)}`,
          { credentials: "same-origin", cache: "no-store" }
        ),
        fetch(`/api/permissions/cluster?id=${encodeURIComponent(student._id)}`, {
          credentials: "same-origin",
          cache: "no-store",
        }),
      ]);
      const histData = await histRes.json().catch(() => ({}));
      if (!histRes.ok) throw new Error(histData.error || "Geçmiş alınamadı");
      const clusterData = clusterRes.ok ? await clusterRes.json() : null;
      setStudentHistory((prev) =>
        prev
          ? {
              ...prev,
              items: histData.items || [],
              cluster: clusterData,
              loading: false,
            }
          : prev
      );
    } catch (e) {
      setStudentHistory((prev) =>
        prev ? { ...prev, error: e.message, loading: false } : prev
      );
    }
  };

  const closeStudentHistory = () => setStudentHistory(null);

  const onApproveAllPastPending = async () => {
    const daysWithPending = pastDays.filter((d) => d.pending > 0);
    if (daysWithPending.length === 0) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Geçmiş ${daysWithPending.length} günde toplam bekleyenler onaylansın mı?`
      )
    ) {
      return;
    }
    setPastBatchBusy(true);
    setPastError("");
    try {
      const itemsByGun = {};
      for (const d of daysWithPending) {
        const cached = pastItems[d.gun];
        itemsByGun[d.gun] = cached || (await fetchPastItems(d.gun));
      }
      const pendingIds = [];
      for (const g of daysWithPending) {
        for (const it of itemsByGun[g.gun] || []) {
          if (it.status === "beklemede") pendingIds.push(it._id);
        }
      }
      if (pendingIds.length === 0) return;
      const res = await fetch("/api/permissions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ids: pendingIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setAuthed(false);
        throw new Error(data.error || "Onay hatası");
      }
      await fetchPast();
      for (const g of daysWithPending) {
        if (pastExpanded[g.gun]) await fetchPastItems(g.gun);
      }
    } catch (e) {
      setPastError(e.message);
    } finally {
      setPastBatchBusy(false);
    }
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
      const { blob, filename } = await generatePermissionPdf({
        students: chosen,
        gun,
        output: "blob",
      });
      const url = URL.createObjectURL(blob);
      setPdfPreview({
        url,
        blob,
        filename,
        gun,
        pendingApproveIds: ids,
        scope: "today",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const closePdfPreview = () => {
    setPdfPreview((p) => {
      if (p?.url) URL.revokeObjectURL(p.url);
      return null;
    });
  };

  const confirmPdfPreview = async () => {
    if (!pdfPreview) return;
    const { blob, filename, pendingApproveIds, scope, gun: pgun } = pdfPreview;
    try {
      const a = document.createElement("a");
      const dlUrl = URL.createObjectURL(blob);
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);

      if (pendingApproveIds && pendingApproveIds.length > 0) {
        const res = await fetch("/api/permissions/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ids: pendingApproveIds }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) setAuthed(false);
          throw new Error(data.error || "Onay hatası");
        }
      }

      closePdfPreview();
      if (scope === "today") {
        await fetchItems();
      } else if (scope === "past") {
        await Promise.all([fetchPast(), fetchPastItems(pgun)]);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink mb-6"
          >
            <ArrowLeft size={14} /> ana sayfa
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
            <Link href="/ogretmen/istatistik" className="btn-ghost">İstatistik</Link>
            <Link href="/ogretmen/log" className="btn-ghost">Log</Link>
            <button onClick={onLogout} className="btn-ghost">
              Çıkış
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-6 sm:pt-10 pb-24 sm:pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <p className="eyebrow mb-3">Bekleyen Talepler</p>
            <h1 className="display text-3xl sm:text-4xl font-semibold tracking-tight">
              Günün talepleri
            </h1>
            <p className="text-sm text-ink-muted mt-2">
              <span className="mark-number">{gun}</span> · {items.length} talep ·{" "}
              {selected.size} seçili
              {newArrived > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent-ink px-2 py-0.5 text-[11px] font-medium animate-pulse">
                  <Bell size={12} />
                  +{newArrived} yeni
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              className="btn-secondary flex-1 sm:flex-none"
              onClick={() => fetchItems()}
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
                          <p className="text-xs text-ink-soft mt-1 italic break-words uppercase tracking-wide">
                            “{i.neden}”
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openStudentHistory(i); }}
                        className="text-ink-muted hover:text-ink active:text-accent p-1.5 -m-1 shrink-0 mt-0.5"
                        aria-label="Talep detayları"
                      >
                        <Info size={16} />
                      </button>
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
                        <td className="p-3 font-medium">
                          <button
                            type="button"
                            onClick={() => openStudentHistory(i)}
                            className="text-left hover:text-accent"
                            title="Bu öğrencinin geçmişi"
                          >
                            {i.adSoyad}
                          </button>
                        </td>
                        <td className="p-3 text-ink-muted mark-number">{i.okulNo}</td>
                        <td className="p-3 text-ink-muted">
                          {i.sinif}-{i.sube}
                        </td>
                        <td className="p-3 text-ink-muted">
                          {i.baslangicDersi}. - {i.bitisDersi}.
                        </td>
                        <td
                          className="p-3 text-ink-muted max-w-[20rem] truncate uppercase tracking-wide"
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

        <section className="mt-10 sm:mt-14">
          <header className="flex flex-wrap items-end justify-between gap-3 mb-4 sm:mb-5">
            <div>
              <p className="eyebrow mb-2">Son {PAST_DAYS} gün</p>
              <h2 className="display text-xl sm:text-2xl font-semibold tracking-tight">
                Geçmiş günler
              </h2>
              <p className="text-sm text-ink-muted mt-1">
                Önceden onayladığınız veya unutulmuş talepleri görüntüleyin, PDF'i
                yeniden indirin.
              </p>
            </div>
            <div className="flex gap-2">
              {pastDays.some((d) => d.pending > 0) && (
                <button
                  className="btn-accent"
                  onClick={onApproveAllPastPending}
                  disabled={pastBatchBusy}
                >
                  {pastBatchBusy
                    ? "Onaylanıyor…"
                    : `Tüm bekleyenleri onayla (${pastDays.reduce(
                        (a, d) => a + d.pending,
                        0
                      )})`}
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={fetchPast}
                disabled={pastLoading}
              >
                {pastLoading ? "Yükleniyor…" : "Yenile"}
              </button>
            </div>
          </header>

          <div className="mb-4">
            <input
              className="field-input"
              placeholder="Ara: ad, okul no, sınıf, neden, tarih (12 may)…"
              value={pastQuery}
              onChange={(e) => setPastQuery(e.target.value)}
            />
          </div>

          {pastError && (
            <div className="mb-4 rounded-lg bg-danger-soft border border-danger/20 px-3 py-2.5 text-[13px] text-danger-ink">
              {pastError}
            </div>
          )}

          <div className="space-y-2.5">
            {pastLoading && pastDays.length === 0 ? (
              <p className="card p-8 text-center text-ink-muted text-sm">
                Yükleniyor…
              </p>
            ) : pastDays.length === 0 ? (
              <p className="card p-8 text-center text-ink-muted text-sm">
                Son {PAST_DAYS} günde kayıt bulunamadı.
              </p>
            ) : (() => {
              const q = pastQuery.trim().toLocaleLowerCase("tr");
              const matchesItem = (i) =>
                !q ||
                (i.adSoyad || "").toLocaleLowerCase("tr").includes(q) ||
                (i.okulNo || "").toLowerCase().includes(q) ||
                `${i.sinif}-${i.sube}`.toLowerCase().includes(q) ||
                (i.neden || "").toLocaleLowerCase("tr").includes(q);
              const matchesGun = (gun) => {
                if (!q) return true;
                const label = formatTurkishDate(gun)
                  .toLocaleLowerCase("tr");
                return label.includes(q) || gun.includes(q);
              };
              const filteredDays = pastDays.filter((g) => {
                if (matchesGun(g.gun)) return true;
                const list = pastItems[g.gun];
                if (!list) return false;
                return list.some(matchesItem);
              });
              if (filteredDays.length === 0) {
                return (
                  <p className="card p-8 text-center text-ink-muted text-sm">
                    Aramayla eşleşen kayıt yok.
                  </p>
                );
              }
              return filteredDays.map((g) => {
                const isOpen = !!pastExpanded[g.gun];
                const allItems = pastItems[g.gun] || [];
                const itemsLoading = !!pastItemsLoading[g.gun];
                const visibleItems = q
                  ? allItems.filter(matchesItem)
                  : allItems;
                const allIds = allItems.map((i) => i._id);
                const selSet = pastSelected[g.gun] || new Set();
                const selCount = selSet.size;
                const busy = !!pastBusy[g.gun];
                const pendingSelected = allItems.filter(
                  (i) => i.status === "beklemede" && selSet.has(i._id)
                ).length;
                return (
                  <div key={g.gun} className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => togglePastExpanded(g.gun)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{formatTurkishDate(g.gun)}</p>
                        <p className="text-xs text-ink-muted mt-0.5">
                          <span className="mark-number">{g.total}</span> talep
                          <span className="mx-1.5 text-ink-soft">·</span>
                          <span className="mark-number">{g.approved}</span>{" "}
                          onaylı
                          {g.pending > 0 && (
                            <>
                              <span className="mx-1.5 text-ink-soft">·</span>
                              <span className="text-danger-ink">
                                <span className="mark-number">{g.pending}</span>{" "}
                                bekleyen
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <Chevron
                        size={16}
                        open={isOpen}
                        className="text-ink-muted shrink-0"
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-line/60">
                        {itemsLoading && allItems.length === 0 ? (
                          <p className="p-6 text-center text-ink-muted text-sm">
                            Yükleniyor…
                          </p>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-paper text-[11px] uppercase tracking-wider text-ink-muted">
                              <label className="flex items-center gap-2 normal-case tracking-normal text-xs text-ink">
                                <input
                                  type="checkbox"
                                  checked={
                                    selCount === allIds.length &&
                                    allIds.length > 0
                                  }
                                  onChange={() => togglePastAll(g.gun, allIds)}
                                  className="accent-accent w-4 h-4"
                                />
                                Tümünü seç ({selCount}/{allIds.length})
                              </label>
                              <button
                                className="btn-accent"
                                onClick={() => onPastProcess(g.gun)}
                                disabled={busy || selCount === 0}
                              >
                                {busy
                                  ? "İşleniyor…"
                                  : pendingSelected > 0
                                    ? `Onayla & PDF (${selCount})`
                                    : `PDF indir (${selCount})`}
                              </button>
                            </div>

                            <ul className="sm:hidden">
                              {visibleItems.map((i) => (
                            <li
                              key={i._id}
                              className="border-b border-line/60 last:border-0 px-4 py-3 flex items-start gap-3 active:bg-paper"
                              onClick={() => togglePastItem(g.gun, i._id)}
                            >
                              <input
                                type="checkbox"
                                checked={selSet.has(i._id)}
                                onChange={() => togglePastItem(g.gun, i._id)}
                                onClick={(e) => e.stopPropagation()}
                                className="accent-accent w-5 h-5 mt-0.5 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <p className="font-medium truncate">
                                    {i.adSoyad}
                                  </p>
                                  <span
                                    className={`text-[10px] uppercase tracking-wider whitespace-nowrap ${
                                      i.status === "approved"
                                        ? "text-ink-soft"
                                        : "text-danger-ink"
                                    }`}
                                  >
                                    {i.status === "approved"
                                      ? "onaylı"
                                      : "bekleyen"}
                                  </span>
                                </div>
                                <p className="text-xs text-ink-muted mt-0.5">
                                  <span className="mark-number">
                                    {i.okulNo}
                                  </span>
                                  <span className="mx-1.5 text-ink-soft">·</span>
                                  {i.sinif}-{i.sube}
                                  <span className="mx-1.5 text-ink-soft">·</span>
                                  {i.baslangicDersi}. - {i.bitisDersi}. ders
                                </p>
                                {i.neden && (
                                  <p className="text-xs text-ink-soft mt-1 italic break-words uppercase tracking-wide">
                                    “{i.neden}”
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openStudentHistory(i); }}
                                className="text-ink-muted hover:text-ink active:text-accent p-1.5 -m-1 shrink-0 mt-0.5"
                                aria-label="Talep detayları"
                              >
                                <Info size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>

                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[11px] text-ink-muted uppercase tracking-wider border-b border-line">
                                <th className="p-3 text-left w-10"></th>
                                <th className="p-3 text-left font-medium">
                                  Ad Soyad
                                </th>
                                <th className="p-3 text-left font-medium">
                                  Okul No
                                </th>
                                <th className="p-3 text-left font-medium">
                                  Sınıf
                                </th>
                                <th className="p-3 text-left font-medium">
                                  Dersler
                                </th>
                                <th className="p-3 text-left font-medium">
                                  Neden
                                </th>
                                <th className="p-3 text-left font-medium">
                                  Durum
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleItems.map((i) => (
                                <tr
                                  key={i._id}
                                  className="border-b border-line/60 last:border-0 hover:bg-paper"
                                >
                                  <td className="p-3">
                                    <input
                                      type="checkbox"
                                      checked={selSet.has(i._id)}
                                      onChange={() =>
                                        togglePastItem(g.gun, i._id)
                                      }
                                      className="accent-accent w-4 h-4"
                                    />
                                  </td>
                                  <td className="p-3 font-medium">
                                    <button
                                      type="button"
                                      onClick={() => openStudentHistory(i)}
                                      className="text-left hover:text-accent"
                                      title="Bu öğrencinin geçmişi"
                                    >
                                      {i.adSoyad}
                                    </button>
                                  </td>
                                  <td className="p-3 text-ink-muted mark-number">
                                    {i.okulNo}
                                  </td>
                                  <td className="p-3 text-ink-muted">
                                    {i.sinif}-{i.sube}
                                  </td>
                                  <td className="p-3 text-ink-muted">
                                    {i.baslangicDersi}. - {i.bitisDersi}.
                                  </td>
                                  <td
                                    className="p-3 text-ink-muted max-w-[20rem] truncate uppercase tracking-wide"
                                    title={i.neden}
                                  >
                                    {i.neden}
                                  </td>
                                  <td
                                    className={`p-3 text-[11px] uppercase tracking-wider ${
                                      i.status === "approved"
                                        ? "text-ink-soft"
                                        : "text-danger-ink"
                                    }`}
                                  >
                                    {i.status === "approved"
                                      ? "onaylı"
                                      : "bekleyen"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </section>
      </div>

      {selected.size > 0 && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-paper/95 backdrop-blur px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-ink-muted">
            {selected.size} seçili
          </span>
          <button
            className="btn-accent flex-1"
            onClick={onApprove}
            disabled={processing}
          >
            {processing ? "İşleniyor…" : `Onayla & PDF`}
          </button>
        </div>
      )}

      {pdfPreview && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePdfPreview();
          }}
        >
          <div className="bg-surface rounded-2xl shadow-pop w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-line">
              <div>
                <p className="eyebrow mb-0.5">PDF Önizleme</p>
                <h3 className="font-semibold text-sm sm:text-base">
                  {pdfPreview.filename}
                </h3>
              </div>
              <button onClick={closePdfPreview} className="btn-ghost">
                Vazgeç
              </button>
            </div>
            <div className="flex-1 bg-paper">
              <iframe
                src={pdfPreview.url}
                title="PDF Önizleme"
                className="w-full h-full min-h-[420px]"
              />
            </div>
            <div className="px-4 sm:px-5 py-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">
                {pdfPreview.pendingApproveIds?.length > 0
                  ? `İndir butonuna bastığında ${pdfPreview.pendingApproveIds.length} talep onaylanır.`
                  : "Tüm seçilen talepler zaten onaylı."}
              </p>
              <button className="btn-accent" onClick={confirmPdfPreview}>
                {pdfPreview.pendingApproveIds?.length > 0
                  ? "İndir & onayla"
                  : "İndir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {studentHistory && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeStudentHistory();
          }}
        >
          <div className="bg-surface rounded-2xl shadow-pop w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-line">
              <div className="min-w-0">
                <p className="eyebrow mb-0.5">Öğrenci geçmişi</p>
                <h3 className="font-semibold truncate">
                  {studentHistory.student.adSoyad}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  <span className="mark-number">
                    {studentHistory.student.okulNo}
                  </span>
                  <span className="mx-1.5 text-ink-soft">·</span>
                  {studentHistory.student.sinif}-{studentHistory.student.sube}
                </p>
              </div>
              <button onClick={closeStudentHistory} className="btn-ghost">
                Kapat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const c = studentHistory.cluster;
                const s = studentHistory.student;
                if (!c && !studentHistory.loading && !s.meta) {
                  return (
                    <div className="px-4 sm:px-5 py-3 bg-paper/60 border-b border-line">
                      <p className="eyebrow mb-1">Talep kaynağı</p>
                      <p className="text-[11px] text-ink-muted">
                        Bu talep için meta veri yok (eski kayıt).
                      </p>
                    </div>
                  );
                }
                if (!c) {
                  return (
                    <div className="px-4 sm:px-5 py-3 bg-paper/60 border-b border-line text-[11px] text-ink-muted">
                      Talep kaynağı yükleniyor…
                    </div>
                  );
                }
                const fmtDate = (iso) =>
                  iso ? new Date(iso).toLocaleString("tr-TR") : "—";
                const StatPair = ({ total, distinct }) => (
                  <span className="mark-number">
                    <span className="font-semibold">{total}</span> talep ·{" "}
                    <span className="font-semibold">{distinct}</span> farklı öğrenci
                  </span>
                );
                return (
                  <div className="px-4 sm:px-5 py-3 bg-paper/60 border-b border-line space-y-3">
                    {c.flags.length > 0 && (
                      <ul className="space-y-1.5">
                        {c.flags.map((f, idx) => (
                          <li
                            key={idx}
                            className={`text-xs rounded-md border px-2.5 py-1.5 ${
                              f.level === "high"
                                ? "bg-danger-soft border-danger/20 text-danger-ink"
                                : "bg-warn-soft border-warn/20 text-warn-ink"
                            }`}
                          >
                            {f.text}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="text-[11px] space-y-1.5">
                      <div className="flex gap-2">
                        <span className="text-ink-muted uppercase tracking-wider shrink-0 w-20 sm:w-24">
                          Zaman
                        </span>
                        <span className="text-ink mark-number">
                          {fmtDate(c.createdAt)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-ink-muted uppercase tracking-wider shrink-0 w-20 sm:w-24">
                          Cihaz
                        </span>
                        <span className="text-ink">
                          {c.device.label || "—"}
                          {c.device.mobile ? " · mobil" : ""}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-ink-muted uppercase tracking-wider shrink-0 w-20 sm:w-24">
                          IP
                        </span>
                        <span className="text-ink font-mono">
                          {c.ip || "—"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-ink-muted uppercase tracking-wider shrink-0 w-20 sm:w-24">
                          Cihaz ID
                        </span>
                        <span className="text-ink font-mono">
                          {c.sid ? `${c.sid}…` : "yok"}
                        </span>
                      </div>
                    </div>

                    {(c.sid || c.ip) && (
                      <div className="border-t border-line/60 pt-2.5 space-y-2 text-[11px]">
                        <p className="eyebrow !text-ink-muted">Toplu davranış</p>
                        {c.sid && (
                          <>
                            <div className="flex gap-2">
                              <span className="text-ink-muted uppercase tracking-wider shrink-0 w-28">
                                Bu cihaz · 7g
                              </span>
                              <StatPair
                                total={c.sidStats.last7.total}
                                distinct={c.sidStats.last7.distinctStudents}
                              />
                            </div>
                            <div className="flex gap-2">
                              <span className="text-ink-muted uppercase tracking-wider shrink-0 w-28">
                                Bu cihaz · 30g
                              </span>
                              <StatPair
                                total={c.sidStats.last30.total}
                                distinct={c.sidStats.last30.distinctStudents}
                              />
                            </div>
                            <div className="flex gap-2">
                              <span className="text-ink-muted uppercase tracking-wider shrink-0 w-28">
                                İlk görülme
                              </span>
                              <span className="text-ink mark-number">
                                {fmtDate(c.sidStats.firstSeen)}
                              </span>
                            </div>
                          </>
                        )}
                        {c.ip && (
                          <>
                            <div className="flex gap-2 pt-1">
                              <span className="text-ink-muted uppercase tracking-wider shrink-0 w-28">
                                Bu IP · 7g
                              </span>
                              <StatPair
                                total={c.ipStats.last7.total}
                                distinct={c.ipStats.last7.distinctStudents}
                              />
                            </div>
                            <div className="flex gap-2">
                              <span className="text-ink-muted uppercase tracking-wider shrink-0 w-28">
                                Bu IP · 30g
                              </span>
                              <StatPair
                                total={c.ipStats.last30.total}
                                distinct={c.ipStats.last30.distinctStudents}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              {studentHistory.loading ? (
                <p className="p-8 text-center text-ink-muted text-sm">
                  Yükleniyor…
                </p>
              ) : studentHistory.error ? (
                <p className="p-8 text-center text-danger-ink text-sm">
                  {studentHistory.error}
                </p>
              ) : studentHistory.items.length === 0 ? (
                <p className="p-8 text-center text-ink-muted text-sm">
                  Bu öğrencinin geçmiş kaydı yok.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {studentHistory.items.map((it, idx) => (
                    <li key={it._id} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                      <span className="mark-number text-xs text-ink-soft w-6 tabular-nums shrink-0 mt-0.5">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          <span className="mark-number">
                            {formatTurkishDate(it.gun)}
                          </span>
                          <span className="mx-1.5 text-ink-soft">·</span>
                          <span className="text-ink-muted">
                            {it.baslangicDersi}. - {it.bitisDersi}. ders
                          </span>
                        </p>
                        {it.neden && (
                          <p className="text-xs text-ink-soft mt-1 italic break-words uppercase tracking-wide">
                            “{it.neden}”
                          </p>
                        )}
                      </div>
                      <span
                        className={
                          it.status === "approved"
                            ? "badge-ok shrink-0"
                            : "badge-warn shrink-0"
                        }
                      >
                        {it.status === "approved" ? "onaylı" : "beklemede"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
