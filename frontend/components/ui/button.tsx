import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed'
    
    const variants = {
      default: 'bg-[#8B1538] text-white hover:bg-[#722F37] focus-visible:ring-[#8B1538]',
      outline: 'border-2 border-[#8B1538] text-[#8B1538] bg-transparent hover:bg-[#8B1538] hover:text-white focus-visible:ring-[#8B1538]',
      ghost: 'hover:bg-gray-100 focus-visible:ring-[#8B1538]',
      destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
    }
    
    const sizes = {
      sm: 'h-10 px-4 text-sm', // Minimum 44px touch target
      md: 'h-12 px-5 py-3 text-base', // Minimum 48px for mobile
      lg: 'h-14 px-6 text-lg',
    }

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
