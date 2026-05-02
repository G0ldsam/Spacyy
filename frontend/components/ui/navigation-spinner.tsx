'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'

export function NavigationSpinner() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  // Hide when navigation completes
  useEffect(() => {
    setLoading(false)
  }, [pathname])

  // Show when a link is clicked — delay 150ms so fast navigations skip the spinner
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('mailto') ||
        href.startsWith('tel') ||
        anchor.target === '_blank'
      ) return
      if (href === pathname) return
      timer = setTimeout(() => setLoading(true), 150)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      if (timer) clearTimeout(timer)
    }
  }, [pathname])

  if (!loading) return null
  return <PageSpinner />
}
