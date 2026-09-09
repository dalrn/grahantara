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

Sebaran 31 titik: jarak tetangga terdekat minimum 18,2 m; kuartil pertama 58,8 m; median 222,4 m. Pada lintang -7,75, tile MapLibre 512 px menghasilkan sekitar 4,73 m/px di zoom 14 dan 1,18 m/px di zoom 16. Pin tidak dirender di bawah zoom 14, fade 0–1 pada 14–16 melalui expression zoom, lalu tampil penuh. Pasangan yang sangat rapat mungkin tetap perlu diperbesar lagi untuk dipilih.

Warna pin mengikuti skor terkini dari heksagon, bukan harga. Warna heksagon berinterpolasi selama 200 ms; perhitungan skor tetap melalui debounce 120 ms yang ada. Animasi hanya mengubah tampilan warna, tidak menghitung skor tambahan.

## Verifikasi

- `npm run build`: lulus; warning ukuran chunk MapLibre masih ada.
- `npm run lint`: tanpa error, 3 warning kode lama (`new Array` di mesinSkor/Metodologi, fungsi tidak digunakan di API compare).
- `npm run test:ui`: lulus pada Edge desktop 1440×1000 dan viewport mobile 390×844. Pengujian mencakup fallback parsing lokal, retensi bobot, visibilitas pin, popup tanpa harga, hover feature-state, perubahan warna, kesamaan warna semua 31 pin dengan H3, tab, sorotan A/B, fallback pembanding, metodologi, dan lebar mobile. Tidak ada error JavaScript pada alur ini.
- Screenshot hasil revisi keterbacaan: `qa-home-desktop.png`, `qa-home-mobile.png`, `qa-map-weights.png`, dan `qa-compare.png` di `test-results/`.
- `npm run test:ui:edge`: lulus untuk loading, HTTP 503 dan kontrol coba lagi, label Estimasi menggunakan fixture respons kos bersumber model, dan alur reduced motion. Fixture hanya di respons uji, bukan berkas data.
- Screenshot berada di `test-results/` pada workspace; direktori ini tidak ikut paket sumber.

Untuk mengulang uji: jalankan dev server di port 5178, lalu `npx playwright install chromium`, `npm run test:ui`, dan `npm run test:ui:edge`. Di Windows dengan Edge tersedia, dapat memakai `$env:PLAYWRIGHT_CHANNEL='msedge'`. `UI_TEST_URL` dapat mengganti alamat server. Uji fallback dijalankan tanpa API key AI.

## Catatan dependensi

`npm audit` menemukan satu kerentanan critical pada MapLibre GL 4.7.1 bawaan proyek: GHSA-jrc7-96c5-q579, sanitizer XSS. Audit menawarkan peningkatan mayor ke 6.8.0. Versi MapLibre dipertahankan dalam lingkup UI ini; peningkatan dan pengujian kompatibilitas diperlukan sebelum rilis publik. Nilai data pada popup kini di-escape sebelum masuk HTML, tetapi itu tidak menggantikan pembaruan library.

Rujukan audit: https://github.com/advisories/GHSA-jrc7-96c5-q579
