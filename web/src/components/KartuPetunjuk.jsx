import { motion } from "framer-motion";
import { motionTokens } from "../design";

/**
 * Kartu petunjuk kecil yang menempel pada elemen yang dimaksud.
 *
 * BUKAN modal dan BUKAN overlay gelap: peta tetap bisa dipakai selagi kartu
 * tampil. Itu syaratnya, petunjuk yang memblokir memaksa pengguna membaca
 * sebelum ia punya alasan, dan itu persis yang hendak dihindari.
 *
 * `posisi` menentukan tempat menempelnya, memakai kelas CSS bernama supaya
 * tata letak layar sempit bisa menimpanya di satu tempat.
 */
export default function KartuPetunjuk({
  judul,
  isi,
  posisi = "tengah-atas",
  onTutup,
  onLewatiSemua,
}) {
  return (
    <motion.div
      className={`kartu-petunjuk kartu-petunjuk--${posisi}`}
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: motionTokens.micro, ease: motionTokens.ease }}
    >
      <div className="kartu-petunjuk-kepala">
        <span className="kartu-petunjuk-judul">{judul}</span>
        <button
          type="button"
          onClick={onTutup}
          className="kartu-petunjuk-tutup"
          aria-label="Tutup petunjuk ini"
        >
          ✕
        </button>
      </div>
      <p className="kartu-petunjuk-isi">{isi}</p>
      {/* "Lewati semua" HANYA di petunjuk pertama. Labelnya sengaja berbeda
          jauh dari tombol tutup, supaya pengguna tidak mengira menutup satu
          kartu akan mematikan seluruh rangkaian. */}
      {onLewatiSemua && (
        <div className="kartu-petunjuk-kaki">
          <button type="button" className="petunjuk-tombol-utama" onClick={onTutup}>
            Mengerti
          </button>
          <button type="button" className="petunjuk-tombol-lewati" onClick={onLewatiSemua}>
            Lewati semua petunjuk
          </button>
        </div>
      )}
    </motion.div>
  );
}
