import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.stationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, stationName: 'NEXUS RADIO', tagline: 'Больше, чем просто музыка', isLive: true, volume: 72 }
  });

  if ((await prisma.track.count()) === 0) {
    await prisma.track.createMany({
      data: [
        {
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          genre: 'Pop / Synthwave',
          audioUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
          coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=88'
        },
        {
          title: 'Houdini',
          artist: 'Dua Lipa',
          genre: 'Pop',
          audioUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
          coverUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80'
        }
      ]
    });
  }

  if ((await prisma.show.count()) === 0) {
    await prisma.show.createMany({
      data: [
        { title: 'Morning Boost', host: 'NEXUS', description: 'Энергичный старт дня', startHour: 10, endHour: 12 },
        { title: 'City Sound', host: 'NEXUS', description: 'Музыка большого города', startHour: 12, endHour: 16 },
        { title: 'Drive Time', host: 'Алексей Кортес', description: 'Музыка, новости и гости', startHour: 16, endHour: 18 },
        { title: 'Evening Vibes', host: 'Мария Лана', description: 'Расслабленный вечер', startHour: 18, endHour: 20 },
        { title: 'Night Select', host: 'Дима Кравец', description: 'Авторская подборка', startHour: 20, endHour: 22 },
        { title: 'Deep Night', host: 'Екатерина Рей', description: 'Электронные горизонты', startHour: 22, endHour: 24 }
      ]
    });
  }
}

main().finally(() => prisma.$disconnect());
