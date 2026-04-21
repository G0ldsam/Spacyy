export default function SessionsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 animate-pulse">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="h-8 w-36 bg-gray-200 rounded-md" />
            <div className="h-10 w-32 bg-gray-200 rounded-lg" />
          </div>
          {/* Session cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="h-11 bg-gray-300" />
                <div className="p-4 sm:p-6 space-y-3">
                  <div className="h-3 w-full bg-gray-200 rounded" />
                  <div className="h-3 w-3/4 bg-gray-200 rounded" />
                  <div className="flex justify-between mt-4">
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                    <div className="h-3 w-8 bg-gray-200 rounded" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                    <div className="h-3 w-8 bg-gray-200 rounded" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <div className="flex-1 h-8 bg-gray-200 rounded-md" />
                    <div className="flex-1 h-8 bg-gray-200 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
