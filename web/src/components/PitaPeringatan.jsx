export default function PitaPeringatan({ versi, basemapAktif }) {
  const stub = typeof versi === "string" && versi.startsWith("stub");
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 space-y-1">
      {stub && (
        <div className="bg-red-800 px-4 py-1.5 text-center text-sm font-semibold text-white">
          DATA PALSU ({versi}) - angka pada peta ini acak, bukan hasil analisis
        </div>
      )}
      {!basemapAktif && (
        <div className="bg-yellow-700 px-4 py-1.5 text-center text-sm font-semibold text-white">
          Basemap MAPID MAPS belum aktif - menunggu kunci
        </div>
      )}
    </div>
  );
}
