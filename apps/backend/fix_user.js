const { PrismaClient } = require('./generated/prisma');
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({ select: { id: true, clerkId: true, email: true } });
  console.log(users);
}
main().finally(() => p.$disconnect());
