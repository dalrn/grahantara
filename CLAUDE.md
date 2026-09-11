# Konteks untuk asisten AI

Grahantara — WebGIS penilai kelayakan kawasan hunian kos mahasiswa di sabuk kampus
Sleman, DIY. Lomba/kompetisi MAPID, tim `cinajawabatak`.

Repo ini punya dua pemilik dengan wilayah terpisah. Sebelum mengubah apa pun, pastikan
kamu tahu sedang bekerja di wilayah siapa.

| Pemilik | Wilayah | Isi |
|---|---|---|
| **Dal** | `pipeline/`, `data/`, `reference/`, `contracts/`, `docs/` | analisis spasial offline |
| **Devon** | `web/` | frontend, serverless function, halaman metodologi |

Jembatan antara keduanya adalah **berkas**, bukan API: `web/public/data/*.geojson`,
dengan `contracts/hexagon.schema.json` sebagai kontraknya. Itulah sebabnya keduanya
bisa bekerja paralel tanpa saling menunggu.

## Aturan keras

1. **Jangan pernah mengedit `pipeline/` kalau kamu sedang membantu Devon.**
   Jangan pernah mengedit `web/src/` kalau kamu sedang membantu Dal.
2. **`contracts/hexagon.schema.json` tidak diubah sepihak.** Kalau kode butuh field yang
   belum ada di schema, jangan menambahkannya sendiri — hentikan dan beri tahu pengguna
   bahwa ini perubahan kontrak yang perlu disepakati dua orang.
3. **Jangan commit apa pun di `data/`.** Sudah ada di `.gitignore`. Data mentah survei dan
   dump MAPID tidak masuk git. **Perkecualian yang sudah diputuskan:** masukan hasil
   kurasi tangan yang *tidak bisa diunduh ulang* hidup di `reference/` dan **dilacak
   git** — enam layer MAPID, berkas gerbang kampus, `hex_index.txt`, `study_area.geojson`,
   dan `Hasil_Survei_BERSIH.xlsx`. Lihat `reference/README.md`.
4. **Jangan menaruh API key di kode klien.** Kunci LLM (`DEEPSEEK_API_KEY`) hidup sebagai
   environment variable di serverless function (`web/api/`), **tanpa awalan `VITE_`** —
   awalan itu menyisipkan variabel ke bundel browser. Kunci basemap MAPID
   (`VITE_MAPID_BASEMAP_KEY`) boleh publik terbatas.
5. **Data di `web/public/data/` sudah asli sejak 2026-09-08 (`versi: "1.0"`).**
   Tetap cek `metadata.versi` sebelum menyimpulkan apa pun — `"stub-0.x"` berarti
   palsu. Jangan "memperbaiki" skor yang terlihat aneh tanpa menelusuri sumbernya:
   1.981 dari 2.134 heksagon memang kehilangan dimensi Affordability, dan itu disengaja.
6. **`reference/hex_index.txt` beku.** Jangan dibangkitkan ulang. `h3_index` adalah kunci
   join dengan frontend; himpunan sel yang sedikit berbeda memutus join tanpa error.

## Bahasa

- Teks yang dilihat pengguna akhir: **Bahasa Indonesia.**
- Nama variabel, field, dan komentar kode: **Inggris** — kecuali di `web/`, yang secara
  konsisten memakai penamaan Indonesia (`bobot`, `skor`, `heksagon`, `lapisan`,
  `panggilDeepseek`). Ikuti gaya berkas yang sedang kamu sunting, jangan mencampur.
- Nama field di dalam GeoJSON mengikuti schema apa adanya (campuran, sudah ditetapkan).
- Docstring dan komentar di `pipeline/` berbahasa Inggris dan **panjang secara sengaja**:
  isinya alasan keputusan, termasuk jebakan pemodelan yang pernah ditabrak. Baca sebelum
  mengubah, dan pertahankan gayanya.

## Yang perlu diketahui soal domainnya

- Unit analisis adalah **heksagon H3 resolusi 9** (~0,105 km², lebar ~380 m). Ada 2.134,
  menutup 213,19 km².
- Kata "kawasan" ambigu di dokumen tim: kadang berarti heksagon, kadang berarti 12 area
  sampel survei (KWS-01 … KWS-12) yang jauh lebih besar. Di kode, selalu pakai `hexagon`
  untuk unit skor dan `survey_area` untuk area sampel. (Di teks UI, "kawasan" berarti
  heksagon.)
- Skor dinormalisasi sebagai **peringkat persentil (ECDF) terhadap seluruh wilayah
  studi**, bukan nilai absolut. Skor 70 berarti "lebih baik dari 70% kawasan lain",
  bukan "70 dari 100". Sebaran nyata: min **14,4** · median **45,1** · maks **87,5**.
- Survei lapangan hanya menyentuh 12 area dari 2.134 heksagon (84 ruas, 12 halte,
  12 titik ekonomi, 31 kos). Sebagian besar indikator bersumber survei **kosong di hampir
  semua heksagon**. Itu bukan bug. Lihat kebijakan data hilang di bawah.

### Empat dimensi dan 16 indikator

```
subskor = Σ (bobot_indikator × persentil_indikator)   ← dinormalisasi ulang bila ada yang hilang
Skor    = 100 × Π (subskor_d/100 + ε)^bobot_d          ε = 0,01, di-clamp ke [0,100]
```

**Rata-rata geometrik, bukan aritmetik** — satu dimensi mendekati nol menyeret total ke
bawah. Itu perilaku yang benar: kos dengan warung melimpah tapi tanpa akses transit
tetap salah pilihan bagi mahasiswa tanpa motor.

| Dimensi | Bobot | Indikator (bobot di dalam dimensi) |
|---|---|---|
| Connectivity | 0,40 | C1 jarak halte 0,30 · C2 rute unik 0,20 · **C3 keterjangkauan kampus 0,40** · C4 jarak KRL 0,10 |
| Affordability | 0,25 | A1 harga kos 0,60 · A2 harga makan 0,40 |
| Amenity | 0,20 | M1 kepadatan makan 0,35 · M2 keragaman 0,20 · M3 keramaian 0,20 · M4 layanan harian 0,25 |
| Walkability | 0,15 | W1 simpang 0,15 · W2 keteduhan 0,20 · W3 penerangan 0,15 · W4 banjir 0,15 · W5 lalin 0,15 · W6 integritas 0,20 |

Bobot dimensi bisa digeser pengguna saat runtime. Bobot antar-indikator **tetap**.
Sumber tunggal angka-angka ini: `pipeline/config/weights.yaml`.

**C3 adalah tesis produk ini.** Halte 100 m dari kos tidak berarti apa-apa kalau tidak ada
koridor yang membawamu ke kampusmu. Simpul grafnya adalah pasangan **(halte, koridor)**,
bukan halte — 295 dari 589 halte dilayani lebih dari satu koridor, dan memakai halte
sebagai simpul menyatukan 20 koridor jadi satu gumpalan sehingga semua kampus tampak
terjangkau langsung. Jebakan itu pernah ditabrak dan tercatat di
`pipeline/20_network/04_c3.py`. **Sanata Dharma III 0% terhubung adalah temuan,
bukan cacat.**

### Cakupan nyata tiap indikator (versi 1.0, terverifikasi)

| Indikator | Punya nilai | Sumber |
|---|---|---|
| C1, C2, C3, C4 | 2.134 (100%) | `osm` |
| **A1 harga kos** | **153 (7,2%)** | `survei` — **tidak dimodelkan**, lihat bawah |
| **A2 harga makan** | **0** | `tidak_tersedia` — Menu Go hanya punya 1 record |
| M1, M4 | 2.134 (100%) | `mapid_poi` |
| M2 keragaman | 1.594 (74,7%) | `mapid_poi` — 540 heksagon tanpa tempat makan sama sekali |
| **M3 keramaian** | **0** | `tidak_tersedia` — survei 12 titik terlalu jarang |
| W1 | 2.134 | `osm` |
| W2 keteduhan | 2.099 | `sentinel2` |
| W3 penerangan | 1.775 | `mapid` — nighttime light 2023 |
| **W4 banjir** | **301 (14,1%)** | `mapid` — bahaya banjir |
| W5 tekanan lalin | 2.095 | `osm`, dikalibrasi survei |
| W6 integritas jalur | 2.095 | **`model`**, dilatih survei |

**A1 tidak dimodelkan, dan itu keputusan berdasar bukti, bukan kemalasan.** Validasi
silang leave-one-out atas 29–30 label harga: Ridge R² **−0,386**, RandomForest
R² **−0,152** — keduanya **lebih buruk daripada menebak rata-rata**. Sebabnya struktural:
45% ragam harga terjadi antar-kos di jalan yang sama (ukuran kamar, kamar mandi dalam,
usia bangunan — tidak satu pun spasial). **W6 dimodelkan** karena diuji dengan cara yang
sama ia memberi R² **+0,394**: ketersediaan trotoar memang fungsi hierarki jalan. Jangan
mengusulkan memodelkan A1 tanpa membaca `pipeline/30_indicators/06_a1_harga_kos.py`.

## Kebijakan data hilang (penting)

Setiap indikator punya field `sumber` yang menyatakan asal nilainya:

| `sumber` | Arti | Perlakuan di UI |
|---|---|---|
| `survei` | Diukur langsung di lapangan | Tampilkan biasa |
| `mapid_poi` (POI titik), `mapid` (poligon non-POI), `osm`, `sentinel2`, `krl` | Data sekunder | Tampilkan biasa |
| `viirs`, `inarisk` | **Usang.** Hanya ada di berkas lama; W3/W4 memakai `mapid` sejak 2026-09-11 | Tampilkan biasa |
| `model` | **Ditaksir** dari data sekunder, dilatih pada survei | Tampilkan dengan penanda "estimasi" |
| `tidak_tersedia` | Tidak ada data | Tampilkan sebagai "tidak tersedia", **bukan nol** |

Aturannya berlaku **dua tingkat**:

1. **Indikator hilang** → dikeluarkan dari subskor, bobot indikator sisanya di dalam
   dimensi itu dinormalisasi ulang.
2. **Dimensi hilang seluruhnya** → dikeluarkan dari rata-rata geometrik, bobot dimensi
   sisanya dinormalisasi ulang. Dimensi itu didaftar di **`properties.dimensi_kosong`**
   dan ditulis `0` pada `subskor` **hanya demi kesesuaian skema**.

Tidak ada imputasi netral 0,5. Jangan pernah merender `null` sebagai `0` — itu memberi
kesan kawasan tersebut buruk, padahal yang benar adalah kita tidak tahu.

> **Siapa pun yang menghitung ulang skor WAJIB membaca `properties.dimensi_kosong`.**
> 1.981 dari 2.134 heksagon tidak punya Affordability. Mengabaikan field ini membuat
> angka meleset sampai **59 poin** — heksagon tipikal jatuh dari 46,9 ke 17,9, menghukum
> 93% peta karena **ketiadaan data**, bukan karena kawasannya mahal. Untuk heksagon
> tanpa Affordability, bobot efektifnya jadi C 0,533 · M 0,267 · W 0,200.

Ini ditegakkan di dua tempat yang harus tetap sepakat:
`pipeline/common/indicators.py` (`subskor`, `skor_akhir`) dan
`web/src/lib/mesinSkor.js` (`siapkanMesin`, `hitungSemua`).

---

# Peta repo

```
contracts/hexagon.schema.json   kontrak data, tidak diubah sepihak
pipeline/                       analisis spasial offline (Dal)
  common/                       paths · geo · cache · indicators  ← impor dari sini
  config/weights.yaml           SUMBER TUNGGAL semua bobot
  00_ingest → 40_score          lima tahap, dijalankan run_all.py
  tests/                        26 uji logika + skema + 20 uji invarian
reference/                      masukan kurasi tangan, DILACAK git
data/                           mentah/antara/hasil — .gitignore, jangan commit
docs/                           metodologi, kamus data, catatan keputusan
web/                            React + Vite + MapLibre + Vercel (Devon)
  api/                          serverless function, tempat kunci LLM
  public/data/                  keluaran pipeline yang disajikan, DILACAK git
  src/lib/                      logika murni: mesinSkor, kelas, rute, kamus
  src/components/               PetaHeksagon + panel
```

## pipeline/ — lima tahap

| Tahap | Isi | Keluaran |
|---|---|---|
| `00_ingest/` | graf jalan kaki OSM, halte/rute/stasiun, Activities MAPID | graf + parquet |
| `10_clean/` | baca survei Excel, geokode kos dari nama jalan | 4 tabel survei |
| `20_network/` | snap ke graf, rute jalan kaki | C1, C2, C3, C4, W1 |
| `30_indicators/` | POI, raster, model | M1, M2, M4, A1, W2–W6 |
| `40_score/` | persentil, agregasi, lapisan titik | `hexagons.geojson` dll. |

Tiap langkah **cache sendiri** ke `data/interim/` dan melewati dirinya kalau keluarannya
sudah ada, kecuali `--force`.

```bash
pip install -r pipeline/requirements.txt
python pipeline/run_all.py            # lewati langkah yang sudah jadi
python pipeline/run_all.py --force    # bangun ulang semua (~15-25 menit)
python pipeline/run_all.py --from 30  # mulai dari tahap indikator
python pipeline/run_all.py --dry-run  # lihat daftar langkah saja
```

Setelah hasilnya diperiksa, salin ke frontend (`run_all.py` mencetak perintah ini):

```bash
cp data/processed/{hexagons,kampus,halte,kos,krl}.geojson \
   data/processed/c3_per_kampus.json web/public/data/
```

### Aturan tetap pipeline

- Semua jarak dihitung di **EPSG:32749 (UTM 49S)**, tidak pernah di 4326.
- Graf diunduh dengan **buffer 2 km** di luar batas studi, supaya heksagon tepi tidak
  tampak tak terjangkau hanya karena grafnya terpotong.
- Impor konstanta dari `pipeline/common/`, jangan definisikan ulang per tahap.
  `indikator()` **menolak** rekaman yang melanggar aturan data hilang, jadi pelanggaran
  gagal saat dibuat, bukan diam-diam masuk ke peta.
- Nama properti pada lapisan titik **mengikuti yang dibaca `PetaHeksagon.jsx`**.
  Mengubahnya memutus popup di peta.

### Uji

```bash
python pipeline/tests/test_indicators.py            # 26 uji logika skoring
python pipeline/tests/validate_schema.py <geojson>  # kesesuaian skema
python pipeline/tests/test_keluaran.py [geojson]    # 20 uji invarian isi
```

`run_all.py` menjalankan ketiganya di akhir. `test_keluaran.py` memeriksa hal yang
**lolos skema tapi tetap salah**: himpunan heksagon yang bergeser dari indeks beku, skor
yang tidak cocok dengan subskornya sendiri, `tidak_tersedia` yang bocor jadi angka, atau
geometri di luar wilayah studi.

## web/ — frontend

React 19 + Vite + MapLibre GL JS + Tailwind + Framer Motion, di-deploy ke Vercel.
Bukan Leaflet, bukan Mapbox GL (berbayar). Basemap dari MAPID MAPS lewat style API.

```bash
cd web && npm install
npm run dev -- --host 127.0.0.1 --port 5178   # port yang dipakai uji UI
npm run build      # bundel produksi
npm run lint       # oxlint
npm run test:ui    # Playwright; butuh dev server di 5178
npm run test:ui:edge
```

`vite.config.js` memasang middleware yang **menjalankan handler `api/` yang sama** saat
dev, jadi tidak ada tiruan endpoint terpisah. Tanpa `DEEPSEEK_API_KEY`, handler memakai
fallback bawaan dan UI memberi label "tanpa AI".

### Berkas data yang disajikan (`web/public/data/`, dilacak git)

| Berkas | Isi | Ukuran | Dibaca oleh |
|---|---|---|---|
| `hexagons.geojson` | 2.134 poligon, skor + 4 subskor + 16 indikator + `metadata` | ~3,9 MB | `PetaHeksagon`, `Metodologi` |
| `metadata.json` | salinan blok `metadata` saja | ~0,5 KB | `Beranda` (agar beranda tak mengunduh 3,9 MB) |
| `kampus.geojson` | 10 titik kampus + `jumlah_gerbang` | kecil | lapisan `kampus` |
| `kampus_gerbang.geojson` | 103 gerbang bernama, tujuan rute | 26 KB | lapisan `gerbang` |
| `halte.geojson` | 566 halte + daftar `koridor` | 93 KB | lapisan `halte`, `PanelRute` |
| `kos.geojson` | 31 kos survei + harga + `presisi_koordinat` | 10 KB | lapisan `kos` |
| `krl.geojson` | 12 stasiun KRL | kecil | lapisan `krl` |
| `c3_per_kampus.json` | keterjangkauan tiap kampus per heksagon | 465 KB | **belum dipakai UI** |

### Hal yang mudah salah di frontend

**Urutan koordinat.** GeoJSON memakai `[lon, lat]`. MapLibre juga. Tapi H3 memakai
`(lat, lng)`. Kalau peta muncul di Somalia, ini penyebabnya.

**Jangan render `null` sebagai `0`.** Indikator `tidak_tersedia` punya `nilai: null` dan
`persentil: null`. Itu artinya kita tidak tahu. Ini salah satu kriteria penerimaan produk,
bukan detail kosmetik.

**Tandai `sumber: "model"` sebagai estimasi.** Menampilkannya tanpa label terbaca sebagai
klaim palsu.

**Performa slider.** `mesinSkor.js` menyimpan `Math.log(subskor/100 + ε)` untuk keempat
dimensi sekali di awal ke `Float64Array`; tiap perubahan bobot hanya butuh satu perkalian
dan satu `Math.exp` per heksagon. `App.jsx` men-debounce 120 ms di atas itu.

**Jangan pakai satu komponen React per heksagon.** Satu source, satu fill layer, satu line
layer. Seleksi lewat `feature-state`, bukan menulis ulang source. Hal yang sama berlaku
untuk 31 pin kos: satu symbol layer, StyleImage canvas yang membaca feature-state (karena
MapLibre 4 tidak mendukung feature-state pada `icon-image`/`icon-size`).

**Indikator tidak diserahkan ke MapLibre.** 16 indikator × 2.134 heksagon (~3,3 MB) hanya
dipakai panel detail untuk satu heksagon. `PetaHeksagon` melepasnya dari properti source
dan menyimpannya di `Map` terpisah supaya MapLibre tidak menyalin dan menyerikannya.

**MapLibre menyerikan array/objek bersarang jadi string JSON.** `dimensi_kosong` bisa
sampai ke komponen sebagai string; `PanelKawasan`/`PanelBanding` punya `daftarKosong()`
untuk memulihkannya. Jangan asumsikan selalu array.

**`h3_index` adalah kunci utama.** Stabil antar versi data. Pakai itu untuk join dan
menyimpan pilihan pengguna, jangan indeks array — urutan feature bisa berubah. Untuk
identitas **pin kos** pakai `properties.id` (dua kos bisa berada di heksagon yang sama).

**Kelas warna memakai kuintil dari skor terkini**, bukan ambang tetap 0-20-40-…, karena
skor nyata hanya membentang 14,4–87,5 dan ambang tetap membuang dua dari lima kelas.

### Serverless function (`web/api/`)

Semua memanggil DeepSeek (`deepseek-chat`) lewat `_klienLLM.js`. Berkas berawalan `_`
tidak diperlakukan Vercel sebagai endpoint.

| Endpoint | Fungsi | Input | Output |
|---|---|---|---|
| `POST /api/parse-preference` | AI-1 penerjemah kebutuhan | `{ teks }` | `{ kampus, anggaran, bobot, ringkas }` |
| `POST /api/explain-score` | AI-2 penjelas skor | `{ h3_index, skor, subskor, dimensiKosong, bobot, indikator }` | `{ kekuatan[2], kelemahan[1], ringkas }` |
| `POST /api/compare` | AI-4 pembanding kawasan | `{ bobot, a, b }` | `{ unggulA, unggulB, simpulan, cocokUntuk }` |
| `GET /api/route` | proksi OSRM (bukan LLM) | `?profil&dari&ke` | `{ geometri, meter }` |
| `GET /api/health` | cek kunci terbaca | — | `{ status, kunciDeepseekTerbaca }` |

Aturan yang membuat keluaran AI bisa diverifikasi, dan **tidak boleh dilonggarkan**:

- **LLM tidak pernah menerima data mentah dan tidak pernah diminta menghitung.** Inputnya
  selalu angka yang sudah jadi.
- **Arah perbandingan dihitung server** di `compare.js` (`arahBanding`) dan diberikan ke
  model sebagai `-> …, unggul: …`; prompt menyuruh menyalinnya apa adanya. Ini mencegah
  model salah menyimpulkan polaritas (jarak dan harga: kecil = lebih baik).
- Prompt melarang menyebut indikator `tidak_tersedia` sebagai kekuatan/kelemahan,
  mengarang angka, menyebut nama tempat, dan memberi saran finansial.
- Semua endpoint membalas **JSON saja**; `parseJsonLonggar()` membersihkan pagar markdown,
  dan setiap endpoint punya **fallback deterministik** kalau LLM gagal atau bentuknya
  salah. Halaman tidak boleh rusak karena LLM mengarang format.
- `/api/route` menolak koordinat di luar kotak wilayah studi supaya tidak jadi proksi
  routing umum.

### Environment variable

```
# web/.env (frontend)
VITE_MAPID_BASEMAP_KEY=   # boleh sampai ke klien, publik terbatas
VITE_BASEMAP_STYLE_URL=   # opsional, MENGGANTIKAN basemap MAPID; berguna tanpa kunci
DEEPSEEK_API_KEY=         # HANYA sisi server. JANGAN diberi awalan VITE_.

# .env di akar (pipeline)
MAPID_API_KEY_MISSION=    # Activities API
MAPID_API_KEY_DATA=       # Open API layer geoserver
MAPID_PROJECT_ID=
EE_PROJECT=               # Google Earth Engine, untuk W2
```

Kunci pipeline dan kunci frontend **sengaja dipisah di dua berkas**. Isi `.env`, jangan
pernah `.env.example` — yang terakhir dilacak git dan harus tetap kosong.

---

## Hal yang sudah diketahui tidak konsisten

Jangan "memperbaiki" ini diam-diam; sebagian butuh keputusan pemilik repo.

- **`kampus_gerbang.geojson` dibuat dari berkas yang sudah digantikan.**
  `web/scripts/buat_gerbang_geojson.py` membaca `reference/kampus_gerbang_103.geojson`,
  padahal `reference/README.md` menandainya SUPERSEDED dan melarang membacanya; yang
  kanonik adalah `kampus_gerbang_10.geojson` (219 gerbang, dipakai C3). Akibatnya lapisan
  gerbang menampilkan 103 titik sementara `kampus.geojson` melaporkan 219.
  **Belum diputuskan** — ini wilayah Devon dan mengubah apa yang dilihat pengguna.
- **`c3_per_kampus.json` (465 KB) disajikan tapi belum dibaca frontend.** C3 saat ini
  hanya tampil sebagai nilai gabungan di `hexagons.geojson`.
- **MapLibre GL 4.7.1 punya advisory GHSA-jrc7-96c5-q579** (XSS sanitizer). Nilai popup
  sudah di-escape (`escapeHTML` di `PetaHeksagon.jsx`), tetapi itu bukan pengganti
  pembaruan library. Peningkatan ke 6.x belum diuji.

## Dokumen rujukan

| Berkas | Isi |
|---|---|
| `docs/METHODOLOGY.md` | Ringkasan untuk pembaca luar: rumus, cakupan, batasan |
| `docs/DATA_DICTIONARY.md` | Definisi presisi 16 indikator + komponen W6 |
| `docs/ARCHITECTURE.md` | Dua fase (offline/runtime), empat fungsi AI, deployment |
| `docs/PIPELINE_LOG.md` | Catatan keputusan per fase, **termasuk yang salah lalu diperbaiki** |
| `docs/SURVEI_ANOMALI.md` | Anomali data survei dan penanganannya |
| `docs/MAPID_UNDUH.md` / `MAPID_PENGGUNAAN.md` | Layer mana diunduh, mana tumpang tindih |
| `docs/FRONTEND_TASKS.md` | Rencana kerja frontend bertahap |
| `docs/PANDUAN_UJI_PENGGUNA.md` | Skrip uji coba pengguna |
| `reference/README.md` | Asal-usul tiap masukan kurasi tangan |
| `web/UI_UX_NOTES.md` | Catatan serah-terima UI: palet, tipografi, pin, hasil uji |

Kalau kamu mengubah keputusan metodologis, **catat alasannya di `docs/PIPELINE_LOG.md`**
dengan angkanya. Itu polanya di repo ini: kode bisa dibaca sendiri, alasan tidak.
