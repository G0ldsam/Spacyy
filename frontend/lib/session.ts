import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

// Deduplicates getServerSession calls within a single server request.
// React cache() ensures the JWT is decoded at most once per render/action.
export const getSession = cache(() => getServerSession(authOptions))
