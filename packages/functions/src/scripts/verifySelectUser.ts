import { prisma } from './common/commonFunctions'
import selectUser from './selectUser'

async function main() {
  const id = `uid-${Date.now()}`
  const email = `test-${Date.now()}@example.com`
  const displayName = 'Test User'

  console.log(`Creating test user: ${email} (id: ${id})`)
  await prisma.user.create({
    data: {
      id,
      email,
      displayName,
    },
  })

  console.log('Testing selectUser by id...')
  const userById = await selectUser(id)

  if (!userById) {
    console.error('Test failed: User not found by id')
    process.exit(1)
  }

  console.log('Testing selectUser by email...')
  const user = await selectUser(email)

  if (!user) {
    console.error('Test failed: User not found')
    process.exit(1)
  }

  if (user.id !== id) {
    console.error(`Test failed: Expected id ${id}, got ${user.id}`)
    process.exit(1)
  }

  if (user.email !== email) {
    console.error(`Test failed: Expected email ${email}, got ${user.email}`)
    process.exit(1)
  }

  if (user.displayName !== displayName) {
    console.error(`Test failed: Expected displayName ${displayName}, got ${user.displayName}`)
    process.exit(1)
  }

  console.log('Test passed!')
  console.log('User:', user)

  // Clean up
  await prisma.user.delete({
    where: { id },
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
