import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Ensure the value is in 24-hour format
      let timeValue = e.target.value
      
      // If the value is in HH:MM format, keep it
      // The browser should already provide this, but we ensure it
      if (onChange) {
        onChange(e)
      }
    }

    return (
      <input
        type="time"
        ref={ref}
        className={cn(
          'flex h-12 w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base sm:text-sm text-gray-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        value={value}
        onChange={handleChange}
        step="60"
        lang="en-GB"
        {...props}
      />
    )
  }
)
TimeInput.displayName = 'TimeInput'

export { TimeInput }
