# Anomali Data Survei

Ditemukan saat Fase 2, 2026-09-08.

> **STATUS: A1, A2, dan B1 SUDAH DIPUTUSKAN dan diterapkan pada
> `Hasil_Survei_BERSIH.xlsx` (2026-09-08, disetujui pemilik repo).**
> Cadangan sebelum koreksi:
> `data/processed/Hasil_Survei_BERSIH.SEBELUM_KOREKSI_2026-09-08.xlsx`
>
> Hanya **kolom sumber** yang diubah. I-1..I-5, Bobot terpakai, W-6 integritas,
> dan W-6 status adalah **rumus Excel hidup** yang membaca sheet `Panduan_W6`,
> jadi keempatnya menghitung ulang sendiri. Menulis nilai ke dalamnya akan
> merusak logika workbook.
>
> Masih terbuka: **C1 (RUAS-053)** di bagian bawah dokumen ini.

Untuk tiap butir: apa yang tertulis, kenapa itu janggal, dan nilai yang
**kemungkinan** dimaksud. Nilai usulan itu dugaan berdasar bukti di baris yang
sama — bukan koreksi yang boleh dipakai tanpa persetujuan.

---

## A. Kontradiksi internal — 2 baris

Dua baris menyatakan trotoar **tidak ada** tapi mencantumkan **lebar trotoar
lebih dari nol**. Keduanya tidak tercatat di sheet `Flag`.

### A1. RUAS-029 — KWS-08, Gg. Melati Jl. Tajem

| Kolom | Nilai tertulis |
|---|---|
| Jenis jalan | Gang |
| **Lebar Jalan (m)** | **0,0** |
| Trotoar | Tidak ada |
| **Lebar Trotoar (m)** | **3,0** |
| Muat mobil | 1 unit |

**Dua hal janggal sekaligus.** Lebar jalan 0 m mustahil untuk ruas yang muat
satu mobil. Dan trotoar "Tidak ada" tapi lebarnya 3 m.

Dugaan: **kedua nilai tertukar.** Lebar jalan 3,0 m dan lebar trotoar 0,0 m
konsisten dengan gang yang muat satu mobil dan tidak bertrotoar. Nilai 3,0 m
juga wajar untuk lebar gang, tidak wajar untuk trotoar gang.

**DITERAPKAN 2026-09-08:** `Lebar Jalan = 3,0`, `Lebar Trotoar = 0,0`.
W-6 tetap 0,0 seperti diperkirakan. Yang berubah hanya W-5 tekanan lalu lintas.

### A2. RUAS-034 — KWS-03, Jl. UPN

| Kolom | Nilai tertulis |
|---|---|
| Jenis jalan | Jalan kecil |
| Lebar Jalan (m) | 3,0 |
| Trotoar | Tidak ada |
| **Lebar Trotoar (m)** | **1,0** |

Lebar jalan wajar. Hanya trotoar yang bertentangan: "Tidak ada" tapi lebar 1 m.

Dugaan: ada trotoar sempit sepanjang sebagian ruas, dan pencatat memilih
"Tidak ada" karena tidak menerus. Atau angka 1,0 salah masuk kolom.

**DITERAPKAN 2026-09-08:** dipilih `Trotoar = "Sebagian"`.
**W-6 naik dari 0,0 menjadi 0,5182** — perubahan satu baris terbesar di dataset.

**Dasar keputusan perlu dicatat jujur.** Pilihan ini bersandar pada keputusan
pemilik repo, bukan pada nilai yang tercatat. Dua kolom lain pada baris yang
sama justru **tidak mendukung** adanya trotoar layak:

- `Pejalan turun ke jalan = "Ya"` — pejalan kaki terpaksa turun ke badan jalan.
- Catatan lapangan asli: *"gang persis di samping UPN, ada warmindo dan kos.
  terhalang bekas bakar sampah, jalannya kecil dan cukup bersampah."*

Catatan lapangan itu **dipertahankan utuh** di kolom `Catatan`, dengan teks
koreksi ditambahkan setelahnya. Sebaiknya ditinjau ulang oleh pencatat sebelum
halaman metodologi terbit, karena ini satu-satunya koreksi yang **menaikkan**
skor dan itu yang paling akan disorot juri.

---

## B. Pencilan yang perlu dikonfirmasi — 1 baris

### B1. RUAS-069 — KWS-09, Jl. Ringroad Barat

| Kolom | Nilai | Rentang ruas lain |
|---|---|---|
| Panjang ruas | **865,9 m** | 50–255 m |
| Waktu melintas | **1.200 detik** (20 menit) | 47–360 detik |

Sudah tercatat di `Flag` sebagai "dibiarkan, jauh di luar rentang". Kecepatan
implisitnya 0,72 m/s — lambat tapi masuk akal untuk pejalan kaki.

Panjang dan waktu **saling konsisten**, jadi ini kemungkinan besar bukan salah
ketik melainkan ruas yang memang panjang. Ringroad Barat adalah jalan arteri,
wajar disurvei dalam penggal panjang.

**DITERAPKAN 2026-09-08:** dibiarkan apa adanya, diberi catatan verifikasi di
kolom `Catatan`. Satu ruas 866 m tetap akan mendominasi rata-rata tertimbang
panjang di KWS-09 — perlu diingat saat menghitung W-5 dan W-6 per kawasan.

---

## C. Kekosongan yang WAJAR — bukan anomali

Diperiksa dan disimpulkan benar. Tidak perlu tindakan.

| Temuan | Penjelasan |
|---|---|
| `I-4 kemulusan` kosong di 59 dari 84 ruas | 55 di antaranya `Trotoar = "Tidak ada"`. Kemulusan **permukaan trotoar** memang tidak terdefinisi kalau trotoarnya tidak ada. Ini kekosongan yang benar, bukan data hilang. |
| `W-6 status = "Belum lengkap"` di 8 ruas | Tersebar di KWS-02 (2), KWS-09 (2), KWS-10 (2), KWS-12 (1), KWS-08 (1). Kamus data menduga 11 ruas terkonsentrasi di KWS-09; kenyataannya 8 dan tersebar. Perbedaan ini perlu diperbarui di dokumen. |
| `Interval OSM (detik)` kosong di 12 dari 12 halte | Seluruh kolom kosong. Kolom ini memang belum pernah diisi. |
| HLT-010 Halte Nogotirto kosong seluruh kolom pengamatan | Satu halte tidak teramati. Jujur sebagai `tidak_tersedia`. |

---

## D. Yang sudah diverifikasi BENAR

Diperiksa ulang secara independen dan lolos:

- **Aritmetika W-6 tepat pada seluruh 84 ruas.** Dihitung ulang dari I-1..I-5
  dengan bobot 0,25/0,15/0,20/0,15/0,25 dan normalisasi ulang saat ada komponen
  kosong. **Nol selisih** terhadap kolom `W-6 integritas`.
- **Sheet Ekonomi konsisten.** `Total usaha` sama persis dengan jumlah delapan
  kolom kategori di seluruh 12 baris.
- **Harga kos wajar.** 29 harga terisi, rentang Rp350.000–Rp1.400.000, median
  Rp775.000. Tidak ada `min > maks`. Tidak ada pencilan ekstrem.
- **Jarak kos ke halte dan kampus** dalam rentang masuk akal (10–1.500 m dan
  30–6.000 m).

---

## Ringkasan keputusan yang diminta

| # | Baris | Pertanyaan |
|---|---|---|
| A1 | RUAS-029 | Tukar lebar jalan dan trotoar jadi 3,0 / 0,0? |
| A2 | RUAS-034 | Lebar trotoar jadi 0,0, atau ubah Trotoar jadi "Sebagian"? |
| B1 | RUAS-069 | Konfirmasi 865,9 m memang benar (usulan: ya, biarkan) |

Selama belum diputuskan, pipeline memakai berkas apa adanya. Dampaknya kecil:
A1 dan A2 tidak mengubah W-6 (keduanya sudah 0,0), hanya mempengaruhi W-5.


---

## C. MASIH TERBUKA

### C1. RUAS-053 — KWS-05, Jl. Brojowikalpo

Terlewat di laporan awal: disebut di bagian "Lebar Jalan = 0" tapi tidak pernah
diberi usulan.

| Kolom | Nilai tertulis |
|---|---|
| Jenis jalan | Jalan kecil |
| Muat mobil | 1 unit |
| **Lebar Jalan (m)** | **0,0** |
| Trotoar | **Ada** |
| **Lebar Trotoar (m)** | **0,0** |
| Panjang ruas | 120 m |
| Catatan | (kosong) |

Dua kejanggalan:

1. **Lebar jalan 0 m** pada ruas yang muat satu mobil — sama seperti RUAS-029.
2. **`Trotoar = "Ada"` tapi `Lebar Trotoar = 0,0`** — kebalikan dari A1/A2.
   Trotoar yang ada mestinya punya lebar.

Berbeda dari RUAS-029, di sini **tidak ada angka yang bisa ditukar** — keduanya
0,0. Jadi tidak ada dugaan yang bisa ditarik dari data itu sendiri.

Dampaknya nyata: dengan `Trotoar = "Ada"` tapi lebar 0, komponen I-2 menjadi
`min(0/1,5 , 1) = 0`, sehingga W-6 ruas ini tertekan padahal trotoarnya
dinyatakan ada.

**Perlu ingatan pencatat:**
- Berapa lebar jalan sebenarnya? (perkiraan 3–4 m wajar untuk "jalan kecil")
- Berapa lebar trotoarnya, atau apakah `Trotoar` seharusnya "Tidak ada"?

Sampai ada jawaban, dibiarkan apa adanya.
