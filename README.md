# Grahantara

WebGIS penilaian kelayakan kawasan hunian mahasiswa di sabuk kampus Sleman, DIY.
Tim **cinajawabatak**. MAPID WebGIS Competition #2, 2026.

## Apa yang dibangun

Peta interaktif yang memberi skor 0–100 pada **2.134 heksagon H3 resolusi 9** di area
211,9 km² sekitar 10 kampus di Sleman. Skor menjawab satu pertanyaan: *seberapa layak
kawasan ini sebagai tempat kos, kalau kamu tidak punya motor?*

Tesis produknya: **keterhubungan transit, bukan kedekatan halte.** Halte 100 m dari kos
tidak berarti apa-apa kalau tidak ada rute yang membawamu ke kampusmu. Dari 1.105 kawasan
yang punya halte dalam jangkauan jalan kaki, hanya 65% terhubung langsung ke UGM, 20% ke
STIE YKPN, dan 18% ke AMIKOM. Itu perbedaan yang tidak bisa dijawab marketplace kos.

## Empat dimensi

| Dimensi | Bobot | Isi singkat |
|---|---|---|
| **Connectivity** | 0,40 | Jarak jaringan ke halte, jumlah rute, keterjangkauan kampus via graf rute, akses KRL |
| **Affordability** | 0,25 | Harga sewa kos, harga makan |
| **Amenity** | 0,20 | Kepadatan & keragaman tempat makan, keramaian, layanan harian |
| **Walkability** | 0,15 | Struktur jaringan, keteduhan, penerangan, banjir, tekanan lalu lintas, integritas trotoar |

Digabung dengan **rata-rata geometrik terbobot**:

```
Skor = 100 × (C+ε)^0,40 × (A+ε)^0,25 × (M+ε)^0,20 × (W+ε)^0,15     dengan ε = 0,01
```

Geometrik, bukan aritmetik, supaya kawasan yang sangat buruk di satu dimensi tidak bisa
ditutupi oleh dimensi lain. Bobot bisa digeser pengguna saat runtime.

Definisi lengkap tiap indikator ada di [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md).

## Struktur repo

```
grahantara/
├── contracts/
│   └── hexagon.schema.json     Kontrak data. SATU-SATUNYA file yang disentuh dua orang.
├── pipeline/                   [Dal] Analisis spasial Python -> GeoJSON
│   ├── 00_ingest/              Ambil data MAPID, OSM, GEE
│   ├── 10_clean/               Bersihkan hasil survei lapangan
│   ├── 20_network/             Graf OSMnx, Dijkstra, graf rute Trans Jogja
│   ├── 30_indicators/          Hitung C1-C4, A1-A2, M1-M4, W1-W6
│   ├── 40_score/               Normalisasi persentil + agregasi geometrik
│   ├── config/weights.yaml     Bobot default
│   └── tests/
├── data/                       .gitignore semua. Jangan commit data mentah.
│   ├── raw/  interim/  processed/
├── web/                        [Devon] React + Vite + MapLibre GL JS
│   ├── public/data/            GeoJSON beku. Pipeline menulis ke sini.
│   ├── src/
│   └── api/                    Serverless function, proxy ke LLM
├── docs/
└── notebooks/                  Eksplorasi. Bukan bagian pipeline.
```

## Pembagian kerja

Tim ini dua orang. Pembagiannya dijaga oleh satu artefak: `contracts/hexagon.schema.json`.

| | **Dal** (Data & AI Analyst) | **Devon** (WebGIS Developer) |
|---|---|---|
| Memiliki | `pipeline/`, `data/`, `contracts/` | `web/` |
| Tidak menyentuh | `web/src/` | `pipeline/` |
| Keluaran | GeoJSON sesuai schema | UI yang mengkonsumsi schema |

Aturannya sederhana: **kalau perubahanmu mengharuskan orang lain mengubah kodenya, itu
perubahan schema.** Bicarakan dulu, ubah `hexagon.schema.json`, baru kerjakan.

## Data di `web/public/data/` sudah ASLI (versi 1.0)

Sejak 2026-09-08 berkas di `web/public/data/` berisi **hasil pipeline sungguhan**,
bukan stub. Cek `metadata.versi` pada `hexagons.geojson`: `"1.0"` berarti asli,
`"stub-0.x"` berarti palsu.

| Berkas | Isi |
|---|---|
| `hexagons.geojson` | 2.134 heksagon, skor + 4 subskor + 16 indikator |
| `kampus.geojson` | 10 kampus dengan jumlah gerbang sebenarnya |
| `halte.geojson` | 566 halte dengan koridornya |
| `kos.geojson` | 31 kos survei dengan harga dan label presisi koordinat |
| `krl.geojson` | 12 stasiun |
| `c3_per_kampus.json` | keterjangkauan tiap kampus per heksagon |

Sebaran skor: minimum 14,4 · median 45,1 · maksimum 87,5.

**Yang perlu diketahui saat membaca peta:** 1.981 dari 2.134 heksagon tidak punya
data Affordability sama sekali, jadi dimensi itu dikeluarkan dari skornya dan
bobot dimensi sisanya dinormalisasi ulang. Lihat
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

## Mulai dari mana

**Devon** → baca [`web/CLAUDE.md`](web/CLAUDE.md), lalu
[`docs/FRONTEND_TASKS.md`](docs/FRONTEND_TASKS.md).

**Dal** → `pipeline/20_network/` duluan. Connectivity berbobot 0,40 dan tidak bergantung
sama sekali pada data survei, jadi itu jalur kritis dan sudah bisa dikerjakan sekarang.

## Tenggat

Submission: peta interaktif publik di subdomain MAPID + halaman metodologi + video demo.
Lihat [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) untuk rencana deployment.
