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

### MAPID Open API — endpoint ditemukan, tapi ada plafon 200

Endpoint yang benar (dari layar Edit Layer, bukan dokumentasi Activities):

```
GET https://geoserver.mapid.io/layers_new/get_layer_list?api_key=..&project_id=..
GET https://geoserver.mapid.io/layers_new/get_layer?api_key=..&layer_id=..&project_id=..
```

Kunci disimpan di `.env` sebagai `MAPID_API_KEY_DATA` dan `MAPID_PROJECT_ID`.
Layer `uji_api` yang ada di tangkapan layar ternyata layer uji kosong — 1 fitur,
0 field. Bukan itu yang dicari.

**Sembilan layer di proyek:**

| Layer | Fitur | Kegunaan |
|---|---|---|
| HALTE Sleman 2025 (premium) | 87 | pembanding 679 halte OSM |
| All Point of Interest | **200 (terpotong)** | M1, M2, M4 |
| Transportation | 48 | — |
| KOS Sleman 2025 | 60 | **A1** — hampir tiga kali lipat sampel survei |
| ALFAMART Sleman | 61 | M4 minimarket |
| DEMOGRAFI Sleman | 86 poligon, 110 field | konteks |
| SITE SELECTION Sleman | **200 (terpotong)** | hasil skoring pihak lain |
| Cyberjaya Transportation / POI | 48 / **200** | bukan wilayah studi |

**Plafon 200 dikonfirmasi, bukan dugaan.** `page=2` mengembalikan hasil yang
**identik byte per byte**, dan semua parameter yang dicoba (`limit`, `skip`,
`offset`, `per_page`, `max`) tidak berpengaruh. Layer yang isinya di bawah 200
mengembalikan jumlah aslinya (87, 60, 61, 86), jadi 200 adalah batas atas
endpoint, bukan ukuran halaman.

**Konsekuensi serius untuk Amenity.** Kamus data mengasumsikan POI MAPID
"menutupi seluruh wilayah studi" dan menopang M1, M2, M4 — 80% dimensi Amenity.
200 titik tidak bisa menutupi 2.134 heksagon. Kalau dipaksakan, sebagian besar
heksagon dapat nol tempat makan, dan nol itu akan dibaca sebagai **fakta**
("tidak ada warung") padahal yang benar adalah **tidak tahu**. Persis mode
kegagalan yang dilarang CLAUDE.md.

Belum diputuskan — menunggu pemilik repo. Opsi yang terbuka: cari endpoint lain
yang tidak berplafon, ekspor manual dari UI MAPID, atau alihkan M1/M2 ke POI OSM
dan pakai MAPID sebagai pembanding kualitas.

**Temuan sampingan yang berguna:** layer KOS berisi 60 titik. Survei lapangan
hanya punya 31 kos berharga, jadi ini bisa memperkuat model A1 secara berarti.

### Ekspor manual MAPID — daftar dibuat, koreksi soal layer KOS

Ditanyakan apakah pernah ada catatan layer premium mana yang harus diekspor.
**Tidak ada.** Seluruh dokumen hanya memuat satu kalimat di `DATA_DICTIONARY.md`
baris 42 tentang "POI premium MAPID yang menutupi seluruh wilayah studi", tanpa
menyebut satu pun nama layer. Daftar kebutuhan baru dibuat di
`docs/MAPID_EXPORT_LIST.md`.

Dua berkas ekspor diterima dan dipindah ke `data/raw/mapid/`:

| Berkas | Fitur | Di wilayah studi |
|---|---|---|
| `halte_sleman_2025.geojson` | 87 | 74 |
| `kos_sleman_2025.geojson` | 60 | 51 |

Keduanya cocok persis dengan jumlah dari API (87 dan 60), yang berarti kedua
layer ini **tidak pernah terpotong** — plafon 200 hanya menggigit layer yang
memang lebih besar dari itu.

**Koreksi.** Sebelumnya layer KOS disebut "hampir tiga kali lipat sampel A1".
Itu keliru. Layer KOS **tidak punya field harga sama sekali** — isinya lokasi
(NAMA, ALAMAT, TELEPON, STATUS), bukan tarif. Jadi ia tidak bisa menjadi label
pelatihan model A1, hanya kovariat berupa kepadatan kos per heksagon. Label
harga tetap hanya dari 31 kos survei.

**Katalog MAPID jauh lebih kaya dari isi proyek saat ini.** Pencarian "sleman"
mengembalikan 254 dataset, dengan etalase Retail 19.980, Sosial 23.254, Makanan
dan Minuman 2.491, Perumahan 4.063. Yang memblokir Amenity karena itu bukan
ketiadaan data, melainkan data yang belum diimpor ke proyek.

Struktur `TIPE_1`/`TIPE_2`/`TIPE_3` di berkas ekspor adalah taksonomi kategori
MAPID, dan itulah yang dibutuhkan M2 untuk menghitung entropi keragaman kuliner.
Kolom itu **wajib dipertahankan** saat ekspor.

### PRD dibaca (2026-09-08) — dan ia menjawab beberapa pertanyaan terbuka

PRD 25 halaman baru dibaca sekarang. Seharusnya dibaca di Fase 0. Isinya
mengonfirmasi beberapa temuan yang sebelumnya ditemukan sendiri lewat kode, dan
itu kabar baik: dua jalur berbeda sampai ke kesimpulan sama.

**Yang dikonfirmasi PRD (halaman 8–9):**

- **Dataset kos MAPID memang tidak punya kolom harga.** PRD menyatakannya
  eksplisit: "Dataset kos MAPID tidak memuat kolom harga sewa, sehingga dimensi
  Affordability bertumpu pada harga hasil survei lapangan." Koreksi yang sudah
  dibuat sebelumnya tepat.
- **Connectivity memang harus memakai OSM, bukan MAPID.** PRD: "hanya OSM yang
  membawa relasi rute yang dibutuhkan untuk pemodelan graf antarrute, sedangkan
  dataset MAPID digunakan sebagai lapisan validasi." Persis keputusan yang
  sudah diambil di Fase 1.
- **Kategori POI yang dimaksud disebut jelas:** Perdagangan dan Retail, Makanan
  dan Minuman, Kesehatan dan Pengobatan, Pendidikan, Layanan atau Jasa. Inilah
  yang selama ini hilang dari `DATA_DICTIONARY.md`.
- **Halte: 87 MAPID vs 347 platform OSM.** PRD menjelaskan keduanya beda konsep —
  MAPID menghitung fasilitas per kabupaten, OSM menghitung platform per arah.
  Angka pipeline (679 dalam wilayah studi + 2 km) lebih besar lagi karena
  cakupannya lebih luas dan menyertakan node anggota relasi. Bukan kontradiksi.

**Tim ternyata berempat, bukan berdua.** PRD mencantumkan Bernardinus Adhika
(Project Leader) dan Gerardus Theo (UI/UX) selain Dal dan Devon. README dan
CLAUDE.md hanya menyebut dua orang.

### Mission Go diuji — Menu Go praktis kosong

Ditanyakan apakah kita punya akses Menu Go. Ketiganya diuji langsung:

| Mission | Di wilayah studi | Kotak luas | Field |
|---|---|---|---|
| `menugo` | **0** | **1** | — |
| `propertigo` | **156** | 179 | kategori, jenis, alamat, 2 foto |
| `struckgo` | **73** | 79 | nama, kategori, metode bayar, foto struk |

**Menu Go memang kosong, bukan salah pemakaian API.** Satu-satunya record
("Halte Library Cafe") berada di luar wilayah studi, dan `hasMore: false`
menandakan itu memang seluruh isinya.

Konsekuensinya langsung: **A2_harga_makan hampir pasti `tidak_tersedia`** di
seluruh wilayah. Kamus data sudah menduga ini ("kecuali Menu Go menutupinya") —
sekarang terbukti Menu Go tidak menutupinya. Bobot A2 (0,40 di dalam
Affordability) akan dinormalisasi ulang ke A1.

**Properti Go dan Struck Go tidak menyelamatkan A2.** Keduanya tidak punya
kolom numerik sama sekali — hanya foto. 156 foto spanduk properti adalah bahan
yang tepat untuk AI-3 (pembaca spanduk kos), fungsi yang di ARCHITECTURE.md
berstatus ditangguhkan. Layak dipertimbangkan ulang kalau A1 butuh label lebih
banyak.

Catatan API: endpoint Mission Go memakai paginasi `offset`, dengan `limit`
terkunci di 100 dan tidak bisa diubah lewat body. Beda dari `get_layer` di
geoserver yang berplafon keras 200 tanpa paginasi.

### 254 dataset MAPID dianalisis

Rekomendasi lengkap ditulis di kepala `mapid_data.txt`, mengacu nomor daftar
aslinya. Ringkasnya:

**Prioritas 1** — lima layer payung sesuai kategori PRD, dipimpin
**97. MAKANAN DAN MINUMAN 2025** yang memikul M1 dan M2 (55% dimensi Amenity).

**Temuan tak terduga — empat dataset yang bisa menggantikan sumber luar:**

| # | Dataset | Berpotensi menggantikan |
|---|---|---|
| 44 | HARGA PROPERTI 2024 | label harga tambahan untuk A1 |
| 250 | WILAYAH RISIKO BANJIR | **InaRISK** (W4) |
| 107–114 | NIGHTTIME LIGHT 2016–2023 | **VIIRS lewat GEE** (W3) |
| 245/246 | TUTUPAN LAHAN / URBAN HEAT ISLAND | pelengkap **Sentinel-2 NDVI** (W2) |

Kalau 250 dan 114 memadai, dua dependensi eksternal (InaRISK dan sebagian GEE)
bisa dihapus, dan seluruh W3/W4 pindah ke sumber resmi panitia — nilai tambah
untuk penilaian lomba, bukan sekadar kemudahan teknis.

**44. HARGA PROPERTI** perlu diperiksa lebih dulu. Ini satu-satunya nama dataset
di seluruh katalog yang menyebut "HARGA". Kalau isinya harga per titik, model A1
yang sekarang hanya punya 31 label survei bisa jauh lebih kuat.

**Yang sengaja dikecualikan:** belasan layer partai politik, layer merek tunggal
(sudah tercakup layer payung, dan menggabungnya akan dobel hitung), SITE
SELECTION (skoring pihak lain, membuat penilaian melingkar), dan layer Cyberjaya
(Malaysia).

---

## Fase 3 — Jaringan (2026-09-08) — SELESAI

C1, C2, C3, C4, dan W1 dihitung untuk seluruh 2.134 heksagon. Tidak ada nilai
kosong. Himpunan heksagon cocok persis dengan `reference/hex_index.txt`.

| Skrip | Keluaran | Isi |
|---|---|---|
| `01_snap.py` | `snap.parquet` | 3.046 titik ditempelkan ke simpul graf |
| `02_c1_c4.py` | `c1_c4.parquet` | jarak jaringan ke halte dan stasiun |
| `03_c2.py` | `c2.parquet` | koridor unik dalam 400 m |
| `04_c3.py` | `c3.parquet`, `c3_per_kampus.parquet` | keterjangkauan 10 kampus |
| `05_w1.py` | `w1.parquet` | kerapatan simpang |

### Kualitas snap

| Jenis | Titik | Median | Maks |
|---|---|---|---|
| heksagon | 2.134 | 37,5 m | 819 m |
| halte | 679 | 17,3 m | 103 m |
| gerbang | 219 | 6,6 m | 168 m |
| stasiun KRL | 14 | 882 m | 12.827 m |

Stasiun KRL bermedian besar karena sebagian berada jauh di luar wilayah studi.
Tidak masalah — hanya stasiun terdekat yang dipakai C4.

### Hasil

- **C1** median jarak jaringan ke halte **1.199 m**. Hanya **348 heksagon**
  (16%) punya halte dalam 400 m, 761 dalam 800 m.
- **C2** median **0 koridor** dalam 400 m. **82,1% heksagon tidak punya koridor
  apa pun** dalam jarak itu.
- **C4** median jarak ke stasiun KRL **6.233 m**. Praktis tidak relevan bagi
  sebagian besar wilayah, sesuai bobotnya yang memang kecil (0,10).
- **W1** median **160 simpang per km²**, dihitung hanya dari simpul berderajat
  ≥3 supaya tidak menggelembung oleh titik lengkung jalan.

Korelasi C1–C2–C3 tinggi (0,61–0,81), wajar karena ketiganya mengukur akses
transit dari sudut berbeda. C4 jauh lebih mandiri (0,28–0,38).

### Jebakan pemodelan C3 — penting, jangan diulang

Model graf pertama **salah**, dan salahnya menghasilkan angka yang kelihatan
masuk akal. Itu jenis kesalahan paling berbahaya.

Model salah: **halte sebagai simpul**, sisi antara halte berurutan pada satu
koridor. Terlihat wajar, tetapi **295 dari 589 halte dilayani lebih dari satu
koridor**. Halte bersama itu menyatukan seluruh 20 koridor menjadi satu
komponen tunggal, sehingga berpindah dari koridor 1A ke 4B berbiaya **nol
transfer**. Akibatnya sembilan kampus mendapat angka identik 97,5% "langsung".

Ketahuan justru karena keseragamannya: README menyebut 65% UGM, 20% STIE YKPN,
18% AMIKOM — angka yang sangat **berbeda-beda**. Hasil yang rata untuk sembilan
kampus mustahil benar.

Model benar: simpul adalah pasangan **(halte, koridor)**.

```
ride     (s1, 1A) -> (s2, 1A)   biaya 0   tetap di dalam bus
transfer (s,  1A) -> (s,  4B)   biaya 1   ganti koridor di halte yang sama
walk     (s1, 1A) -> (s2, 4B)   biaya 1   jalan kaki pendek untuk ganti
```

Dengan model ini setiap pergantian koridor menjadi sisi eksplisit yang dihitung.
Hasilnya langsung terdiferensiasi: UGM 79,0% langsung, STIE YKPN 43,4%, sesuai
urutan yang disebut README meski angkanya lebih tinggi karena ambang jalan kaki
di sini lebih longgar.

Pencarian memakai **0-1 BFS** (deque, sisi biaya 0 masuk depan, biaya 1 masuk
belakang), bukan Dijkstra — bobotnya hanya 0 dan 1.

### GATE_M dinaikkan 600 -> 1.000 m, dengan alasan

Pada 600 m, Instiper dan Sanata Dharma III punya **nol halte pelayan**. Terlihat
seperti bug, ternyata bukan:

| Kampus | Garis lurus | **Jaringan jalan kaki** |
|---|---|---|
| Instiper | 330 m | **918 m** |
| Sanata Dharma III | 905 m | **1.184 m** |

Rute jalan kaki nyata memang berkelok hampir tiga kali garis lurusnya. Uji
sensitivitas 600/800/1.000/1.200/1.500 m menunjukkan **1.000 m** adalah titik
di mana sembilan dari sepuluh kampus mendapat halte pelayan.

**Sanata Dharma III tetap nol sampai 1.200 m, dan itu dibiarkan.** Skor 0,20 di
seluruh wilayah untuk kampus itu adalah **temuan yang benar** tentang aksesnya,
bukan cacat yang harus disetel hilang. Menaikkan ambang sampai semua kampus
"lulus" berarti menyembunyikan justru hal yang produk ini ingin ungkap.

### UGM dan UNY identik — benar, bukan bug

Keduanya menghasilkan angka persis sama (601 langsung, 143 satu transfer). Sudah
diperiksa: keduanya kampus bersebelahan yang **berbagi 27 halte**, dan 12
koridor UNY hampir seluruhnya himpunan bagian dari 14 koridor UGM. Koridor yang
mencapai satu kampus mencapai yang lain. Konsisten pula dengan temuan Fase 0
bahwa dua gerbang memang melayani kedua kampus.

### C3 per kampus disimpan terpisah

`c3_per_kampus.parquet` memuat sepuluh kolom skor per heksagon. Ini yang
dibutuhkan AI-1 saat pengguna menyebut kampusnya dan frontend menghitung ulang
di klien. Disimpan sebagai berkas pendamping supaya GeoJSON 2.134 fitur tidak
membengkak sepuluh field per heksagon, dan `mesinSkor.js` Devon tidak perlu
berubah.

C3 bawaan di GeoJSON memakai **kampus terbaik** yang terjangkau tiap heksagon.

### Catatan: 1.105 di README

README menyebut "1.105 kawasan yang punya halte dalam jangkauan jalan kaki".
Angka itu setara ambang **±1.250 m**, bukan 400 m yang dipakai C1. Bukan
kesalahan, hanya definisi "jangkauan jalan kaki" yang berbeda. Perlu diseragamkan
di halaman metodologi supaya angka publik dan angka pipeline tidak saling
bertentangan.

---

## Ekspor MAPID gelombang kedua (2026-09-08)

Lima GeoJSON diterima, dipindah ke `data/raw/mapid/` dengan nama pendek.

| Berkas | Fitur | Di wilayah studi | Untuk |
|---|---|---|---|
| `makanan_minuman_2025.geojson` | 1.712 | **1.338** | **M1, M2** |
| `toko_makanan_minuman_2025.geojson` | 1.603 | 525 | M1, M4 |
| `harga_properti_2024.geojson` | 1.221 | 835 | A1 (kovariat) |
| `risiko_banjir.geojson` | 588 poligon | 118 | **W4** |
| `bahaya_banjir.geojson` | 1.057 poligon | 248 | W4 (alternatif) |

### Amenity tidak lagi terblokir

1.338 titik makanan-minuman di dalam wilayah studi untuk 2.134 heksagon.
Bandingkan dengan 200 titik terpotong dari Open API — sekarang cakupannya nyata.
**M1 dan M2 bisa dihitung.**

**Dua layer makanan itu berbeda, bukan duplikat.** Sudah diperiksa: tumpang
tindihnya hanya **9 titik** dari 1.712/1.603.

| Layer | TIPE_1 | Isi TIPE_2 |
|---|---|---|
| `makanan_minuman` | MAKANAN DAN MINUMAN | RESTORAN 1.227, ROTI DAN KUE 250, MINUMAN 234, BAR 1 |
| `toko_makanan_minuman` | PERDAGANGAN DAN RETAIL | TOKO MAKANAN DAN MINUMAN 1.603 |

Yang pertama adalah **tempat makan** (tempat orang duduk makan). Yang kedua
adalah **toko yang menjual bahan makanan**. Beda peruntukan:

- **M1 kepadatan tempat makan** dan **M2 keragaman kuliner** memakai
  `makanan_minuman` saja. Memasukkan toko bahan makanan akan salah — mahasiswa
  yang mencari makan siang tidak dilayani toko kelontong.
- **M4 layanan harian** justru cocok memakai `toko_makanan_minuman`, karena
  kategori "warung" di kamus data memang toko kebutuhan sehari-hari.

Keduanya dipakai, di indikator yang berbeda. Menggabungkannya jadi satu kolam
akan menggelembungkan M1 hampir dua kali lipat.

### HARGA PROPERTI — ada harga, tapi BUKAN harga sewa kos

Dugaan sebelumnya sebagian benar dan sebagian salah. Layer ini memang memuat
kolom harga sungguhan, terisi rapat:

| Kolom | Terisi | Median |
|---|---|---|
| `HARGA PROPERTI NET (RP)` | 1.161/1.221 | Rp 700.100.000 |
| `HARGA TANAH NET (RP/M²)` | 316/1.221 | — |

Tetapi `TIPE_3` menunjukkan isinya: TANAH KOMERSIAL 476, TANAH RESIDENSIAL 441,
RUMAH SEKEN 179, APARTEMEN SEKEN 55, RUKO 43. **Ini harga JUAL properti, bukan
sewa bulanan kos.** Skalanya ratusan juta sampai miliar rupiah, sedangkan harga
kos dari survei sekitar Rp700 ribu per bulan. Tiga orde besaran berbeda.

**Tidak bisa dipakai sebagai label A1.** Label harga sewa tetap hanya 31 kos
survei — tidak berubah.

**Tapi sangat berguna sebagai kovariat.** 835 titik harga properti di dalam
wilayah studi adalah proksi kuat untuk nilai tanah setempat, dan nilai tanah
adalah penentu utama harga sewa kos. Model A1 yang dilatih pada 31 label akan
jauh lebih kuat dengan fitur "median harga properti di sekitar heksagon ini"
dibanding hanya jarak-ke-kampus dan kepadatan POI.

Catatan: seluruh 1.221 baris bertanda `WAKTU = Q2 2024`, jadi satu potret waktu,
bukan deret waktu. Geometrinya MultiPoint, perlu di-centroid saat dibaca.

38 baris menyebut KOS di salah satu kolom tipe/nama — terlalu sedikit untuk
label, tapi layak diperiksa saat membangun model A1.

### Dua layer banjir — keduanya diterima, `bahaya_banjir` yang dipilih

| Berkas | Poligon | Kelas |
|---|---|---|
| `risiko_banjir` | 588 (118 di wilayah studi) | TINGGI 239, SEDANG 301, RENDAH 48 |
| `bahaya_banjir` | 1.057 (248 di wilayah studi) | Sangat Rendah 177, Cukup Rendah 338, Sedang 318, Cukup Tinggi 182, Tinggi 42 |

**`bahaya_banjir` dipakai untuk W4**, dengan dua alasan:

1. **Lima kelas, bukan tiga.** Kamus data mendefinisikan W4 sebagai
   `1 - indeks bahaya`, dan lima tingkat memberi gradasi yang jauh lebih halus
   setelah dinormalisasi persentil.
2. **Cakupan dua kali lipat** di dalam wilayah studi (248 vs 118 poligon).

Namanya pun cocok: kamus data menyebut "indeks **bahaya**", dan layer ini
memang layer bahaya. `risiko_banjir` disimpan sebagai pembanding.

**Ini menggantikan InaRISK.** Satu dependensi eksternal hilang, dan W4 kini
bersumber dari data resmi panitia — nilai tambah untuk penilaian lomba.

Yang belum: layer NIGHTTIME LIGHT (107–114) untuk menggantikan VIIRS di W3.

---

## Fase 2 — Baca survei (2026-09-08) — SELESAI, dengan 3 butir menunggu keputusan

`10_clean/01_baca_survei.py` membaca `Hasil_Survei_BERSIH.xlsx` menjadi empat
tabel Parquet. Sesuai keputusan pemilik repo, pembersihan Excel **tidak**
direproduksi ulang di kode.

| Keluaran | Baris | Catatan |
|---|---|---|
| `survei_ruas.parquet` | 84 | W-6 lengkap 76, belum lengkap 8 |
| `survei_halte.parquet` | 12 | 11 dengan pengamatan waktu |
| `survei_ekonomi.parquet` | 12 | Total usaha cocok di semua baris |
| `survei_kos.parquet` | 31 | 29 berharga, median Rp775.000 |

### Yang diverifikasi dan LOLOS

- **Aritmetika W-6 tepat pada seluruh 84 ruas.** Dihitung ulang mandiri dari
  I-1..I-5 dengan bobot 0,25/0,15/0,20/0,15/0,25 plus normalisasi ulang saat
  ada komponen kosong. **Nol selisih.**
- **Sheet Ekonomi konsisten**: `Total usaha` sama dengan jumlah delapan kolom
  kategori di seluruh 12 baris.
- **Harga kos wajar**: rentang Rp350.000–Rp1.400.000, median Rp775.000, tidak
  ada `min > maks`.

### Aturan nol struktural diterapkan

Sesuai kamus data: `Trotoar = "Tidak ada"` berarti lebar dan panjang terputus
memang **0**, bukan tidak diketahui. Diterapkan pada 6 sel `Lebar Trotoar` dan
12 sel `Panjang trotoar terputus` yang kosong.

**Hanya pada sel KOSONG.** Tidak pernah menimpa nilai yang tercatat, sekalipun
nilai itu bertentangan — itu wilayah keputusan manusia.

### Tiga anomali — TIDAK diubah, dilaporkan di docs/SURVEI_ANOMALI.md

| # | Ruas | Masalah |
|---|---|---|
| A1 | RUAS-029 | `Lebar Jalan = 0` di gang yang muat mobil, sekaligus `Trotoar = "Tidak ada"` tapi `Lebar Trotoar = 3,0` |
| A2 | RUAS-034 | `Trotoar = "Tidak ada"` tapi `Lebar Trotoar = 1,0` |
| B1 | RUAS-069 | Panjang 865,9 m (ruas lain 50–255 m), waktu 1.200 detik |

A1 dan A2 **tidak tercatat di sheet `Flag`** — luput dari pembersihan manual.
B1 sudah tercatat dan sengaja dibiarkan.

Dugaan untuk A1: nilai lebar jalan dan lebar trotoar **tertukar**. 3,0 m wajar
untuk lebar gang, tidak wajar untuk trotoar gang; dan 0 m mustahil untuk jalan
yang muat satu mobil. Untuk B1: panjang dan waktu **saling konsisten**
(kecepatan 0,72 m/s), jadi kemungkinan besar memang ruas panjang di jalan
arteri, bukan salah ketik.

Dampak ketiganya kecil: A1 dan A2 sudah menghasilkan W-6 = 0,0, jadi koreksi
apa pun tidak mengubah W-6 — hanya mempengaruhi W-5 yang memakai lebar jalan.

Skrip **mendeteksi ulang** anomali ini setiap kali dijalankan, sehingga
perubahan pada workbook tidak bisa menyembunyikannya diam-diam.

### Kekosongan yang wajar, bukan data hilang

- `I-4 kemulusan` kosong di 59 dari 84 ruas — 55 di antaranya tidak bertrotoar.
  Kemulusan permukaan trotoar memang tidak terdefinisi kalau trotoarnya tidak
  ada. Ini kekosongan yang benar.
- `Interval OSM (detik)` kosong di seluruh 12 halte — kolom belum pernah diisi.
- HLT-010 Halte Nogotirto tanpa pengamatan sama sekali.

### Koreksi terhadap kamus data

`DATA_DICTIONARY.md` menyatakan 11 ruas tidak terhitung dan "terkonsentrasi di
KWS-09". Kenyataannya **8 ruas**, tersebar di KWS-02 (2), KWS-09 (2), KWS-10
(2), KWS-12 (1), KWS-08 (1). Perlu diperbarui di dokumen.

### Catatan teknis

Kolom `Harga (teks asli)` bertipe campur (`'775rb/1.2jt'` dan satu baris berupa
angka), ditolak Parquet. Di-cast ke string agar teks aslinya utuh; angka yang
sudah diurai tetap ada di `Harga median/min/maks`.

### Koreksi anomali diterapkan (2026-09-08)

Ketiganya disetujui pemilik repo dan diterapkan pada
`Hasil_Survei_BERSIH.xlsx`. Cadangan sebelum koreksi disimpan sebagai
`Hasil_Survei_BERSIH.SEBELUM_KOREKSI_2026-09-08.xlsx`.

| Ruas | Perubahan | W-6 |
|---|---|---|
| RUAS-029 | Lebar Jalan 0,0→3,0 · Lebar Trotoar 3,0→0,0 | 0,0 (tetap) |
| RUAS-034 | Trotoar "Tidak ada"→"Sebagian" | **0,0 → 0,5182** |
| RUAS-069 | hanya catatan verifikasi | 0,0 (tetap) |

### Temuan penting: W-6 adalah RUMUS EXCEL, bukan nilai statis

Hampir merusak workbook karena mengira kolom I-1..I-5 dan W-6 berisi angka.
Ternyata seluruhnya **rumus hidup** yang membaca parameter dari sheet
`Panduan_W6`. Percobaan menulis nilai ke sana dibatalkan dan berkas dipulihkan
dari cadangan.

Yang benar: **hanya kolom sumber yang diubah** (`Trotoar`, `Lebar Jalan`,
`Lebar Trotoar`, `Catatan`). Rumus menghitung ulang sendiri.

Parameter yang ternyata berbeda dari dugaan:

| Parameter | Nilai sebenarnya | Dugaan awal |
|---|---|---|
| Konstanta pemulusan I-4 | **3** | 1 |
| Lebar trotoar standar | 1,5 m | 1,5 m (benar) |
| Pengecualian gang sepi | **"Tidak"** (nonaktif) | tidak diketahui ada |

Karena konstanta I-4 adalah 3 dan bukan 1, perkiraan awal W-6 RUAS-034 (0,4609)
meleset; nilai sebenarnya **0,5182**.

Ada pula aturan "Lengkap (gang)" di rumus status yang memberi perlakuan khusus
untuk gang sepi, tetapi saklarnya (`Panduan_W6!B11`) sedang **"Tidak"**, jadi
tidak aktif. Perlu diketahui kalau nanti dinyalakan.

**Pembaca sekarang menghitung ulang W-6 sendiri** dari parameter `Panduan_W6`.
Diperlukan karena openpyxl menyimpan rumus tanpa hasil cache Excel, sehingga
setelah penyuntingan programatik kolom I-* dan W-6 terbaca kosong sampai berkas
dibuka di Excel. Sekaligus menjadi pemeriksaan silang terhadap spreadsheet.

### Catatan lapangan RUAS-034 sempat tertimpa, sudah dipulihkan

Teks asli pencatat — *"gang persis di samping UPN, ada warmindo dan kos.
terhalang bekas bakar sampah, jalannya kecil dan cukup bersampah"* — sempat
tertimpa teks koreksi, lalu dipulihkan dan koreksi ditambahkan setelahnya.

Isinya penting justru karena **bertentangan dengan koreksi yang dipilih**:
menggambarkan gang kecil bersampah yang terhalang bekas bakar sampah, dan kolom
`Pejalan turun ke jalan` tetap "Ya". Keduanya tidak mendukung adanya trotoar
layak. Koreksi tetap diterapkan sesuai keputusan pemilik repo, tetapi dasarnya
dicatat terbuka di `docs/SURVEI_ANOMALI.md` karena ini satu-satunya koreksi yang
**menaikkan** skor, dan itu yang paling akan disorot juri.

### Anomali baru yang belum diputuskan: RUAS-053

Terlewat di laporan awal. `Lebar Jalan = 0,0` pada ruas yang muat satu mobil,
**dan** `Trotoar = "Ada"` tapi `Lebar Trotoar = 0,0` — kebalikan dari A1/A2.

Tidak seperti RUAS-029, di sini tidak ada angka yang bisa ditukar karena
keduanya nol. Perlu ingatan pencatat. Dibiarkan apa adanya sampai ada keputusan.

### RUAS-053 sebagian diputuskan (2026-09-08)

Pencatat mengonfirmasi ada trotoar selebar **2 m**. `Lebar Trotoar` 0,0 → 2,0.
Kolom `Trotoar = "Ada"` memang benar sejak awal; yang salah hanya lebarnya.

**W-6 ruas ini naik dari 0,0 menjadi 0,75.** I-1 sampai I-4 penuh, I-5 nol
karena `Pejalan turun ke jalan = "Ya"` — profil yang konsisten: trotoar lebar
dan mulus, tapi pejalan kaki tetap turun ke jalan.

`Lebar Jalan = 0,0` pada ruas yang sama **tidak diubah**. Yang dikonfirmasi
hanya lebar trotoar. Peringatan anomali untuk kolom itu sengaja dibiarkan
menyala. Berdampak pada W-5, bukan W-6.

Ringkasan W-6 setelah empat koreksi: median 0,0000, rata-rata 0,2629,
lengkap 76 dari 84 ruas.

---

## Fase 4 sebagian — Amenity dan W4 (2026-09-08)

| Skrip | Indikator | Hasil |
|---|---|---|
| `01_amenity.py` | M1, M2, M4 | M1/M4 terisi penuh, M2 terisi 1.594 |
| `02_w4_banjir.py` | W4 | terisi 301, sisanya `tidak_tersedia` |

### Keputusan besar: radius M1/M2 diubah dari heksagon menjadi 800 m

Definisi awal kamus data menghitung tempat makan **di dalam heksagon**.
Hasilnya **75% heksagon bernilai nol** pada M1, dan M2 hilang di 1.606 heksagon.

Diperiksa: **74,7% heksagon punya tempat makan dalam 800 m** — hampir kebalikan
persisnya. Heksagon res 9 hanya selebar ~380 m, jadi warung 200 m di seberang
batas terhitung nol padahal lima menit jalan kaki. Definisi lama mengukur
**kisi**, bukan kawasan.

Uji sensitivitas:

| Radius | Heksagon > 0 | Median | Nol |
|---|---|---|---|
| dalam heksagon | 528 | 0 | 75,3% |
| 400 m | 1.094 | 1 | 48,7% |
| 600 m | 1.392 | 2 | 34,8% |
| **800 m** | **1.594** | **4** | **25,3%** |

**Diputuskan pemilik repo: 800 m**, sama dengan radius M4 dan anggaran jalan
kaki C3. Dipilih demi konsistensi antarindikator, bukan demi memperbagus
sebaran. `DATA_DICTIONARY.md` sudah diperbarui.

### Layer mana untuk indikator mana

Diverifikasi dengan pencocokan nama + koordinat, bukan asumsi:

| Indikator | Layer | Alasan |
|---|---|---|
| M1, M2 | `makanan_minuman` | **tempat makan**, bukan toko bahan makanan |
| M4 apotek | `apotek` (425) | seluruhnya subset `kesehatan_pengobatan`; pakai yang spesifik |
| M4 minimarket | `minimarket` (351) | sudah memuat semua merek |
| M4 warung | `toko_kelontong` (1.136) | **bukan** subset retail, layer mandiri |

Mahasiswa yang mencari makan siang tidak dilayani toko kelontong, jadi
`toko_makanan_minuman` sengaja **tidak** masuk M1/M2.

### W4 — 85% wilayah tidak terpetakan, dan itu jujur

Hanya **301 dari 2.134 heksagon (14,1%)** bersinggungan dengan peta bahaya
banjir. Sisanya `tidak_tersedia`.

Sempat dikira cakupannya kurang, lalu dibandingkan dengan layer satunya:

| Layer | Poligon | Heksagon tersentuh |
|---|---|---|
| `bahaya_banjir` | 1.057 | 301 (14,1%) |
| `risiko_banjir` | 588 | 306 (14,3%) |
| **gabungan** | — | **320 (15,0%)** |

Keduanya sama-sama ~14%, dan digabung pun hanya 15%. Jadi kelangkaan ini
**melekat pada datanya**: layer ini memetakan kawasan rawan banjir, bukan
seluruh kabupaten.

Karena itu heksagon yang tidak tersentuh **tidak diberi nilai bahaya 0**.
Tidak terpetakan berarti **tidak diketahui**, bukan aman. Memberi 0 akan
mengklaim seluruh Sleman bebas banjir hanya karena petanya tidak menjangkau ke
sana. Bobot W4 dinormalisasi ulang di dalam Walkability untuk 1.833 heksagon itu.

Indeks bahaya dihitung **tertimbang luas** saat satu heksagon berpotongan
dengan beberapa poligon, bukan mengambil poligon yang kebetulan memuat pusatnya.

### Hasil

| Indikator | Terisi | Median | Catatan |
|---|---|---|---|
| M1 | 2.134 | 0,551 | median 4 tempat makan dalam 800 m, maks 113 |
| M2 | 1.594 | 0,688 | 540 kosong: tidak ada tempat makan dalam jangkauan |
| M4 | 2.134 | 1,000 | 1.075 heksagon punya ketiga kategori |
| W4 | 301 | 0,577 | 1.833 `tidak_tersedia` |

Korelasi M1–M4 tinggi (0,79), keduanya memang mengukur kepadatan komersial.
M2 jauh lebih mandiri (0,35–0,50) — keragaman berbeda dari jumlah.

### Koreksi lain di kamus data

Jumlah ruas W-6 yang bisa dihitung diperbarui dari "73 ruas, terkonsentrasi di
KWS-09" menjadi **76 ruas**, dengan 8 sisanya **tersebar** di lima kawasan.

### W3 dan W5 (2026-09-08)

| Indikator | Terisi | Sumber |
|---|---|---|
| W3 penerangan | 1.775 (83,2%) | `nighttime_light_2023` MAPID |
| W5 tekanan lalin | 2.095 (98,2%) | kelas jalan OSM, dikalibrasi survei |

### W3 menggantikan VIIRS lewat GEE

Layer MAPID sudah terklasifikasi lima kelas DN dengan rentang intensitas
(nW/sr/cm²), sudah terpotong untuk Sleman. Radians ditaksir dari **titik tengah
tiap rentang**; kelas tertinggi (≥20) diberi nilai wakil 30. Karena hasil akhir
adalah peringkat persentil, yang penting hanya **urutannya**, bukan besaran
persisnya.

Cakupan 83,2% jauh lebih baik daripada W4 (14,1%). 359 heksagon yang tidak
terpetakan tetap `tidak_tersedia`.

**Satu dependensi eksternal hilang.** W3 kini bersumber data resmi panitia,
bukan Google Earth Engine. Tersisa W2 (NDVI) yang masih butuh GEE.

**Batasan yang harus dinyatakan di halaman metodologi:** cahaya malam satelit
adalah proksi rasa aman berjalan ke halte selepas magrib, **bukan** ukuran lampu
jalan. Jalan pertokoan terang dan lapangan parkir bersorot terbaca sama oleh
satelit.

### W5 memakai pola kalibrasi yang diminta kamus data

Survei tidak memberi nilai langsung — 84 ruas tidak mungkin menutupi 2.134
heksagon. Survei **mengalibrasi aturan** yang diterapkan pada data sekunder yang
cakupannya penuh.

Bukti kalibrasi dari 84 ruas survei:

| Jenis jalan | Ramai | Sedang | Sepi | Median lebar |
|---|---|---|---|---|
| Gang | 0 | 0 | **20** | ~3 m |
| Jalan kecil | 1 | 8 | 15 | 5,25 m |
| Jalan raya | **30** | 10 | 0 | 10,50 m |

Jenis jalan memprediksi kepadatan hampir sempurna: **seluruh 20 gang "Sepi"**,
dan **30 dari 31 ruas "Ramai" adalah jalan raya**. Lebar jalan juga memisahkan
ketiganya dengan bersih (rata-rata 3,8 / 6,9 / 13,4 m). Jadi kelas jalan OSM
yang menutupi seluruh wilayah adalah proksi sah untuk kepadatan yang disurvei.

Pemetaan kelas OSM ke tekanan: trunk/primary 1,00 · secondary 0,85 ·
tertiary 0,60 · unclassified/residential 0,35 · living_street/service 0,15 ·
footway/path 0,00.

Tiap heksagon memakai **rata-rata tertimbang panjang** jalan di dalamnya,
sehingga heksagon dengan satu ruas arteri dan banyak gang tidak dinilai dari
arterinya saja — tetapi heksagon yang isinya memang mayoritas arteri, ya.

Hierarki jalan hasilnya realistis: residential 6.102 km, living_street 1.510 km,
sementara trunk hanya 197 km. Median tekanan 0,34 wajar untuk wilayah yang
didominasi permukiman.

**Batasan yang jujur dicatat:** kalibrasi ini memvalidasi **urutan**, bukan
besaran. Ruas survei tidak membawa koordinat sendiri di berkas bersih, jadi
tidak bisa dicocokkan satu-satu dengan ruas OSM untuk mengukur akurasi per
ruas. Yang bisa dipastikan: urutan model (gang paling tenang, arteri paling
menekan) sama persis dengan urutan yang diamati di lapangan.

### W2 keteduhan (2026-09-08)

`05_w2_keteduhan.py` — **2.099 heksagon (98,4%)**, NDVI median 0,382
(rentang 0,108–0,765). Wajar untuk Sleman yang campuran permukiman dan sawah.

Satu-satunya indikator yang masih memakai Google Earth Engine. Layer MAPID
TUTUPAN LAHAN dan URBAN HEAT ISLAND sempat dipertimbangkan sebagai pengganti,
tapi tutupan lahan bersifat **kategorikal** (bukan ukuran kehijauan kontinu) dan
urban heat island adalah **akibat** dari vegetasi, bukan vegetasinya. NDVI
mengukur tajuk secara langsung.

Dua keputusan metodologis:

1. **Komposit median musim kemarau** (April–Oktober 2025, awan <40%, mask SCL
   untuk bayangan awan dan sirus). Satu lintasan berawan tidak bisa mengacaukan
   satu heksagon, dan tajuk yang bertahan di musim kemarau adalah keteduhan
   nyata, bukan tanaman padi musiman.
2. **Direduksi pada buffer 15 m di sekitar jaringan jalan kaki**, bukan seluruh
   heksagon. Keteduhan penting di tempat orang berjalan; heksagon yang
   separuhnya sawah tidak berarti trotoarnya teduh.

### Geokode kos — hasilnya sederhana, dan itu perlu dinyatakan jujur

Survei tidak merekam koordinat kos. `02_geocode_kos.py` memulihkan posisi dari
nama jalan, memakai **graf jalan OSM sebagai gazetteer** (3.297 jalan bernama).

**Google Maps tidak dipakai** dan tidak akan dipakai: Places API butuh kunci
Google Cloud dengan penagihan aktif, dan menyapu halaman Maps melanggar
ketentuan layanannya sekaligus rapuh. OSM sudah terunduh, gratis, offline, dan
reproducible.

Tiga tingkat, sesuai urutan yang diusulkan pemilik repo:

| Tingkat | Jumlah | Cara |
|---|---|---|
| `nama_kos` | 2 | nama jalan tertulis eksplisit di catatan kos |
| `ruas_terkait` | 17 | lewat `ID ruas terkait`, ruas yang dicatat surveyor |
| `pusat_kawasan` | 9 | rata-rata kos lain di kawasan yang sama |
| `gagal` | 2 | tidak ada petunjuk sama sekali |

28 dari 29 kos berharga kini punya koordinat.

**Jebakan yang sempat terjadi dan hampir lolos.** Versi pertama mencocokkan
**seluruh nama kos** dengan nama jalan. Hasilnya tampak bagus — 12 kecocokan
"nama_kos" dengan skor tinggi — padahal isinya sampah:

| Kos | Dicocokkan ke | Nyata? |
|---|---|---|
| Kost Soto Medan | Gang Noto Dimejan | tidak, hanya mirip huruf |
| Kos Aydin | Jalan Gading | tidak |
| Kost Putri Annisa | Gang Angsa | tidak |
| Kos Elisa Putri | Jalan Delima Raya | tidak |

Ketahuan saat audit satu per satu. Sekaligus terlihat KOS-001 yang namanya
memuat "Jl. Kaliurang Km 13" justru jatuh ke pusat kawasan — logikanya terbalik.

Diperbaiki: tingkat 1 kini **hanya menerima nama jalan eksplisit** yang didahului
penanda (Jl./Jln/Gg./Gang), diambil lewat regex. Kalau catatan kos tidak memuat
penanda itu, langsung turun ke tingkat 2. Sekarang seluruh kecocokan bisa
ditelusuri ke jalan yang memang dicatat surveyor.

**Hasil sebenarnya: 15 lokasi unik, naik dari 12.** Bukan lompatan besar.
Penyebabnya beberapa kos berbagi ruas yang sama (KOS-010 dan KOS-011 sama-sama
Jl. Raya Tajem; empat kos di Ring Road Utara), dan koordinatnya adalah
**centroid seluruh jalan** — untuk jalan panjang seperti Ring Road Utara, itu
bisa meleset ratusan meter.

Ini **memperbaiki** masukan A1, tetapi **tidak menyelesaikan** masalah dasarnya:
29 label harga tetap terlalu sedikit untuk melatih model di 2.134 heksagon.
Keputusan pendekatan A1 masih terbuka.

---

## A1 — dilaporkan hanya di tempat yang benar-benar disurvei (2026-09-08)

**153 heksagon (7,2%)** punya harga terukur. Sisanya `tidak_tersedia`.

### Tidak ada model, dan itu keputusan berdasar bukti

Kamus data mengandaikan A1 ditaksir model dari data sekunder. Sudah diuji dan
**ditolak karena hasilnya buruk**, bukan karena preferensi. Validasi silang
leave-one-out atas 29 label:

| Pendekatan | R² | MAE |
|---|---|---|
| tebak rata-rata saja | 0,000 | Rp 259.067 |
| Ridge, 9 fitur spasial | **−0,386** | Rp 297.467 |
| RandomForest | **−0,152** | Rp 284.665 |
| median kawasan survei | −0,045 | Rp 252.635 |

**R² negatif berarti model aktif memperburuk** dibanding menebak satu angka
tetap. Menerbitkannya dengan catatan kelemahan bukan kejujuran — itu peta yang
salah dan bisa dibuktikan salah oleh juri dalam satu klik.

### Sebabnya struktural, tidak bisa diperbaiki fitur apa pun

**45% ragam harga terjadi antar-kos di jalan yang sama.** Di KWS-06 harga
berkisar Rp350.000 sampai Rp1.200.000 dalam satu kawasan. Itu ukuran kamar,
kamar mandi dalam atau luar, usia bangunan — tidak satu pun bersifat spasial.
Plafon teoretis prediktor berbasis lokasi sekitar 55%, dan korelat terbaik yang
kita punya (kepadatan tempat makan) hanya r = 0,30.

### Radius 500 m, bukan 800 m seperti amenitas

Empat pertimbangan:

1. **Harga adalah observasi titik tentang satu bangunan**, bukan medan seperti
   cahaya atau vegetasi. "Ada warung dalam jarak jalan kaki" tetap benar sejauh
   800 m; "sewa di sini Rp700rb" tidak.
2. **Surveyor sudah menjawabnya sendiri.** Jarak kos ke halte yang mereka ukur
   bermedian **220 m** dengan p75 **500 m**. Itu definisi operasional tim
   sendiri tentang "di sini".
3. **Radius lebar membeli cakupan dengan mengencerkan makna.** Rentang harga
   yang tercampur dalam satu heksagon naik dari Rp350rb (500 m) ke Rp450rb
   (800 m) ke Rp550rb (1.500 m).
4. **Data tidak bisa memilih radius.** Uji leave-one-out — bisakah kos tetangga
   memprediksi kos yang ditutup — memberi R² antara +0,14 dan −0,24 **tanpa
   tren**. Itu derau pada n≈20. Kalau data tidak bisa memilih, pilihan
   konservatif yang menang.

500 m memberi 153 heksagon; 800 m memberi 310. Angka lebih kecil dipilih karena
**kekosongan yang dinyatakan lebih terpertanggungjawabkan daripada angka kabur**
— standar yang sama seperti W4.

### Koordinat kos akhirnya lengkap

Seluruh **31 kos punya koordinat unik**, dari sebelumnya 12 lokasi efektif.

| Presisi | Jumlah |
|---|---|
| `ruas_terkait` | 18 |
| `pusat_kawasan` | 8 |
| `manual` | 3 |
| `nama_kos` | 2 |

Tiga koreksi manual pemilik repo: KOS-025 Kost HM4 dan KOS-026 Janti 54 (dua kos
yang sebelumnya gagal dicocokkan), serta **KOS-004 Kost Green Villa** yang
koordinatnya sempat salah ketik di lat −7,4904 — sekitar **17 km di utara
wilayah studi**, dekat Merapi. Yang benar −7,701534, 110,415575. Ketahuan karena
skrip menolak titik di luar batas wilayah studi.

Dua kos cadangan menggantikan entri lama: **Kost HM4** (Rp850.000) menggantikan
"Kos ekslusif sorjem", dan **Kost Bu Moyo** (Rp750.000) menggantikan "Kos putri
Wisma Bharata". Harga min/maks lama Wisma Bharata dikosongkan karena milik kos
yang berbeda.

Kini **30 kos berharga**, naik dari 29.

### KOS-023 Mulia Sari dikeluarkan

Berada ~250 m di barat batas wilayah studi. Tidak bisa menempel ke heksagon mana
pun, jadi dikeluarkan dari A1 alih-alih digeser paksa ke heksagon terdekat.

---

## W6 integritas jalur — model DIBENARKAN, berbeda dari A1 (2026-09-08)

**2.095 heksagon (98,2%)**. Model dilatih pada 83 ruas survei, diterapkan ke
182.866 ruas OSM.

### Kenapa W6 boleh dimodelkan padahal A1 tidak

Diuji dengan cara yang sama persis, dan hasilnya berbeda tajam:

| Pendekatan | W6 (n=83) | A1 (n=29) |
|---|---|---|
| tebak rata-rata | R² 0,000 | R² 0,000 |
| model | **R² +0,394** | **R² −0,386** |
| MAE | 0,197 vs dasar 0,285 | Rp297rb vs dasar Rp259rb |

W6 **mengalahkan** tebakan rata-rata dengan selisih besar; galatnya 31% lebih
kecil. A1 justru **lebih buruk**. Itulah alasan A1 hanya melaporkan yang terukur
sementara W6 dimodelkan — keputusannya dari bukti, bukan preferensi.

Sebabnya jelas dari data survei: ketersediaan trotoar adalah **fungsi hierarki
jalan**, dan itu keteraturan tata kota yang nyata.

| Trotoar | Ruas | Rata-rata W6 | | Jenis jalan | Rata-rata W6 |
|---|---|---|---|---|---|
| Ada | 22 | 0,731 | | Jalan raya | 0,449 |
| Sebagian | 7 | 0,440 | | Jalan kecil | 0,129 |
| Tidak ada | 54 | 0,049 | | Gang | 0,044 |

Jalan arteri dapat trotoar, gang tidak. Harga sewa tidak punya keteraturan
setara — 45% ragamnya terjadi antar-kos di jalan yang sama.

### Fitur: hanya yang OSM punya di mana-mana

- **Kelas jalan** (100% terisi) — dipetakan ke tiga jenis jalan survei
- **Lebar** (24% tertag) — sisanya diisi median kelas itu **dari survei**, jadi
  cadangannya pun berasal dari pengukuran lapangan

Kelas jalan saja memberi R² 0,262; ditambah lebar naik ke 0,394.

**Kepadatan kendaraan sengaja tidak dipakai** meski menambah R² 0,017. Nilainya
berasal dari survei, dan W5 sudah menurunkannya dari kelas jalan yang sama —
memakainya berarti mencuci satu fitur menjadi dua.

### Rentang prediksi lebih sempit dari survei, dan itu BENAR

Survei bermedian 0,000 dengan maksimum 1,000; prediksi bermedian 0,130 dengan
maksimum 0,339. Penyusutan ke rata-rata adalah perilaku regresi yang wajar,
tetapi ada sebab yang lebih penting dan perlu dinyatakan di halaman metodologi:

**Survei mengambil sampel jalan arteri secara berlebih.**

| Jenis | Porsi survei | Porsi jaringan nyata |
|---|---|---|
| Jalan raya | **47,6%** | **12,9%** |
| Jalan kecil | 28,6% | 62,5% |
| Gang | 23,8% | 24,5% |

Surveyor memilih ruas beragam supaya tiap kondisi terwakili — metode survei yang
benar. Tetapi karena trotoar hampir hanya ada di jalan arteri, **W6 hasil survei
terlihat lebih baik daripada kenyataan wilayah studi**. Nilai model yang lebih
rendah adalah koreksinya, bukan cacatnya.

Konsekuensi jujur: model tidak akan pernah memprediksi 1,0 karena tidak ada
kombinasi kelas+lebar yang, rata-rata, bertrotoar sempurna. Sifat ini melekat
pada model linear dengan dua fitur dan harus dicatat, bukan disamarkan.

Skrip **berhenti sendiri** kalau R² validasi silang jatuh ke nol atau negatif,
supaya perubahan data di kemudian hari tidak diam-diam menghidupkan model yang
tidak lebih baik daripada menebak.
