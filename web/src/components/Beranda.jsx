import { useEffect, useState } from "react";

import { DAFTAR_KAMPUS } from "../kampus.js";

const CONTOH = [
  "maba UGM, budget 800 ribuan, penting deket halte dan banyak warung murah",
  "kos dekat UPN, saya jalan kaki ke mana-mana, jalanan harus teduh dan terang",
  "anggaran 1,5 juta, yang penting banyak pilihan makan dan dekat stasiun",
];

const DIMENSI = [
  ["connectivity", "Konektivitas"],
  ["affordability", "Keterjangkauan"],
  ["amenity", "Amenitas"],
  ["walkability", "Kelayakan Jalan Kaki"],
];

const formatRupiah = (n) => (Number.isFinite(n) ? `Rp ${n.toLocaleString("id-ID")}` : "");
const formatDetik = (ms) => (ms !== undefined ? `${(ms / 1000).toFixed(1)} dtk` : "");

function ChipBobot({ kunci, nama, nilai, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-36 shrink-0 text-slate-300">{nama}</span>
      <input
        type="number"
        min={0}
        max={100}
        value={nilai}
        onChange={(e) => onChange(kunci, e.target.value)}
        className="w-16 rounded bg-slate-800 px-1.5 py-1 text-right text-slate-100 outline-none focus:ring-1 focus:ring-emerald-400"
      />
      <span className="text-slate-500">/ 100</span>
    </label>
  );
}

export default function Beranda({ onProfil, onLewati, profilAwal }) {
  const [teks, setTeks] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);
  const [profil, setProfil] = useState(profilAwal ?? null);

  useEffect(() => {
    // profil terakhir bertahan selama komponen hidup
  }, []);

  const total = DIMENSI.reduce((a, [, k]) => a + (profil?.bobot?.[k] ?? 0), 0);
  const pct = (k) => (total > 0 ? Math.round(((profil?.bobot?.[k] ?? 0) / total) * 100) : 0);

  const ubahChip = (patch) => setProfil((p) => ({ ...p, ...patch }));

  const proses = async () => {
    if (!teks.trim() || memuat) return;
    setMemuat(true);
    setGalat(null);
    try {
      const r = await fetch("/api/parse-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teks: teks.trim() }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setGalat(j?.galat ?? `Server menjawab ${r.status}.`);
        setMemuat(false);
        return;
      }
      const data = await r.json();
      if (!data.bobot) {
        data.bobot = { connectivity: 40, affordability: 25, amenity: 20, walkability: 15 };
      }
      setProfil(data);
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-slate-950 px-4 py-8">
      <div className="w-full max-w-[640px]">
        <h1 className="text-center text-4xl font-bold text-emerald-400">Grahantara</h1>
        <p className="mt-2 text-center text-slate-400">
          Cari kawasan kos di Sleman yang cocok dengan cara kamu bergerak.
        </p>
        <div className="mt-4 rounded bg-red-800 px-4 py-1.5 text-center text-sm font-semibold text-white">
          DATA PALSU (stub-0.1) - angka pada peta ini acak, bukan hasil analisis
        </div>

        <textarea
          rows={4}
          value={teks}
          maxLength={500}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="maba UGM, budget 800 ribuan, penting deket halte dan banyak warung murah"
          className="mt-4 w-full resize-none rounded-lg bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-emerald-400"
        />
        <div className="mt-1 text-right text-xs text-slate-600">{teks.length}/500</div>

        <div className="mt-2 space-y-1.5">
          {CONTOH.map((c) => (
            <button
              key={c}
              onClick={() => setTeks(c)}
              className="block w-full rounded bg-slate-900 px-3 py-1.5 text-left text-xs text-slate-400 ring-1 ring-slate-800 hover:bg-slate-800 hover:text-slate-200"
            >
              {c}
            </button>
          ))}
        </div>

        <button
          onClick={proses}
          disabled={!teks.trim() || memuat}
          className="mt-4 w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          {memuat ? "Memproses…" : "Proses"}
        </button>
        <div className="mt-2 text-center">
          <button onClick={onLewati} className="text-xs text-slate-500 underline hover:text-slate-300">
            Lewati, langsung ke peta
          </button>
        </div>

        {galat && (
          <div className="mt-4 rounded-lg bg-red-900/60 p-3 text-sm text-red-100">
            {galat}
            <button onClick={proses} className="ml-2 underline">
              Coba lagi
            </button>
          </div>
        )}

        {profil && (
          <div className="mt-5 rounded-lg bg-slate-900 p-4 ring-1 ring-slate-800">
            <div className="text-sm text-slate-400">Profil dari permintaanmu — koreksi bila salah:</div>

            {profil.sumber === "fallback" && (
              <div className="mt-2 rounded bg-yellow-700 px-3 py-1.5 text-xs font-semibold text-white">
                Diproses tanpa AI. Layanan bahasa tidak merespons.
              </div>
            )}
            {profil.bobotDiganti && (
              <div className="mt-2 rounded bg-amber-900/70 px-3 py-1.5 text-xs text-amber-100">
                Bobot dari AI tidak valid, dipakai bobot bawaan.
              </div>
            )}

            <label className="mt-3 block text-xs">
              <span className="text-slate-300">Kampus</span>
              <select
                value={profil.kampus ?? ""}
                onChange={(e) => ubahChip({ kampus: e.target.value || null })}
                className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-slate-100 outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="">Tidak ditentukan</option>
                {DAFTAR_KAMPUS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs">
              <span className="text-slate-300">Anggaran (Rp/bulan)</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="kosongkan bila tidak tahu"
                onBlur={(e) => {
                  const bersih = e.target.value.replace(/[^\d]/g, "");
                  ubahChip({ anggaran: bersih ? Number(bersih) : null });
                  e.target.value = bersih ? formatRupiah(Number(bersih)) : "";
                }}
                className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-slate-100 outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </label>
            {profil.anggaran !== null && profil.anggaran !== undefined && (
              <div className="mt-1 text-xs text-slate-400">Tersimpan: {formatRupiah(profil.anggaran)}</div>
            )}

            <div className="mt-4 space-y-1.5">
              <div className="text-xs font-semibold text-slate-300">Bobot prioritas</div>
              {DIMENSI.map(([k, nama]) => (
                <div key={k} className="flex items-center gap-2">
                  <ChipBobot
                    kunci={k}
                    nama={nama}
                    nilai={profil.bobot[k]}
                    onChange={(kunci, v) => {
                      const angka = v === "" ? 0 : Math.max(0, Math.min(100, Number(v)));
                      ubahChip({ bobot: { ...profil.bobot, [kunci]: angka } });
                    }}
                  />
                  <span className="ml-auto text-xs font-semibold text-emerald-400">{pct(k)}%</span>
                </div>
              ))}
              <div className="flex justify-between text-xs text-slate-500">
                <span>Total</span>
                <span>100% (ternormalisasi)</span>
              </div>
            </div>

            <p className="mt-3 text-xs italic text-slate-500">{profil.ringkas}</p>
            <div className="mt-1 text-[10px] text-slate-600">
              sumber: {profil.sumber}
              {profil.msLatensi !== undefined ? ` | latensi: ${formatDetik(profil.msLatensi)}` : ""}
            </div>

            <button
              onClick={() => onProfil(profil)}
              className="mt-4 w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Lihat peta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
