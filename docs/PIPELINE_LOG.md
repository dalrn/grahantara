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
