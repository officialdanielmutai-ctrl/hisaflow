import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/infrastructure/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const prisma = app.get(PrismaService).db;

  // Find all inventory items that don't belong to a product using raw SQL
  // (after the schema push, product_id column now exists in DB)
  const orphanItems: any[] = await prisma.$queryRaw`
    SELECT id, organization_id, name, category FROM inventory_items WHERE product_id IS NULL
  `;

  console.log(`Found ${orphanItems.length} legacy inventory items without a product.`);

  for (const item of orphanItems) {
    const productId = 'p_' + crypto.randomUUID().replace(/-/g, '');
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO products (id, organization_id, name, category, description, created_at, updated_at)
      VALUES (${productId}, ${item.organization_id}, ${item.name}, ${item.category}, 'Migrated from legacy inventory', ${now}, ${now})
    `;

    await prisma.$executeRaw`
      UPDATE inventory_items SET product_id = ${productId} WHERE id = ${item.id}
    `;

    console.log(`✅ Migrated: "${item.name}"`);
  }

  console.log('\n🎉 Migration completed successfully.');
  await app.close();
}

bootstrap().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
