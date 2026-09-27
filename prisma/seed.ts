import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.stationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      stationName: 'NEXUS RADIO',
      tagline: 'Больше, чем просто музыка',
      isLive: true,
      volume: 72,
      timezone: 'Europe/Moscow'
    }
  });

  await prisma.track.deleteMany({
    where: { audioUrl: { contains: 't-rex-roar.mp3' } }
  });

  let playlist = await prisma.playlist.findFirst({ where: { name: 'Основная ротация' } });
  if (!playlist) {
    playlist = await prisma.playlist.create({
      data: { name: 'Основная ротация', description: 'Плейлист по умолчанию' }
    });
  }

  const activeTracks = await prisma.track.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' }
  });

  for (let i = 0; i < activeTracks.length; i++) {
    await prisma.playlistTrack.upsert({
      where: { playlistId_trackId: { playlistId: playlist.id, trackId: activeTracks[i].id } },
      update: {},
      create: { playlistId: playlist.id, trackId: activeTracks[i].id, position: i }
    });
  }

  if (!settings.defaultPlaylistId) {
    await prisma.stationSettings.update({
      where: { id: 1 },
      data: { defaultPlaylistId: playlist.id, rotationStartedAt: new Date() }
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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
