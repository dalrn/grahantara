# Daftar Unduh MAPID

Nomor mengacu penomoran di `mapid_data.txt`.
Semua ekspor disimpan di `data/raw/mapid/` (di-.gitignore).

## Sudah lengkap — tidak ada lagi yang perlu diunduh

```
  5. APOTEK                        425 titik    227 di wilayah studi
 30. DEMOGRAFI                      86 poligon   24 di wilayah studi
 43. HALTE                          87 titik     74 di wilayah studi
 44. HARGA PROPERTI              1.221 titik    835 di wilayah studi
 67. KESEHATAN DAN PENGOBATAN    1.250 titik    732 di wilayah studi
 77. KOS                             60 titik     51 di wilayah studi
 84. LAYANAN ATAU JASA           2.954 titik  1.722 di wilayah studi
 97. MAKANAN DAN MINUMAN         1.712 titik  1.338 di wilayah studi
101. MINIMARKET                    351 titik    239 di wilayah studi
114. NIGHTTIME LIGHT 2023           23 poligon    9 di wilayah studi
138. PASAR                         121 titik     41 di wilayah studi
151. PERDAGANGAN DAN RETAIL      8.208 titik  3.765 di wilayah studi
153. PERGURUAN TINGGI               11 titik     11 di wilayah studi
197. STASIUN                         3 titik      2 di wilayah studi
216. TOKO KELONTONG              1.136 titik    478 di wilayah studi
220. TOKO MAKANAN DAN MINUMAN    1.603 titik    525 di wilayah studi
250. WILAYAH RISIKO BANJIR         588 poligon  118 di wilayah studi
     WILAYAH BAHAYA BANJIR       1.057 poligon  248 di wilayah studi
```

## JANGAN diunduh — sudah tercakup layer lain

Diperiksa dengan mencocokkan nama dan koordinat, bukan menebak:

| Layer | Alasan |
|---|---|
| ALFAMART, INDOMARET, CIRCLE K, FAMILYMART | **Seluruhnya sudah ada di dalam MINIMARKET (101).** Indomaret 178, Alfamart 60, Circle K 20, Alfamidi 1, FamilyMart 1 dari total 351. Mengunduh terpisah = dobel hitung. |
| RESTORAN, ROTI DAN KUE, MINUMAN | Sudah ada di dalam MAKANAN DAN MINUMAN (97). |
| KLINIK, PUSKESMAS, RUMAH SAKIT | Sudah ada di dalam KESEHATAN DAN PENGOBATAN (67). |
| TOKO PAKAIAN, TOKO ELEKTRONIK, dll. | Sudah ada di dalam PERDAGANGAN DAN RETAIL (151). |
| SITE SELECTION SLEMAN | Hasil skoring pihak lain. Memakainya membuat penilaian melingkar. |
| Layer partai politik, merek tunggal | Tidak relevan. |
| Layer Cyberjaya | Malaysia, di luar wilayah studi. |

## Catatan penting soal tumpang tindih

Diverifikasi dengan pencocokan nama + koordinat:

- **APOTEK (425) seluruhnya ada di dalam KESEHATAN DAN PENGOBATAN (1.250).**
  Untuk M4 pakai **APOTEK saja**, jangan keduanya.
- **TOKO MAKANAN DAN MINUMAN (1.603) seluruhnya ada di dalam PERDAGANGAN DAN
  RETAIL (8.208).** Jangan gabungkan keduanya.
- **TOKO KELONTONG (1.136) TIDAK ada di dalam PERDAGANGAN DAN RETAIL** — hanya
  1 titik yang beririsan, meski katalog menempatkannya di bawah retail. Ini
  layer mandiri, dan paling cocok sebagai "warung" pada definisi M4.
- **MINIMARKET (351) hampir seluruhnya ada di dalam PERDAGANGAN DAN RETAIL**
  (350 dari 351).
