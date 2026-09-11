# Grahantara — UI/UX handoff

Implementasi dilakukan di `web/` dari ZIP 9 September 2026. Berkas di `pipeline/`, `data/`, `contracts/`, `web/public/data/`, dan `web/src/lib/mesinSkor.js` identik byte demi byte dengan ZIP asal (47 berkas terlindungi diperiksa).

## Menjalankan

```sh
cd web
npm ci
npm run dev -- --host 127.0.0.1 --port 5178
```

Buka http://127.0.0.1:5178. Vite kini menjalankan handler yang sudah ada di `api/` melalui middleware server lokal. Tanpa `DEEPSEEK_API_KEY`, handler memakai fallback bawaan dan UI memberi label tanpa AI. Kunci tersebut hanya berada di server. API produksi tetap memakai fungsi Vercel yang sama.

Untuk latar jalan MAPID, isi `VITE_MAPID_BASEMAP_KEY` di `.env.local`. Tanpa kunci, data heksagon dan titik tetap dapat digunakan di latar polos. Integrasi basemap dengan kunci nyata dan panggilan AI eksternal belum diuji dalam sesi ini. Tidak ada publikasi atau deployment.

## Hasil

- Tema gelap, aksen mint, Plus Jakarta Sans yang disimpan lokal, radius/spacing konsisten, fokus keyboard, dan dukungan preferensi reduced motion.
- Revisi keterbacaan 2026-09-10: latar utama dinaikkan ke `#172925`, panel ke `#20332e`, dan teks sekunder paling redup kini memiliki rasio kontras 4,70:1 terhadap panel. Palet skor serta aksen mint tetap sama.
- Skala tipografi dipusatkan di `tailwind.config.js`: micro 11px hanya untuk atribusi, xs 13px untuk teks fungsional, sm 15px untuk isi ringkas, base 16px, dan lg 18px. Nilai arbitrer `text-[9px]`, `text-[10px]`, dan `text-[11px]` telah dihapus dari komponen.
- Paragraf pembuka Beranda menjadi 17px di desktop dan 16px di mobile; tab, legenda, label slider, baris indikator, serta tabel pembanding memiliki batas bawah 13px.
- Satu palet skor dalam `src/design.js`, diimpor Tailwind, peta, legenda, serta pin. Kelas tetap menggunakan kuintil dari skor terkini.
- Beranda dengan hierarki judul, form berlabel, contoh kebutuhan, animasi chip prioritas, koreksi profil, dan CTA kontekstual. Perbaikan persentase chip serta retensi bobot saat masuk atau kembali ke peta.
- Revisi beranda 2026-09-11: fokus dialihkan dari tampilan ke kejelasan fungsi. Judul menyebut produknya apa adanya ("Peta kawasan untuk memilih kos di Sleman"), empat dimensi penilaian dijelaskan satu per satu sebagai daftar definisi, dan angka statistik dipindah ke bagian "Dasar penilaiannya" di bawah hero dengan kalimat konteks, bukan label singkat. Yang dihapus: foto latar Unsplash, ilustrasi heksagon SVG beserta labelnya, penomoran langkah "01" dan titik carousel palsu, pil lokasi non-interaktif, eyebrow, catatan privasi, serta simbol hias (↗ ◎ ◈ ● ·). Nav menjadi Beranda / Peta / Metodologi, dan footer memuat identitas, tautan, tanggal data, serta atribusi tim.
- Blok CSS beranda yang sebelumnya ditulis bertema gelap lalu ditimpa blok terang di akhir `index.css` kini digabung menjadi satu tema terang. Tiap elemen beranda hanya punya satu sumber warna, dan aturan responsif beranda yang sudah tidak dipakai dihapus dari `@media (max-width: 1000px)` dan `@media (max-width: 767px)`.
- Logika tidak berubah: `parse-preference`, editor profil (kampus, anggaran, bobot), peringatan data stub, `onProfil`/`onLewati`/`onMetodologi`, dan pemuatan `metadata.json` tetap sama persis.
- Revisi beranda iterasi 2 (2026-09-11): iterasi sebelumnya terlalu jauh membuang elemen sehingga halaman membaca seperti dokumen, bukan produk spasial. Yang dikembalikan dan ditambahkan, semuanya bersumber data asli:
  - **`PetaHero.jsx`** — instance MapLibre di hero dengan 2.134 heksagon asli berwarna skor komposit, basemap MAPID, dan label UGM/UNY/UPN. Memakai ulang `prepareBasemap`, `hitungKuintil`, `ekspresiWarna`, `WARNA_KELAS`, dan `campusImage` dari halaman peta supaya warna di beranda berarti sama dengan warna di `/peta`; tidak ada pipeline data baru. Hover memperlihatkan skor kawasan, klik membuka peta penuh. Dimuat `lazy()` dengan placeholder solid. Indikator dilepas dari properti sebelum diserahkan ke MapLibre. `icon-variable-anchor`/`icon-radial-offset` tidak dipakai: keduanya khusus `text-field` di MapLibre 4 dan ditolak validator, jadi pergeseran label kampus ditulis eksplisit lewat `icon-offset`.
  - **Formulir hibrida** — dropdown kampus, slider anggaran (rentang Rp 300.000–1.500.000, dari survei 30 kos: Rp 350.000–1.400.000), empat slider prioritas berlabel kata, dan tiga preset situasi. Rekomendasi bisa didapat **tanpa mengetik satu kata pun**: jalur terstruktur menyusun profil di klien dan tidak memanggil `/api/parse-preference` sama sekali. Semua slider di tingkat "Biasa" menghasilkan bobot 40/25/20/15, identik dengan bawaan pipeline. Textarea narasi tetap ada sebagai catatan tambahan opsional di bawah tombol utama.
  - **`SebaranDimensi.jsx`** — histogram subskor per dimensi dari `hexagons.geojson`, termasuk cacah heksagon yang benar-benar punya data (Biaya hanya 153 dari 2.134, ditampilkan apa adanya).
  - **Kontras tombol diperbaiki**: primer kini latar `--aksen` pekat dengan teks putih (7,2:1), sekunder jadi tautan bergaris bawah. Sebelumnya aksi sekunder terlihat lebih bisa diklik daripada primer. Seluruh 58 elemen teks beranda lolos WCAG AA (diperiksa otomatis).
  - **Palet digeser dari hijau sage ke teal teknis.** `--aksen: #15615f` adalah versi gelap `#319b98`, yaitu kelas tengah skala skor di `design.js`, sehingga warna halaman punya rujukan yang sama dengan warna peta. Latar dinaikkan dari krem `#f7f9f7` ke `#eef2f1`.
  - Preset memakai state tegas: border tebal, latar terisi, **dan** tanda centang — bukan warna saja.
  - Basemap gelap dipertahankan sesuai keputusan tim di `config.js` (basemap terang membuat kelas skor tertinggi `#edd58b` menyatu dengan latar); bingkai peta dibuat gelap agar terbaca sebagai panel yang disengaja.
- Revisi beranda iterasi 3 (2026-09-11): kartu form dipecah dua tahap dan empat slider prioritas dibuang.
  - **Tahap 1** hanya textarea besar, tiga chip contoh satu baris, tombol "Lanjut", tautan "Jelajahi peta tanpa mengisi", dan tautan "Lebih suka memilih daripada menulis" yang membuka tahap 2 kosong. Tinggi kartu 504 px, muat di layar laptop tanpa scroll.
  - **Tahap 2** menampilkan hasil parsing sebagai kontrol yang sudah terisi: kampus, anggaran, prioritas, dan catatan asli. Kontrol yang gagal diisi dari narasi diberi penanda "belum terbaca". Ada jalan kembali ke tahap 1 tanpa kehilangan teks.
  - **Kegagalan API tidak lagi mematikan alur.** `baca()` menangkap error dan tetap membuka tahap 2 dengan kalimat netral; pengguna tetap sampai ke peta. Diuji dengan `route.abort()` pada `/api/parse-preference`.
  - **Empat slider kepentingan diganti kontrol "pilih dua".** Alasannya ada di komentar `Beranda.jsx`: skor memakai bobot relatif, sehingga keempat slider di maksimum menghasilkan 25% per dimensi — identik dengan keempatnya di minimum dan dengan tidak mengisi apa pun. Bobot final: dua terpilih 40/40/10/10, satu terpilih 57/14/14/14, "semuanya sama penting" 25 merata. Angka ini didokumentasikan di halaman Metodologi. State terpilih memakai ikon centang SVG + border tebal + latar terisi, tidak bergantung warna saja.
  - **Tiga preset situasi dihapus**, sesuai arahan: isinya hanya prioritas, yang kini dikerjakan "pilih dua" dengan teks jauh lebih sedikit.
  - **`DIMENSI_UI` di `lib/kamus.js` jadi sumber tunggal label, urutan, dan warna dimensi** untuk kontrol yang dilihat pengguna (beranda + `PanelBobot`). Sengaja terpisah dari `KELOMPOK_INDIKATOR.label` yang dipakai panel detail, pembanding, dan metodologi dengan istilah lebih teknis. Sebelumnya `PanelBobot` menulis "Keterjangkauan"/"Kenyamanan" sementara beranda menulis "Biaya"/"Fasilitas".
  - **Label slider di `/peta` kini persentase relatif** yang selalu berjumlah 100%, bukan nilai mentah 0-100. Dengan begitu memaksimalkan semua slider langsung terlihat sia-sia. Hanya labelnya yang berubah; logika skoring, rentang slider, dan perilaku peta tidak disentuh.
  - **Pita "pilihanmu mendarat"** di `/peta` menyebut dimensi yang dipilih di beranda, muncul sekali per sesi, bisa ditutup (`pitaPrioritas` di `App.jsx`).
  - Opsi yang tidak terpilih saat kuota penuh TIDAK memakai `opacity`: pada 0,55 teksnya turun ke 3,39:1, di bawah WCAG AA. Yang diredupkan hanya latar dan kotak centang.
  - Label "Arahkan kursor ke satu kawasan" dihapus dari peta hero, dan keterangan "2.134 kawasan punya data" kini hanya muncul pada baris yang cakupannya berbeda (Biaya, 153).
- Revisi beranda iterasi 4 (2026-09-11): perbaikan terarah, bukan tulis ulang.
  - **Urutan halaman diubah.** Hero + kartu form kini satu layar; "Empat hal yang dinilai" turun ke bawahnya, berdampingan dengan "Dasar penilaiannya" dalam wadah baru `.home-penjelasan` selebar konten. Rata atas, tinggi sengaja dibiarkan berbeda, dipisah garis vertikal tipis. Di bawah 1100 px keduanya menumpuk dengan "Empat hal" di atas.
  - Kolom kanan lebih sempit, jadi tiga angka (2.134 / 10 / 16) disusun menurun satu per baris, dan dua paragraf catatan ikut menumpuk.
  - Kalimat penjelas tiap dimensi pindah ke bawah nama dimensinya supaya histogram mendapat kolom selebar 148 px. `row-gap: 0` + margin `dd` dipakai agar nama dan kalimatnya tetap rapat meski histogram lebih tinggi.
  - **Peta hero menampilkan seluruh sepuluh kampus.** Dua lapisan: `kampus-titik` (lingkaran, selalu tampil) memastikan tiap kampus punya penanda, dan `titik-kampus` (sprite berlabel, `icon-allow-overlap: false`) menyerahkan label ke mesin tabrakan MapLibre. Pada zoom awal hanya ~3 label yang muat dan itu memang batas fisik: delapan kampus berdesakan dalam ~80 px (UPN dan AMIKOM hanya 5 px terpisah) sementara sprite selebar 70-117 px. Label bertambah saat zoom (3 di z10,3 -> 5 di z12 -> 6 di z13,5). `symbol-sort-key` sempat dicoba dan tidak mengubah hasil, jadi tidak disimpan.
  - Label "153 kawasan" di bawah histogram Biaya dihapus; kalimat di bawah tabel sudah menjelaskan hal yang sama.
  - **Teks bantuan di kontrol prioritas dihapus seluruhnya.** Batas dua pilihan kini dikomunikasikan lewat kontrolnya: begitu kuota penuh, opsi sisanya benar-benar `disabled` dengan `cursor: not-allowed`. Membatalkan salah satu mengaktifkan kembali yang lain.
  - **Seluruh teks UI beranda dipusatkan di `src/content/landing.js`** (`TEKS`), strukturnya mengikuti struktur halaman. Angka dari data (jumlah kawasan, versi, tanggal, jumlah kampus) tetap dihitung dari sumbernya, tidak dipindah ke sana.
  - Jumlah kampus di bagian data kini `DAFTAR_KAMPUS.length`, bukan angka 10 yang ditulis tangan.
  - **`window.__qaMap` akhirnya di-assign** di `PetaHeksagon.jsx` (khusus DEV). Uji Playwright sudah lama menunggunya padahal tidak pernah ada di `src/` pada commit mana pun, sehingga selalu habis waktu di layer `titik-kos`. Uji kini melaju jauh lebih jauh; sisa kegagalannya adalah swiftshader yang terlalu lambat, bukan cacat produk.
- Revisi beranda iterasi 5 (2026-09-11): menambah "hidup" tanpa elemen yang bukan turunan produk.
  - **Warna halaman kini diturunkan dari skala warna peta.** `design.js` menambah `uiColors`, semuanya versi lebih gelap dari satu kelas `scoreColors`: aksen `#226c6a` (<- toska `#319b98`), tinta `#322a46` (<- ungu `#534675`), dan tiga warna angka besar dari biru/toska/hijau. Kuning `#edd58b` sengaja TIDAK dipakai untuk teks: di latar terang kontrasnya cuma 1,45:1. Pengecualian yang didokumentasikan di `index.css`: netral (beda < 2 digit heksa kalau diturunkan, tidak ada gunanya diubah), warna semantik merah/kuning peringatan, dan latar peta hero yang mengikuti basemap MAPID.
  - **Hero disusun ulang.** Judul melebar sendiri di atas, peta selebar konten dengan tinggi `min(560px, 62vh)`, dan kartu form melayang di sisi kanan peta pada >= 1101 px. `fitBoundsOptions` memakai padding kanan 430 px di layar lebar supaya gugus heksagon bergeser ke kiri dan tidak tertutup kartu. Tombol "Buka peta lengkap" dan bar atribusi MapLibre digeser ke kiri. Kartu dibatasi `max-height` dengan `overflow-y: auto`, jadi isinya yang di-scroll, bukan petanya yang memanjang. Di bawah 1101 px kartu kembali static di bawah peta.
  - **Animasi masuk heksagon**: muncul bertahap dari pusat gugus ke luar, ~520 ms, sekali per sesi. Dijalankan lewat `setPaintProperty` per frame karena MapLibre tidak punya variabel ekspresi yang bisa dianimasikan; jarak tiap heksagon dari pusat dihitung sekali saat data dimuat dan disimpan sebagai properti `jauh`. `prefers-reduced-motion: reduce` membuat heksagon langsung tampil penuh tanpa pernah masuk state animasi (terverifikasi). Tidak diulang saat kembali ke beranda (`sudahDianimasikan` di level modul).
  - **Tekstur latar dari jaringan jalan Sleman.** `scripts/buat_tekstur_jalan.py` membaca `data/interim/walk_graph.graphml` (71.045 simpul / 182.866 sisi) dan menulis `public/tekstur-jalan.svg` sekali, BUKAN saat build atau runtime. Segmen < 3 px dibuang dan koordinat dibulatkan, menyisakan 18.994 garis (333 KB mentah, 128 KB gzip). Dipasang lewat `TeksturJalan.jsx` sebagai elemen `<svg>`, bukan `background-image`: pada viewBox 1600 unit garis 0,7 jadi sub-piksel dan hilang sama sekali saat diskalakan CSS. Opasitas 5% (pada 3% praktis tak terlihat, pada 9% mulai terbaca sebagai peta dan mengganggu teks). Hanya di bagian bawah halaman, TIDAK di belakang peta hero.
  - **Perbaikan keandalan peta hero.** Sebelumnya heksagon hanya terbentuk pada 1 dari 4 pemuatan: `map.on("load")` tidak pernah menyala karena StrictMode memasang komponen dua kali dan pembongkaran mount pertama membatalkan `style.json` mount kedua. `isStyleLoaded()` juga tetap `false` selamanya walau style sudah punya 105 lapisan, karena permintaan sprite/glyph ikut dibatalkan. Syaratnya diganti menjadi "style sudah punya lapisan", dan handler dipasang pada `load` maupun `styledata`. Hasilnya 4 dari 4 pemuatan berhasil.
- Framer Motion untuk perpindahan halaman, panel masuk/keluar, collapse legenda/lapisan/bobot, dan bagian metodologi saat terlihat.
- Panel kawasan: Ringkasan / Subskor / 16 Indikator; data kosong tetap tidak tersedia, indikator model tetap estimasi.
- Pembanding: kolom A/B, sorotan dimensi unggul, nilai indikator dibandingkan melalui persentil agar polaritas jarak/biaya benar. Perbaikan ID feature-state A/B dan tampilan kegagalan API.
- Loading skeleton, pesan kegagalan fetch, pembatalan fetch saat unmount, dan pemberitahuan jika sebagian lapisan gagal dimuat.
- Peta dimuat dengan lazy import; bundle awal sekitar 376 kB mentah / 117 kB gzip. Bundle MapLibre terpisah sekitar 801 kB mentah / 215 kB gzip.

## Implementasi pin

31 titik memakai satu source GeoJSON dan satu symbol layer MapLibre. Tidak ada komponen React per titik. `properties.id` digunakan untuk identitas pin; join skor selalu memakai `h3_index`. Tidak ada field GeoJSON yang ditambahkan atau diubah.

Setiap pin memiliki StyleImage canvas kecil. MapLibre 4 tidak mendukung feature-state pada properti layout `icon-image`/`icon-size`, sehingga StyleImage membaca feature-state untuk warna, hover, dan seleksi. Ini memungkinkan bentuk teardrop, rumah kontras, shadow, garis putus-putus untuk satu kos tanpa harga, dan scale 1,1 saat hover. Pixel hanya berubah selama transisi; tidak ada requestAnimationFrame tak berujung saat idle.

Pin kos kini aktif sejak awal dan terlihat pada zoom jauh. Ukurannya mengikuti zoom melalui expression: 0,65 pada zoom 10, 0,85 pada 14, 1 pada 16, dan 1,3 pada 19. Pasangan yang sangat rapat tetap dapat diperbesar untuk dipilih satu per satu. Palet skor tetap sama.

Kampus memakai bubble singkatan dan ikon topi wisuda. Halte memakai sprite bus kecil; collision detection mengurangi tumpukan halte saat zoom jauh. Semua sprite dan teks singkatan dibuat lokal, tanpa layanan glyph atau gambar internet.

Mode Bandingkan memiliki pilihan Kawasan dan Kos. Perbandingan kos memakai ID listing sehingga dua kos dalam heksagon yang sama tetap dapat dibandingkan. Ctrl+klik (Cmd+klik di Mac), tombol popup, atau tekan lama 550 ms di layar sentuh memulai pemilihan. Setelah mode kos aktif, pilihan berikutnya cukup diklik/diketuk. Gerakan geser lebih dari 10 px, zoom, multi-touch, dan pembatalan sentuhan membatalkan tekan lama. Ketuk dua kali tetap untuk zoom.

Panel kos menampilkan harga/sumber harga, jenis, jarak halte, skor kawasan yang mengikuti bobot, koordinat, dan ketelitian lokasi. Data kosong bukan nol; harga model diberi label Estimasi. Pin A/B diberi garis dan lencana pembeda. Kode heksagon pada tampilan diganti koordinat titik tengah dari poligon asli; H3 tetap menjadi kunci internal dan berkas GeoJSON tidak diubah.

Warna pin mengikuti skor terkini dari heksagon, bukan harga. Warna heksagon berinterpolasi selama 200 ms; perhitungan skor tetap melalui debounce 120 ms yang ada. Animasi hanya mengubah tampilan warna, tidak menghitung skor tambahan.

## Verifikasi

- `npm run build`: lulus; warning ukuran chunk MapLibre masih ada.
- `npm run lint`: tanpa error, 3 warning kode lama (`new Array` di mesinSkor/Metodologi, fungsi tidak digunakan di API compare).
- `npm run test:ui`: lulus pada Edge desktop 1440×1000 dan viewport mobile 390×844. Pengujian mencakup fallback parsing lokal, retensi bobot, visibilitas pin, popup tanpa harga, hover feature-state, perubahan warna, kesamaan warna semua 31 pin dengan H3, tab, sorotan A/B, fallback pembanding, metodologi, dan lebar mobile. Tidak ada error JavaScript pada alur ini.
- Screenshot hasil revisi keterbacaan: `qa-home-desktop.png`, `qa-home-mobile.png`, `qa-map-weights.png`, dan `qa-compare.png` di `test-results/`.
- `npm run test:ui:edge`: lulus untuk loading, HTTP 503 dan kontrol coba lagi, label Estimasi menggunakan fixture respons kos bersumber model, dan alur reduced motion. Fixture hanya di respons uji, bukan berkas data.
- Screenshot berada di `test-results/` pada workspace; direktori ini tidak ikut paket sumber.
- `tests/map-symbols-comparison.mjs` menambah pemeriksaan simbol saat overview, ukuran terhadap zoom, Ctrl+klik, pilihan duplikat, dua kos dalam satu heksagon, ganti slot, data kosong, estimasi, koordinat, popup mobile, tekan lama, serta pembatalan saat geser. Fixture estimasi hanya berlaku di respons uji. Screenshot tambahan: `qa-symbols-overview.png`, `qa-compare-kos-desktop.png`, `qa-compare-kos-mobile.png`, dan `qa-compare-kos-long-press.png`.

Untuk mengulang uji: jalankan dev server di port 5178, lalu `npx playwright install chromium`, `npm run test:ui`, dan `npm run test:ui:edge`. Di Windows dengan Edge tersedia, dapat memakai `$env:PLAYWRIGHT_CHANNEL='msedge'`. `UI_TEST_URL` dapat mengganti alamat server. Uji fallback dijalankan tanpa API key AI.

## Catatan dependensi

`npm audit` menemukan satu kerentanan critical pada MapLibre GL 4.7.1 bawaan proyek: GHSA-jrc7-96c5-q579, sanitizer XSS. Audit menawarkan peningkatan mayor ke 6.8.0. Versi MapLibre dipertahankan dalam lingkup UI ini; peningkatan dan pengujian kompatibilitas diperlukan sebelum rilis publik. Nilai data pada popup kini di-escape sebelum masuk HTML, tetapi itu tidak menggantikan pembaruan library.

Rujukan audit: https://github.com/advisories/GHSA-jrc7-96c5-q579
