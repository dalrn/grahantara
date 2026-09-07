export default function Legenda({ labels }) {
  return (
    <div className="absolute bottom-16 left-2 z-10 max-w-[330px] rounded-lg bg-slate-900/80 p-2 text-white shadow-lg backdrop-blur-sm md:bottom-4 md:left-4 md:max-w-none md:p-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300 md:mb-2 md:text-xs">
        Skor Grahantara
      </div>
      {labels ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 md:block md:space-y-1">
          {labels.map((label, i) => (
            <div key={label} className="flex items-center gap-1 text-[9px] md:gap-2 md:text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm md:h-3 md:w-4"
                style={{ backgroundColor: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"][i] }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-400">memuat…</div>
      )}
      <div className="mt-1 hidden border-t border-white/10 pt-1 text-[10px] text-slate-400 md:block">
        Kelas dibagi kuintil dari data
      </div>
    </div>
  );
}
