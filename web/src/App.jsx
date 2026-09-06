import { useEffect, useMemo, useState } from "react";

import "./App.css";
import heroLayers from "./assets/hero.png";
import PetaHeksagon from "./components/PetaHeksagon";

const TABS = [
  ["beranda", "Beranda"],
  ["peta", "Peta Grahantara"],
  ["bandingkan", "Bandingkan"],
  ["survey", "Survey Activities"],
  ["metodologi", "Metodologi"],
];

const DIMENSIONS = [
  ["connectivity", "Connectivity", "C", "jarak halte, rute, dan akses kampus"],
  ["affordability", "Affordability", "A", "harga sewa kos dan makan"],
  ["amenity", "Amenity", "M", "kepadatan dan keragaman tempat makan"],
  ["walkability", "Walkability", "W", "trotoar, keteduhan, dan penerangan"],
];

const DEFAULT_WEIGHTS = { connectivity: 40, affordability: 25, amenity: 20, walkability: 15 };
const COLORS = ["#efeccd", "#d8dcc5", "#a9c2a0", "#5f9a73", "#0f3d30"];

const SURVEY_ITEMS = [
  ["⌂", "Kos yang cocok", "I-1", "Harga dikonfirmasi langsung kepada pengelola dan penghuni."],
  ["↟", "Aksesibilitas jalan", "I-2", "Kondisi trotoar, hambatan, keteduhan, dan penerangan dicatat per segmen."],
  ["▰", "Jadwal bus", "I-3", "Headway jam sibuk diperiksa dari kedatangan bus yang diamati."],
  ["Rp", "Daftar harga", "I-1", "Harga yang tidak tercantum pada spanduk diverifikasi di lapangan."],
  ["●", "Warung terdekat", "I-4", "Status operasi dan kisaran harga tempat makan diperiksa ulang."],
  ["✦", "Penerangan", "I-2", "PJU dan kantong gelap dipetakan untuk memvalidasi proksi malam."],
];

const TOUR = [
  ["beranda", "Ceritakan kebutuhan", "Mulai dari kebutuhan mahasiswa dalam bahasa sehari-hari."],
  ["beranda", "Profil terstruktur", "Kebutuhan diterjemahkan menjadi kampus, budget, dan prioritas."],
  ["peta", "Peta berbobot", "Heksagon dihitung ulang dari empat bobot yang dapat diatur."],
  ["peta", "Detail kawasan", "Klik heksagon untuk melihat skor, penjelasan, dan kos di kawasan itu."],
  ["bandingkan", "Perbandingan", "Dua kawasan dapat dibandingkan berdampingan."],
  ["survey", "Validasi lapangan", "Survey menutup celah data yang tidak tersedia secara publik."],
  ["metodologi", "Metode terbuka", "Sumber, rumus, dan status data dapat ditelusuri."],
];

function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value), 0) || 1;
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number(value) / total]));
}

function calculateScore(subscores, weights) {
  const normalized = normalizeWeights(weights);
  return 100 * Object.keys(normalized).reduce((score, key) => {
    const value = Math.max(0, Math.min(100, Number(subscores?.[key] ?? 0))) / 100;
    return score * Math.pow(value + 0.01, normalized[key]);
  }, 1);
}

function quantiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0);
}

function formatScore(value) {
  return Number(value ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function scoreLabel(score, thresholds) {
  const labels = ["rendah", "kurang", "sedang", "baik", "sangat baik"];
  const index = thresholds.findIndex((limit) => score < limit);
  return labels[index === -1 ? 4 : index];
}

function App() {
  const [activeTab, setActiveTab] = useState("beranda");
  const [data, setData] = useState(null);
  const [campuses, setCampuses] = useState(null);
  const [stops, setStops] = useState(null);
  const [boardingHouses, setBoardingHouses] = useState(null);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [selected, setSelected] = useState(null);
  const [showBoardingHouses, setShowBoardingHouses] = useState(false);
  const [need, setNeed] = useState("maba UGM, budget 800 ribuan, penting deket halte dan banyak warung murah");
  const [profile, setProfile] = useState(null);
  const [compareA, setCompareA] = useState(0);
  const [compareB, setCompareB] = useState(1);
  const [tourStep, setTourStep] = useState(-1);

  useEffect(() => {
    Promise.all([
      fetch("/data/hexagons.geojson").then((r) => r.json()),
      fetch("/data/kampus.geojson").then((r) => r.json()),
      fetch("/data/halte.geojson").then((r) => r.json()),
      fetch("/data/kos.geojson").then((r) => r.json()),
    ]).then(([hexagons, campusData, stopData, boardingData]) => {
      setData(hexagons);
      setCampuses(campusData);
      setStops(stopData);
      setBoardingHouses(boardingData);
    });
  }, []);

  const weightedData = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      features: data.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          skor_dinamis: Number(calculateScore(feature.properties.subskor, weights).toFixed(2)),
        },
      })),
    };
  }, [data, weights]);

  const thresholds = useMemo(
    () => quantiles(weightedData?.features.map((f) => f.properties.skor_dinamis) ?? []),
    [weightedData],
  );

  const ranked = useMemo(
    () => [...(weightedData?.features ?? [])].sort((a, b) => b.properties.skor_dinamis - a.properties.skor_dinamis),
    [weightedData],
  );

  const currentSelected = useMemo(() => {
    if (!selected || !weightedData) return selected;
    return weightedData.features.find((feature) => feature.properties.h3_index === selected.properties.h3_index) ?? selected;
  }, [selected, weightedData]);

  useEffect(() => {
    if (ranked.length > 1 && !selected) {
      setCompareA(0);
      setCompareB(Math.min(12, ranked.length - 1));
    }
  }, [ranked.length, selected]);

  const selectedKos = useMemo(() => {
    if (!currentSelected || !boardingHouses) return [];
    return boardingHouses.features.filter((f) => f.properties.h3_index === currentSelected.properties.h3_index).slice(0, 5);
  }, [boardingHouses, currentSelected]);

  function parseNeed() {
    const lower = need.toLowerCase();
    const campus = ["UGM", "UNY", "UII", "UPN", "AMIKOM", "Atma Jaya"].find((name) => lower.includes(name.toLowerCase())) ?? "UGM";
    const match = lower.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|jt|juta)?/);
    const raw = match ? Number(match[1].replace(",", ".")) : null;
    const budget = raw ? raw * (match?.[2]?.startsWith("j") ? 1_000_000 : 1_000) : null;
    const next = { ...DEFAULT_WEIGHTS };
    const priorities = [];
    if (/murah|budget|hemat/.test(lower)) { next.affordability += 15; priorities.push("harga terjangkau"); }
    if (/halte|transit|bus|dekat|deket/.test(lower)) { next.connectivity += 15; priorities.push("akses transit"); }
    if (/warung|makan|kuliner|ramai|rame/.test(lower)) { next.amenity += 15; priorities.push("amenitas harian"); }
    if (/jalan kaki|trotoar|teduh|nyaman/.test(lower)) { next.walkability += 15; priorities.push("kenyamanan berjalan"); }
    if (!priorities.length) { next.connectivity += 15; priorities.push("akses transit"); }
    setWeights(next);
    setProfile({ campus, budget, priorities });
  }

  function goToTab(tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startTour() {
    setTourStep(0);
    goToTab(TOUR[0][0]);
  }

  function nextTour() {
    if (tourStep >= TOUR.length - 1) {
      setTourStep(-1);
      return;
    }
    const next = tourStep + 1;
    setTourStep(next);
    goToTab(TOUR[next][0]);
    if (next === 3 && ranked[0]) setSelected(ranked[0]);
  }

  const compareOne = ranked[compareA]?.properties;
  const compareTwo = ranked[compareB]?.properties;
  const weighted = normalizeWeights(weights);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button className="wordmark" onClick={() => goToTab("beranda")} aria-label="Kembali ke beranda">
            <span className="brand-hex" /> GRAHANTARA
          </button>
          <nav aria-label="Navigasi utama">
            {TABS.map(([key, label]) => (
              <button key={key} className={activeTab === key ? "active" : ""} onClick={() => goToTab(key)}>{label}</button>
            ))}
          </nav>
          <button className="tour-start" onClick={startTour}>▶ Walkthrough</button>
        </div>
      </header>

      {data?.metadata?.versi?.startsWith("stub") && (
        <div className="data-warning">DATA DEMO · skor dan harga belum boleh dipakai sebagai rekomendasi final</div>
      )}

      <main>
        {activeTab === "beranda" && (
          <section className="home-panel">
            <div className="eyebrow">Indeks kelayakan huni · sabuk kampus Sleman, DIY</div>
            <div className="hero-grid">
              <div className="hero-copy">
                <p className="hero-kicker">Transit × hunian × kebutuhan harian</p>
                <h1>Kos murah yang <em>memutus transit</em> bukan kos yang layak.</h1>
                <p className="hero-sub">Grahantara membaca kawasan kos dari konektivitas, biaya hidup, amenitas, dan kenyamanan berjalan—dalam satu peta yang dapat dijelaskan.</p>
                <div className={`need-board ${tourStep === 0 ? "tour-focus" : ""}`}>
                  <label htmlFor="need">Ceritakan kebutuhanmu</label>
                  <textarea id="need" value={need} onChange={(e) => setNeed(e.target.value)} />
                  <div className="board-actions">
                    <button className="primary-button" onClick={parseNeed}>Bentuk profil →</button>
                    <span>profil dapat dikoreksi sebelum peta dihitung</span>
                  </div>
                  {profile && (
                    <div className={`chips ${tourStep === 1 ? "tour-focus" : ""}`}>
                      <span>Kampus <b>{profile.campus}</b></span>
                      {profile.budget && <span>Budget <b>~Rp{profile.budget.toLocaleString("id-ID")}</b></span>}
                      <span>Prioritas <b>{profile.priorities.join(", ")}</b></span>
                      <button onClick={() => goToTab("peta")}>Lihat peta →</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="hero-visual" aria-hidden="true">
                <div className="map-stamp">SLEMAN · DIY</div>
                <img src={heroLayers} alt="" />
                <div className="hero-score"><strong>4</strong><span>dimensi<br />kelayakan</span></div>
                <div className="route-line" />
              </div>
            </div>
            <div className="dimension-strip">
              {DIMENSIONS.map(([key, name, code, detail]) => (
                <article key={key}>
                  <div className="dimension-code">{code} · {Math.round(weighted[key] * 100)}%</div>
                  <h3>{name}</h3>
                  <p>{detail}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "peta" && (
          <section className="content-panel map-page">
            <div className="section-heading">
              <div><div className="eyebrow">Eksplorasi kawasan</div><h2>Peta Grahantara</h2></div>
              <div className="dataset-count"><b>{data?.features.length.toLocaleString("id-ID") ?? "…"}</b> heksagon dianalisis</div>
            </div>
            {profile && <div className="profile-line">Profil aktif: <b>{profile.campus}</b> · {profile.priorities.join(" · ")}</div>}
            <div className={`weight-panel ${tourStep === 2 ? "tour-focus" : ""}`}>
              {DIMENSIONS.map(([key, name, code]) => (
                <label key={key}>
                  <span><b>{code}</b> {name}<strong>{Math.round(weighted[key] * 100)}%</strong></span>
                  <input type="range" min="5" max="70" value={weights[key]} onChange={(e) => setWeights((old) => ({ ...old, [key]: Number(e.target.value) }))} />
                </label>
              ))}
              <button className="reset-button" onClick={() => setWeights(DEFAULT_WEIGHTS)}>Reset bobot</button>
            </div>
            <div className="map-layout">
              <div className="map-card">
                <PetaHeksagon
                  data={weightedData}
                  campuses={campuses}
                  stops={stops}
                  boardingHouses={boardingHouses}
                  thresholds={thresholds}
                  selected={currentSelected}
                  onSelect={(feature) => { setSelected(feature); setShowBoardingHouses(false); }}
                  showSelectedBoardingHouses={showBoardingHouses}
                />
                <div className="map-legend"><span>rendah</span>{COLORS.map((color) => <i key={color} style={{ background: color }} />)}<span>tinggi</span><small>klik heksagon untuk detail</small></div>
              </div>
              <aside className={`detail-card ${tourStep === 3 ? "tour-focus" : ""}`}>
                {currentSelected ? (
                  <AreaDetail feature={currentSelected} thresholds={thresholds} kos={selectedKos} showKos={showBoardingHouses} onShowKos={() => setShowBoardingHouses(true)} />
                ) : (
                  <div className="empty-detail"><span>⌖</span><h3>Pilih kawasan</h3><p>Klik sebuah heksagon untuk membuka rincian skor dan kos terdekat.</p></div>
                )}
              </aside>
            </div>
          </section>
        )}

        {activeTab === "bandingkan" && (
          <section className={`content-panel ${tourStep === 4 ? "tour-focus" : ""}`}>
            <div className="section-heading"><div><div className="eyebrow">Keputusan berdampingan</div><h2>Bandingkan kawasan</h2></div></div>
            {ranked.length > 0 && <ComparePanel ranked={ranked} a={compareA} b={compareB} setA={setCompareA} setB={setCompareB} first={compareOne} second={compareTwo} />}
          </section>
        )}

        {activeTab === "survey" && (
          <section className={`content-panel ${tourStep === 5 ? "tour-focus" : ""}`}>
            <div className="section-heading"><div><div className="eyebrow">Jejak validasi</div><h2>Survey Activities</h2></div><p>Data lapangan menutup celah yang tidak tersedia dari sumber publik.</p></div>
            <div className="survey-grid">
              {SURVEY_ITEMS.map(([icon, title, code, text], index) => (
                <article className="survey-card" key={title}>
                  <div className="survey-visual"><span>{icon}</span><b>{String(index + 1).padStart(2, "0")}</b></div>
                  <div><small>{code} · VERIFIKASI</small><h3>{title}</h3><p>{text}</p></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "metodologi" && (
          <section className={`content-panel ${tourStep === 6 ? "tour-focus" : ""}`}>
            <div className="section-heading"><div><div className="eyebrow">Dapat dijelaskan & divalidasi</div><h2>Metodologi dan sumber data</h2></div></div>
            <div className="method-stats"><article><b>0,84</b><span>Spearman median<br />27 skenario bobot</span></article><article><b>±10%</b><span>Ambang akurasi<br />ekstraksi harga</span></article><article><b>≥0,6</b><span>Ambang rho<br />kalibrasi walkability</span></article></div>
            <div className="method-grid">
              <table><thead><tr><th>Sumber</th><th>Peran</th><th>Status</th></tr></thead><tbody>
                {[
                  ["Menu Go (MAPID)", "Harga makan, kepadatan dan keramaian", "SIAP"],
                  ["Properti Go (MAPID)", "Lokasi kos dan harga dari foto", "OCR / AI"],
                  ["OpenStreetMap", "Jaringan jalan kaki dan transit", "PUBLIK"],
                  ["KAI Commuter", "Jadwal dan akses KRL", "SIAP"],
                  ["Sentinel-2 / VIIRS / SRTM", "Keteduhan, penerangan, kemiringan", "PUBLIK"],
                  ["InaRISK BNPB", "Risiko banjir dan genangan", "PUBLIK"],
                  ["Survei lapangan", "Harga, trotoar, dan headway", "SURVEI"],
                ].map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td><span>{row[2]}</span></td></tr>)}
              </tbody></table>
              <aside className="formula-card"><small>AGREGASI SKOR</small><div>Skor = 100 × Π (dᵢ + ε)<sup>wᵢ</sup></div><p>ε = 0,01. Rata-rata geometrik menghukum ketimpangan antar-subskor: harga murah tidak dapat menutupi transit yang buruk.</p></aside>
            </div>
          </section>
        )}
      </main>

      {tourStep >= 0 && (
        <div className="tour-card" role="dialog" aria-label="Walkthrough Grahantara">
          <small>LANGKAH {tourStep + 1} / {TOUR.length}</small>
          <h3>{TOUR[tourStep][1]}</h3>
          <p>{TOUR[tourStep][2]}</p>
          <div><button onClick={() => setTourStep(-1)}>Lewati</button><button className="primary-button" onClick={nextTour}>{tourStep === TOUR.length - 1 ? "Selesai" : "Lanjut →"}</button></div>
        </div>
      )}
    </div>
  );
}

function AreaDetail({ feature, thresholds, kos, showKos, onShowKos }) {
  const p = feature.properties;
  const entries = DIMENSIONS.map(([key, name]) => [key, name, Number(p.subskor?.[key] ?? 0)]);
  const strongest = [...entries].sort((a, b) => b[2] - a[2])[0];
  const weakest = [...entries].sort((a, b) => a[2] - b[2])[0];
  return <>
    <div className="detail-head"><div><small>HEKSAGON TERPILIH</small><code>{p.h3_index}</code></div><span className="quality-badge">{scoreLabel(p.skor_dinamis, thresholds)}</span></div>
    <div className="big-score"><b>{formatScore(p.skor_dinamis)}</b><span>/ 100<br />skor total</span></div>
    <div className="subscores">{entries.map(([key, name, value]) => <div key={key}><span>{name}<b>{formatScore(value)}</b></span><i><u style={{ width: `${value}%` }} /></i></div>)}</div>
    <p className="narrative">Kawasan ini paling unggul pada <b>{strongest[1]}</b> ({formatScore(strongest[2])}). Titik yang perlu diperhatikan adalah <b>{weakest[1]}</b> ({formatScore(weakest[2])}).</p>
    <button className="primary-button full" onClick={onShowKos}>{showKos ? `${kos.length} kos ditampilkan di peta` : "Lihat kos di kawasan ini →"}</button>
    {showKos && <div className="kos-list">{kos.length ? kos.map((item) => <div key={item.properties.id}><span><b>{item.properties.nama}</b><small>{item.properties.jarak_halte_m} m ke halte</small></span><strong>Rp{Number(item.properties.harga_median).toLocaleString("id-ID")}</strong></div>) : <p>Belum ada titik kos yang cocok persis dengan heksagon ini.</p>}</div>}
  </>;
}

function ComparePanel({ ranked, a, b, setA, setB, first, second }) {
  const options = ranked.slice(0, 120);
  const rows = [["Skor total", first?.skor_dinamis, second?.skor_dinamis], ...DIMENSIONS.map(([key, name]) => [name, first?.subskor?.[key], second?.subskor?.[key]])];
  const betterTransit = Number(first?.subskor?.connectivity) >= Number(second?.subskor?.connectivity) ? "Kawasan A" : "Kawasan B";
  const betterBudget = Number(first?.subskor?.affordability) >= Number(second?.subskor?.affordability) ? "Kawasan A" : "Kawasan B";
  return <>
    <div className="compare-selects">
      <label>KAWASAN A<select value={a} onChange={(e) => setA(Number(e.target.value))}>{options.map((f, i) => <option key={f.properties.h3_index} value={i}>{f.properties.h3_index} · {formatScore(f.properties.skor_dinamis)}</option>)}</select></label>
      <span>VS</span>
      <label>KAWASAN B<select value={b} onChange={(e) => setB(Number(e.target.value))}>{options.map((f, i) => <option key={f.properties.h3_index} value={i}>{f.properties.h3_index} · {formatScore(f.properties.skor_dinamis)}</option>)}</select></label>
    </div>
    <div className="compare-table-wrap"><table className="compare-table"><thead><tr><th>Metrik</th><th>Kawasan A</th><th>Kawasan B</th></tr></thead><tbody>{rows.map(([name, one, two]) => <tr key={name}><td>{name}</td><td className={Number(one) >= Number(two) ? "winner" : ""}>{formatScore(one)}</td><td className={Number(two) >= Number(one) ? "winner" : ""}>{formatScore(two)}</td></tr>)}</tbody></table></div>
    <div className="verdict"><small>RINGKASAN KEPUTUSAN</small><p><b>{betterTransit}</b> unggul untuk akses transit, sedangkan <b>{betterBudget}</b> lebih kuat untuk keterjangkauan. Pilih berdasarkan kebutuhan yang tidak bisa dikompromikan.</p></div>
  </>;
}

export default App;
