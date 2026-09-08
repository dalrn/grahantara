# Catatan Kerja Pipeline

Catatan berjalan untuk sisi Dal (`pipeline/`, `data/`, `contracts/`, `reference/`).
Satu bagian per fase. Isinya **keputusan dan alasannya**, bukan ringkasan kode —
kode bisa dibaca sendiri, alasan tidak.

Format tiap fase: apa yang dikerjakan, keputusan yang diambil beserta alasannya,
temuan yang mengubah rencana, dan apa yang masih terbuka.

---

## Fase 0 — Fondasi repo (2026-09-08) — SELESAI

Menyiapkan hal-hal yang harus benar sebelum sebaris kode analisis ditulis.
Tidak ada indikator yang dihitung di fase ini.

### Yang dikerjakan

| Berkas | Isi |
|---|---|
| `reference/kampus_gerbang_10.geojson` | 219 gerbang, 10 kampus. Kanonik untuk C3. |
| `reference/kampus_gerbang_103.geojson` | Draf lama 16 Juli. Arsip, jangan dibaca. |
| `reference/hex_index.txt` | 2.134 indeks H3 res 9, beku, terurut. |
| `reference/study_area.geojson` | Batas wilayah studi, 213,19 km². |
| `reference/README.md` | Asal-usul tiap berkas di atas. |
| `pipeline/common/` | Modul bersama: `paths`, `geo`, `indicators`. |
| `pipeline/requirements.txt` | 16 dependensi, versi terverifikasi. |

### Keputusan

**1. Berkas gerbang dipindah dari `data/` ke `reference/` baru.**

Keduanya sebelumnya berada di `data/` dan tidak terlacak git. Ternyata `.gitignore`
hanya menutup `data/raw/`, `data/interim/`, `data/processed/` — bukan akar `data/` —
jadi berkas itu sebenarnya *bisa* di-commit, hanya belum pernah.

Ini berbahaya. Kedua berkas adalah **masukan pipeline hasil kurasi tangan**, bukan
data mentah survei. Kalau hilang, C3 tidak bisa dihitung ulang oleh siapa pun.
Aturan 3 CLAUDE.md melarang commit `data/` justru karena isinya dump mentah; berkas
gerbang bukan itu. Maka dibuat direktori `reference/` yang eksplisit dilacak git.

**2. `kampus_gerbang_10.geojson` yang dipakai, bukan yang 103.**

Bukti: 219 fitur (cocok dengan angka di kamus data), 10 kampus (cocok dengan README),
tanggal lebih baru. Seluruh 101 node unik berkas 103 adalah himpunan bagian dari
berkas 219 — jadi ini perluasan cakupan, bukan versi berbeda. Berkas 103 tidak punya
UIN Sunan Kalijaga sama sekali dan cakupannya jauh lebih tipis di kampus besar.

**3. Duplikat `osm_node` dibiarkan — itu benar, bukan galat.**

Node `12317733863` dan `12335959201` muncul dua kali, sekali sebagai UGM sekali
sebagai UNY. Keduanya gerbang di batas bersama UGM–UNY dan memang melayani dua
kampus. Dedup harus pakai `(osm_node, kampus)`. Dedup pada `osm_node` saja akan
menghapus akses sah satu kampus.

**4. Himpunan heksagon DIBEKUKAN, tidak dibangkitkan ulang.**

`hex_index.txt` diturunkan sekali dari stub `hexagons.geojson`, lalu tidak pernah
disentuh lagi. Alasannya: `h3_index` adalah kunci join dengan frontend. Membangkitkan
ulang dari poligon batas berisiko menghasilkan himpunan sel yang sedikit berbeda
(sel tepi masuk/keluar tergantung aturan cakupan), dan itu akan memutus join di
`web/` tanpa error yang terlihat — peta hanya akan bolong.

Sudah diverifikasi: 2.134 sel unik, semuanya valid, semuanya res 9, dan membentuk
**satu komponen terhubung**. Dissolve-nya menghasilkan satu Polygon tunggal tanpa
lubang, yang menguatkan bahwa himpunan ini memang wilayah utuh.

**5. Semua jarak dihitung di EPSG:32749 (UTM 49S).**

Ditegakkan lewat `common/geo.py`. Menghitung jarak dalam derajat di lintang ini
salah cukup besar untuk mengubah urutan peringkat heksagon — dan karena seluruh
skor adalah peringkat persentil, kesalahan urutan adalah kesalahan skor.

**6. Kebijakan data hilang ditanam di kode, bukan di konvensi.**

`common/indicators.py` menolak membuat rekaman indikator yang melanggar kontrak:
`tidak_tersedia` wajib bernilai `null` pada `nilai` dan `persentil`, sumber lain
wajib punya persentil 0–1. Ini menutup mode kegagalan paling berbahaya di proyek
ini — menulis `0` untuk "tidak tahu", yang membuat kawasan tampak buruk padahal
kita hanya tidak punya datanya.

`subskor()` melakukan normalisasi ulang bobot di dalam dimensi saat ada indikator
`tidak_tersedia`. Ini penting karena survei hanya menyentuh 12 dari 2.134 heksagon,
jadi M3, A2, dan sebagian W6 akan kosong di hampir seluruh wilayah.

### Temuan yang mengubah rencana

**Devon jauh lebih maju dari dugaan.** Cabang `feat/frontend-tahap1` berisi 11
commit yang belum tergabung, menembus Tahap 7A: slider bobot, mesin skor sisi klien,
panel kawasan, halaman metodologi, plus tiga fungsi serverless (AI-1, AI-2, AI-4).
Sudah digabung ke `main` (commit `82e1855`) — hanya menyentuh `web/`, nol konflik
dengan wilayah pipeline.

**Daftar kampus frontend tidak cocok dengan data gerbang.** Frontend memuat
"Universitas Respati", data gerbang memuat "UIN Sunan Kalijaga". Keduanya 10 nama,
jadi ada satu yang tertukar. Dikonfirmasi pemilik repo: **UIN Sunan Kalijaga yang
benar**. Diperbaiki di `web/src/kampus.js` dan `web/api/_daftarKampus.js`
(commit `44529a1`, atas izin eksplisit pemilik repo — normalnya aturan 1 melarang).

Konsekuensi yang belum ditutup: `kampus.geojson` dan `halte.geojson` masih memuat
nama lama, jadi untuk sementara UI punya entri dropdown tanpa data pasangan.
Kedua berkas itu stub dan akan ditimpa pipeline di Fase 5.

**Mesin skor Devon membaca `subskor`, bukan indikator.** `web/src/lib/mesinSkor.js`
menghitung `log(subskor/100 + ε)` per dimensi lalu menggabung ulang saat slider
digeser. Artinya **keempat nilai `subskor` adalah permukaan kontrak yang hidup** —
normalisasi ulang bobot akibat `tidak_tersedia` harus sudah matang di dalam
`subskor` yang ditulis pipeline, karena klien tidak pernah melihat bobot indikator.

Sudah diuji silang: implementasi Python `skor_akhir()` dan JS `mesinSkor.js`
menghasilkan angka yang sama pada data stub (20,4 vs 20,41 — beda pembulatan saja).

**`config.js` Devon menandai `metadata.bobot_default` sebagai ASUMSI.** GeoJSON
stub tidak memuatnya, jadi dia menghardcode bobot dari dokumen. Keluaran Fase 5
harus menyediakan `metadata.bobot_default` agar asumsi itu hilang.

### Uji yang sudah dijalankan

- `ecdf_percentile` menangani seri berisi NaN tanpa memberi persentil pada yang kosong.
- `subskor` dengan satu indikator `tidak_tersedia` menormalisasi ulang dengan benar
  (68,57 pada kasus uji, cocok hitung tangan).
- `subskor` yang seluruh indikatornya hilang mengembalikan 0,0, bukan nilai tengah.
- `skor_akhir` pada satu dimensi nol memberi **15,47** meski tiga dimensi lain 95 —
  perilaku geometrik yang memang dituntut spesifikasi.
- `pipeline.common` terimpor bersih, CRS metrik benar EPSG:32749.

### Masih terbuka

- **C3 per kampus belum punya rumah.** Skema hanya menyimpan satu
  `C3_keterjangkauan_kampus`, padahal AI-1 membiarkan pengguna memilih kampus dan
  frontend menghitung ulang di klien. Rencana: berkas pendamping
  `c3_per_kampus.json` berkunci `h3_index`, supaya GeoJSON 2.134 fitur tidak
  membengkak 10 field per heksagon dan mesin skor Devon tidak perlu berubah.
  Diputuskan saat Fase 3 selesai, ketika bentuk datanya sudah pasti.
- **`sumber: "krl"`** ada di enum skema tapi kamus data menugaskan C4 ke `osm`.
  Perlu disepakati C4 memancarkan yang mana. Tidak mendesak.

---

## Catatan kredensial (2026-09-08)

### Berkas mana yang diisi

Kunci **wajib** masuk ke `.env` (di-.gitignore). **Bukan** `.env.example`, yang
dilacak git dan akan terdorong ke GitHub.

Pernah salah sekali: kedua kunci sempat diketik ke `.env.example`. Belum sempat
ter-commit, jadi tidak ada kebocoran. Nilai sudah dipindah ke `.env` dan templat
dikosongkan kembali. `EE_PROJECT=` ditambahkan ke templat sebagai placeholder.

| Kunci | Berkas | Dipakai untuk |
|---|---|---|
| `MAPID_API_KEY_MISSION` | `.env` (akar) | Activities API — lapisan bukti foto |
| `EE_PROJECT` | `.env` (akar) | Google Earth Engine — W2 NDVI, W3 VIIRS |
| `VITE_MAPID_BASEMAP_KEY` | `web/.env` | basemap, wilayah Devon |
| `DEEPSEEK_API_KEY` | `web/.env` | AI-1/2/4, wilayah Devon |

### Status verifikasi

- **GEE — OK.** Kredensial sudah ada sejak 14 Juli, `earthengine authenticate`
  tidak perlu diulang. `ee.Initialize(project=EE_PROJECT)` berhasil dan panggilan
  nyata ke server Google berhasil.
- **MAPID Mission — OK.** HTTP 200, mengembalikan **158 aktivitas**.

### Bentuk request Activities API yang benar

Dua jebakan, keduanya sudah kena sekali:

1. **`feature` harus geometry Polygon telanjang**, bukan pembungkus Feature.
   Mengirim Feature menghasilkan HTTP 400 dengan pesan yang menyesatkan
   ("must be a GeoJSON Polygon, not another type (e.g. MultiPolygon)") padahal
   geometrinya memang Polygon — yang salah adalah pembungkusnya.
2. **Respons bersarang di `data.activities`**, bukan array di akar. Menghitung
   `len(data)` memberi 1, bukan jumlah aktivitas.

Contoh body yang bekerja:

```python
{"feature": <geometry Polygon>, "start_date": "2026-01-01",
 "end_date": "2026-12-31", "hashtag": ["cinajawabatak"]}
```

Field per aktivitas: `_id`, `title`, `description`, `geometry`, `medias`,
`created_at`, `likes`, `total_comment`, `user_name`, `user_full_name`,
`community_name`, `community_description`, `community_picture`,
`user_profile_picture`.

Tidak ada field numerik terstruktur — sesuai ARCHITECTURE.md, Activities adalah
**lapisan bukti** (foto, provenance untuk narasi AI-2), bukan sumber angka.

**Selisih 160 vs 158 — SELESAI, bukan masalah.** Dokumen benar: dengan kotak
pencarian yang lebih luas (lon 110,25–110,50 / lat −7,90–−7,65) API mengembalikan
**160** dan `meta.total` juga 160. Dengan poligon wilayah studi yang ketat
(213 km²) hasilnya **158**.

Dua aktivitas selisihnya memang berada **di luar wilayah studi**, sekitar
200–300 m di sebelah barat batas (batas barat lon 110,3341):

| Aktivitas | Koordinat |
|---|---|
| Kost Putri Mulia Sari | 110,33683 · −7,76749 |
| Potret Suasana Jalan Mojo, Area Ringroad Barat Yogya | 110,33654 · −7,76733 |

Tanggal tidak berpengaruh — rentang sempit (25 Jul–3 Sep 2026) dan rentang setahun
penuh sama-sama memberi 160 pada kotak yang sama.

**Keputusan: pakai 158.** Keduanya di luar area yang diberi skor, jadi menariknya
masuk berarti menempelkan bukti foto ke heksagon yang tidak ada. Activities adalah
lapisan bukti untuk narasi AI-2, dan setiap butirnya harus menempel pada heksagon
yang benar-benar dinilai.

**Catatan penting soal filter `hashtag`:** dokumentasi MAPID menyatakan filter ini
adalah *partial match* pada **description**, bukan field tag terstruktur. Jadi
postingan yang lupa menulis `#cinajawabatak` di keterangannya tidak akan muncul di
hitungan mana pun. Angka 160 adalah "yang bertag dan di dalam kotak", belum tentu
seluruh postingan tim.

`meta.total` tersedia sebagai penghitung resmi — Fase 1 sebaiknya memeriksa
`len(activities)` terhadap `meta.total`, bukan sekadar percaya panjang array.

### Keputusan: C4 memakai `sumber: "osm"`, bukan `"krl"`

Awalnya dikira murni kosmetik. Salah — `sumber` tampil ke pengguna. `kamus.js`
memetakan `osm` → "OpenStreetMap" dan `krl` → "Jadwal KRL", dan string itu muncul
di panel indikator, tabel halaman metodologi, serta prompt AI-2.

C4 mengukur jarak jalan kaki ke stasiun di atas jaringan OSM. Tidak ada jadwal
yang dibaca — tidak ada waktu keberangkatan, tidak ada frekuensi. Melabelinya
"Jadwal KRL" akan memberi kesan skor memperhitungkan seberapa sering kereta
lewat, padahal tidak. Itu klaim berlebih yang akan ketahuan juri, sekaligus
memberi premis palsu ke narasi AI-2.

Nilai `krl` dibiarkan ada di enum skema tapi tidak dipakai.

---

## Fase 1 — Ingest (2026-09-08) — SEBAGIAN

Sumber OSM dan MAPID Activities selesai. MAPID POI tertahan menunggu informasi
endpoint. GEE belum dikerjakan.

### Selesai

| Keluaran | Isi | Catatan |
|---|---|---|
| `walk_graph.graphml` | 71.045 simpul, 182.866 ruas, 73 MB | satu komponen terhubung penuh |
| `halte.parquet` | 675 halte bertag (650 bernama) | query tag OSM |
| `rute.parquet` | 23 relasi: **20 Trans Jogja** + 3 Trans Gadjah Mada | urutan halte tersimpan |
| `krl_stasiun.parquet` | 14 stasiun | Yogyakarta, Lempuyangan, Maguwo termasuk |
| `halte_rute.parquet` | 679 halte, 589 berkoridor diketahui | masukan C1/C2/C3 |
| `activities.parquet` | 158 aktivitas, semuanya berfoto | lapisan bukti AI-2 |

### Kualitas graf jalan kaki

Diunduh untuk wilayah studi **+ buffer 2 km**, bukan wilayah studi telanjang.
Memotong graf rute di batas analisis membuat heksagon tepi tampak tak terjangkau,
padahal pejalan kaki nyata boleh keluar batas lalu kembali.

Hasil verifikasi:

- **Satu komponen terhubung penuh** (71.045 simpul, 100%). Tidak ada pulau.
- Jarak snap pusat heksagon ke simpul terdekat: median 37,4 m, p90 116 m, maks 819 m.
- **Nol heksagon** yang snap ke luar komponen utama — semuanya bisa dirutekan.
- 17 heksagon snap lebih jauh dari satu lebar heksagon (>380 m). Kemungkinan
  sawah atau hutan yang jalannya memang jarang. Ditandai, bukan dianggap galat.

### Tiga jebakan OSM yang sudah kena dan diperbaiki

**1. `ox.features_from_polygon` tidak bisa mengambil relasi rute.**
Fungsi itu hanya mengembalikan fitur yang geometrinya bisa dirakit, dan relasi
rute bus sering gagal dirakit — hasilnya `InsufficientResponseError: No matching
features`, seolah-olah tidak ada rute sama sekali. Padahal ada 23. Solusinya
query Overpass langsung dan menyimpan daftar anggota relasi, karena yang
dibutuhkan C3 memang **topologi koridor**, bukan garis yang tergambar.

**2. Overpass menjawab HTTP 406 tanpa User-Agent.** Selalu kirim header itu.

**3. `out body` sekaligus untuk seluruh bbox kena HTTP 504.** Bukan query salah,
tapi terlalu berat karena setiap anggota relasi ikut diperluas. Dipecah dua
tahap: `out tags` untuk mengambil id, lalu `out body` per batch 5 id. Satu batch
selesai ~1 detik. Ditambah retry berjenjang karena 504 sering hanya beban sesaat.

### Dedup halte di dalam relasi

Satu halte fisik biasanya dipetakan **dua kali** dalam relasi rute: sekali
`role=stop` (titik di badan jalan) dan sekali `role=platform` (area tunggu di
tepi). Keduanya perjalanan yang sama. Dedup dilakukan sambil **mempertahankan
urutan**, karena urutan itulah topologi koridornya.

### Halte yang hanya ada sebagai anggota relasi

Query tag menemukan 675 halte. Relasi rute menyebut 653 id halte, dan **68 di
antaranya tidak ada di hasil query tag** — node itu tidak memikul tag halte
sendiri, hanya menjadi anggota relasi.

Diperiksa satu per satu, bukan ditebak: 65 dari 68 memang di luar wilayah studi
(median 3,4 km, maks 11,4 km) — wajar, koridor Trans Jogja menjangkau pusat kota.
Tetapi **3 berada di dalam wilayah studi**. Kalau dibiarkan, C3 kehilangan
koridor yang lewat situ tanpa peringatan apa pun.

`03_halte_rute_join.py` menggabungkan keduanya, lalu memangkas ke wilayah studi
+2 km. Hasil: **679 halte, 589 (86,7%) berkoridor diketahui**, median 2 koridor
per halte, maksimum 13.

### Tertahan

**MAPID POI belum bisa diambil.** Endpoint Activities sudah pasti benar, tapi
endpoint POI/layer belum diketahui — tebakan `/web/competition/layers`, `/layer`,
dan `/poi` semuanya 404. Butuh informasi dari pemilik repo. Ini memblokir
M1, M2, M4 (80% dimensi Amenity).

**GEE (W2 NDVI, W3 VIIRS) belum dikerjakan.** Kredensial sudah terverifikasi
bekerja, tinggal ditulis skripnya.
