import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create orderer company
  const orderer = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Acme Corp (Orderer)',
      type: 'orderer',
    },
  });

  console.log('Created/Updated orderer:', orderer);

  // Create farmer companies
  const farmer1 = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Farmer Tanaka',
      type: 'farmer',
    },
  });

  const farmer2 = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Farmer Suzuki',
      type: 'farmer',
    },
  });

  console.log('Created/Updated farmers:', farmer1, farmer2);

  // Create products for farmer 1
  const product1 = await prisma.product.upsert({
    where: { id: '10000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000001',
      farmerCompanyId: farmer1.id,
      name: 'Tomato',
      unitPrice: 150,
      unit: 'kg',
      isManaged: true,
    },
  });

  const product2 = await prisma.product.upsert({
    where: { id: '10000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000002',
      farmerCompanyId: farmer1.id,
      name: 'Cucumber',
      unitPrice: 100,
      unit: 'kg',
      isManaged: true,
    },
  });

  console.log('Created/Updated products:', product1, product2);

  // Create special price
  const specialPrice = await prisma.productSpecialPrice.upsert({
    where: {
      id: '20000000-0000-0000-0000-000000000001',
    },
    update: {},
    create: {
      id: '20000000-0000-0000-0000-000000000001',
      productId: product1.id,
      price: 120,
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2025-12-31'),
    },
  });

  console.log('Created/Updated special price:', specialPrice);

  // Create ship-to (delivery address)
  const shipTo = await prisma.shipTo.upsert({
    where: { id: '30000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '30000000-0000-0000-0000-000000000001',
      ordererCompanyId: orderer.id,
      label: 'Tokyo Warehouse',
      address: '123 Shibuya, Tokyo, Japan',
      phone: '+81-90-1234-5678',
    },
  });

  console.log('Created/Updated ship-to:', shipTo);

  console.log('Seed data created successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
