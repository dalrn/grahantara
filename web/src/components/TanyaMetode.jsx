import { useState } from "react";

const SARAN = [
  "Kenapa pakai rata-rata geometrik?",
  "Apa itu peringkat persentil?",
  "Data ini dari mana saja?",
];

export default function TanyaMetode() {
  const [riwayat, setRiwayat] = useState([]);
  const [pertanyaan, setPertanyaan] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);

  const giliranPengguna = riwayat.filter((g) => g.peran === "pengguna").length;
  const batasTercapai = giliranPengguna >= 12;

  const kirim = async (teks) => {
    const tanya = (teks ?? "").trim();
    if (!tanya || tanya.length > 200 || memuat || batasTercapai) return;
    setMemuat(true);
    setGalat(null);
    try {
      const r = await fetch("/api/tanya-metode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riwayat: riwayat.slice(-6),
          pertanyaan: tanya,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setGalat(j?.galat ?? `Server menjawab ${r.status}.`);
        return;
      }
      const hasil = await r.json();
      setRiwayat((sebelum) => [
        ...sebelum,
        { peran: "pengguna", isi: tanya },
        { peran: "asisten", isi: hasil.jawaban, sumber: hasil.sumber },
      ]);
      setPertanyaan("");
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="mt-3">
      <p className="metodologi-p">
        Tanyakan cara kerja Grahantara di sini. Halaman ini tidak memuat data
        kawasan; untuk angka suatu kawasan, buka peta lalu pilih kawasan di
        sana.
      </p>

      {!batasTercapai && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SARAN.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => kirim(s)}
              disabled={memuat}
              className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-60"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {riwayat.length > 0 && (
        <div className="mt-3 space-y-1.5 text-xs">
          {riwayat.map((g, i) => (
            <div
              key={i}
              className={
                g.peran === "pengguna"
                  ? "ml-6 rounded bg-sky-900/40 px-2 py-1 text-sky-100"
                  : "mr-6 rounded bg-slate-800 px-2 py-1 text-slate-200"
              }
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {g.peran === "pengguna" ? "Kamu" : "Asisten"}
              </div>
              <div>{g.isi}</div>
              {g.peran === "asisten" && g.sumber === "fallback" && (
                <div className="mt-1 rounded bg-yellow-700 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Dijawab tanpa AI
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {galat && (
        <div className="mt-2 rounded bg-red-900/60 p-2 text-xs text-red-100">
          {galat}
        </div>
      )}
      {memuat && <div className="mt-2 text-xs text-slate-400">Menjawab...</div>}

      {batasTercapai ? (
        <div className="mt-2 text-xs text-slate-400">
          Batas 12 pertanyaan sudah tercapai.
        </div>
      ) : (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            kirim(pertanyaan);
          }}
        >
          <input
            type="text"
            value={pertanyaan}
            maxLength={200}
            onChange={(e) => setPertanyaan(e.target.value)}
            placeholder="Tanya tentang metode Grahantara..."
            disabled={memuat}
            className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-emerald-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={memuat || !pertanyaan.trim()}
            className="tombol-aksi rounded px-2 py-1 text-xs font-semibold disabled:opacity-60"
          >
            Kirim
          </button>
        </form>
      )}
      {!batasTercapai && pertanyaan.length > 160 && (
        <div className="mt-0.5 text-right text-[10px] text-slate-500">
          {200 - pertanyaan.length} karakter tersisa
        </div>
      )}
    </div>
  );
}
