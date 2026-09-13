# Metodologi Grahantara

Dokumen ini menjelaskan bagaimana Skor Grahantara dihitung, dari data apa, dan
apa saja batasannya. Versi data `1.0`, dihitung 2026-09-12 atas 2.134 heksagon
H3 resolusi 9 yang menutup 213,19 km² sabuk kampus Sleman, DIY.

---

## 1. Skor ini bersifat relatif

Setiap indikator dinormalisasi sebagai peringkat persentil (ECDF) terhadap
seluruh wilayah studi, bukan terhadap standar absolut.

> Skor 70 berarti "lebih baik daripada 70% kawasan lain di wilayah studi",
> bukan "70 dari 100".

Konsekuensinya kami nyatakan terbuka: kalau seluruh Sleman punya trotoar buruk,
kawasan dengan trotoar terbaik tetap mendapat persentil tinggi. Skor ini
membandingkan pilihan yang tersedia bagi mahasiswa di wilayah itu, bukan
menilai Sleman terhadap kota lain.

Cara ini dipilih karena tahan pencilan dan bebas satuan. Ia bisa menggabungkan
meter, rupiah, dan indeks vegetasi dalam satu kerangka tanpa menetapkan
sendiri berapa "harga yang wajar" atau "jarak yang layak".

Sebaran skor akhir pada data ini: minimum **27,8**, median **45,5**, maksimum
**75,4**.

---

## 2. Empat dimensi dan cara menggabungkannya

| Dimensi | Bobot | Pertanyaan yang dijawab |
|---|---|---|
| Akses transportasi | 0,40 | Bisakah saya sampai ke kampus tanpa motor? |
| Biaya | 0,25 | Sanggupkah saya membayarnya? |
| Fasilitas | 0,20 | Bisakah saya makan dan berbelanja dengan jalan kaki? |
| Lingkungan jalan kaki | 0,15 | Nyaman dan amankah berjalan kaki di sini? |

```
subskor = Σ (bobot_indikator × persentil_indikator)
Skor    = 100 × (C+ε)^0,40 × (A+ε)^0,25 × (M+ε)^0,20 × (W+ε)^0,15   ε = 0,01
```

Yang dipakai adalah rata-rata geometrik, bukan aritmetik. Ini keputusan yang
disengaja: kawasan dengan akses transportasi 5 dan fasilitas 95 akan terlihat
sedang-sedang saja pada rata-rata aritmetik, padahal bagi mahasiswa tanpa
kendaraan kawasan itu jelas salah pilihan. Dengan rata-rata geometrik, satu
dimensi yang mendekati nol menyeret seluruh skor ke bawah.

Konstanta ε = 0,01 menjaga fungsi tetap terdefinisi saat sebuah subskor nol.
Akibatnya skor terendah yang mungkin adalah 1, bukan 0, dan hasil yang melebihi
100 dipotong di 100.

Bobot antar-dimensi bisa digeser pengguna saat aplikasi berjalan. Bobot
antar-indikator di dalam satu dimensi tetap.

### Rentang tiap subskor

Subskor dan skor akhir berada pada skala yang berbeda. Subskor adalah
rata-rata persentil, jadi sebarannya melebar hampir penuh. Skor akhir adalah
rata-rata geometrik atas keempatnya, dan rata-rata geometrik menarik nilai
ekstrem ke tengah.

| Ukuran | Minimum | Median | Maksimum |
|---|---|---|---|
| Skor akhir | 27,8 | 45,5 | 75,4 |
| Akses transportasi | 21,9 | 41,0 | 93,1 |
| Biaya | 0,2 | 51,8 | 99,1 |
| Fasilitas | 9,0 | 52,5 | 88,4 |
| Lingkungan jalan kaki | 25,5 | 50,1 | 77,5 |

Karena itu sebuah subskor bisa melampaui skor tertinggi di legenda peta tanpa
ada yang keliru. Legenda mewarnai skor akhir, bukan subskor.

---

## 3. Enam belas indikator

Seluruh indikator tercakup penuh pada 2.134 heksagon (100%).

### Akses transportasi, bobot 0,40

| Indikator | Bobot | Cara hitung | Sumber |
|---|---|---|---|
| C1 jarak halte | 0,30 | `exp(-jarak / 400 m)` | OpenStreetMap |
| C2 rute unik | 0,20 | `1 - exp(-jumlah rute / 2)` | OpenStreetMap |
| C3 keterjangkauan kampus | 0,40 | 0 transfer 1,00; 1 transfer 0,60; tidak terjangkau 0,20 | OpenStreetMap |
| C4 jarak stasiun KRL | 0,10 | `exp(-jarak / 800 m)` | OpenStreetMap |

Seluruh jarak diukur menyusuri graf jalan kaki, bukan garis lurus, dari titik
tengah heksagon.

**C3 adalah inti produk ini.** Halte 100 m dari kos tidak berarti apa-apa kalau
tidak ada koridor yang membawa penumpang ke kampusnya. Karena itu simpul
grafnya adalah pasangan (halte, koridor), bukan halte. Sebanyak 295 dari 589
halte dilayani lebih dari satu koridor; memakai halte sebagai simpul akan
menyatukan 20 koridor menjadi satu gumpalan dan membuat semua kampus tampak
terjangkau langsung.

Halte dianggap terjangkau bila berjarak paling jauh 800 m jalan kaki, dan
kampus terjangkau bila paling jauh 1.000 m dari halte tujuan.

### Biaya, bobot 0,25

| Indikator | Bobot | Cara hitung | Sumber |
|---|---|---|---|
| A1 harga sewa kos | 0,60 | harga median, arah dibalik | survei lapangan |
| A2 harga makan | 0,40 | harga median per porsi, arah dibalik | survei lapangan |

A1 dilaporkan apa adanya dari survei, tidak dimodelkan. Keputusan itu berdasar
bukti: validasi silang leave-one-out atas label harga memberi R² negatif untuk
Ridge maupun RandomForest, keduanya lebih buruk daripada menebak rata-rata.
Sebabnya struktural, yaitu sebagian besar ragam harga terjadi antar-kos di
jalan yang sama (ukuran kamar, kamar mandi dalam, usia bangunan), dan tidak
satu pun dari faktor itu bersifat spasial.

### Fasilitas, bobot 0,20

| Indikator | Bobot | Cara hitung | Sumber |
|---|---|---|---|
| M1 kepadatan tempat makan | 0,35 | `1 - exp(-jumlah / 5)` | POI MAPID |
| M2 keragaman kuliner | 0,20 | indeks Shannon ternormalisasi | POI MAPID |
| M3 keramaian kawasan | 0,20 | pejalan per 10 menit | survei lapangan |
| M4 layanan harian | 0,25 | jumlah kategori hadir dibagi 3 | POI MAPID |

M1, M2, dan M4 dihitung dalam radius 800 m dari titik tengah heksagon, bukan
hanya di dalam heksagon. Sel resolusi 9 hanya selebar sekitar 380 m, sehingga
warung 200 m di luar batas akan terhitung nol padahal jaraknya lima menit
jalan kaki.

M2 memakai indeks keragaman Shannon atas kategori tempat makan, dinormalisasi
dengan membaginya dengan logaritma jumlah kategori yang hadir sehingga
hasilnya berada di rentang 0 sampai 1. Satu kategori saja bernilai 0.

M4 menghitung berapa dari tiga kategori (apotek, minimarket, warung kelontong)
yang hadir, bukan berapa banyak tokonya. Dua minimarket tetap dihitung satu
kategori.

### Lingkungan jalan kaki, bobot 0,15

| Indikator | Bobot | Cara hitung | Sumber |
|---|---|---|---|
| W1 kerapatan simpang | 0,15 | simpang per km² | OpenStreetMap |
| W2 keteduhan | 0,20 | NDVI rata-rata, buffer 15 m sepanjang jalur | Sentinel-2 |
| W3 penerangan malam | 0,15 | `log(1 + radiansi)` | lapisan MAPID |
| W4 keamanan dari genangan | 0,15 | `1 - indeks bahaya banjir` | lapisan MAPID |
| W5 ketenangan lalu lintas | 0,15 | `1 - tekanan`, dari kelas jalan | OpenStreetMap |
| W6 jalur pejalan kaki | 0,20 | model dari kelas jalan dan lebar | model |

W2 dihitung dari komposit median Sentinel-2 musim kemarau yang sudah
dibersihkan awan, sehingga satu lintasan berawan tidak menggeser hasilnya.

W3 adalah proksi rasa aman berjalan selepas magrib, bukan hitungan lampu
jalan. Jalan pertokoan yang terang dan lapangan bersorot tampak sama terang
pada citra, dan resolusi rasternya ratusan meter sehingga hanya sah sebagai
proksi tingkat kawasan.

**W6 adalah satu-satunya indikator hasil estimasi model**, dan di antarmuka
selalu diberi penanda "estimasi". Penjelasan lengkapnya ada di bagian 5.

---

## 4. Polaritas indikator

Sebagian indikator berpolaritas terbalik: nilai lebih kecil berarti kondisi
lebih baik. Jarak ke halte 200 m lebih baik daripada 2.000 m, dan harga sewa
Rp 600 ribu lebih baik daripada Rp 1,4 juta.

Peringkat persentil tidak membalik arah dengan sendirinya. Yang dilakukan
adalah membalik arahnya lebih dulu di tingkat indikator, sebelum persentil
dihitung, dan tiap indikator memakai transformasi yang sesuai sifatnya:

- C1 dan C4 memakai peluruhan eksponensial atas jaraknya, `exp(-jarak/400 m)`
  dan `exp(-jarak/800 m)`, sehingga jarak besar meluruh mendekati nol.
- A1 dan A2 memakai harga yang dinegatifkan, sehingga harga termurah menempati
  peringkat tertinggi.
- W4 dan W5 menyimpan `1 - indeks bahaya` dan `1 - tekanan`. Itu sebabnya
  keduanya dinamai menurut hal baiknya, yaitu keamanan dan ketenangan.

Akibatnya setiap nilai yang tersimpan sudah berorientasi "makin tinggi makin
baik", dan langkah persentil tidak perlu tahu apa pun soal polaritas.

---

## 5. Indikator hasil estimasi

Ketersediaan jalur pejalan kaki tidak ada sebagai data siap pakai untuk
seluruh wilayah. Memetakannya berarti menyurvei tiap ruas jalan, sementara
survei tim mencakup 83 ruas, kurang dari satu persen wilayah studi.

Karena itu W6 ditaksir dari dua hal yang dipunyai OpenStreetMap di seluruh
wilayah, yaitu kelas jalan dan lebar jalan bila tercatat, dengan model yang
dilatih pada ruas hasil survei.

Keputusan memodelkan diuji, bukan diasumsikan. Dengan validasi silang
leave-one-out atas ruas survei:

| Model | R² | Galat rata-rata |
|---|---|---|
| Menebak rata-rata | 0,000 | 0,285 |
| Kelas jalan saja | +0,262 | 0,220 |
| Kelas jalan dan lebar | **+0,394** | **0,197** |

Model dipakai karena menjelaskan sekitar 39% ragam, jauh lebih baik daripada
menebak. Yang membuatnya bekerja adalah keteraturan tata kota yang nyata:
jalan arteri diberi trotoar, gang tidak. Pada ruas survei, rata-rata keutuhan
jalur di jalan raya 0,449 sementara di gang 0,044.

Kepadatan kendaraan sengaja tidak dipakai sebagai fitur meski menambah sedikit
ketepatan, karena angkanya berasal dari survei yang sama dan W5 sudah memakai
kelas jalan yang sama. Memasukkannya berarti menghitung satu fitur dua kali.

Sebagai pembanding, A1 diuji dengan cara yang sama dan justru tidak dimodelkan
karena hasilnya lebih buruk daripada menebak rata-rata.

---

## 6. Kebijakan data hilang

Aturan ini tetap berlaku meski pada data versi 1.0 seluruh indikator tercakup
penuh, karena data berikutnya belum tentu demikian.

| Keadaan | Ditulis sebagai | Perlakuan di skor |
|---|---|---|
| Diukur langsung | `survei` | dipakai biasa |
| Data sekunder | `osm`, `mapid`, `mapid_poi`, `sentinel2` | dipakai biasa |
| Ditaksir model | `model` | dipakai, diberi penanda "estimasi" |
| Tidak ada data | `tidak_tersedia` | dikeluarkan, bobot dinormalisasi ulang |

Aturannya berlaku dua tingkat. Indikator yang hilang dikeluarkan dari subskor
dan bobot indikator sisanya di dalam dimensi itu dinormalisasi ulang. Dimensi
yang seluruh indikatornya hilang dikeluarkan dari rata-rata geometrik dan
bobot dimensi sisanya dinormalisasi ulang; dimensi itu didaftar di
`properties.dimensi_kosong` dan ditulis 0 pada `subskor` hanya demi kesesuaian
skema.

Tidak ada imputasi netral 0,5, dan nilai kosong tidak pernah dirender sebagai
nol. Menampilkan data yang belum ada sebagai nol akan membuat kawasan terlihat
buruk padahal yang sebenarnya terjadi adalah kami tidak tahu.

---

## 7. Batasan yang perlu diketahui pembaca

- Skor bersifat relatif terhadap wilayah studi, bukan nilai mutlak. Kawasan
  berskor tertinggi adalah yang terbaik di Sleman, bukan yang memenuhi standar
  tertentu.
- Unit analisisnya kawasan seluas sekitar 0,105 km², bukan bangunan. Skor
  tinggi tidak menjamin setiap kos di dalamnya cocok, dan skor rendah tidak
  berarti tidak ada kos bagus di sana.
- Harga sewa berasal dari survei lapangan pada sejumlah titik. Sebagian
  diperoleh dari media sosial dan spanduk, bukan seluruhnya wawancara
  langsung.
- Sebagian koordinat kos adalah perkiraan tingkat ruas jalan, bukan titik
  bangunan.
- W3 memakai raster cahaya malam beresolusi ratusan meter, sehingga hanya sah
  sebagai proksi tingkat kawasan, bukan tingkat jalan.
- W6 adalah hasil estimasi model, bukan pengukuran langsung di tiap ruas.
- Daftar tempat di panel kawasan memuat titik di dalam heksagon, sedangkan
  skor Fasilitas menghitung radius 800 m dari titik tengahnya. Keduanya memang
  berbeda dan antarmuka menyebutkan perbedaan itu.

---

## 8. Sumber data

| Sumber | Dipakai untuk |
|---|---|
| OpenStreetMap | graf jalan kaki, halte, rute, stasiun, kelas jalan |
| Lapisan POI MAPID | tempat makan, minimarket, apotek, warung kelontong |
| Lapisan non-POI MAPID | cahaya malam 2023, bahaya banjir |
| Sentinel-2 | NDVI untuk keteduhan |
| Survei lapangan tim | harga sewa, harga makan, keramaian, kalibrasi jalur pejalan |

Seluruh pengambilan data MAPID dilakukan di sisi backend pada tahap pipeline
offline. Aplikasi web hanya memuat berkas hasil olahan yang statis.

---

## 9. Keterlacakan

Seluruh angka di aplikasi berasal dari `web/public/data/hexagons.geojson`, yang
memuat blok `metadata` berisi versi, waktu hitung, jumlah heksagon, dan bobot
bawaan. Kontrak datanya ada di `contracts/hexagon.schema.json`.

Pipeline menjalankan tiga lapis pemeriksaan di akhir setiap proses: uji logika
skoring, validasi kesesuaian skema, dan uji invarian isi yang memeriksa hal
yang lolos skema tetapi tetap keliru, misalnya himpunan heksagon yang bergeser
dari indeks beku, skor yang tidak cocok dengan subskornya sendiri, atau nilai
`tidak_tersedia` yang bocor menjadi angka.
