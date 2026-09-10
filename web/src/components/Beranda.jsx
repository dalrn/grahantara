import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { DAFTAR_KAMPUS } from "../kampus.js";

const CONTOH = [
  "maba UGM, budget 800 ribuan, penting deket halte dan banyak warung murah",
  "kos dekat UPN, saya jalan kaki ke mana-mana, jalanan harus teduh dan terang",
  "anggaran 1,5 juta, yang penting banyak pilihan makan dan dekat stasiun",
];

const DIMENSI = [
  ["connectivity", "Akses transportasi"],
  ["affordability", "Keterjangkauan"],
  ["amenity", "Kenyamanan"],
  ["walkability", "Kenyamanan berjalan kaki"],
];

const formatRupiah = (n) =>
  Number.isFinite(n) ? `Rp ${n.toLocaleString("id-ID")}` : "";

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

export default function Beranda({
  onProfil,
  onLewati,
  onMetodologi,
  profilAwal,
}) {
  const [teks, setTeks] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);
  const [profil, setProfil] = useState(profilAwal ?? null);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    // metadata versi data untuk pita; berkas sama dengan yang dipakai peta
    // (di-serve dari cache HTTP setelah muat pertama).
    fetch("/data/hexagons.geojson")
      .then((r) => r.json())
      .then((d) => setMeta(d.metadata ?? null))
      .catch(() => setMeta(null));
  }, []);

  const formatTanggal = (iso) => {
    if (typeof iso !== "string") return null;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return null;
    return t.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const stub =
    meta && typeof meta.versi === "string" && meta.versi.startsWith("stub");

  const total = DIMENSI.reduce((a, [k]) => a + (profil?.bobot?.[k] ?? 0), 0);
  const pct = (k) =>
    total > 0
      ? Math.round(((profil?.bobot?.[k] ?? 0) / total) * 100)
      : { connectivity: 40, affordability: 25, amenity: 20, walkability: 15 }[
          k
        ];

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
        data.bobot = {
          connectivity: 40,
          affordability: 25,
          amenity: 20,
          walkability: 15,
        };
      }
      setProfil(data);
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="home-page h-full overflow-y-auto bg-slate-950">
      <header className="home-nav">
        <a href="#" className="brand" aria-label="Grahantara beranda">
          <span className="brand-mark" aria-hidden="true"><img src="/grahantara-mark.svg" alt="" width="40" height="47" /></span>grahantara
          <span className="brand-dot">●</span>
        </a>
        <nav>
          <span className="nav-active">Beranda</span>
          <button onClick={onLewati}>Jelajahi peta ↗</button>
          <button onClick={onMetodologi}>Metodologi</button>
        </nav>
        <span className="location-tag">◎ Sleman, Yogyakarta</span>
      </header>
      <div className="home-layout">
        <section className="home-intro">
          <div className="eyebrow">
            <span /> RUANG YANG PAS UNTUKMU
          </div>
          <h1>
            Cari kos,
            <br />
            pilih <em>kawasan</em>
            <br />
            yang terasa pas.
          </h1>
          <p>
            Dekat kampus, ramah di kantong, nyaman dijalani. Kenali lingkungan
            kos di Sleman dari hal yang paling berarti buatmu.
          </p>
          <div className="home-map-art" aria-hidden="true">
            <svg viewBox="0 0 560 290">
              <defs>
                <pattern
                  id="hex-grid"
                  width="66"
                  height="114"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M33 0 66 19 66 57 33 76 0 57 0 19ZM0 57 33 76 33 114M66 57 33 76"
                    fill="none"
                    stroke="#65dfbb"
                    strokeOpacity=".16"
                  />
                </pattern>
                <linearGradient id="map-fade">
                  <stop stopColor="#65dfbb" stopOpacity=".05" />
                  <stop offset="1" stopColor="#65dfbb" stopOpacity=".3" />
                </linearGradient>
              </defs>
              <rect width="560" height="290" fill="url(#hex-grid)" />
              <path
                d="M0 234Q130 270 190 146T410 100T570 38"
                fill="none"
                stroke="#65dfbb"
                strokeOpacity=".22"
                strokeWidth="18"
              />
              <path
                d="M0 234Q130 270 190 146T410 100T570 38"
                fill="none"
                stroke="#a0efd4"
                strokeOpacity=".7"
                strokeWidth="1"
                strokeDasharray="5 7"
              />
              {[
                [231, 95, "#319b98"],
                [297, 95, "#94ca91"],
                [330, 152, "#edd58b"],
                [264, 209, "#5379a5"],
                [165, 95, "#534675"],
              ].map(([x, y, color]) => (
                <path
                  key={x}
                  d={`M${x} ${y - 38}l33 19v38l-33 19-33-19v-38Z`}
                  fill={color}
                  stroke="#192b27"
                  strokeWidth="3"
                />
              ))}
              <g transform="translate(297 55)">
                <path d="M0 0C-38-35-14-60 0-60S38-35 0 0" fill="#65dfbb" />
                <path d="M-11-33 0-43 11-33v12H4v-8h-8v8h-7Z" fill="#192b27" />
              </g>
            </svg>
            <div className="map-art-label">
              ◎ Eksplorasi dimulai dari lingkungan.
            </div>
            <span className="map-art-note">Ilustrasi kawasan</span>
          </div>
          <div className="home-facts">
            <div>
              <strong>{meta?.jumlah?.toLocaleString("id-ID") ?? "—"}</strong>
              <span>heksagon dianalisis</span>
            </div>
            <div>
              <strong>4</strong>
              <span>dimensi kehidupan</span>
            </div>
            <div>
              <strong>16</strong>
              <span>indikator kawasan</span>
            </div>
          </div>
        </section>
        <section className="preference-card">
          <div className="card-step">
            01 <span>KENALI KEBUTUHANMU</span>
            <span className="step-dots">● ○ ○</span>
          </div>
          <h2>
            Kos seperti apa
            <br />
            yang kamu cari?
          </h2>
          <p className="card-description">
            Ceritakan kampus, anggaran, dan kebiasaanmu. Kami bantu menyusun
            prioritas kawasan.
          </p>
          {stub ? (
            <div className="mt-4 rounded bg-red-800 px-4 py-1.5 text-center text-sm font-semibold text-white">
              DATA PALSU ({meta.versi}) - angka pada peta ini acak, bukan hasil
              analisis
            </div>
          ) : meta?.versi ? (
            <div className="data-stamp">
              Data versi {meta.versi}
              {formatTanggal(meta.dihitung_pada)
                ? `, dihitung ${formatTanggal(meta.dihitung_pada)}.`
                : "."}
            </div>
          ) : null}

          <label htmlFor="needs" className="input-label">
            Kebutuhan & keseharianmu
          </label>
          <textarea
            id="needs"
            rows={4}
            value={teks}
            maxLength={500}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="maba UGM, budget 800 ribuan, penting deket halte dan banyak warung murah"
            className="mt-4 w-full resize-none rounded-lg bg-slate-900 p-3 text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-emerald-400"
          />
          <div className="mt-1 text-right text-xs text-slate-600">
            {teks.length}/500
          </div>

          <div className="example-chips">
            <span className="text-xs text-slate-400">Coba contoh</span>
            {CONTOH.map((c, i) => (
              <button
                key={c}
                onClick={() => setTeks(c)}
                className="example-chip"
              >
                {["🎓 Maba UGM", "↗ Jalan kaki ke UPN", "◎ Dekat stasiun"][i]}
              </button>
            ))}
          </div>

          {!profil && (
            <button
              onClick={proses}
              disabled={!teks.trim() || memuat}
              className="mt-4 w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
            >
              {memuat ? "Menyusun prioritas…" : "Temukan kawasan saya →"}
            </button>
          )}
          {profil && (
            <button
              className="mt-3 text-xs text-emerald-400"
              onClick={proses}
              disabled={memuat || !teks.trim()}
            >
              Susun ulang dari cerita saya ↻
            </button>
          )}
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={onLewati}
              className="text-xs text-slate-500 underline hover:text-slate-300"
            >
              Lewati, langsung ke peta
            </button>
            <button
              onClick={onMetodologi}
              className="text-xs text-slate-500 underline hover:text-slate-300"
            >
              Metodologi
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
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-lg bg-slate-900 p-4 ring-1 ring-slate-800"
            >
              <div className="text-sm text-slate-400">
                Profil dari permintaanmu — koreksi bila salah:
              </div>

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
                  key={profil.anggaran}
                  defaultValue={formatRupiah(profil.anggaran)}
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
                <div className="mt-1 text-xs text-slate-400">
                  Tersimpan: {formatRupiah(profil.anggaran)}
                </div>
              )}

              <div className="mt-4 space-y-1.5">
                <div className="text-xs font-semibold text-slate-300">
                  Bobot prioritas
                </div>
                {DIMENSI.map(([k, nama], i) => (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-2"
                  >
                    <ChipBobot
                      kunci={k}
                      nama={nama}
                      nilai={profil.bobot[k]}
                      onChange={(kunci, v) => {
                        const angka =
                          v === "" ? 0 : Math.max(0, Math.min(100, Number(v)));
                        ubahChip({
                          bobot: { ...profil.bobot, [kunci]: angka },
                        });
                      }}
                    />
                    <span className="ml-auto text-xs font-semibold text-emerald-400">
                      {pct(k)}%
                    </span>
                  </motion.div>
                ))}
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Total</span>
                  <span>100% (ternormalisasi)</span>
                </div>
              </div>

              <p className="mt-3 text-xs italic text-slate-500">
                {profil.ringkas}
              </p>

              <button
                onClick={() => onProfil({ ...profil, teks: teks.trim() })}
                className="mt-4 w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Lihat peta
              </button>
            </motion.div>
          )}
          <p className="privacy-note">
            ◈ Prioritas dapat kamu koreksi sebelum membuka peta.
          </p>
        </section>
      </div>
      <footer className="home-footer">
        <span>GRAHANTARA · KENALI KAWASAN, TEMUKAN KENYAMANAN.</span>
        <span className="community-tag">#cinajawabatak</span>
        <button onClick={onMetodologi}>
          Dibangun dari data. Dijelaskan terbuka. ↗
        </button>
      </footer>
    </div>
  );
}
