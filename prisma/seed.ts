// prisma/seed.ts
import { prisma } from '@/lib/prisma';

async function main() {
    const roomCode = 'KEQING'; // initial room code for Keqing/Winter
    const existing = await prisma.room.findUnique({ where: { code: roomCode } });
    if (!existing) {
        await prisma.room.create({ data: { code: roomCode } });
        console.log('✅ Created initial room with code', roomCode);
    } else {
        console.log('ℹ️ Room already exists');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
