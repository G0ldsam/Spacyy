import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.user.count()
  console.log(`Deleting ${count} user(s)...`)
  await prisma.user.deleteMany({})
  console.log('Done. All user accounts deleted.')
  console.log('Client and booking records are kept (userId set to null).')
  console.log('Re-create your admin account with: npm run setup:user')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
