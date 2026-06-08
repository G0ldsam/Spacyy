'use client'

import { useState } from 'react'
import { RebookClient } from '@/components/rebook/RebookClient'
import { BrowseBookView } from '@/components/booking/BrowseBookView'
import type { Suggestion } from '@/app/book/page'

type Tab = 'recommended' | 'browse'

interface Props {
  suggestions: Suggestion[]
  slotsRemaining: number | null
  clientSessionAllowance: number | null
}

export function BookingHub({ suggestions, slotsRemaining, clientSessionAllowance }: Props) {
  const [tab, setTab] = useState<Tab>('recommended')

  return tab === 'recommended' ? (
    <RebookClient
      suggestions={suggestions}
      slotsRemaining={slotsRemaining}
      clientSessionAllowance={clientSessionAllowance}
      onBrowse={() => setTab('browse')}
    />
  ) : (
    <BrowseBookView onRecommended={() => setTab('recommended')} />
  )
}
