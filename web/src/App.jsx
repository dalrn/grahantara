import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

const PetaHeksagon = lazy(() => import("./components/PetaHeksagon"));
import PanelKontrol from "./components/PanelKontrol";
import PanelKawasan from "./components/PanelKawasan";
import PanelBanding from "./components/PanelBanding";
import PanelBandingKos from "./components/PanelBandingKos";
import PitaPeringatan from "./components/PitaPeringatan";
import PanelRute from "./components/PanelRute";
import Beranda from "./components/Beranda";
import Metodologi from "./components/Metodologi";
import { labelKelas } from "./lib/kelas";
import {
  normalisasiBobot,
  hitungSemua,
  logSubskorDitekan,
} from "./lib/mesinSkor";
import {
  PENEKANAN,
  DIMENSI_PENEKANAN,
  PENEKANAN_KATEGORI,
} from "./config";
import { DEFINISI_LAPISAN } from "./lib/lapisan";
import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR, DIMENSI_UI } from "./lib/kamus";
import { muatanIndikatorAI } from "./lib/bahasaIndikator";
import { fokusDariProfil } from "./lib/fokusKampus";
import {
  petunjukBerikut,
  catatTampil,
  tandaiSelesai,
  lewatiSemua,
  resetPetunjuk,
} from "./lib/petunjuk";
import { TEKS_PETUNJUK } from "./content/petunjuk.js";
import {
  adalahSentuh,
  pintasBandingKos,
  pintasJatuhkanPin,
} from "./lib/perangkat";
import KartuPetunjuk from "./components/KartuPetunjuk";

const BAWAAN_MENTAH = {
  connectivity: 40,
  affordability: 25,
  amenity: 20,
  walkability: 15,
};

function lapisanAwal() {
  return Object.fromEntries(DEFINISI_LAPISAN.map((d) => [d.id, d.aktifAwal]));
}

function skorProfilKeBobot(profil, bawaan) {
  // bobot dari chip berangka 0-100 (mentah), sama dengan state bobot
  const b = profil?.bobot;
  if (!b) return bawaan;
  const salin = { ...bawaan };
  for (const k of ["connectivity", "affordability", "amenity", "walkability"]) {
    if (typeof b[k] === "number" && Number.isFinite(b[k]))
      salin[k] = Math.max(0, Math.min(100, b[k]));
  }
  return salin;
}

// metadata.bobot_default datang sebagai pecahan 0-1; ubah ke skala 0-100.
function bobotMetadataKeMentah(meta) {
  const salin = { ...BAWAAN_MENTAH };
  for (const k of ["connectivity", "affordability", "amenity", "walkability"]) {
    if (typeof meta?.[k] === "number" && Number.isFinite(meta[k]))
      salin[k] = Math.round(meta[k] * 100);
  }
  return salin;
}

// Kalimat pendek untuk pita di peta: menyebut apa yang dipilih di beranda
// supaya pilihan itu terasa mendarat, bukan diabaikan.
function ringkasPrioritas(profil) {
  const dipilih = Array.isArray(profil?.prioritas) ? profil.prioritas : [];
  if (dipilih.length === 0) {
    // Tanpa prioritas, beranda mengirim bobot BAWAAN, bukan bobot setara.
    return "Kamu belum memilih prioritas, jadi peta memakai bobot bawaan. Atur poin di tab Prioritas untuk menyesuaikan.";
  }
  const nama = dipilih
    .map((k) => DIMENSI_UI.find((d) => d.kunci === k)?.label)
    .filter(Boolean);
  if (nama.length === 0) return null;
  const daftar = nama.length === 1 ? nama[0] : `${nama[0]} dan ${nama[1]}`;
  return `Bobot disetel ke prioritasmu: ${daftar}. Atur poin di tab Prioritas untuk menyesuaikan.`;
}

const DIMENSI_KUNCI = [
  "connectivity",
  "affordability",
  "amenity",
  "walkability",
];

export default function App() {
  const [tampilan, setTampilan] = useState("beranda");
  const [profilTerakhir, setProfilTerakhir] = useState(null);
  // Pita yang memberi tahu bahwa pilihan prioritas dari beranda sudah
  // diterapkan ke slider. Muncul sekali per sesi, lalu bisa ditutup.
  const [pitaPrioritas, setPitaPrioritas] = useState(null);
  const [pitaPernahTampil, setPitaPernahTampil] = useState(false);
  const [fokusPeta, setFokusPeta] = useState(null);
  const [kosRute, setKosRute] = useState(null);
  const [rute, setRute] = useState(null);
  const [gerbangRute, setGerbangRute] = useState(null);
  // Kampus tujuan panel rute. Dimiliki App supaya popup gerbang bisa tahu
  // tujuan aktif dan memindahkannya dalam satu aksi {kampus, gerbang}.
  const [kampusRute, setKampusRute] = useState(null);
  // Indeks ruas rute yang sedang disorot dari daftar langkah di panel rute.
  const [ruasSorot, setRuasSorot] = useState(null);
  // Pin yang dijatuhkan pengguna lewat klik kanan di peta.
  const [pinJatuh, setPinJatuh] = useState(null);
  const [modePin, setModePin] = useState(false);
  // Penekanan antar-indikator dari beranda (mis. "makan").
  const [penekanan, setPenekanan] = useState(null);
  const [kategoriPoi, setKategoriPoi] = useState([]);
  // --- pengenalan progresif -------------------------------------------------
  // Keadaan yang memicu petunjuk. Semuanya TINDAKAN pengguna, bukan waktu.
  const [petunjukAktif, setPetunjukAktif] = useState(null);
  const [adaDisarankan, setAdaDisarankan] = useState(false);
  const [kawasanDibuka, setKawasanDibuka] = useState(() => new Set());
  const [kosDibuka, setKosDibuka] = useState(false);
  const [tabRinciDibuka, setTabRinciDibuka] = useState(false);
  const [pernahBanding, setPernahBanding] = useState(false);
  const [pernahUbahBobot, setPernahUbahBobot] = useState(false);
  const [pernahRute, setPernahRute] = useState(false);
  const [pernahMetodologi, setPernahMetodologi] = useState(false);
  const [petaSiap, setPetaSiap] = useState(false);
  const [versiPetunjuk, setVersiPetunjuk] = useState(0);
  const sudahDicatat = useRef(null);
  const [bobot, setBobot] = useState(BAWAAN_MENTAH);
  const [bobotBawaan, setBobotBawaan] = useState(BAWAAN_MENTAH);
  const [bobotDariMetadata, setBobotDariMetadata] = useState(false);
  const [heksagonTerpilih, setHeksagonTerpilih] = useState(null);
  const [versi, setVersi] = useState(null);
  const [dihitungPada, setDihitungPada] = useState(null);
  const [basemapAktif, setBasemapAktif] = useState(false);
  const [labels, setLabels] = useState(null);
  // Ambang kuintil skor terkini; dipakai mewarnai angka skor di panel supaya
  // warnanya selalu sepakat dengan warna heksagon di peta.
  const [ambangSkor, setAmbangSkor] = useState(null);
  const [skorTerkini, setSkorTerkini] = useState(null);
  const [lapisanAktif, setLapisanAktif] = useState(lapisanAwal);
  const [jumlahLapisan, setJumlahLapisan] = useState({});
  const [narasiCache, setNarasiCache] = useState({});
  const [percakapanCache, setPercakapanCache] = useState({});
  const [modeBanding, setModeBanding] = useState(false);
  const [comparisonType, setComparisonType] = useState("kawasan");
  const [pilihanBanding, setPilihanBanding] = useState({ a: null, b: null });
  const [hasilBanding, setHasilBanding] = useState(null);
  const [cacheBanding, setCacheBanding] = useState({});
  const [galatBanding, setGalatBanding] = useState(null);
  const mesin = useRef(null);
  const indeksH3 = useRef(null);
  const timer = useRef(null);
  const memuatBanding = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape membersihkan pin yang dijatuhkan pengguna, sekaligus menutup
  // panel rutenya. Pin adalah satu-satunya objek yang dibuat pengguna di
  // peta, jadi ia butuh cara membatalkan yang tidak menuntut membidik tombol
  // kecil. Escape tidak menyentuh pilihan kawasan atau mode banding: keduanya
  // sudah punya tombol tutupnya sendiri yang jelas.
  useEffect(() => {
    const padaTombol = (e) => {
      if (e.key !== "Escape") return;
      if (!pinJatuh) return;
      setPinJatuh(null);
      setKosRute(null);
      setRute(null);
      setGerbangRute(null);
    };
    window.addEventListener("keydown", padaTombol);
    return () => window.removeEventListener("keydown", padaTombol);
  }, [pinJatuh]);

  const klikBanding = (props) => {
    setGalatBanding(null);
    setHasilBanding(null);
    // Ctrl+klik di peta bisa datang saat mode banding BELUM menyala. Nyalakan
    // di sini, kalau tidak pilihannya tersimpan tapi panelnya tidak pernah
    // terbuka dan jalan pintasnya tampak tidak bekerja.
    setHeksagonTerpilih(null);
    setModeBanding(true);
    setPernahBanding(true);
    setComparisonType("kawasan");
    setPilihanBanding((sebelum) => {
      if (!sebelum.a) return { a: props, b: null };
      if (!sebelum.b) {
        if (sebelum.a.h3_index === props.h3_index) return sebelum;
        return { a: sebelum.a, b: props };
      }
      return { a: props, b: sebelum.b };
    });
  };

  const compareKos = (kos) => {
    setPernahBanding(true);
    setModeBanding(true);
    setComparisonType("kos");
    setHeksagonTerpilih(null);
    setLapisanAktif((layers) => ({ ...layers, kos: true }));
    setPilihanBanding((previous) => {
      if ((previous.a || previous.b)?.kind !== "kos")
        return { a: kos, b: null };
      if (previous.a?.id === kos.id || previous.b?.id === kos.id)
        return previous;
      if (!previous.a) return { ...previous, a: kos };
      if (!previous.b) return { ...previous, b: kos };
      return { a: kos, b: previous.b };
    });
  };

  const changeComparisonType = (type) => {
    setComparisonType(type);
    setPilihanBanding({ a: null, b: null });
    setHasilBanding(null);
    setGalatBanding(null);
    if (type === "kos") setLapisanAktif((layers) => ({ ...layers, kos: true }));
  };

  const gantiSlot = (slot) => {
    setPilihanBanding((s) => ({ ...s, [slot]: null }));
    setHasilBanding(null);
    setGalatBanding(null);
  };

  const skorUntuk = (props) => {
    if (!props || !mesin.current || !skorTerkini || !indeksH3.current)
      return null;
    const i = indeksH3.current.get(props.h3_index);
    return i === undefined ? null : skorTerkini[i];
  };

  const mintaBanding = () => {
    const { a, b } = pilihanBanding;
    if (!a || !b || memuatBanding.current) return;
    const kunci = `${a.h3_index}|${b.h3_index}`;
    if (cacheBanding[kunci]) {
      setHasilBanding(cacheBanding[kunci]);
      return;
    }
    memuatBanding.current = true;
    setHasilBanding("memuat");
    setGalatBanding(null);
    const buat = (d) => ({
      h3_index: d.h3_index,
      skor: d.skor,
      subskor: d.subskor,
      dimensiKosong: d.dimensi_kosong ?? [],
      // Label kualitatif + persentil, bukan nilai mentah: lihat alasannya di
      // muatanIndikatorAI (lib/bahasaIndikator.js).
      indikator: KELOMPOK_INDIKATOR.flatMap((kel) =>
        kel.kunci.map((k) =>
          muatanIndikatorAI(k, d.indikator?.[k], NAMA_INDIKATOR[k] ?? k),
        ),
      ),
    });
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bobot, a: buat(a), b: buat(b) }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        setCacheBanding((c) => ({ ...c, [kunci]: j }));
        setHasilBanding(j);
      })
      .catch(() =>
        setGalatBanding("Tidak dapat menghubungi server. Coba lagi."),
      )
      .finally(() => {
        memuatBanding.current = false;
      });
  };

  const tutupRute = () => {
    setKosRute(null);
    setRute(null);
    setGerbangRute(null);
    setKampusRute(null);
    setRuasSorot(null);
  };

  // Menerima pin APA PUN yang punya `coordinates` dan `nama`: pin kos, pin
  // yang dijatuhkan pengguna, atau titik lain. rencanaRute hanya butuh itu.
  const mintaRute = (titik) => {
    setPernahRute(true);
    setHeksagonTerpilih(null);
    setModeBanding(false);
    setRute(null);
    setGerbangRute(null);
    setKosRute(titik);
  };

  // Gerbang dipilih di peta: pindahkan tujuan ke kampus gerbang itu DULU,
  // lalu pasang gerbangnya, supaya penjaga di PanelRute (gerbang.kampus ===
  // kampus) lolos dan rute langsung dihitung ke pintu tersebut.
  const pilihGerbang = (g) => {
    setKampusRute(g.kampus);
    setGerbangRute(g);
  };

  const keluarBanding = () => {
    setModeBanding(false);
    setPilihanBanding({ a: null, b: null });
    setHasilBanding(null);
    setGalatBanding(null);
  };

  // Timpaan log-subskor bila pengguna menekankan indikator tertentu.
  // Dihitung ulang hanya saat penekanan atau datanya berubah, bukan tiap
  // gerakan slider.
  const timpaL = useRef(null);
  useEffect(() => {
    if (!mesin.current || !penekanan || !PENEKANAN[penekanan]) {
      timpaL.current = null;
      return;
    }
    const d = DIMENSI_PENEKANAN[penekanan];
    const L = logSubskorDitekan(mesin.current, d, PENEKANAN[penekanan]);
    timpaL.current = L ? { [d]: L } : null;
  }, [penekanan, skorTerkini === null]);

  // debounce 120 ms: normalisasi -> hitungSemua -> skorTerkini
  useEffect(() => {
    if (!mesin.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { bobot: ternormalisasi } = normalisasiBobot(bobot);
      setSkorTerkini(
        hitungSemua(mesin.current, ternormalisasi, timpaL.current),
      );
    }, 120);
  }, [bobot]);

  // Evaluasi petunjuk. Dijalankan ulang tiap kali keadaan pemicunya berubah,
  // TIDAK pernah karena timer. Hanya satu petunjuk boleh tampil, dan selama
  // satu masih tampil, evaluasi berikutnya tidak menggantinya.
  useEffect(() => {
    if (tampilan !== "peta") return;
    if (petunjukAktif) return;
    const p = petunjukBerikut({
      petaSiap,
      adaDisarankan,
      jumlahKawasanDibuka: kawasanDibuka.size,
      pernahBanding,
      bobotBawaan: !bedaDariBawaan && !profilTerakhir,
      pernahUbahBobot,
      kosDibuka,
      pernahRute,
      tabRinciDibuka,
      pernahMetodologi,
    });
    if (!p) return;
    // StrictMode menjalankan efek dua kali, dan setPetunjukAktif belum
    // tercermin saat jalan kedua. Tanpa penjaga ini satu petunjuk terhitung
    // tampil dua kali dan anggarannya habis separuh lebih cepat.
    if (sudahDicatat.current === p.id) return;
    sudahDicatat.current = p.id;
    catatTampil(p.id);
    setPetunjukAktif(p);
    // bedaDariBawaan sengaja tidak jadi dependensi langsung: nilainya
    // diturunkan dari `bobot`, yang sudah ada di daftar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tampilan, petaSiap, adaDisarankan, kawasanDibuka, pernahBanding,
    bobot, pernahUbahBobot, kosDibuka, pernahRute, tabRinciDibuka,
    pernahMetodologi, petunjukAktif, versiPetunjuk,
  ]);

  const tutupPetunjuk = () => {
    if (petunjukAktif) tandaiSelesai(petunjukAktif.id);
    setPetunjukAktif(null);
  };
  const lewatiSemuaPetunjuk = () => {
    lewatiSemua();
    setPetunjukAktif(null);
  };
  const ulangiPetunjuk = () => {
    resetPetunjuk();
    setPetunjukAktif(null);
    sudahDicatat.current = null;
    // Status di localStorage saja tidak cukup. Syarat tiap petunjuk juga
    // membaca keadaan sesi ini, dan sebagian syaratnya hanya benar bagi
    // pengguna yang belum melakukan apa-apa. Tanpa ini, menekan "Ulangi"
    // setelah menjelajah tidak memunculkan apa pun.
    setKawasanDibuka(new Set());
    setKosDibuka(false);
    setTabRinciDibuka(false);
    setPernahBanding(false);
    setPernahUbahBobot(false);
    setPernahRute(false);
    setPernahMetodologi(false);
    setVersiPetunjuk((v) => v + 1);
  };

  // Panel bobot memakai alokasi poin, jadi keempat dimensi selalu disetel
  // sekaligus sebagai satu objek. Skor memakai bobot RELATIF (w / Sigma-w);
  // nilai yang disimpan tetap skala 0-100 supaya mesin skor tidak berubah.
  const ubahBobot = (baru) => {
    setPernahUbahBobot(true);
    return setBobot(() => {
      const hasil = {};
      for (const k of DIMENSI_KUNCI) {
        // TIDAK dibulatkan: bobot dipakai sebagai proporsi (w/sum(w)), dan
        // pembulatan per dimensi membuat totalnya meleset dari 100 sehingga
        // panel kiri dan panel kanan menampilkan dua angka berbeda untuk
        // bobot yang sama. Pembulatan hanya boleh terjadi saat DITAMPILKAN.
        hasil[k] = Math.max(0, Math.min(100, baru[k] ?? 0));
      }
      return hasil;
    });
  };
  const kembalikanBawaan = () => setBobot(bobotBawaan);
  const toggleLapisan = (id) =>
    setLapisanAktif((l) => ({ ...l, [id]: !l[id] }));

  const bedaDariBawaan =
    Math.abs(bobot.connectivity - bobotBawaan.connectivity) > 0.5 ||
    Math.abs(bobot.affordability - bobotBawaan.affordability) > 0.5 ||
    Math.abs(bobot.amenity - bobotBawaan.amenity) > 0.5 ||
    Math.abs(bobot.walkability - bobotBawaan.walkability) > 0.5;

  // Panel kawasan dibuka: catat h3-nya (Set, jadi kawasan yang sama dibuka
  // dua kali tidak dihitung dua).
  const pilihHeksagon = (props) => {
    setHeksagonTerpilih(props);
    if (props?.h3_index) {
      setKawasanDibuka((s) => {
        if (s.has(props.h3_index)) return s;
        const baru = new Set(s);
        baru.add(props.h3_index);
        return baru;
      });
    }
  };

  const skorTerpilih = (() => {
    if (!heksagonTerpilih || !mesin.current || !skorTerkini) return null;
    if (!indeksH3.current) return null;
    const i = indeksH3.current.get(heksagonTerpilih.h3_index);
    return i === undefined ? null : skorTerkini[i];
  })();

  const renderView = () => {
    if (tampilan === "metodologi") {
      return (
        <div className="h-screen w-screen overflow-hidden bg-slate-950">
          <Metodologi
            onKembali={() => setTampilan("peta")}
            onBeranda={() => setTampilan("beranda")}
            versi={versi}
          />
        </div>
      );
    }

    if (tampilan === "beranda") {
      return (
        <div className="h-screen w-screen overflow-hidden bg-slate-950">
          <Beranda
            profilAwal={profilTerakhir}
            onMetodologi={() => setTampilan("metodologi")}
            onProfil={(profil) => {
              setProfilTerakhir(profil);
              setBobot(skorProfilKeBobot(profil, bobotBawaan));
              const kat = Array.isArray(profil?.kategoriPoi)
                ? profil.kategoriPoi
                : [];
              setKategoriPoi(kat);
              // Kalau AI tidak menyimpulkan penekanan tapi pengguna menyebut
              // jenis tempat tertentu, turunkan penekanannya dari kategori
              // itu. Tanpa ini "dekat apotek" hanya mengubah daftar di panel
              // dan sama sekali tidak menggeser peta.
              setPenekanan(
                profil?.penekanan ??
                  (kat.length ? (PENEKANAN_KATEGORI[kat[0]] ?? null) : null),
              );
              setFokusPeta(fokusDariProfil(profil));
              if (!pitaPernahTampil) {
                setPitaPrioritas(ringkasPrioritas(profil));
                setPitaPernahTampil(true);
              }
              setTampilan("peta");
            }}
            onLewati={() => {
              setProfilTerakhir(null);
              setBobot(bobotBawaan);
              setPenekanan(null);
              setFokusPeta(null);
              setPitaPrioritas(null);
              setTampilan("peta");
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-900">
        <div className="flex-none">
          <PitaPeringatan versi={versi} basemapAktif={basemapAktif} />
        </div>
        <div
          className={`relative flex-1 overflow-hidden ${modeBanding ? "map-comparing" : ""}`}
        >
          {pitaPrioritas && (
            <div className="pita-prioritas" role="status">
              <span>{pitaPrioritas}</span>
              <button
                type="button"
                onClick={() => setPitaPrioritas(null)}
                aria-label="Tutup pemberitahuan"
              >
                Tutup
              </button>
            </div>
          )}
          <div className="map-nav absolute left-1/2 top-3 z-30 flex -translate-x-1/2 gap-1.5">
            <button
              onClick={() => setTampilan("beranda")}
              className="rounded bg-slate-900/85 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
            >
              ← Beranda
            </button>
            {modeBanding ? (
              <button
                onClick={keluarBanding}
                className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-500"
              >
                Selesai banding
              </button>
            ) : (
              <button
                data-petunjuk="nav-banding"
                onClick={() => {
                  setHeksagonTerpilih(null);
                  setModeBanding(true);
                  setPernahBanding(true);
                  changeComparisonType("kawasan");
                }}
                className="rounded bg-slate-900/85 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
              >
                Bandingkan
              </button>
            )}
            <button
              data-petunjuk="nav-metodologi"
              onClick={() => {
                setPernahMetodologi(true);
                setTampilan("metodologi");
              }}
              className="rounded bg-slate-900/85 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
            >
              Metodologi
            </button>
            {/* Wajib ada: tanpa ini rangkaian petunjuk tidak bisa didemokan
                dua kali dan tidak bisa diuji ulang setelah sekali dilihat. */}
            <button
              onClick={ulangiPetunjuk}
              title="Tampilkan ulang petunjuk pengenalan"
              className="rounded bg-slate-900/85 px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-700 hover:text-white"
            >
              Ulangi petunjuk
            </button>
            {/* Kontrol menjatuhkan pin duduk di baris navigasi, bukan di
                sudut kanan bawah: di sana ia bertabrakan dengan pita
                "Bandingkan kawasan" dan popup koordinat. Jalan pintasnya
                disebut di tooltip tombol ini, sesuai perangkat. */}
            <button
              onClick={() => setModePin((v) => !v)}
              aria-pressed={modePin}
              title={`Jatuhkan pin di peta, pintasan: ${pintasJatuhkanPin(adalahSentuh())}`}
              className={`tombol-pin${modePin ? " is-aktif" : ""}`}
            >
              {modePin ? "Batalkan pin" : "Jatuhkan pin"}
            </button>
          </div>
          {modeBanding && (
            <div className="comparison-controls absolute left-2 right-2 top-14 z-30 rounded-xl bg-slate-900/95 p-2 text-xs text-slate-200 shadow-lg md:left-auto md:right-14 md:w-80">
              <div
                className="flex gap-1"
                role="group"
                aria-label="Jenis perbandingan"
              >
                {["kawasan", "kos"].map((type) => (
                  <button
                    key={type}
                    aria-pressed={comparisonType === type}
                    onClick={() => changeComparisonType(type)}
                    className={`flex-1 rounded-lg px-3 py-2 font-semibold ${comparisonType === type ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-200"}`}
                  >
                    {type === "kos" ? "Kos" : "Kawasan"}
                  </button>
                ))}
              </div>
              <p className="px-1 pt-2">
                {comparisonType === "kos"
                  ? `Pilih dua pin rumah. Pintasan: ${pintasBandingKos(adalahSentuh())}.`
                  : "Klik dua heksagon di peta."}
              </p>
            </div>
          )}
          <PanelKontrol
            bobot={bobot}
            bobotBawaan={bobotBawaan}
            onBobotBerubah={ubahBobot}
            onKembalikanBawaan={kembalikanBawaan}
            lapisanAktif={lapisanAktif}
            onToggleLapisan={toggleLapisan}
            jumlahLapisan={jumlahLapisan}
            labels={labels}
            modeRute={Boolean(kosRute)}
          />
          <Suspense
            fallback={
              <div className="loading-map" role="status">
                <p className="animate-pulse text-sm text-emerald-400">
                  Menyiapkan peta kawasan...
                </p>
              </div>
            }
          >
            <PetaHeksagon
              onPilih={pilihHeksagon}
              onStatusBasemap={setBasemapAktif}
              onPetaSiap={({
                versi: v,
                dihitungPada: t,
                bobotDefault: m,
                labels: l,
                ambang: a,
              }) => {
                setVersi(v);
                if (t) setDihitungPada(t);
                setLabels(l);
                if (a) setAmbangSkor(a);
                if (m) {
                  // metadata menyediakan bobot bawaan: pakai sebagai nilai awal
                  // slider dan acuan "Kembalikan bawaan".
                  const b = bobotMetadataKeMentah(m);
                  setBobotBawaan(b);
                  if (!bobotDariMetadata && !profilTerakhir) setBobot(b);
                  setBobotDariMetadata(true);
                } else {
                  setBobotDariMetadata(false);
                  console.warn(
                    "metadata.bobot_default tidak ada; memakai BOBOT_DEFAULT cadangan dari config.",
                  );
                }
              }}
              skorTerkini={skorTerkini}
              onDataSiap={(m) => {
                mesin.current = m;
                indeksH3.current = new Map(m.h3.map((id, i) => [id, i]));
                const { bobot: ternormalisasi } = normalisasiBobot(bobot);
                setSkorTerkini(hitungSemua(m, ternormalisasi));
              }}
              onAmbangBerubah={({ ambang, minSkor, maksSkor }) => {
                setLabels(labelKelas(ambang, minSkor, maksSkor));
                setAmbangSkor(ambang);
              }}
              fokus={fokusPeta}
              tujuanRute={kampusRute ?? fokusPeta?.nama ?? null}
              onMintaRute={mintaRute}
              onPilihGerbang={pilihGerbang}
              rute={rute}
              ruasSorot={ruasSorot}
              pinJatuh={pinJatuh}
              onPinJatuh={setPinJatuh}
              onPetaMuat={() => setPetaSiap(true)}
              onDisarankan={setAdaDisarankan}
              onKosDibuka={() => setKosDibuka(true)}
              modePin={modePin}
              onModePin={setModePin}
              lapisanAktif={lapisanAktif}
              onJumlahLapisan={setJumlahLapisan}
              modeBanding={modeBanding}
              pilihanBanding={pilihanBanding}
              onPilihBanding={klikBanding}
              comparisonType={comparisonType}
              onCompareKos={compareKos}
            />
          </Suspense>
          {kosRute && (
            <PanelRute
              kos={kosRute}
              kampusAwal={kampusRute ?? fokusPeta?.nama}
              onKampusBerubah={setKampusRute}
              gerbang={gerbangRute}
              onGerbangReset={() => setGerbangRute(null)}
              onRute={setRute}
              onSorotRuas={setRuasSorot}
              onTutup={tutupRute}
            />
          )}
          <AnimatePresence>
            {petunjukAktif &&
              (() => {
                const t = TEKS_PETUNJUK[petunjukAktif.id]?.({
                  kampus: fokusPeta?.nama ?? null,
                  bobotBawaan: !bedaDariBawaan,
                  sentuh: adalahSentuh(),
                });
                if (!t) return null;
                return (
                  <KartuPetunjuk
                    key={petunjukAktif.id}
                    judul={t.judul}
                    isi={t.isi}
                    posisi={t.posisi}
                    onTutup={tutupPetunjuk}
                    // "Lewati semua" HANYA di petunjuk pertama.
                    onLewatiSemua={
                      petunjukAktif.id === "p1_disarankan"
                        ? lewatiSemuaPetunjuk
                        : undefined
                    }
                  />
                );
              })()}
            {!modeBanding && heksagonTerpilih && (
              <PanelKawasan
                key="kawasan"
                heksagon={heksagonTerpilih}
                versi={versi}
                dihitungPada={dihitungPada}
                bobotDariMetadata={bobotDariMetadata}
                bobotBawaan={bobotBawaan}
                skorKini={skorTerpilih}
                bobotKini={
                  bedaDariBawaan ? normalisasiBobot(bobot).bobot : null
                }
                ambangSkor={ambangSkor}
                onTutup={() => setHeksagonTerpilih(null)}
                onTabRinci={() => setTabRinciDibuka(true)}
                kategoriPoi={kategoriPoi}
                narasiCache={narasiCache}
                simpanNarasi={(h3, hasil) =>
                  setNarasiCache((c) => (c[h3] ? c : { ...c, [h3]: hasil }))
                }
                percakapanCache={percakapanCache}
                simpanPercakapan={(h3, daftar) =>
                  setPercakapanCache((c) => ({ ...c, [h3]: daftar }))
                }
              />
            )}
            {modeBanding &&
              comparisonType === "kos" &&
              (pilihanBanding.a || pilihanBanding.b) && (
                <PanelBandingKos
                  key="banding-kos"
                  pilihan={pilihanBanding}
                  scores={{
                    a: skorUntuk(pilihanBanding.a),
                    b: skorUntuk(pilihanBanding.b),
                  }}
                  ambangSkor={ambangSkor}
                  onClose={keluarBanding}
                  onReplace={gantiSlot}
                />
              )}
            {modeBanding &&
              comparisonType === "kawasan" &&
              (pilihanBanding.a || pilihanBanding.b) && (
                <PanelBanding
                  key="banding"
                  pilihan={pilihanBanding}
                  skorKini={{
                    a: skorUntuk(pilihanBanding.a),
                    b: skorUntuk(pilihanBanding.b),
                  }}
                  versi={versi}
                  dihitungPada={dihitungPada}
                  onTutup={keluarBanding}
                  onGanti={gantiSlot}
                  hasilBanding={hasilBanding}
                  galat={galatBanding}
                  padaBanding={mintaBanding}
                  ambangSkor={ambangSkor}
                />
              )}
          </AnimatePresence>
        </div>
      </div>
    );
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tampilan}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="h-dvh"
      >
        {renderView()}
      </motion.div>
    </AnimatePresence>
  );
}
