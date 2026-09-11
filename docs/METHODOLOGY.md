# Metodologi Grahantara

Dokumen ini menjelaskan bagaimana Skor Grahantara dihitung, dari data apa, dan —
sama pentingnya — **apa yang tidak kami ketahui**. Versi data `1.0`, dihitung
2026-09-08 atas 2.134 heksagon H3 resolusi 9 di 213,19 km² sabuk kampus Sleman.

---

## 1. Yang perlu dipahami lebih dulu: skor ini RELATIF

Setiap indikator dinormalisasi sebagai **peringkat persentil (ECDF)** terhadap
seluruh wilayah studi, bukan terhadap standar absolut.

> **Skor 70 berarti "lebih baik daripada 70% kawasan lain di wilayah studi",
> bukan "70 dari 100".**

Konsekuensinya harus dinyatakan terbuka: kalau seluruh Sleman punya trotoar
buruk, kawasan dengan trotoar terbaik tetap mendapat persentil tinggi. Skor ini
membandingkan pilihan yang tersedia bagi mahasiswa, bukan menilai Sleman
terhadap kota lain.

Cara ini dipilih karena tahan pencilan dan bebas satuan — ia bisa menggabungkan
meter, rupiah, dan indeks vegetasi dalam satu kerangka tanpa membuat asumsi
sewenang-wenang tentang berapa "harga yang wajar" atau "jarak yang layak".

Sebaran skor akhir: minimum **14,4** · median **45,1** · maksimum **87,5**.

---

## 2. Empat dimensi dan cara menggabungkannya

| Dimensi | Bobot | Pertanyaan yang dijawab |
|---|---|---|
| Connectivity | 0,40 | Bisakah saya sampai ke kampus tanpa motor? |
| Affordability | 0,25 | Sanggupkah saya membayarnya? |
| Amenity | 0,20 | Bisakah saya makan dan berbelanja dengan jalan kaki? |
| Walkability | 0,15 | Nyaman dan amankah berjalan kaki di sini? |

```
subskor = Σ (bobot_indikator × persentil_indikator)
Skor    = 100 × (C+ε)^0,40 × (A+ε)^0,25 × (M+ε)^0,20 × (W+ε)^0,15   ε = 0,01
```

**Rata-rata geometrik, bukan aritmetik.** Ini keputusan yang disengaja: kawasan
dengan Connectivity 5 dan Amenity 95 akan terlihat "sedang" pada rata-rata
aritmetik, padahal bagi mahasiswa tanpa kendaraan kawasan itu salah pilihan.
Dengan rata-rata geometrik, satu dimensi yang mendekati nol menyeret seluruh
skor ke bawah — dan itu perilaku yang benar.

Bobot dimensi bisa digeser pengguna saat aplikasi berjalan. Bobot antar-indikator
di dalam dimensi tetap.

---

## 3. Enam belas indikator dan cakupannya

Kolom **cakupan** adalah jumlah heksagon yang benar-benar punya nilai. Selisihnya
dari 2.134 adalah heksagon yang datanya **tidak tersedia** — bukan bernilai nol.

### Connectivity — bobot 0,40

| Indikator | Bobot | Cakupan | Sumber |
|---|---|---|---|
| C1 jarak jaringan ke halte terdekat | 0,30 | **2.134** (100%) | OSM |
| C2 jumlah koridor unik dalam 400 m | 0,20 | **2.134** (100%) | relasi rute OSM |
| C3 keterjangkauan kampus | 0,40 | **2.134** (100%) | graf rute + 219 gerbang |
| C4 jarak ke stasiun KRL | 0,10 | **2.134** (100%) | OSM |

**C3 adalah tesis produk ini.** Halte 100 meter dari kos tidak berarti apa-apa
kalau tidak ada koridor yang membawa Anda ke kampus Anda. C3 menjawabnya dengan
membangun **graf transfer antarkoridor** — bukan sekadar melingkari halte.

Simpulnya adalah pasangan **(halte, koridor)**, bukan halte. Perbedaan itu
menentukan: 295 dari 589 halte dilayani lebih dari satu koridor, dan kalau halte
dijadikan simpul, halte bersama itu menyatukan seluruh 20 koridor menjadi satu
gumpalan sehingga berpindah koridor terhitung **nol transfer**. Dengan pasangan
(halte, koridor), tiap pergantian koridor menjadi sisi berbiaya 1.

Hasilnya, dari heksagon yang punya halte dalam jangkauan jalan kaki 800 m:

| Kampus | Terhubung langsung |
|---|---|
| UGM | 79,0% |
| UNY | 79,0% |
| Atma Jaya Babarsari | 55,3% |
| UIN Sunan Kalijaga | 51,1% |
| AMIKOM · UPN Veteran | 47,4% |
| Instiper | 47,2% |
| STIE YKPN | 43,4% |
| UII Kaliurang | 38,0% |
| **Sanata Dharma III** | **0%** |

UGM dan UNY identik karena keduanya kampus bersebelahan yang berbagi 27 halte;
koridor yang mencapai satu mencapai yang lain.

**Sanata Dharma III 0% adalah temuan, bukan cacat.** Halte terdekatnya berjarak
1.184 m lewat jaringan jalan kaki — di luar ambang 1.000 m yang dipakai. Ambang
itu sengaja tidak dinaikkan sampai semua kampus "lulus", karena justru inilah
yang ingin diungkap produk ini.

### Affordability — bobot 0,25

| Indikator | Bobot | Cakupan | Sumber |
|---|---|---|---|
| A1 harga sewa kos | 0,60 | **153** (7,2%) | survei lapangan |
| A2 harga makan | 0,40 | **0** (0%) | tidak ada |

Ini dimensi terlemah kami, dan kami menyatakannya terbuka.

**A1 tidak dimodelkan, dan itu keputusan berdasar bukti.** Kami menguji apakah
30 harga hasil survei bisa melatih model untuk seluruh wilayah. Validasi silang
leave-one-out:

| Pendekatan | R² | Galat rata-rata |
|---|---|---|
| tebak rata-rata saja | 0,000 | Rp 259.067 |
| Ridge, 9 fitur spasial | **−0,386** | Rp 297.467 |
| RandomForest | **−0,152** | Rp 284.665 |

R² negatif berarti model **lebih buruk** daripada menebak satu angka tetap.
Sebabnya struktural: **45% ragam harga terjadi antar-kos di jalan yang sama** —
di satu kawasan sampel harga berkisar Rp350.000 sampai Rp1.200.000. Itu ukuran
kamar, kamar mandi dalam atau luar, dan usia bangunan; tidak satu pun bersifat
spasial. Maka A1 hanya melaporkan harga di tempat yang benar-benar disurvei.

**A2 kosong** karena Menu Go — sumber yang direncanakan PRD — hanya memuat satu
record untuk seluruh wilayah. Kami juga memeriksa Properti Go (156 record, hanya
2 berkategori kos), Struck Go (tanpa kolom nominal), dataset kos MAPID (tanpa
kolom harga), dan dataset harga properti MAPID (harga jual, median Rp700 juta,
bukan sewa bulanan). Tidak ada yang bisa dipakai.

### Amenity — bobot 0,20

| Indikator | Bobot | Cakupan | Sumber |
|---|---|---|---|
| M1 kepadatan tempat makan | 0,35 | **2.134** (100%) | POI MAPID |
| M2 keragaman kuliner | 0,20 | **1.594** (74,7%) | POI MAPID |
| M3 keramaian | 0,20 | **0** (0%) | survei, terlalu jarang |
| M4 ragam layanan harian | 0,25 | **2.134** (100%) | POI MAPID |

M1 dan M2 menghitung tempat makan dalam **radius jalan kaki 800 m** dari pusat
heksagon, bukan di dalam heksagon. Heksagon resolusi 9 hanya selebar ~380 m,
sehingga warung 200 m di seberang batas — lima menit jalan kaki — akan terhitung
nol. Definisi lama itu mengukur kisi, bukan kawasan.

M2 kosong di 540 heksagon yang tidak punya tempat makan sama sekali dalam
jangkauan: tidak ada keragaman untuk diukur, dan itu berbeda dari keragaman nol.

M3 bersumber survei di 12 titik saja — terlalu jarang untuk 2.134 heksagon.

### Walkability — bobot 0,15

| Indikator | Bobot | Cakupan | Sumber |
|---|---|---|---|
| W1 kerapatan simpang | 0,15 | **2.134** (100%) | OSMnx |
| W2 keteduhan | 0,20 | **2.099** (98,4%) | Sentinel-2 NDVI |
| W3 penerangan | 0,15 | **1.775** (83,2%) | nighttime light MAPID |
| W4 keamanan banjir | 0,15 | **301** (14,1%) | bahaya banjir MAPID |
| W5 tekanan lalu lintas | 0,15 | **2.095** (98,2%) | OSM, dikalibrasi survei |
| W6 integritas jalur | 0,20 | **2.095** (98,2%) | model, dilatih survei |

**W6 dimodelkan, A1 tidak — dan bedanya terukur.** Diuji dengan cara yang sama,
W6 memberi R² **+0,394** dengan galat 31% lebih kecil daripada menebak
rata-rata. Sebabnya nyata: ketersediaan trotoar adalah fungsi hierarki jalan
(jalan raya rata-rata 0,449, jalan kecil 0,129, gang 0,044). Harga sewa tidak
punya keteraturan setara.

**W5 memakai pola kalibrasi.** Survei tidak dipakai langsung, tetapi
mengalibrasi aturan atas kelas jalan OSM yang cakupannya penuh. Buktinya kuat:
seluruh 20 gang tercatat "Sepi", dan 30 dari 31 ruas "Ramai" adalah jalan raya.

---

## 4. Kebijakan data hilang

| Tier | `sumber` | Perlakuan |
|---|---|---|
| Teramati | `survei`, `osm`, `mapid_poi`, `mapid`, `sentinel2` | dipakai langsung |
| Ditaksir | `model` | dipakai, **ditandai "estimasi"** di antarmuka |
| Tidak ada | `tidak_tersedia` | **dikeluarkan**, bobot dinormalisasi ulang |

**Tidak ada imputasi nilai tengah.** Menyembunyikan ketidaktahuan di balik angka
0,5 lebih buruk daripada mengatakan tidak tahu.

Aturan ini berlaku dua tingkat:

1. **Indikator hilang** → dikeluarkan dari subskor, bobot indikator sisanya di
   dalam dimensi itu dinormalisasi ulang.
2. **Dimensi hilang seluruhnya** → dikeluarkan dari rata-rata geometrik, bobot
   dimensi sisanya dinormalisasi ulang.

Aturan kedua penting karena Affordability tidak tersedia di 1.981 dari 2.134
heksagon. Tanpa aturan itu, dimensi kosong akan bernilai 0 dan menyeret heksagon
tipikal dari skor 46,9 menjadi **17,9** — menghukum 93% peta karena **ketiadaan
data**, bukan karena kawasannya mahal.

Untuk heksagon tanpa Affordability, bobot efektifnya menjadi
Connectivity 0,533 · Amenity 0,267 · Walkability 0,200.

---

## 5. Batasan yang harus diketahui pembaca

**Survei mengambil sampel jalan arteri secara berlebih.** 47,6% ruas yang
disurvei adalah jalan raya, padahal jalan raya hanya 12,9% panjang jaringan
nyata. Surveyor sengaja memilih ruas beragam agar tiap kondisi terwakili —
metode yang benar — tetapi karena trotoar hampir hanya ada di jalan arteri,
**angka W6 hasil survei mentah terlihat lebih baik daripada kenyataan**. Nilai
model yang lebih rendah adalah koreksinya.

**Koordinat kos dipulihkan setelah survei, bukan direkam saat survei.** Titik kos
diturunkan dari nama jalan lewat gazetteer OSM. Tiap titik membawa label
`presisi_koordinat`: 18 lewat ruas terkait, 8 memakai pusat kawasan, 3 diisi
manual, 2 dari nama jalan di catatan kos.

**Cahaya malam bukan ukuran lampu jalan.** W3 adalah proksi rasa aman berjalan
selepas magrib. Jalan pertokoan terang dan lapangan parkir bersorot terbaca sama
oleh satelit.

**Peta bahaya banjir hanya menjangkau 14,1% wilayah.** Layer ini memetakan
kawasan rawan banjir, bukan seluruh kabupaten. Heksagon yang tidak tersentuh
diberi `tidak_tersedia`, **bukan** aman — kami memeriksa layer risiko banjir
sebagai pembanding dan cakupannya setara (14,3%), jadi kelangkaan ini melekat
pada datanya.

**Skor tidak berubah kecuali pipeline dijalankan ulang.** Seluruh analisis
spasial berjalan luring sebelum penerbitan; aplikasi hanya membaca berkas statis
dan menghitung ulang agregasi saat pengguna menggeser bobot.

---

## 6. Sumber data

| Sumber | Dipakai untuk |
|---|---|
| MAPID Database (Premium) | POI makanan, apotek, minimarket, toko kelontong, bahaya banjir, nighttime light, halte, kos |
| MAPID Apps (Activities) | 158 foto lapangan sebagai lapisan bukti |
| OpenStreetMap | jaringan pejalan kaki (71.045 simpul), 20 koridor Trans Jogja, halte, stasiun, gerbang kampus |
| Sentinel-2 (Google Earth Engine) | NDVI keteduhan |
| Survei lapangan tim | 84 ruas, 12 halte, 12 titik ekonomi, 31 kos |

Survei lapangan dilakukan tim cinajawabatak di 12 kawasan sampel. Angka survei
masuk lewat pipeline; foto dan lokasinya hidup di MAPID Apps sebagai lapisan
bukti untuk narasi AI.

---

## 7. Keterlacakan

Setiap keputusan metodologis di atas, termasuk yang salah lalu diperbaiki,
tercatat di [`PIPELINE_LOG.md`](PIPELINE_LOG.md) beserta alasan dan angkanya.
Anomali data survei dan penanganannya tercatat di
[`SURVEI_ANOMALI.md`](SURVEI_ANOMALI.md).
