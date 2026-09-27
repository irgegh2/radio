# NEXUS RADIO

Full-stack веб-приложение онлайн-радиостанции: публичный эфир, API, админка, медиатека, эфирная сетка и подготовленная интеграция с S3-compatible storage.

## Стек

- Next.js + React + TypeScript
- Prisma ORM
- SQLite локально (для production позже переведём на PostgreSQL)
- S3-compatible storage через AWS SDK
- HTTP-only cookie для админ-сессии
- API для будущего Liquidsoap/AzuraCast broadcast engine

## Уже работает

- публичная главная в утверждённом дизайне;
- live player + громкость;
- API `/api/public/station`;
- текущий трек, история и эфирная сетка;
- `/admin` с авторизацией;
- настройки станции и URL live-потока;
- добавление/удаление треков;
- добавление/удаление шоу;
- загрузка аудиофайла в S3 через presigned PUT URL;
- хранение S3 key + public audio URL в базе;
- защищённый каталог треков для broadcast engine;
- callback `now-playing`, чтобы история отражала реальный эфир;
- адаптивный интерфейс.

## Первый запуск на macOS

Если репозиторий уже лежит на рабочем столе:

```bash
cd ~/Desktop/radio
git pull
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Открыть:

- сайт: http://localhost:3000
- админка: http://localhost:3000/admin

Пароль админки по умолчанию берётся из `ADMIN_PASSWORD` в `.env`. Перед реальным использованием обязательно поменяй `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` и `BROADCAST_API_KEY`.

## S3

Когда будут данные S3, заполни в локальном `.env`:

```env
S3_ENDPOINT="https://..."
S3_REGION="..."
S3_BUCKET="..."
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_BASE_URL="https://..."
S3_FORCE_PATH_STYLE="true"
```

Секретные ключи **не коммитятся**: `.env` находится в `.gitignore`.

Для прямой browser upload бакет должен разрешать CORS для `PUT` с домена приложения. Для воспроизведения объектов браузером нужен публичный CDN/base URL либо выдача signed GET URL.

## Как будет устроен настоящий эфир 24/7

S3 хранит исходные треки, но сам по себе не является радиосервером. Для единого синхронного эфира всем слушателям нужен broadcast engine:

```text
S3 media library
      ↓
Liquidsoap / AzuraCast automation
      ↓
Icecast continuous stream
      ↓
NEXUS web player
```

Broadcast engine получает активные треки через:

```http
GET /api/internal/catalog
Authorization: Bearer <BROADCAST_API_KEY>
```

Когда трек реально начинает играть, engine сообщает приложению:

```http
POST /api/internal/now-playing
Authorization: Bearer <BROADCAST_API_KEY>
Content-Type: application/json

{"trackId": 1}
```

Так публичный сайт показывает реальный `Now Playing` и историю эфира, а не локальную очередь браузера.

## Что дальше

Следующие логичные блоки: PostgreSQL, полноценные плейлисты/ротации, джинглы, роли админов, сообщения слушателей, статистика, Liquidsoap/AzuraCast deployment и production hosting.
