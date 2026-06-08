export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse ml-auto" />
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full">
            <div className="h-2 w-1/3 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        {/* Section 1 skeleton */}
        <div>
          <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[72px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
        {/* Section 2 skeleton */}
        <div>
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-[72px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
