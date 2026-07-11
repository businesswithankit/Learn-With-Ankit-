export function SkeletonCard() {
  return (
    <div className="w-full bg-slate-900/30 border border-zinc-800/60 rounded-2xl p-6 space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-4 bg-zinc-800 rounded-sm w-1/3" />
        <div className="h-6 bg-zinc-800 rounded-sm w-16" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-8 bg-zinc-800 rounded-sm w-2/3" />
        <div className="h-3 bg-zinc-800 rounded-sm w-1/2" />
      </div>
      <div className="pt-4 border-t border-zinc-800/40 flex justify-between">
        <div className="h-3 bg-zinc-800 rounded-sm w-1/4" />
        <div className="h-3 bg-zinc-800 rounded-sm w-1/4" />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="bg-slate-900/25 border border-zinc-900/50 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="h-3 bg-zinc-800 rounded-sm w-1/2" />
      <div className="h-6 bg-zinc-800 rounded-sm w-3/4" />
      <div className="h-2 bg-zinc-800 rounded-sm w-1/3" />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="w-full space-y-3 animate-pulse">
      <div className="h-10 bg-zinc-800/40 rounded-lg w-full" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} className="h-12 bg-zinc-900/30 rounded-lg w-full flex items-center px-4 justify-between">
            <div className="h-4 bg-zinc-800 rounded-sm w-1/4" />
            <div className="h-4 bg-zinc-800 rounded-sm w-1/6" />
            <div className="h-4 bg-zinc-800 rounded-sm w-1/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonLeaderboard() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((idx) => (
        <div key={idx} className="h-16 bg-zinc-900/30 rounded-xl w-full flex items-center px-4 space-x-4">
          <div className="w-6 h-6 bg-zinc-800 rounded-full" />
          <div className="w-10 h-10 bg-zinc-800 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-800 rounded-sm w-1/3" />
            <div className="h-3 bg-zinc-800 rounded-sm w-1/4" />
          </div>
          <div className="h-4 bg-zinc-800 rounded-sm w-16" />
        </div>
      ))}
    </div>
  );
}
