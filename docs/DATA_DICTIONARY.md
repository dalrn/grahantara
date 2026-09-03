# Kamus Data

Enam belas indikator, empat dimensi. Bobot di kolom terakhir adalah bobot **di dalam
dimensinya**, bukan bobot terhadap skor total.

## Connectivity — bobot dimensi 0,40

Tidak satu pun bergantung pada survei lapangan. Seluruhnya bisa dihitung untuk 2.134
heksagon sejak hari ini.

| Kunci | Definisi | Rumus | Sumber | Bobot |
|---|---|---|---|---|
| `C1_jarak_halte` | Jarak jaringan pejalan kaki ke halte terdekat | `exp(-d/400)` | OSM | 0,30 |
| `C2_rute_unik` | Jumlah rute berbeda dalam radius jalan kaki 400 m | `1 - exp(-r/2)` | OSM relasi rute | 0,20 |
| `C3_keterjangkauan_kampus` | Apakah halte terdekat membawa ke kampus tujuan | Diskrit: langsung 1,00 · satu transfer 0,60 · dua transfer / tidak terjangkau 0,20 | OSM graf rute + 219 gerbang | 0,40 |
| `C4_jarak_krl` | Jarak jaringan ke stasiun KRL terdekat | `exp(-d/800)` | OSM + KAI Commuter | 0,10 |

`C3` adalah tesis produk ini dan sekaligus bagian tersulit. Butuh graf antarrute Trans Jogja
(20 koridor), bukan sekadar buffer di sekitar halte.

## Affordability — bobot dimensi 0,25

| Kunci | Definisi | Rumus | Sumber | Bobot |
|---|---|---|---|---|
| `A1_harga_kos` | Median harga sewa bulanan | `1 - persentil(median)` | Survei (29 titik) → **model** | 0,60 |
| `A2_harga_makan` | Median harga per porsi | `1 - persentil(median)` | Survei / Menu Go | 0,40 |

**Peringatan.** Survei menghasilkan 29 kos berharga di 12 area sampel. Jumlah heksagon
dengan ≥3 kos berharga mendekati nol, jadi ambang "minimal 3 kos" yang ada di PRD tidak
bisa dipakai apa adanya di resolusi heksagon. `A1` akan sebagian besar bersumber `model`.
`A2` kemungkinan `tidak_tersedia` di hampir seluruh wilayah kecuali Menu Go menutupinya.

## Amenity — bobot dimensi 0,20

| Kunci | Definisi | Rumus | Sumber | Bobot |
|---|---|---|---|---|
| `M1_kepadatan_makan` | Jumlah titik tempat makan per heksagon | `1 - exp(-n/5)` | MAPID POI | 0,35 |
| `M2_keragaman` | Keragaman jenis tempat makan | Shannon entropy ternormalisasi | MAPID POI | 0,20 |
| `M3_keramaian` | Proksi footfall | Ordinal: sepi 0 · sedang 0,5 · ramai 1 | Survei (12 titik) | 0,20 |
| `M4_layanan_harian` | Kategori layanan nonkuliner ≤800 m | `k/3` (apotek, minimarket, warung) | MAPID POI | 0,25 |

Delapan puluh persen dimensi ini berjalan di atas POI premium MAPID yang menutupi seluruh
wilayah studi. Hanya `M3` yang terikat survei, dan 12 titik terlalu sedikit — kemungkinan
besar `tidak_tersedia` dengan bobot dinormalisasi ulang ke M1/M2/M4.

## Walkability — bobot dimensi 0,15

| Kunci | Definisi | Rumus | Sumber | Bobot |
|---|---|---|---|---|
| `W1_kerapatan_simpang` | Simpang jalan kaki per km² | Persentil | OSMnx | 0,15 |
| `W2_keteduhan` | NDVI rata-rata dalam buffer 15 m sepanjang jalur | Persentil | Sentinel-2 | 0,20 |
| `W3_penerangan` | Radiansi malam | `log(1+x)`, persentil | VIIRS | 0,15 |
| `W4_banjir` | Keamanan dari genangan | `1 - indeks bahaya` | InaRISK | 0,15 |
| `W5_tekanan_lalin` | Tekanan lalu lintas terhadap pejalan | Kelas jalan OSM + lebar, **dikalibrasi** ke survei | OSM + survei | 0,15 |
| `W6_integritas_jalur` | Kondisi mikro trotoar | Indeks komposit 5 komponen, lihat bawah | Survei (73 ruas) → **model** | 0,20 |

`W5` sudah menggunakan pola kalibrasi: survei tidak dipakai langsung, tapi melatih model di
atas data sekunder yang menutupi seluruh wilayah. Pola yang sama dipakai untuk `A1` dan `W6`.

### Indeks Integritas (W-6)

| Kode | Komponen | Kolom survei | Definisi | Bobot |
|---|---|---|---|---|
| I-1 | Ketersediaan trotoar | `Trotoar` | Ada 1,0 · Sebagian 0,5 · Tidak ada 0,0 | 0,25 |
| I-2 | Kecukupan lebar | `Lebar Trotoar (m)` | `min(lebar/1,5 , 1)` | 0,15 |
| I-3 | Keutuhan | `Panjang trotoar terputus (m)`, `Panjang ruas (m)` | `1 - (terputus/panjang)` | 0,20 |
| I-4 | Kemulusan permukaan | `Jumlah lubang atau paving lepas`, `Panjang ruas (m)` | `exp(-lubang per 100 m)` | 0,15 |
| I-5 | Keterpaksaan turun ke jalan | `Pejalan turun ke jalan` | Tidak 1,0 · Ya 0,0 | 0,25 |

Setelah aturan **nol struktural** (kalau `Trotoar = "Tidak ada"` maka lebar dan panjang
terputus adalah 0, bukan kosong), 73 dari 84 ruas bisa dihitung. Sebelas sisanya
terkonsentrasi di KWS-09.

## Agregasi

```
subskor  = Σ (bobot_indikator × persentil_indikator)   dinormalisasi ulang bila ada yang tidak tersedia
Skor     = 100 × (C+ε)^0,40 × (A+ε)^0,25 × (M+ε)^0,20 × (W+ε)^0,15
ε        = 0,01
```

Semua indikator dinormalisasi sebagai **peringkat persentil (ECDF)** terhadap satu pool
berisi seluruh wilayah studi. Ini membuat skor tahan pencilan dan bebas satuan, tapi juga
berarti skor bersifat **relatif** — skor 70 artinya lebih baik dari 70% kawasan lain di
Sleman, bukan 70 dari 100 secara absolut. Ini perlu dinyatakan di halaman metodologi.

## Kebijakan data hilang

| Tier | `sumber` | Perlakuan |
|---|---|---|
| 1 Teramati | `survei` dan sumber sekunder | Pakai langsung |
| 2 Ditaksir | `model` | Pakai, tapi **wajib ditandai** di UI |
| 3 Tidak ada | `tidak_tersedia` | Keluarkan dari perhitungan, normalisasi ulang bobot dalam dimensinya |

Tidak ada imputasi netral 0,5. Menyembunyikan ketidaktahuan di balik angka tengah lebih
buruk daripada mengatakan tidak tahu, dan penilai kompetisi akan menemukannya.
