import { cn } from '@/lib/utils'

interface SpinnerProps {
  readonly className?: string
  readonly size?: 'sm' | 'md' | 'lg'
}

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-[3px]',
    lg: 'w-14 h-14 border-4',
  }

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <div
        className={cn('rounded-full border-brand/15 animate-spin', sizeClasses[size])}
        style={{ borderTopColor: 'var(--brand-primary)' }}
      />
      <div className="absolute w-2 h-2 rounded-full bg-brand/40 animate-pulse" />
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-4 border-brand/10 border-t-brand/40 animate-spin" style={{ animationDuration: '1.4s' }} />
        <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-brand animate-spin" style={{ animationDuration: '0.7s' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
        </div>
      </div>
    </div>
  )
}
