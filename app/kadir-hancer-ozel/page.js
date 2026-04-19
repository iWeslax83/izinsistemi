"use client";

import { useEffect, useState } from "react";
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
        <form onSubmit={onLogin} className="card w-full max-w-sm p-8 space-y-4">
          <h1 className="text-xl font-bold text-amber uppercase tracking-wider">
            Öğretmen Girişi
          </h1>
          <input
            type="password"
            className="field-input"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-amber w-full" disabled={loading}>
            {loading ? "Doğrulanıyor..." : "Giriş"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-wrap items-end justify-between mb-6 gap-4 border-b border-charcoal-600 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber">
              Öğretmen Paneli
            </p>
            <h1 className="text-2xl font-bold mt-1">Bekleyen İzin Talepleri</h1>
            <p className="text-sm text-charcoal-400 mt-1">
              Tarih: <span className="text-gray-200">{gun}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              onClick={() => fetchItems(password)}
              disabled={loading}
            >
              Yenile
            </button>
            <button
              className="btn-amber"
              onClick={onApprove}
              disabled={processing || selected.size === 0}
            >
              {processing
                ? "İşleniyor..."
                : `Onayla ve PDF Oluştur (${selected.size})`}
            </button>
          </div>
        </header>

        {error && (
          <p className="mb-4 text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md p-3">
            {error}
          </p>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-charcoal-400">Yükleniyor...</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-charcoal-400">
              Bugün için bekleyen talep yok.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-charcoal-700 text-amber uppercase text-xs tracking-wider">
                <tr>
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === items.length}
                      onChange={toggleAll}
                      className="accent-amber w-4 h-4"
                    />
                  </th>
                  <th className="p-3 text-left">Ad Soyad</th>
                  <th className="p-3 text-left">Okul No</th>
                  <th className="p-3 text-left">Sınıf</th>
                  <th className="p-3 text-left">Ders Aralığı</th>
                  <th className="p-3 text-left">Saat</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr
                    key={i._id}
                    className="border-t border-charcoal-600 hover:bg-charcoal-700/50"
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(i._id)}
                        onChange={() => toggle(i._id)}
                        className="accent-amber w-4 h-4"
                      />
                    </td>
                    <td className="p-3">{i.adSoyad}</td>
                    <td className="p-3">{i.okulNo}</td>
                    <td className="p-3">
                      {i.sinif}-{i.sube}
                    </td>
                    <td className="p-3">
                      {i.baslangicDersi}. - {i.bitisDersi}.
                    </td>
                    <td className="p-3 text-charcoal-400">
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
