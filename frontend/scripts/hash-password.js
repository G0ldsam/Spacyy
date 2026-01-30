/**
 * Helper script to hash passwords for user creation
 * Usage: node scripts/hash-password.js "your-password"
 */

const bcrypt = require('bcryptjs')

const password = process.argv[2]

if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-password"')
  process.exit(1)
}

async function hashPassword() {
  const hash = await bcrypt.hash(password, 10)
  console.log('\nHashed password:')
  console.log(hash)
  console.log('\nCopy this hash to use when creating users in the database.\n')
}

hashPassword().catch(console.error)
