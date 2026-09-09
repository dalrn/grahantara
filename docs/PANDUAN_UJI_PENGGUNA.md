# Panduan Uji Coba Grahantara

Untuk dua penguji. Buka situsnya, pakai seperti mahasiswa yang benar-benar
sedang mencari kos, lalu catat di Google Sheet.

**Aturan utama: kalau kamu bingung, itu temuan.** Jangan dimaklumi, jangan
dicoba dipahami sendiri. Catat.

---

## Sebelum mulai

1. Buka di **HP dan laptop**. Banyak masalah hanya muncul di salah satunya.
2. Coba juga **refresh halaman** di tengah pemakaian.
3. Kalau ada yang error, **screenshot** dan tempel tautannya di kolom Alasan.

---

## Yang perlu diperhatikan

### 1. Halaman pertama
- Dalam 10 detik, paham tidak ini aplikasi apa dan untuk siapa?
- Tahu harus mulai dari mana, atau bingung?
- Loading-nya berapa lama? Ada tanda kalau sedang memuat?

### 2. Mengetik kebutuhan (fitur AI)
- Coba tulis dengan bahasa sehari-hari, misalnya
  *"maba UGM, budget 800 ribuan, pengen deket halte"*.
- Hasilnya masuk akal? Kampus dan anggarannya kebaca benar?
- Coba juga kalimat yang aneh, singkat, atau typo. Apa yang terjadi?
- **Coba kampus selain UGM.** Semua sepuluh kampus harus bisa dipilih.

### 3. Peta
- Warnanya kebaca? Bisa bedakan kawasan bagus dan jelek?
- Geser, zoom in, zoom out — lancar atau patah-patah?
- Klik heksagon: panelnya muncul? Isinya sesuai dengan yang diklik?
- Di HP, jarinya cukup mudah mengenai heksagon yang dimaksud?

### 4. Panel skor
- Angka-angkanya kebaca artinya, atau cuma angka tanpa makna?
- **Ada indikator bertulis "tidak tersedia"? Itu memang disengaja** — datanya
  memang tidak ada. Tapi catat kalau tampilannya membingungkan atau terlihat
  seperti error.
- **Ada yang bertanda "estimasi"? Juga disengaja** — nilainya ditaksir, bukan
  diukur. Catat kalau tandanya tidak jelas.
- Kalau ada angka yang **kelihatan salah** (misalnya harga kos Rp50 juta),
  catat dan sebutkan heksagon mana.

### 5. Slider bobot
- Geser slider: petanya berubah? Cepat atau lemot?
- **Setelah menggeser, apakah skornya masih masuk akal?** Kalau ada kawasan yang
  tiba-tiba melonjak atau anjlok drastis, catat.
- Coba geser satu slider sampai mentok nol.

### 6. Narasi AI
- Penjelasannya nyambung dengan angka di panel, atau ngarang?
- **Kalau AI menyebut angka yang tidak ada di panel, itu masalah serius.** Catat.
- Bahasanya enak dibaca untuk orang awam?

### 7. Perbandingan dua kawasan
- Bisa memilih dua kawasan dan membandingkan?
- Kesimpulannya sesuai dengan tabelnya?

### 8. Halaman metodologi
- Kebaca sampai selesai, atau terlalu berat?
- Ada istilah yang tidak dimengerti orang awam? Sebutkan yang mana.

---

## Cara mengisi Google Sheet

| Kolom | Isi dengan |
|---|---|
| **Posisi di WebGIS** | Sedetail mungkin: *"Panel skor, baris Harga sewa kos"*, bukan *"di panel"* |
| **Yang perlu diubah/ditambahkan** | Apa yang kamu lihat DAN apa yang kamu harapkan |
| **Alasan** | Kenapa itu mengganggu. Sertakan tautan screenshot |
| **Saran perbaikan** | Kalau ada. Boleh dikosongkan kalau tidak terpikir |

**Contoh yang baik:**
> Posisi: Panel skor, indikator "Harga makan"
> Masalah: Tertulis "tidak tersedia" tanpa penjelasan. Saya kira aplikasinya error.
> Alasan: Tidak ada keterangan kenapa kosong, jadi terlihat seperti gagal memuat.
> Saran: Tambahkan tooltip "Data harga makan belum tersedia untuk kawasan ini".

**Contoh yang kurang berguna:**
> Posisi: peta
> Masalah: kurang bagus

---

## Jangan lupa catat juga

- Hal yang **membuatmu berhenti sejenak dan berpikir**, walaupun akhirnya paham.
- Hal yang kamu **coba klik tapi ternyata tidak bisa diklik**.
- Hal yang kamu **cari tapi tidak ketemu**.
- Kalau ada yang **sudah bagus**, catat juga — supaya tidak diubah.
