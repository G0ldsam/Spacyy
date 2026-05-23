import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/api-helpers'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const tenant = await getTenantContext()
  const orgId = tenant?.organizationId ?? session.user.organizations?.[0]?.organization.id

  if (!orgId) {
    redirect('/dashboard')
  }

  // Always verify role from DB — never trust JWT alone
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId: session.user.id,
      organizationId: orgId,
      role: { in: ['OWNER', 'ADMIN'] },
    },
  })

  if (!userOrg) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
