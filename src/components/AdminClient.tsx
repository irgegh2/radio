'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  ExternalLink,
  ListMusic,
  LogOut,
  Music2,
  Pencil,
  Radio,
  RefreshCw,
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
  items: PlaylistItem[];
};

type ScheduleBlock = {
  id: number;
  title: string;
  dayOfWeek: number;
  startSecond: number;
  endSecond: number;
  playlistId: number;
  playlist: { id: number; name: string };
};

type QueueItem = { track: Track; startsAt: string; offsetSeconds: number };
type QueueState = {
  serverTime: string;
  playlistName: string;
  offsetSeconds: number;
  currentTrack: Track | null;
  queue: QueueItem[];
};

type Show = {
  id: number;
  title: string;
  host: string;
  description?: string | null;
  startHour: number;
  endHour: number;
};

type Settings = {
  stationName: string;
  tagline: string;
  streamUrl?: string | null;
  isLive: boolean;
  volume: number;
  timezone: string;
  defaultPlaylistId?: number | null;
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

async function audioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const value = Math.max(1, Math.round(audio.duration));
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось определить длительность аудио'));
    };
    audio.src = url;
  });
}

export default function AdminClient({ authenticated }: { authenticated: boolean }) {
  const [authed, setAuthed] = useState(authenticated);
  const [password, setPassword] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null);

  const activeTracks = useMemo(() => tracks.filter((track) => track.active), [tracks]);

  const load = async () => {
    const responses = await Promise.all([
      fetch('/api/admin/tracks'),
      fetch('/api/admin/schedule'),
      fetch('/api/admin/settings'),
      fetch('/api/admin/playlists'),
      fetch('/api/admin/schedule-blocks'),
      fetch('/api/admin/queue', { cache: 'no-store' })
    ]);

    if (responses[0].ok) setTracks(await responses[0].json());
    if (responses[1].ok) setShows(await responses[1].json());
    if (responses[2].ok) setSettings(await responses[2].json());
    if (responses[3].ok) setPlaylists(await responses[3].json());
    if (responses[4].ok) setSchedule(await responses[4].json());
    if (responses[5].ok) setQueue(await responses[5].json());
  };

  useEffect(() => {
    if (!authed) return;
    load();
    const timer = setInterval(async () => {
      const response = await fetch('/api/admin/queue', { cache: 'no-store' });
      if (response.ok) setQueue(await response.json());
    }, 5000);
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
    } else setMsg('Неверный пароль');
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
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
        isLive: form.get('isLive') === 'on'
      })
    });
    if (response.ok) {
      setSettings(await response.json());
      setMsg('Настройки станции сохранены');
      load();
    }
  }

  async function restartRotation() {
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ restartRotation: true })
    });
    setMsg('Эфирная ротация запущена с текущего момента');
    load();
  }

  async function handleAudioFile(file: File | null) {
    if (!file?.size) {
      setDetectedDuration(null);
      return;
    }
    try {
      setDetectedDuration(await audioDuration(file));
    } catch {
      setDetectedDuration(null);
    }
  }

  async function addTrack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    let audioUrl = String(form.get('audioUrl') || '');
    let s3Key: string | undefined;
    let duration = detectedDuration || Number(form.get('duration') || 0);
    const file = form.get('file') as File;

    if (file && file.size) {
      setUploading(true);
      if (!duration) duration = await audioDuration(file);

      const uploadForm = new FormData();
      uploadForm.set('file', file);
      const uploadResponse = await fetch('/api/admin/tracks/upload', {
        method: 'POST',
        body: uploadForm
      });
      const upload = await uploadResponse.json();
      if (!uploadResponse.ok) {
        setMsg(upload.error || 'Не удалось загрузить файл в S3');
        setUploading(false);
        return;
      }
      s3Key = upload.key;
      audioUrl = `s3://${upload.key}`;
    }

    const response = await fetch('/api/admin/tracks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        artist: form.get('artist'),
        genre: form.get('genre'),
        coverUrl: form.get('coverUrl'),
        audioUrl,
        s3Key,
        duration,
        kind: form.get('kind')
      })
    });

    const json = await response.json();
    setUploading(false);
    if (!response.ok) {
      setMsg(json.error || 'Ошибка добавления');
      return;
    }

    setMsg(json.kind === 'JINGLE' ? 'Джингл добавлен' : 'Трек добавлен');
    formEl.reset();
    setDetectedDuration(null);
    load();
  }

  async function editTrack(track: Track) {
    const artist = prompt('Исполнитель / подпись', track.artist);
    if (artist === null) return;
    const title = prompt('Название', track.title);
    if (title === null) return;
    const duration = prompt('Длительность в секундах', String(track.duration || ''));
    if (duration === null) return;

    const response = await fetch('/api/admin/tracks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: track.id, artist, title, duration: Number(duration) })
    });
    if (response.ok) {
      setMsg('Медиа обновлено');
      load();
    }
  }

  async function toggleTrack(track: Track) {
    await fetch('/api/admin/tracks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: track.id, active: !track.active })
    });
    load();
  }

  async function deleteTrack(id: number) {
    if (!confirm('Удалить медиа из библиотеки?')) return;
    await fetch(`/api/admin/tracks?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function createPlaylist(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const response = await fetch('/api/admin/playlists', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.get('name'), description: form.get('description') })
    });
    if (response.ok) {
      formEl.reset();
      setMsg('Плейлист создан');
      load();
    }
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
      setMsg('Медиа добавлено в плейлист');
      load();
    }
  }

  async function removePlaylistItem(id: number) {
    await fetch(`/api/admin/playlists/items?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function createScheduleBlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const response = await fetch('/api/admin/schedule-blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        dayOfWeek: Number(form.get('dayOfWeek')),
        startSecond: timeToSeconds(String(form.get('start'))),
        endSecond: timeToSeconds(String(form.get('end'))),
        playlistId: Number(form.get('playlistId'))
      })
    });
    if (response.ok) {
      formEl.reset();
      setMsg('Эфирный блок добавлен');
      load();
    }
  }

  async function deleteScheduleBlock(id: number) {
    await fetch(`/api/admin/schedule-blocks?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function addShow(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const response = await fetch('/api/admin/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form))
    });
    if (response.ok) {
      formEl.reset();
      setMsg('Шоу добавлено');
      load();
    }
  }

  async function deleteShow(id: number) {
    await fetch(`/api/admin/schedule?id=${id}`, { method: 'DELETE' });
    load();
  }

  if (!authed) {
    return (
      <div className="admin-login">
        <form onSubmit={login} className="admin-card">
          <div className="brand"><span className="brand-main">NEXUS</span><span className="brand-sub">RADIO / ADMIN</span></div>
          <h1>Вход в админку</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" />
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
        <div><div className="brand-main">NEXUS</div><div className="brand-sub">CONTROL ROOM</div></div>
        <div>
          <a href="/"><ExternalLink size={15} /> Открыть эфир</a>
          <button onClick={logout}><LogOut size={15} /> Выйти</button>
        </div>
      </header>

      <section className="admin-hero">
        <div><span>STATION OPERATIONS</span><h1>Управление радио</h1><p>Общий эфирный таймлайн, плейлисты, джинглы и расписание.</p></div>
        <div className="admin-stat"><b>{tracks.length}</b><span>медиа</span></div>
        <div className="admin-stat"><b>{playlists.length}</b><span>плейлистов</span></div>
      </section>

      {msg && <div className="admin-message">{msg}</div>}

      <section className="admin-card queue-card">
        <div className="admin-section-head">
          <h2><Clock3 size={19} /> Эфирная очередь</h2>
          <span>{queue?.playlistName || '—'} · обновление 5 сек.</span>
        </div>
        <div className="queue-list">
          {(queue?.queue || []).slice(0, 10).map((item, index) => (
            <div className={`queue-row ${index === 0 ? 'on-now' : ''}`} key={`${item.track.id}-${item.startsAt}`}>
              <time>{new Date(item.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
              <span>{index === 0 ? `LIVE +${Math.floor(queue?.offsetSeconds || 0)}s` : item.track.kind}</span>
              <b>{item.track.artist} — {item.track.title}</b>
              <em>{fmtDuration(item.track.duration)}</em>
            </div>
          ))}
        </div>
        <button onClick={restartRotation}><RefreshCw size={15} /> Начать текущую ротацию заново</button>
      </section>

      <section className="admin-card">
        <div className="admin-section-head"><h2>Станция</h2><span>основные настройки</span></div>
        {settings && (
          <form onSubmit={saveSettings} className="admin-form">
            <div className="two">
              <input name="stationName" defaultValue={settings.stationName} placeholder="Название станции" />
              <input name="tagline" defaultValue={settings.tagline} placeholder="Слоган" />
            </div>
            <input name="streamUrl" defaultValue={settings.streamUrl || ''} placeholder="Icecast/AzuraCast stream URL — необязательно" />
            <div className="three">
              <input name="volume" type="number" min="0" max="100" defaultValue={settings.volume} />
              <input name="timezone" defaultValue={settings.timezone || 'Europe/Moscow'} placeholder="Europe/Moscow" />
              <select name="defaultPlaylistId" defaultValue={settings.defaultPlaylistId || ''}>
                <option value="">Авто: все активные медиа</option>
                {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
              </select>
            </div>
            <label className="upload-box">Станция в эфире <input name="isLive" type="checkbox" defaultChecked={settings.isLive} /></label>
            <button>Сохранить настройки</button>
          </form>
        )}
      </section>

      <div className="admin-grid">
        <section className="admin-card">
          <h2><Upload size={19} /> Загрузить музыку или джингл</h2>
          <form onSubmit={addTrack} className="admin-form">
            <div className="two">
              <select name="kind" defaultValue="MUSIC"><option value="MUSIC">Музыка</option><option value="JINGLE">Джингл</option></select>
              <input name="genre" placeholder="Жанр / категория" />
            </div>
            <div className="two">
              <input name="artist" required placeholder="Исполнитель / NEXUS RADIO" />
              <input name="title" required placeholder="Название" />
            </div>
            <input name="coverUrl" placeholder="URL обложки" />
            <label className="upload-box">
              <Upload size={18} /> Аудиофайл для S3
              <input name="file" type="file" accept="audio/*" onChange={(e) => handleAudioFile(e.target.files?.[0] || null)} />
            </label>
            {detectedDuration && <small className="detected">Длительность: {fmtDuration(detectedDuration)} ({detectedDuration} сек.)</small>}
            <div className="or">или прямой URL</div>
            <div className="two">
              <input name="audioUrl" placeholder="Прямой URL аудиофайла" />
              <input name="duration" type="number" min="1" placeholder="Длительность, сек. (для URL)" />
            </div>
            <button disabled={uploading}>{uploading ? 'Загрузка…' : 'Добавить в медиатеку'}</button>
          </form>
        </section>

        <section className="admin-card">
          <h2><ListMusic size={19} /> Новый плейлист</h2>
          <form onSubmit={createPlaylist} className="admin-form">
            <input name="name" required placeholder="Название плейлиста" />
            <input name="description" placeholder="Описание" />
            <button>Создать плейлист</button>
          </form>
          <hr className="admin-divider" />
          <form onSubmit={addPlaylistItem} className="admin-form">
            <select name="playlistId" required><option value="">Плейлист</option>{playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select name="trackId" required><option value="">Трек / джингл</option>{activeTracks.map((t) => <option key={t.id} value={t.id}>{t.kind === 'JINGLE' ? '[JINGLE] ' : ''}{t.artist} — {t.title}</option>)}</select>
            <button>Добавить в плейлист</button>
          </form>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-section-head"><h2><ListMusic size={19} /> Плейлисты</h2><span>порядок = порядок эфира</span></div>
        <div className="playlist-grid">
          {playlists.map((playlist) => (
            <article className="playlist-card" key={playlist.id}>
              <h3>{playlist.name}</h3>
              <p>{playlist.description || 'Без описания'}</p>
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
        <div className="admin-section-head"><h2><Clock3 size={19} /> Автоматическое расписание плейлистов</h2><span>точность до секунды</span></div>
        <form onSubmit={createScheduleBlock} className="admin-form schedule-form">
          <input name="title" required placeholder="Название блока" />
          <select name="dayOfWeek" required>{days.map((day, index) => <option value={index} key={day}>{day}</option>)}</select>
          <input name="start" type="time" step="1" required />
          <input name="end" type="time" step="1" required />
          <select name="playlistId" required><option value="">Плейлист</option>{playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <button>Добавить блок</button>
        </form>
        <div className="schedule-block-list">
          {schedule.map((block) => (
            <div className="schedule-block-row" key={block.id}>
              <b>{days[block.dayOfWeek]} · {secondsToClock(block.startSecond)} — {secondsToClock(block.endSecond)}</b>
              <span>{block.title}</span>
              <em>{block.playlist.name}</em>
              <button onClick={() => deleteScheduleBlock(block.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card admin-table">
        <div className="admin-section-head"><h2>Медиатека</h2><span>{tracks.length} позиций</span></div>
        <div className="table-list">
          {tracks.map((track) => (
            <div className="table-row media-row" key={track.id}>
              <div className="track-thumb">{track.coverUrl ? <img src={track.coverUrl} alt="" /> : <Music2 size={18} />}</div>
              <div><b>{track.artist} — {track.title}</b><span>{track.kind} · {track.genre || 'Без категории'} · {fmtDuration(track.duration)}</span></div>
              <div className="url-cell">{track.s3Key ? 'S3 media' : track.audioUrl}</div>
              <div className="row-actions">
                <button onClick={() => editTrack(track)}><Pencil size={14} /> Изменить</button>
                <button className={track.active ? 'status-active' : ''} onClick={() => toggleTrack(track)}><Radio size={14} /> {track.active ? 'Активен' : 'Включить'}</button>
                <button onClick={() => deleteTrack(track.id)} aria-label="Удалить"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card admin-table">
        <div className="admin-section-head"><h2>Шоу / ведущие</h2><span>{shows.length} программ</span></div>
        <form onSubmit={addShow} className="admin-form schedule-form compact-show-form">
          <input name="title" required placeholder="Название шоу" />
          <input name="host" required placeholder="Ведущий" />
          <input name="description" placeholder="Описание" />
          <input name="startHour" required type="number" min="0" max="23" placeholder="Начало" />
          <input name="endHour" required type="number" min="1" max="24" placeholder="Конец" />
          <button>Добавить</button>
        </form>
        <div className="table-list">
          {shows.map((show) => (
            <div className="table-row" key={show.id}>
              <div className="time-badge">{String(show.startHour).padStart(2, '0')}:00</div>
              <div><b>{show.title}</b><span>{show.host} · {show.description}</span></div>
              <div>{String(show.startHour).padStart(2, '0')}:00 — {String(show.endHour).padStart(2, '0')}:00</div>
              <button onClick={() => deleteShow(show.id)} aria-label="Удалить"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
