# Penggunaan 18 Layer MAPID

Audit per 2026-09-08. Menjawab: apa sebenarnya kegunaan tiap berkas di
`data/raw/mapid/`.

## Dipakai langsung menghitung indikator — 5 layer

| Layer | Indikator | Peran |
|---|---|---|
| `makanan_minuman_2025` | **M1, M2** | 1.338 tempat makan; kepadatan dan entropi keragaman |
| `apotek_2025` | **M4** | satu dari tiga kategori layanan harian |
| `minimarket_2025` | **M4** | kategori kedua; sudah memuat semua merek |
| `toko_kelontong_2025` | **M4** | kategori ketiga, "warung" |
| `bahaya_banjir` | **W4** | indeks bahaya lima kelas |
| `nighttime_light_2023` | **W3** | radians malam, menggantikan VIIRS lewat GEE |

## Dipakai untuk memilih layer di atas — bukan hitungan, tapi menentukan

| Layer | Kegunaan |
|---|---|
| `kesehatan_pengobatan_2025` | Membuktikan seluruh 425 apotek adalah subsetnya, sehingga M4 memakai `apotek` saja dan tidak dobel hitung |
| `perdagangan_retail_2025` | Membuktikan `toko_makanan_minuman` seluruhnya subsetnya, dan `toko_kelontong` **bukan** — itulah alasan kelontong dipakai sebagai warung |
| `toko_makanan_minuman_2025` | Dibandingkan dengan `makanan_minuman` dan terbukti hanya 9 titik beririsan; membuktikan keduanya beda konsep (tempat makan vs toko bahan makanan) |
| `risiko_banjir` | Dibandingkan dengan `bahaya_banjir`; cakupannya setara (14,3% vs 14,1%) tapi kelasnya hanya tiga, jadi `bahaya_banjir` yang dipakai |

Keempatnya **tidak** masuk skor, tetapi tanpa keduanya kita akan salah memilih
layer dan menggelembungkan M4 hampir dua kali lipat. Itu kerja yang nyata.

## Diuji untuk A1 lalu DITOLAK berdasarkan bukti

| Layer | Hasil uji |
|---|---|
| `harga_properti_2024` | Korelasi dengan harga kos survei hanya +0,20 pada radius 1 km, dan **berganti tanda** jadi −0,28 pada 500 m. Ketidakstabilan itu ciri derau. Isinya juga harga **jual** properti (median Rp700 juta), bukan sewa bulanan |
| `kos_sleman_2025` | Tidak ada kolom harga. Sebagai kovariat kepadatan korelasinya **−0,24** pada 300 m, artinya makin banyak kos makin murah — masuk akal secara ekonomi tapi derau pada n=29. Hanya 4 dari 31 kos survei punya kos MAPID dalam 300 m |

## Belum dipakai — kandidat lapisan peta, bukan skor

| Layer | Rencana |
|---|---|
| `halte_sleman_2025` | Validasi visual jaringan halte OSM. PRD menyebut peran ini eksplisit |
| `kos_sleman_2025` | **Lapisan titik kos di peta** — PRD menyebutnya eksplisit. 51 titik di wilayah studi |
| `perguruan_tinggi_2025` | Pembanding 219 gerbang kampus; 11 titik |
| `stasiun_2025` | Pembanding stasiun KRL untuk C4; 3 titik |
| `demografi` | Konteks kepadatan mahasiswa. PRD: "validasi relevansi wilayah studi" |
| `pasar_2025` | Kandidat perluasan M4 kalau definisi warung diperlebar |
| `layanan_jasa_2025` | Kandidat perluasan M4 (fotokopi, laundry) |
| `harga_properti_2024` | Kandidat lapisan peta konteks nilai tanah |

## Ringkasan

- **6 layer** menghasilkan angka indikator
- **4 layer** menentukan pilihan layer di atas lewat uji tumpang tindih
- **2 layer** diuji untuk A1 dan ditolak dengan bukti
- **8 layer** menunggu sebagai lapisan peta atau validasi

Tidak ada yang terbuang. Yang tidak masuk skor tetap dipakai untuk memilih,
memvalidasi, atau ditampilkan di peta — dan beberapa justru mencegah kesalahan
hitung yang tidak akan terlihat kalau tidak diperiksa.
