import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.stationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      stationName: 'NEXUS RADIO',
      tagline: 'Больше, чем просто музыка',
      isLive: true,
      volume: 72
    }
  });

  // Удаляем старые демонстрационные звуки, которые использовались только на этапе прототипа.
  await prisma.track.deleteMany({
    where: {
      audioUrl: {
        contains: 't-rex-roar.mp3'
      }
    }
  });

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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
