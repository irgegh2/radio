'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Heart,
  Instagram,
  Pause,
  Play,
  Radio,
  RadioTower,
  Send,
  Volume2
} from 'lucide-react';

type Track = {
  id: number;
  title: string;
  artist: string;
  genre?: string | null;
  coverUrl?: string | null;
  audioUrl: string;
  duration?: number | null;
  kind?: string;
  playedAt?: string;
};

type QueueItem = {
  track: Track;
  startsAt: string;
  endsAt: string;
  offsetSeconds: number;
  source: string;
};

type Show = {
  id: number;
  title: string;
  host: string;
  description?: string | null;
  imageUrl?: string | null;
  startHour: number;
  endHour: number;
};

type Station = {
  settings: {
    stationName: string;
    tagline: string;
    streamUrl?: string | null;
    isLive: boolean;
    volume: number;
  };
  currentTrack: Track | null;
  currentShow: Show | null;
  playlist: Track[];
  shows: Show[];
  history: Track[];
  offsetSeconds: number;
  serverTime: string;
  playlistName: string;
  sourceLabel: string;
  control: {
    mode: string;
    status: string;
    version: number;
  };
  queue: QueueItem[];
};

const fallbackCover =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=88';

export default function RadioClient() {
  const [data, setData] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(72);
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasUserStarted = useRef(false);
  const autoplayTried = useRef(false);

  const source = useMemo(
    () => data?.settings.streamUrl?.trim() || data?.currentTrack?.audioUrl?.trim() || '',
    [data?.settings.streamUrl, data?.currentTrack?.audioUrl]
  );

  const usingLiveStream = Boolean(data?.settings.streamUrl?.trim());
  const track = data?.currentTrack;
  const show = data?.currentShow;

  const liveOffset = useCallback(() => {
    if (!data || usingLiveStream) return 0;
    const networkElapsed = Math.max(0, (Date.now() - new Date(data.serverTime).getTime()) / 1000);
    const duration = data.currentTrack?.duration || 0;
    if (!duration) return data.offsetSeconds || 0;
    return Math.min(duration - 0.15, Math.max(0, (data.offsetSeconds || 0) + networkElapsed));
  }, [data, usingLiveStream]);

  const syncToLive = useCallback(async (resume = false) => {
    const audio = audioRef.current;
    if (!audio || !source) return;

    if (!usingLiveStream && Number.isFinite(audio.duration)) {
      const target = liveOffset();
      if (Math.abs(audio.currentTime - target) > 1.5) audio.currentTime = target;
    }

    if (resume || !audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
        setError('');
      } catch {
        setPlaying(false);
      }
    }
  }, [liveOffset, source, usingLiveStream]);

  async function load() {
    try {
      const response = await fetch('/api/public/station', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось получить данные станции');
      const json: Station = await response.json();
      setData((previous) => {
        if (previous?.currentTrack?.id !== json.currentTrack?.id && hasUserStarted.current) {
          requestAnimationFrame(() => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.load();
            audio.addEventListener('loadedmetadata', () => syncToLive(true), { once: true });
          });
        }
        return json;
      });
      setVolume((current) => current === 72 ? (json.settings.volume ?? 72) : current);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !data) return;

    if (data.control.status === 'PAUSED') {
      audio.pause();
      return;
    }

    if (!hasUserStarted.current || !source) return;

    const sync = async () => {
      try {
        if (!usingLiveStream && audio.readyState >= 1) {
          const target = liveOffset();
          if (Math.abs(audio.currentTime - target) > 1.5) audio.currentTime = target;
        }
        if (audio.paused) await audio.play();
      } catch {
        // Браузер может требовать первое ручное действие слушателя.
      }
    };

    if (audio.readyState >= 1) sync();
    else audio.addEventListener('loadedmetadata', sync, { once: true });
  }, [data?.currentTrack?.id, data?.control.status, data?.control.version, source, liveOffset, usingLiveStream]);

  useEffect(() => {
    if (!source || !audioRef.current || autoplayTried.current || data?.control.status === 'PAUSED') return;
    autoplayTried.current = true;

    const audio = audioRef.current;
    const attempt = async () => {
      try {
        if (!usingLiveStream && audio.readyState >= 1) audio.currentTime = liveOffset();
        await audio.play();
        hasUserStarted.current = true;
        setPlaying(true);
      } catch {
        // Нормальное поведение: большинство браузеров блокируют звук до действия пользователя.
      }
    };

    if (audio.readyState >= 1) attempt();
    else audio.addEventListener('loadedmetadata', attempt, { once: true });
  }, [source, liveOffset, usingLiveStream, data?.control.status]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || !source) {
      setError('В эфирной ротации пока нет треков с известной длительностью.');
      return;
    }

    if (!audio.paused) {
      audio.pause();
      return;
    }

    if (data?.control.status === 'PAUSED') {
      setError('Эфир временно поставлен на паузу из админки.');
      return;
    }

    hasUserStarted.current = true;
    try {
      if (!usingLiveStream) audio.currentTime = liveOffset();
      await audio.play();
      setPlaying(true);
      setError('');
    } catch {
      setPlaying(false);
      setError('Не удалось подключиться к эфиру. Проверь аудиофайл и S3.');
    }
  }

  async function goLive() {
    if (data?.control.status === 'PAUSED') {
      setError('Эфир временно поставлен на паузу из админки.');
      return;
    }
    hasUserStarted.current = true;
    await syncToLive(true);
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-main">NEXUS</span>
          <span className="brand-sub">RADIO</span>
        </a>
        <nav className="nav">
          <a className="active" href="#top">Главная</a>
          <a href="#program">Программа</a>
          <a href="#history">Эфир</a>
          <a href="#shows">Шоу</a>
          <a href="/admin">Админка</a>
        </nav>
        <div className="top-actions">
          <span className="live-mini"><i /> {data?.settings.isLive ? 'LIVE' : 'OFF AIR'}</span>
          <span className="signal"><i /><i /><i /></span>
        </div>
      </header>

      <section id="top" className="hero">
        <div className="hero-cover">
          <img src={track?.coverUrl || fallbackCover} alt="Обложка текущего трека" />
          <div className="cover-copy">
            <span>{track?.artist || 'NEXUS RADIO'}</span>
            <small>{track?.title || 'ЭФИР ГОТОВ'}</small>
          </div>
        </div>

        <div className="hero-player">
          <div className="eyebrow">
            <span className="live-pill"><b /> LIVE</span>
            <span>{data?.control.status === 'PAUSED' ? 'ЭФИР НА ПАУЗЕ' : (usingLiveStream ? 'LIVE STREAM' : data?.playlistName || 'AUTO DJ')}</span>
          </div>
          <h1>{track?.title || 'NEXUS RADIO'}</h1>
          <h2>{track?.artist || data?.settings.tagline || 'Добавь музыку в админке'}</h2>
          <div className="tags">
            <span>{track?.genre || (track?.kind === 'JINGLE' ? 'Jingle' : 'Radio')}</span>
            <span>{track?.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : 'Live'}</span>
            <span>{data?.playlistName || 'Эфир'}</span>
          </div>

          <div className="player-row radio-player-row">
            <button className={`ghost-control ${favorite ? 'favorite active' : 'favorite'}`} onClick={() => setFavorite(!favorite)} aria-label="В избранное">
              <Heart size={22} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="play-control" onClick={toggle} disabled={!source} aria-label={playing ? 'Пауза' : 'Слушать эфир'}>
              {playing ? <Pause size={27} fill="currentColor" /> : <Play size={27} fill="currentColor" />}
            </button>
            <button className="ghost-control live-sync-control" onClick={goLive} disabled={!source} aria-label="Вернуться в прямой эфир">
              <RadioTower size={22} />
            </button>
            <div className={`waveform ${playing ? 'is-playing' : ''}`} aria-hidden="true">
              {Array.from({ length: 32 }).map((_, i) => (
                <i key={i} className={playing && i < 22 ? 'live' : ''} style={{ height: `${10 + ((i * 17) % 33)}px` }} />
              ))}
            </div>
            <div className="volume-wrap">
              <Volume2 size={19} />
              <input aria-label="Громкость" type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </div>
          </div>

          <audio
            ref={audioRef}
            {...(source ? { src: source } : {})}
            preload="auto"
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onLoadedMetadata={() => {
              if (hasUserStarted.current && !usingLiveStream && audioRef.current) {
                audioRef.current.currentTime = liveOffset();
              }
            }}
            onEnded={() => load()}
            onError={() => source && setError('Источник аудио недоступен. Проверь S3 или URL потока.')}
          />
          {!playing && source && <p className="autoplay-note">Нажми Play один раз, если браузер заблокировал автоматический звук.</p>}
          {error && <p className="error-banner">{error}</p>}
        </div>

        <aside className="hero-manifesto">
          <p>Больше, чем просто музыка.<br />NEXUS RADIO — это люди,<br />истории и атмосфера,<br />которая всегда с тобой.</p>
          <span />
        </aside>
      </section>

      <section id="program" className="broadcast-grid">
        <article className="on-air panel">
          <div className="panel-content">
            <h3>СЕЙЧАС В ЭФИРЕ</h3>
            <div className="time-row">
              <span className="live-pill"><b /> LIVE</span>
              <span>{show ? `${String(show.startHour).padStart(2, '0')}:00 — ${String(show.endHour).padStart(2, '0')}:00` : '24/7'}</span>
            </div>
            <h2>{show?.title || data?.playlistName || 'NEXUS RADIO'}</h2>
            <h4>{show?.host || 'Автоматический эфир'}</h4>
            <p>{show?.description || 'Общий синхронизированный эфир для всех слушателей.'}</p>
            <button className="air-btn"><Send size={16} /> Написать в эфир</button>
          </div>
          <img src={show?.imageUrl || 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=900&q=85'} alt="Студия" />
        </article>

        <article className="next-air panel">
          <h3>ДАЛЕЕ В ЭФИРЕ</h3>
          {(data?.queue || []).slice(1, 4).map((item) => (
            <div className="next-item" key={`${item.track.id}-${item.startsAt}`}>
              <div className="avatar-dot"><Radio size={20} /></div>
              <div>
                <small>{new Date(item.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>
                <b>{item.track.title}</b>
                <span>{item.track.artist}</span>
              </div>
            </div>
          ))}
        </article>

        <article className="today panel">
          <div className="panel-head"><h3>СЕГОДНЯ В ПРОГРАММЕ</h3></div>
          {(data?.shows || []).map((item) => (
            <div className={`schedule-row ${show?.id === item.id ? 'active' : ''}`} key={item.id}>
              <time>{String(item.startHour).padStart(2, '0')}:00</time>
              <div><b>{item.title}</b><span>{item.description}</span></div>
              {show?.id === item.id && <em><i /> LIVE</em>}
            </div>
          ))}
        </article>
      </section>

      <section id="history" className="track-history panel">
        <div className="section-head"><h3>БЛИЖАЙШИЙ ЭФИР</h3><span>синхронизация каждую секунду</span></div>
        <div className="track-strip">
          {(data?.queue || []).slice(0, 6).map((item, index) => (
            <article className={`track ${index === 0 ? 'current' : ''}`} key={`${item.track.id}-${item.startsAt}`}>
              <img src={item.track.coverUrl || fallbackCover} alt="" />
              <div>
                <small>{new Date(item.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>
                <b>{item.track.artist}</b>
                <span>{item.track.title}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="shows" className="shows-section">
        <div className="section-head"><h3>НАШИ ШОУ</h3></div>
        <div className="show-grid">
          {(data?.shows || []).map((item) => (
            <article className="show-card" key={item.id}>
              <img src={item.imageUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80'} alt="" />
              <div><b>{item.title}</b><span>{item.description || item.host}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="join-banner">
        <div><h2>Стань частью<br />NEXUS RADIO</h2><p>Делись историями, заказывай треки,<br />участвуй в эфирах и следи за новостями.</p></div>
        <button className="join-btn"><Send size={16} /> Написать в эфир</button>
        <div className="socials">
          <a aria-label="Telegram"><Send size={17} /></a>
          <a aria-label="Instagram"><Instagram size={17} /></a>
          <a aria-label="Радио"><Radio size={17} /></a>
        </div>
      </section>
    </main>
  );
}
