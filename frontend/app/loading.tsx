export default function RootLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#8B1538]/20 border-t-[#8B1538] rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium tracking-wide">Loading…</p>
      </div>
    </div>
  )
}
