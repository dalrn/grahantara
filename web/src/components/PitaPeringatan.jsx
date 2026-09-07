export default function PitaPeringatan({ versi, basemapAktif }) {
  const stub = typeof versi === "string" && versi.startsWith("stub");
  return (
    <div className="space-y-1">
      {stub && (
        <div className="bg-red-800 px-4 py-1 text-center text-xs font-semibold text-white sm:text-sm">
          DATA PALSU ({versi}) - angka pada peta ini acak, bukan hasil analisis
        </div>
      )}
      {!basemapAktif && (
        <div className="bg-yellow-700 px-4 py-1 text-center text-xs font-semibold text-white sm:text-sm">
          Basemap MAPID MAPS belum aktif - menunggu kunci
        </div>
      )}
    </div>
  );
}
