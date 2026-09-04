export default function Legenda({ labels }) {
  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-slate-900/80 p-3 text-white shadow-lg backdrop-blur-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        Skor Grahantara
      </div>
      <div className="space-y-1">
        {labels ? (
          labels.map((label, i) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-4 shrink-0 rounded-sm"
                style={{ backgroundColor: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"][i] }}
              />
              <span>{label}</span>
            </div>
          ))
        ) : (
          <div className="text-xs text-slate-400">memuat…</div>
        )}
      </div>
      <div className="mt-2 border-t border-white/10 pt-1 text-[10px] text-slate-400">
        Kelas dibagi kuintil dari data
      </div>
    </div>
  );
}
