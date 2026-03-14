import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create a sample user
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: 'demo123', // In production, this should be hashed
      organization: 'Demo Organization',
      experience: 5,
      position: 'Software Developer'
    }
  })

  console.log('✅ Created demo user:', user.email)

  // Create a sample project
  const project = await prisma.project.upsert({
    where: { id: 'demo-project' },
    update: {},
    create: {
      id: 'demo-project',
      name: 'Sample E-commerce Project',
      description: 'A sample project for demonstration purposes',
      userId: user.id
    }
  })

  console.log('✅ Created demo project:', project.name)

  // Create sample requirements
  const requirements = await Promise.all([
    prisma.requirement.create({
      data: {
        title: 'User Authentication',
        description: 'Users should be able to register, login, and manage their accounts',
        type: 'FUNCTIONAL',
        priority: 'HIGH',
        source: 'MANUAL_INPUT',
        confidence: 0.9,
        projectId: project.id
      }
    }),
    prisma.requirement.create({
      data: {
        title: 'Product Catalog',
        description: 'Display products with images, descriptions, and pricing',
        type: 'FUNCTIONAL', 
        priority: 'HIGH',
        source: 'MANUAL_INPUT',
        confidence: 0.95,
        projectId: project.id
      }
    }),
    prisma.requirement.create({
      data: {
        title: 'System Performance',
        description: 'The system should handle 1000+ concurrent users with <2s response time',
        type: 'NON_FUNCTIONAL',
        priority: 'MEDIUM',
        source: 'MANUAL_INPUT',
        confidence: 0.8,
        projectId: project.id
      }
    })
  ])

  console.log(`✅ Created ${requirements.length} sample requirements`)

  console.log('🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })