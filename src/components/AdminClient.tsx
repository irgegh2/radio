'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  ExternalLink,
  ListMusic,
  LogOut,
  Music2,
  Pause,
  Pencil,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Square,
  Trash2,
  Upload
} from 'lucide-react';

type Track = {
  id: number;
  title: string;
  artist: string;
  genre?: string | null;
  audioUrl: string;
  coverUrl?: string | null;
  coverKey?: string | null;
  s3Key?: string | null;
  duration?: number | null;
  kind: string;
  active: boolean;
};

type PlaylistItem = { id: number; position: number; track: Track };
type Playlist = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  shuffle: boolean;
  items: PlaylistItem[];
};

type ScheduleBlock = {
  id: number;
  title: string;
  dayOfWeek: number;
  startSecond: number;
  endSecond: number;
  playlistId: number;
  active: boolean;
  playlist: { id: number; name: string };
};

type QueueItem = {
  track: Track;
  startsAt: string;
  endsAt: string;
  offsetSeconds: number;
  source: string;
};

type QueueState = {
  serverTime: string;
  playlistId?: number | null;
  playlistName: string;
  sourceLabel: string;
  offsetSeconds: number;
  currentTrack: Track | null;
  control: { mode: string; status: string; version: number };
  queue: QueueItem[];
};

type Settings = {
  stationName: string;
  tagline: string;
  streamUrl?: string | null;
  isLive: boolean;
  volume: number;
  timezone: string;
  defaultPlaylistId?: number | null;
  repeatWindow: number;
};

type UploadDraft = {
  key: string;
  coverKey?: string | null;
};

const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function fmtDuration(seconds?: number | null) {
  if (!seconds) return '—';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function timeToSeconds(value: string) {
  const [h, m, s = '0'] = value.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function secondsToClock(value: number) {
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function localTime(value: string) {
  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function safeImageUrl(value?: string | null) {
  if (!value) return '';
  const trimmed = value.trim();
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) ? trimmed : '';
}

export default function AdminClient({ authenticated }: { authenticated: boolean }) {
  const [authed, setAuthed] = useState(authenticated);
  const [password, setPassword] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const [draft, setDraft] = useState<UploadDraft | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [duration, setDuration] = useState('');
  const [kind, setKind] = useState('MUSIC');
  const [coverUrl, setCoverUrl] = useState('');
  const [directUrl, setDirectUrl] = useState('');

  const activeTracks = useMemo(() => tracks.filter((track) => track.active), [tracks]);

  async function loadAll() {
    const responses = await Promise.all([
      fetch('/api/admin/tracks', { cache: 'no-store' }),
      fetch('/api/admin/settings', { cache: 'no-store' }),
      fetch('/api/admin/playlists', { cache: 'no-store' }),
      fetch('/api/admin/schedule-blocks', { cache: 'no-store' }),
      fetch('/api/admin/queue', { cache: 'no-store' })
    ]);

    if (responses[0].ok) setTracks(await responses[0].json());
    if (responses[1].ok) setSettings(await responses[1].json());
    if (responses[2].ok) setPlaylists(await responses[2].json());
    if (responses[3].ok) setSchedule(await responses[3].json());
    if (responses[4].ok) setQueue(await responses[4].json());
  }

  async function refreshQueue() {
    const response = await fetch('/api/admin/queue', { cache: 'no-store' });
    if (response.ok) setQueue(await response.json());
  }

  useEffect(() => {
    if (!authed) return;
    loadAll();
    const timer = setInterval(refreshQueue, 1000);
    return () => clearInterval(timer);
  }, [authed]);

  async function login(e: FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (response.ok) {
      setAuthed(true);
      setMsg('');
    } else {
      setMsg('Неверный пароль');
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
  }

  async function broadcast(action: string, payload: Record<string, unknown> = {}) {
    const response = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    const json = await response.json();

    if (!response.ok) {
      setMsg(json.error || 'Не удалось изменить эфир');
      return;
    }

    setQueue(json);
    setMsg('Эфир обновлён');
  }

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const response = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stationName: form.get('stationName'),
        tagline: form.get('tagline'),
        streamUrl: form.get('streamUrl'),
        volume: Number(form.get('volume')),
        timezone: form.get('timezone'),
        defaultPlaylistId: form.get('defaultPlaylistId') || null,
        repeatWindow: Number(form.get('repeatWindow') || 50),
        isLive: form.get('isLive') === 'on'
      })
    });

    if (response.ok) {
      setSettings(await response.json());
      setMsg('Настройки станции сохранены');
      await loadAll();
    }
  }

  async function restartRotation() {
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ restartRotation: true })
    });
    await broadcast('auto');
    setMsg('Автоматическая ротация начата заново');
  }

  async function inspectAndUpload(file: File | null) {
    if (!file?.size) return;

    setUploading(true);
    setMsg('Читаю MP3-теги и загружаю файл…');

    const body = new FormData();
    body.set('file', file);

    const response = await fetch('/api/admin/tracks/upload', {
      method: 'POST',
      body
    });
    const json = await response.json();
    setUploading(false);

    if (!response.ok) {
      setMsg(json.error || 'Не удалось загрузить файл');
      return;
    }

    setDraft({ key: json.key, coverKey: json.coverKey || null });
    setTitle(json.metadata?.title || '');
    setArtist(json.metadata?.artist || '');
    setGenre(json.metadata?.genre || '');
    setDuration(json.metadata?.duration ? String(json.metadata.duration) : '');
    setMsg('Метаданные прочитаны. Проверь поля и сохрани трек.');
  }

  function clearTrackDraft() {
    setDraft(null);
    setTitle('');
    setArtist('');
    setGenre('');
    setDuration('');
    setKind('MUSIC');
    setCoverUrl('');
    setDirectUrl('');
  }

  async function addTrack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const audioUrl = draft?.key ? `s3://${draft.key}` : directUrl.trim();
    const response = await fetch('/api/admin/tracks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        artist,
        genre,
        coverUrl,
        coverKey: draft?.coverKey || null,
        audioUrl,
        s3Key: draft?.key || null,
        duration: Number(duration),
        kind
      })
    });

    const json = await response.json();
    if (!response.ok) {
      setMsg(json.error || 'Не удалось сохранить трек');
      return;
    }

    setMsg('Медиа сохранено в библиотеке');
    clearTrackDraft();
    await loadAll();
  }

  async function editTrack(track: Track) {
    const nextArtist = prompt('Исполнитель', track.artist);
    if (nextArtist === null) return;
    const nextTitle = prompt('Название', track.title);
    if (nextTitle === null) return;
    const nextGenre = prompt('Жанр', track.genre || '');
    if (nextGenre === null) return;
    const nextDuration = prompt('Длительность в секундах', String(track.duration || ''));
    if (nextDuration === null) return;

    const response = await fetch('/api/admin/tracks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: track.id,
        artist: nextArtist,
        title: nextTitle,
        genre: nextGenre,
        duration: Number(nextDuration)
      })
    });

    if (response.ok) {
      setMsg('Трек обновлён');
      await loadAll();
    }
  }

  async function toggleTrack(track: Track) {
    await fetch('/api/admin/tracks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: track.id, active: !track.active })
    });
    await loadAll();
  }

  async function deleteTrack(id: number) {
    if (!confirm('Удалить медиа из библиотеки?')) return;
    await fetch(`/api/admin/tracks?id=${id}`, { method: 'DELETE' });
    await loadAll();
  }

  async function createPlaylist(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const response = await fetch('/api/admin/playlists', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        description: form.get('description'),
        shuffle: form.get('shuffle') === 'on'
      })
    });

    if (response.ok) {
      formEl.reset();
      setMsg('Плейлист создан');
      await loadAll();
    }
  }

  async function togglePlaylistShuffle(playlist: Playlist) {
    await fetch('/api/admin/playlists', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: playlist.id, shuffle: !playlist.shuffle })
    });
    await loadAll();
  }

  async function addPlaylistItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const response = await fetch('/api/admin/playlists/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playlistId: Number(form.get('playlistId')),
        trackId: Number(form.get('trackId'))
      })
    });

    if (response.ok) {
      setMsg('Трек добавлен в плейлист');
      await loadAll();
    }
  }

  async function removePlaylistItem(id: number) {
    await fetch(`/api/admin/playlists/items?id=${id}`, { method: 'DELETE' });
    await loadAll();
  }

  async function createScheduleBlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const dayOfWeeks = days
      .map((_, index) => index)
      .filter((index) => form.get(`day-${index}`) === 'on');

    const response = await fetch('/api/admin/schedule-blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        dayOfWeeks,
        startSecond: timeToSeconds(String(form.get('start'))),
        endSecond: timeToSeconds(String(form.get('end'))),
        playlistId: Number(form.get('playlistId'))
      })
    });

    const json = await response.json();
    if (!response.ok) {
      setMsg(json.error || 'Не удалось добавить расписание');
      return;
    }

    formEl.reset();
    setMsg('Повторяющееся расписание добавлено');
    await loadAll();
  }

  async function toggleSchedule(block: ScheduleBlock) {
    await fetch('/api/admin/schedule-blocks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: block.id, active: !block.active })
    });
    await loadAll();
  }

  async function deleteScheduleBlock(id: number) {
    await fetch(`/api/admin/schedule-blocks?id=${id}`, { method: 'DELETE' });
    await loadAll();
  }

  if (!authed) {
    return (
      <div className="admin-login">
        <form onSubmit={login} className="admin-card">
          <div className="brand">
            <span className="brand-main">NEXUS</span>
            <span className="brand-sub">RADIO / ADMIN</span>
          </div>
          <h1>Вход в админку</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
          />
          <button>Войти</button>
          {msg && <small>{msg}</small>}
          <a href="/">На сайт</a>
        </form>
      </div>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-top">
        <div>
          <div className="brand-main">NEXUS</div>
          <div className="brand-sub">CONTROL ROOM</div>
        </div>
        <div>
          <a href="/"><ExternalLink size={15} /> Открыть эфир</a>
          <button onClick={logout}><LogOut size={15} /> Выйти</button>
        </div>
      </header>

      <section className="admin-hero">
        <div>
          <span>STATION OPERATIONS</span>
          <h1>Эфирный пульт</h1>
          <p>Медиатека, плейлисты, расписание и ручное управление одним общим эфиром.</p>
        </div>
        <div className="admin-stat"><b>{tracks.length}</b><span>медиа</span></div>
        <div className="admin-stat"><b>{playlists.length}</b><span>плейлистов</span></div>
      </section>

      {msg && <div className="admin-message">{msg}</div>}

      <section className="admin-card broadcast-console">
        <div className="admin-section-head">
          <h2><Radio size={19} /> Эфир сейчас</h2>
          <span>{queue?.sourceLabel || '—'} · {queue?.control.status || '—'}</span>
        </div>

        <div className="onair-console">
          <div className="onair-cover">
            {queue?.currentTrack?.coverUrl
              ? <img src={queue.currentTrack.coverUrl} alt="" />
              : <Music2 size={28} />}
          </div>
          <div className="onair-copy">
            <small>{queue?.playlistName || 'Нет активного плейлиста'}</small>
            <h3>{queue?.currentTrack?.artist || '—'} — {queue?.currentTrack?.title || 'Эфир остановлен'}</h3>
            <span>
              {queue?.currentTrack
                ? `позиция ${fmtDuration(Math.floor(queue.offsetSeconds))} / ${fmtDuration(queue.currentTrack.duration)}`
                : 'нет текущего трека'}
            </span>
          </div>
          <div className="onair-actions">
            {queue?.control.status === 'PAUSED'
              ? <button onClick={() => broadcast('resume')}><Play size={15} /> Продолжить</button>
              : <button onClick={() => broadcast('pause')}><Pause size={15} /> Пауза</button>}
            <button onClick={() => broadcast('stop')}><Square size={15} /> Стоп</button>
            <button onClick={() => broadcast('auto')}><RotateCcw size={15} /> Вернуть автоматику</button>
            <button onClick={restartRotation}><RefreshCw size={15} /> Перезапустить ротацию</button>
          </div>
        </div>

        <div className="manual-control-grid">
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              broadcast('play-track', { trackId: Number(form.get('trackId')) });
            }}
          >
            <h3>Включить трек сейчас</h3>
            <select name="trackId" required>
              <option value="">Выбери трек</option>
              {activeTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.kind === 'JINGLE' ? '[JINGLE] ' : ''}{track.artist} — {track.title}
                </option>
              ))}
            </select>
            <button><Play size={14} /> Прервать эфир и включить</button>
          </form>

          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              broadcast('queue-next', { trackId: Number(form.get('trackId')) });
            }}
          >
            <h3>Поставить следующим</h3>
            <select name="trackId" required>
              <option value="">Выбери трек</option>
              {activeTracks.map((track) => (
                <option key={track.id} value={track.id}>{track.artist} — {track.title}</option>
              ))}
            </select>
            <button><SkipForward size={14} /> Добавить следующим</button>
          </form>

          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              broadcast('play-playlist', { playlistId: Number(form.get('playlistId')) });
            }}
          >
            <h3>Включить плейлист сейчас</h3>
            <select name="playlistId" required>
              <option value="">Выбери плейлист</option>
              {playlists.filter((playlist) => playlist.active).map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}{playlist.shuffle ? ' · вперемешку' : ''}
                </option>
              ))}
            </select>
            <button><ListMusic size={14} /> Прервать эфир и включить</button>
          </form>
        </div>
      </section>

      <section className="admin-card queue-card">
        <div className="admin-section-head">
          <h2><Clock3 size={19} /> Ближайшие треки</h2>
          <span>время старта и окончания до секунды</span>
        </div>
        <div className="queue-list">
          {(queue?.queue || []).map((item, index) => (
            <div className={`queue-row queue-row-wide ${index === 0 ? 'on-now' : ''}`} key={`${item.track.id}-${item.startsAt}`}>
              <time>{localTime(item.startsAt)}</time>
              <time>{localTime(item.endsAt)}</time>
              <span>{index === 0 ? 'LIVE' : item.source}</span>
              <b>{item.track.artist} — {item.track.title}</b>
              <em>{fmtDuration(item.track.duration)}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-section-head">
          <h2>Настройки автоматики</h2>
          <span>анти-повтор применяется к случайной ротации</span>
        </div>
        {settings && (
          <form onSubmit={saveSettings} className="admin-form">
            <div className="two">
              <input name="stationName" defaultValue={settings.stationName} placeholder="Название станции" />
              <input name="tagline" defaultValue={settings.tagline} placeholder="Слоган" />
            </div>
            <input name="streamUrl" defaultValue={settings.streamUrl || ''} placeholder="Icecast/AzuraCast URL — необязательно" />
            <div className="three">
              <input name="volume" type="number" min="0" max="100" defaultValue={settings.volume} />
              <input name="timezone" defaultValue={settings.timezone || 'Europe/Moscow'} placeholder="Europe/Moscow" />
              <input name="repeatWindow" type="number" min="0" max="500" defaultValue={settings.repeatWindow || 50} />
            </div>
            <select name="defaultPlaylistId" defaultValue={settings.defaultPlaylistId || ''}>
              <option value="">Все активные треки</option>
              {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
            </select>
            <label className="upload-box">
              Станция в эфире
              <input name="isLive" type="checkbox" defaultChecked={settings.isLive} />
            </label>
            <button>Сохранить настройки</button>
          </form>
        )}
      </section>

      <section className="admin-card">
        <div className="admin-section-head">
          <h2><Upload size={19} /> Медиатека: загрузка MP3</h2>
          <span>ID3 читается автоматически, поля можно менять</span>
        </div>

        <form onSubmit={addTrack} className="admin-form">
          <label className="upload-box">
            <Upload size={18} />
            {uploading ? 'Читаю и загружаю…' : 'Выбрать MP3 / аудиофайл'}
            <input
              type="file"
              accept="audio/*"
              disabled={uploading}
              onChange={(e) => inspectAndUpload(e.target.files?.[0] || null)}
            />
          </label>

          {draft?.coverKey && (
            <div className="metadata-hint">В MP3 найдена встроенная обложка — она будет сохранена автоматически.</div>
          )}

          <div className="two">
            <input value={artist} onChange={(e) => setArtist(e.target.value)} required placeholder="Исполнитель" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Название" />
          </div>
          <div className="three">
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Жанр" />
            <input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" min="1" required placeholder="Длительность, сек." />
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="MUSIC">Музыка</option>
              <option value="JINGLE">Джингл</option>
            </select>
          </div>
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="URL обложки — если нужно заменить встроенную" />
          {!draft && (
            <input value={directUrl} onChange={(e) => setDirectUrl(e.target.value)} placeholder="Или прямой URL аудио" />
          )}
          <button disabled={uploading}>Сохранить в медиатеку</button>
        </form>
      </section>

      <section className="admin-card admin-table">
        <div className="admin-section-head">
          <h2>Все загруженные треки</h2>
          <span>{tracks.length} позиций</span>
        </div>
        <div className="table-list">
          {tracks.map((track) => (
            <div className="table-row media-row" key={track.id}>
              <div className="track-thumb">
                {(track.coverKey || safeImageUrl(track.coverUrl))
                  ? <img src={track.coverKey ? `/api/public/media/${track.id}/cover` : safeImageUrl(track.coverUrl)} alt="" />
                  : <Music2 size={18} />}
              </div>
              <div>
                <b>{track.artist} — {track.title}</b>
                <span>{track.kind} · {track.genre || 'Без жанра'} · {fmtDuration(track.duration)}</span>
              </div>
              <div className="url-cell">{track.s3Key ? 'S3 / MP3' : track.audioUrl}</div>
              <div className="row-actions">
                <button onClick={() => broadcast('play-track', { trackId: track.id })}><Play size={13} /> Сейчас</button>
                <button onClick={() => broadcast('queue-next', { trackId: track.id })}><SkipForward size={13} /> Следующим</button>
                <button onClick={() => editTrack(track)}><Pencil size={13} /> Изменить</button>
                <button className={track.active ? 'status-active' : ''} onClick={() => toggleTrack(track)}>
                  <Radio size={13} /> {track.active ? 'Активен' : 'Выключен'}
                </button>
                <button onClick={() => deleteTrack(track.id)} aria-label="Удалить"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-card">
          <h2><ListMusic size={19} /> Новый плейлист</h2>
          <form onSubmit={createPlaylist} className="admin-form">
            <input name="name" required placeholder="Название" />
            <input name="description" placeholder="Описание" />
            <label className="upload-box">
              Играть вперемешку
              <input name="shuffle" type="checkbox" defaultChecked />
            </label>
            <button>Создать</button>
          </form>
        </section>

        <section className="admin-card">
          <h2>Добавить трек в плейлист</h2>
          <form onSubmit={addPlaylistItem} className="admin-form">
            <select name="playlistId" required>
              <option value="">Плейлист</option>
              {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
            </select>
            <select name="trackId" required>
              <option value="">Трек / джингл</option>
              {activeTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.kind === 'JINGLE' ? '[JINGLE] ' : ''}{track.artist} — {track.title}
                </option>
              ))}
            </select>
            <button>Добавить</button>
          </form>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-section-head">
          <h2>Плейлисты</h2>
          <span>медиатека и эфир остаются независимыми</span>
        </div>

        <div className="playlist-grid">
          {playlists.map((playlist) => (
            <article className="playlist-card" key={playlist.id}>
              <div className="playlist-headline">
                <div>
                  <h3>{playlist.name}</h3>
                  <p>{playlist.description || 'Без описания'}</p>
                </div>
                <div className="row-actions">
                  <button onClick={() => broadcast('play-playlist', { playlistId: playlist.id })}>
                    <Play size={13} /> В эфир
                  </button>
                  <button onClick={() => togglePlaylistShuffle(playlist)}>
                    <RefreshCw size={13} /> {playlist.shuffle ? 'Shuffle' : 'По порядку'}
                  </button>
                </div>
              </div>

              {playlist.items.map((item, index) => (
                <div className="playlist-item" key={item.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <b>{item.track.kind === 'JINGLE' ? 'JINGLE · ' : ''}{item.track.artist} — {item.track.title}</b>
                  <em>{fmtDuration(item.track.duration)}</em>
                  <button onClick={() => removePlaylistItem(item.id)} aria-label="Убрать"><Trash2 size={13} /></button>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-section-head">
          <h2><Clock3 size={19} /> Расписание</h2>
          <span>еженедельное повторение по выбранным дням</span>
        </div>

        <form onSubmit={createScheduleBlock} className="admin-form">
          <div className="schedule-main-fields">
            <input name="title" required placeholder="Название программы / блока" />
            <input name="start" type="time" step="1" required />
            <input name="end" type="time" step="1" required />
            <select name="playlistId" required>
              <option value="">Плейлист</option>
              {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
            </select>
          </div>
          <div className="weekday-picker">
            {days.map((day, index) => (
              <label key={day}>
                <input type="checkbox" name={`day-${index}`} /> {day}
              </label>
            ))}
          </div>
          <button>Добавить повторяющийся блок</button>
        </form>

        <div className="schedule-block-list">
          {schedule.map((block) => (
            <div className={`schedule-block-row ${block.active ? '' : 'is-disabled'}`} key={block.id}>
              <b>{days[block.dayOfWeek]} · {secondsToClock(block.startSecond)} — {secondsToClock(block.endSecond)}</b>
              <span>{block.title}</span>
              <em>{block.playlist.name}</em>
              <div className="row-actions">
                <button onClick={() => toggleSchedule(block)}>{block.active ? 'Вкл' : 'Выкл'}</button>
                <button onClick={() => deleteScheduleBlock(block.id)} aria-label="Удалить"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
