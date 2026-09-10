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
