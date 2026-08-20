
import { PrismaClient } from './generated/prisma';
const p = new PrismaClient();
async function main() {
    const s = await p.student.findMany();
    console.log('Students:', s.length);
    const c = await p.schoolClass.findMany({ include: { _count: { select: { students: true } } } });
    console.log('Classes:', JSON.stringify(c, null, 2));
}
main().finally(() => process.exit(0));
