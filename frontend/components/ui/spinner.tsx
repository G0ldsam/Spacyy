import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-[3px]',
    lg: 'w-14 h-14 border-4',
  }

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Outer ring */}
      <div
        className={cn(
          'rounded-full border-[#8B1538]/15 animate-spin',
          sizeClasses[size]
        )}
        style={{ borderTopColor: '#8B1538' }}
      />
      {/* Inner pulsing dot */}
      <div className="absolute w-2 h-2 rounded-full bg-[#8B1538]/40 animate-pulse" />
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* Outer slow ring */}
          <div className="w-14 h-14 rounded-full border-4 border-[#8B1538]/10 border-t-[#8B1538]/40 animate-spin" style={{ animationDuration: '1.4s' }} />
          {/* Inner fast ring */}
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-[#8B1538] animate-spin" style={{ animationDuration: '0.7s' }} />
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#8B1538] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
