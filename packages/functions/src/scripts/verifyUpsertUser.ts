import { prisma } from './common/commonFunctions'
import upsertUser from './upsertUser'
import selectUser from './selectUser'

async function main() {
  const id = `uid-upsert-${Date.now()}`
  const email = `test-upsert-${Date.now()}@example.com`
  const displayName = 'Upsert Test User'
  const updatedDisplayName = 'Updated Test User'

  console.log(`Testing upsertUser (creation): ${email} (id: ${id})`)
  await upsertUser({
    id,
    email,
    displayName,
    attribute: {},
  })

  let user = await selectUser(id)
  if (!user || user.displayName !== displayName) {
    console.error('Test failed: Creation failed or displayName mismatch')
    process.exit(1)
  }
  console.log('Creation successful')

  console.log(`Testing upsertUser (update): ${email}`)
  await upsertUser({
    id,
    email,
    displayName: updatedDisplayName,
    attribute: { theme: 'dark' },
  })

  user = await selectUser(id)
  if (!user || user.displayName !== updatedDisplayName) {
    console.error('Test failed: Update failed or displayName mismatch')
    process.exit(1)
  }
  if (user.attribute.theme !== 'dark') {
    console.error('Test failed: Attribute update failed')
    process.exit(1)
  }
  console.log('Update successful')

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
