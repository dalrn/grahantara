# Kamus Data

Definisi presisi enam belas indikator Grahantara. Bobot di kolom terakhir
adalah bobot **di dalam dimensinya**, bukan terhadap skor total.

Seluruh indikator tercakup penuh pada 2.134 heksagon (data versi 1.0).
Seluruh jarak diukur menyusuri graf jalan kaki dari titik tengah heksagon,
bukan garis lurus, dan dihitung pada proyeksi meter EPSG:32749 (UTM 49S).

---

## Akses transportasi, bobot dimensi 0,40

| Kunci | Definisi | Rumus | Sumber | Bobot |
|---|---|---|---|---|
| `C1_jarak_halte` | Jarak jalan kaki ke halte terdekat | `exp(-d/400)` | OpenStreetMap | 0,30 |
| `C2_rute_unik` | Jumlah koridor berbeda yang terjangkau | `1 - exp(-r/2)` | OpenStreetMap | 0,20 |
| `C3_keterjangkauan_kampus` | Apakah koridor yang lewat benar-benar sampai ke kampus | Diskrit: langsung 1,00; satu transfer 0,60; tidak terjangkau 0,20 | OpenStreetMap | 0,40 |
| `C4_jarak_krl` | Jarak jalan kaki ke stasiun KRL terdekat | `exp(-d/800)` | OpenStreetMap | 0,10 |

`C3` memakai graf antarkoridor Trans Jogja, bukan buffer di sekitar halte.
Simpulnya adalah pasangan (halte, koridor), karena 295 dari 589 halte dilayani
lebih dari satu koridor. Memakai halte sebagai simpul akan menyatukan 20
koridor menjadi satu komponen terhubung dan membuat semua kampus tampak
terjangkau langsung.

Halte dianggap terjangkau bila paling jauh 800 m jalan kaki dari titik tengah
heksagon, dan kampus terjangkau bila paling jauh 1.000 m dari halte tujuan.
Tujuannya adalah 219 gerbang kampus, bukan titik tengah kampus, karena pintu
masuk yang berbeda bisa berjarak ratusan meter.

---

## Biaya, bobot dimensi 0,25

| Kunci | Definisi | Rumus | Sumber | Bobot |
|---|---|---|---|---|
| `A1_harga_kos` | Harga sewa bulanan median di sekitar kawasan | harga median, arah dibalik | survei lapangan | 0,60 |
| `A2_harga_makan` | Harga median per porsi | harga median, arah dibalik | survei lapangan | 0,40 |

`A1` dilaporkan apa adanya dari survei dan tidak dimodelkan. Pemodelan diuji
dan ditolak berdasarkan bukti: validasi silang leave-one-out atas label harga
memberi R² −0,386 (Ridge) dan −0,152 (RandomForest), keduanya lebih buruk
daripada menebak rata-rata. Sebabnya struktural, yaitu sebagian besar ragam
harga terjadi antar-kos di jalan yang sama (ukuran kamar, kamar mandi dalam,
usia bangunan), dan tidak satu pun faktor itu bersifat spasial.

---

## Fasilitas, bobot dimensi 0,20

| Kunci | Definisi | Rumus | Sumber | Bobot |
|---|---|---|---|---|
| `M1_kepadatan_makan` | Jumlah tempat makan dalam radius 800 m | `1 - exp(-n/5)` | POI MAPID | 0,35 |
| `M2_keragaman` | Keragaman jenis tempat makan dalam radius yang sama | indeks Shannon ternormalisasi | POI MAPID | 0,20 |
| `M3_keramaian` | Cacah pejalan per 10 menit | persentil | survei lapangan | 0,20 |
| `M4_layanan_harian` | Kategori layanan harian dalam radius 800 m | `k/3` (apotek, minimarket, warung kelontong) | POI MAPID | 0,25 |

`M1`, `M2`, dan `M4` dihitung dalam radius 800 m dari titik tengah heksagon,
bukan hanya di dalam heksagon. Heksagon resolusi 9 hanya selebar sekitar
380 m, sehingga warung 200 m di seberang batas, yang sebenarnya lima menit
jalan kaki, akan terhitung nol. Radius 800 m dipilih agar konsisten dengan
anggaran jalan kaki `C3`.

`M2` memakai indeks keragaman Shannon atas kategori tempat makan,
dinormalisasi dengan membaginya dengan logaritma jumlah kategori yang hadir,
sehingga hasilnya berada di rentang 0 sampai 1. Satu kategori saja bernilai 0.

`M4` menghitung berapa dari tiga kategori yang hadir, bukan berapa banyak
tokonya. Dua minimarket tetap dihitung satu kategori. Lapisan POI yang dipakai
sengaja yang paling spesifik, yaitu apotek dan bukan seluruh lapisan kesehatan,
serta minimarket yang sudah memuat semua merek.

---

## Lingkungan jalan kaki, bobot dimensi 0,15

| Kunci | Definisi | Rumus | Sumber | Bobot |
|---|---|---|---|---|
| `W1_kerapatan_simpang` | Simpang jalan kaki per km² | persentil | OpenStreetMap | 0,15 |
| `W2_keteduhan` | NDVI rata-rata dalam buffer 15 m sepanjang jalur | persentil | Sentinel-2 | 0,20 |
| `W3_penerangan` | Radiansi cahaya malam | `log(1+x)`, persentil | lapisan MAPID 2023 | 0,15 |
| `W4_banjir` | Keamanan dari genangan | `1 - indeks bahaya` | lapisan MAPID | 0,15 |
| `W5_tekanan_lalin` | Ketenangan lalu lintas bagi pejalan | `1 - tekanan`, dari kelas jalan, dikalibrasi survei | OpenStreetMap | 0,15 |
| `W6_integritas_jalur` | Ketersediaan dan keutuhan jalur pejalan kaki | model dari kelas jalan dan lebar | model | 0,20 |

`W4` dan `W5` menyimpan kebalikan dari hal buruknya, sehingga nilai tinggi
berarti aman dan tenang. Penamaannya mengikuti arti nilai yang tersimpan.

`W6` adalah satu-satunya indikator hasil estimasi dan selalu diberi penanda
"estimasi" di antarmuka. Prediksinya dirata-ratakan berbobot panjang jalan di
dalam heksagon, sehingga kawasan dinilai dari jalur yang benar-benar dilewati
pejalan.

### Indeks Integritas, komponen penyusun W6

Indeks ini dihitung dari survei lapangan, lalu dipakai sebagai label pelatihan
model.

| Kode | Komponen | Definisi | Bobot |
|---|---|---|---|
| I1 | Ketersediaan trotoar | ada 1,0; sebagian 0,5; tidak ada 0,0 | 0,25 |
| I2 | Kecukupan lebar | `min(lebar / 1,5 , 1)` | 0,15 |
| I3 | Keutuhan | `1 - (panjang terputus / panjang ruas)` | 0,20 |
| I4 | Kemulusan permukaan | `exp(-lubang per 100 m)` | 0,15 |
| I5 | Keterpaksaan turun ke jalan | tidak 1,0; ya 0,0 | 0,25 |

Berlaku aturan nol struktural: bila trotoar tidak ada, maka lebar dan panjang
terputus bernilai 0, bukan kosong. Dengan aturan itu 76 dari 84 ruas survei
bisa dihitung, dan delapan sisanya tersebar di beberapa area sampel, bukan
terkonsentrasi di satu area.

---

## Agregasi

```
subskor = Σ (bobot_indikator × persentil_indikator), dinormalisasi ulang
          bila ada indikator yang tidak tersedia
Skor    = 100 × (C+ε)^0,40 × (A+ε)^0,25 × (M+ε)^0,20 × (W+ε)^0,15
ε       = 0,01
```

Tiap indikator lebih dulu diubah menjadi peringkat persentil (ECDF) terhadap
seluruh heksagon wilayah studi yang punya nilai untuk indikator itu. Nilai yang
sama mendapat peringkat rata-rata, dan indikator tanpa data tidak mendapat
persentil sama sekali.

Penjelasan lengkap rumus, polaritas, dan kebijakan data hilang ada di
[METHODOLOGY.md](METHODOLOGY.md).

---

## Field pada berkas data

Tiap indikator di `web/public/data/hexagons.geojson` berbentuk:

```json
{
  "nilai": 483.2,
  "satuan": "m",
  "persentil": 0.79,
  "sumber": "osm"
}
```

| Field | Arti |
|---|---|
| `nilai` | Angka asli dalam satuannya. `null` bila tidak tersedia. |
| `satuan` | Satuan `nilai`. `null` untuk indikator kategorikal. |
| `persentil` | Peringkat 0 sampai 1 terhadap wilayah studi. `null` bila tidak tersedia. |
| `sumber` | Asal nilai: `survei`, `osm`, `mapid`, `mapid_poi`, `sentinel2`, `model`, atau `tidak_tersedia`. |

Kontrak lengkapnya ada di `contracts/hexagon.schema.json`.
