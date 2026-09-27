'use client';

import { FormEvent, useEffect, useState } from 'react';

type Track = {
  id: number;
  title: string;
  artist: string;
  genre?: string | null;
  audioUrl: string;
  coverUrl?: string | null;
  active: boolean;
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
};

export default function AdminClient({ authenticated }: { authenticated: boolean }) {
  const [authed, setAuthed] = useState(authenticated);
  const [password, setPassword] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const [tracksResponse, showsResponse, settingsResponse] = await Promise.all([
      fetch('/api/admin/tracks'),
      fetch('/api/admin/schedule'),
      fetch('/api/admin/settings')
    ]);

    if (tracksResponse.ok) setTracks(await tracksResponse.json());
    if (showsResponse.ok) setShows(await showsResponse.json());
    if (settingsResponse.ok) setSettings(await settingsResponse.json());
  };

  useEffect(() => {
    if (authed) load();
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
        isLive: form.get('isLive') === 'on'
      })
    });

    if (response.ok) {
      setSettings(await response.json());
      setMsg('Настройки станции сохранены');
    }
  }

  async function addTrack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    let audioUrl = String(form.get('audioUrl') || '');
    let s3Key: string | undefined;
    const file = form.get('file') as File;

    if (file && file.size) {
      setUploading(true);

      const presignResponse = await fetch('/api/admin/tracks/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'audio/mpeg'
        })
      });

      if (!presignResponse.ok) {
        const json = await presignResponse.json();
        setMsg(json.error || 'Не удалось получить S3 upload URL');
        setUploading(false);
        return;
      }

      const presign = await presignResponse.json();
      const putResponse = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'audio/mpeg' },
        body: file
      });

      if (!putResponse.ok) {
        setMsg('S3 отклонил загрузку файла');
        setUploading(false);
        return;
      }

      audioUrl = presign.publicUrl;
      s3Key = presign.key;
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
        s3Key
      })
    });

    const json = await response.json();
    setUploading(false);

    if (!response.ok) {
      setMsg(json.error || 'Ошибка');
      return;
    }

    setMsg('Трек добавлен');
    e.currentTarget.reset();
    load();
  }

  async function deleteTrack(id: number) {
    if (!confirm('Удалить трек?')) return;
    await fetch(`/api/admin/tracks?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function addShow(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const response = await fetch('/api/admin/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form))
    });

    if (response.ok) {
      setMsg('Шоу добавлено');
      e.currentTarget.reset();
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
          <div className="brand">
            <span className="brand-main">NEXUS</span>
            <span className="brand-sub">RADIO / ADMIN</span>
          </div>
          <h1>Вход в админку</h1>
          <p>Пароль задаётся переменной <code>ADMIN_PASSWORD</code>.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
          />
          <button>Войти</button>
          {msg && <small>{msg}</small>}
          <a href="/">← На сайт</a>
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
          <a href="/">Открыть эфир ↗</a>
          <button onClick={logout}>Выйти</button>
        </div>
      </header>

      <section className="admin-hero">
        <div>
          <span>STATION OPERATIONS</span>
          <h1>Управление радио</h1>
          <p>Треки, эфирная сетка, S3-медиатека и контент станции.</p>
        </div>
        <div className="admin-stat"><b>{tracks.length}</b><span>треков</span></div>
        <div className="admin-stat"><b>{shows.length}</b><span>шоу</span></div>
      </section>

      {msg && <div className="admin-message">{msg}</div>}

      <section className="admin-card">
        <div className="admin-section-head">
          <h2>Станция</h2>
          <span>основные настройки</span>
        </div>
        {settings && (
          <form onSubmit={saveSettings} className="admin-form">
            <div className="two">
              <input name="stationName" defaultValue={settings.stationName} placeholder="Название станции" />
              <input name="tagline" defaultValue={settings.tagline} placeholder="Слоган" />
            </div>
            <input
              name="streamUrl"
              defaultValue={settings.streamUrl || ''}
              placeholder="URL непрерывного live-потока (Icecast/AzuraCast)"
            />
            <div className="two">
              <input name="volume" type="number" min="0" max="100" defaultValue={settings.volume} />
              <label className="upload-box">
                Станция в эфире
                <input name="isLive" type="checkbox" defaultChecked={settings.isLive} />
              </label>
            </div>
            <button>Сохранить настройки</button>
          </form>
        )}
      </section>

      <div className="admin-grid">
        <section className="admin-card">
          <h2>Добавить трек</h2>
          <form onSubmit={addTrack} className="admin-form">
            <div className="two">
              <input name="artist" required placeholder="Исполнитель" />
              <input name="title" required placeholder="Название" />
            </div>
            <div className="two">
              <input name="genre" placeholder="Жанр" />
              <input name="coverUrl" placeholder="URL обложки" />
            </div>
            <label className="upload-box">
              Аудиофайл для S3
              <input name="file" type="file" accept="audio/*" />
            </label>
            <div className="or">или, пока S3 не подключён</div>
            <input name="audioUrl" placeholder="Прямой URL аудиофайла" />
            <button disabled={uploading}>{uploading ? 'Загрузка…' : 'Добавить трек'}</button>
          </form>
        </section>

        <section className="admin-card">
          <h2>Добавить шоу</h2>
          <form onSubmit={addShow} className="admin-form">
            <input name="title" required placeholder="Название шоу" />
            <input name="host" required placeholder="Ведущий" />
            <input name="description" placeholder="Описание" />
            <div className="two">
              <input name="startHour" required type="number" min="0" max="23" placeholder="Начало" />
              <input name="endHour" required type="number" min="1" max="24" placeholder="Конец" />
            </div>
            <button>Добавить в сетку</button>
          </form>
        </section>
      </div>

      <section className="admin-card admin-table">
        <div className="admin-section-head">
          <h2>Медиатека</h2>
          <span>{tracks.length} позиций</span>
        </div>
        <div className="table-list">
          {tracks.map((track) => (
            <div className="table-row" key={track.id}>
              <div className="track-thumb">
                {track.coverUrl ? <img src={track.coverUrl} alt="" /> : '♪'}
              </div>
              <div>
                <b>{track.artist} — {track.title}</b>
                <span>{track.genre || 'Без жанра'}</span>
              </div>
              <div className="url-cell">{track.audioUrl}</div>
              <button onClick={() => deleteTrack(track.id)}>Удалить</button>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card admin-table">
        <div className="admin-section-head">
          <h2>Эфирная сетка</h2>
          <span>{shows.length} программ</span>
        </div>
        <div className="table-list">
          {shows.map((show) => (
            <div className="table-row" key={show.id}>
              <div className="time-badge">{String(show.startHour).padStart(2, '0')}:00</div>
              <div>
                <b>{show.title}</b>
                <span>{show.host} · {show.description}</span>
              </div>
              <div>
                {String(show.startHour).padStart(2, '0')}:00 — {String(show.endHour).padStart(2, '0')}:00
              </div>
              <button onClick={() => deleteShow(show.id)}>Удалить</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
