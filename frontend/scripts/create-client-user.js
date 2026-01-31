require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Creating client user...')

  // Get organization (you'll need to provide the organization ID or create one first)
  const organization = await prisma.organization.findFirst()
  
  if (!organization) {
    console.error('No organization found. Please create an organization first.')
    process.exit(1)
  }

  console.log(`Using organization: ${organization.name} (${organization.id})`)

  // Client user details
  const email = process.argv[2] || 'client@example.com'
  const password = process.argv[3] || 'password123'
  const name = process.argv[4] || 'Test Client'

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    console.log(`User with email ${email} already exists.`)
    process.exit(1)
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      organizations: {
        create: {
          organizationId: organization.id,
          role: 'CLIENT',
        },
      },
    },
  })

  // Create client record linked to user
  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      email,
      name,
    },
  })

  console.log('\n✅ Client user created successfully!')
  console.log(`\nEmail: ${email}`)
  console.log(`Password: ${password}`)
  console.log(`User ID: ${user.id}`)
  console.log(`Client ID: ${client.id}`)
  console.log(`\nYou can now login at http://localhost:3000/login`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
