/**
 * Script to create the first organization and user
 * Usage: node scripts/create-first-user.js
 * 
 * Make sure to set environment variables first:
 * - DATABASE_URL
 * - ORG_NAME
 * - ORG_SLUG
 * - USER_EMAIL
 * - USER_PASSWORD
 * - USER_NAME (optional)
 */

require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const orgName = process.env.ORG_NAME || 'My Organization'
  const orgSlug = process.env.ORG_SLUG || 'my-org'
  const userEmail = process.env.USER_EMAIL
  const userPassword = process.env.USER_PASSWORD
  const userName = process.env.USER_NAME || 'Admin User'

  if (!userEmail || !userPassword) {
    console.error('Error: USER_EMAIL and USER_PASSWORD must be set in .env.local')
    console.error('\nExample .env.local:')
    console.error('ORG_NAME="My Business"')
    console.error('ORG_SLUG="my-business"')
    console.error('USER_EMAIL="admin@example.com"')
    console.error('USER_PASSWORD="secure-password"')
    console.error('USER_NAME="Admin User"')
    process.exit(1)
  }

  try {
    // Check if organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    })

    if (existingOrg) {
      console.error(`Organization with slug "${orgSlug}" already exists!`)
      process.exit(1)
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail },
    })

    if (existingUser) {
      console.error(`User with email "${userEmail}" already exists!`)
      process.exit(1)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userPassword, 10)

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgSlug,
      },
    })

    console.log(`✅ Created organization: ${organization.name} (${organization.slug})`)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        name: userName,
        password: hashedPassword,
      },
    })

    console.log(`✅ Created user: ${user.email}`)

    // Link user to organization as OWNER
    await prisma.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: 'OWNER',
      },
    })

    console.log(`✅ Linked user to organization as OWNER`)

    console.log('\n🎉 Setup complete!')
    console.log(`\nYou can now login with:`)
    console.log(`Email: ${userEmail}`)
    console.log(`Password: ${userPassword}`)
    console.log(`\nVisit http://localhost:3000/login`)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
