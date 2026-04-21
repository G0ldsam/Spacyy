export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 animate-pulse">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="h-8 w-48 bg-gray-200 rounded-md mb-2" />
            <div className="h-4 w-32 bg-gray-200 rounded-md" />
          </div>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
                <div className="h-9 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          {/* Quick actions */}
          <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
