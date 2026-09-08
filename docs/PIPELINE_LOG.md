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
