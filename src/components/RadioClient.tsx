'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  Instagram,
  Pause,
  Play,
  Radio,
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
  playedAt?: string;
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
};

const fallbackCover =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=88';

export default function RadioClient() {
  const [data, setData] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(72);
  const [error, setError] = useState('');
  const [queueIndex, setQueueIndex] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function load() {
    try {
      const response = await fetch('/api/public/station', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось получить данные станции');
      const json: Station = await response.json();
      setData(json);
      setVolume((current) => current === 72 ? (json.settings.volume ?? 72) : current);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const playlist = data?.playlist || [];
  const queueTrack = playlist.length ? playlist[queueIndex % playlist.length] : data?.currentTrack || null;
  const source = useMemo(
    () => data?.settings.streamUrl?.trim() || queueTrack?.audioUrl?.trim() || '',
    [data?.settings.streamUrl, queueTrack?.audioUrl]
  );

  const usingLiveStream = Boolean(data?.settings.streamUrl?.trim());
  const track = queueTrack;
  const show = data?.currentShow;

  async function playCurrent() {
    if (!audioRef.current || !source) {
      setError('В медиатеке пока нет активных треков. Добавь аудио в админке.');
      return;
    }

    try {
      await audioRef.current.play();
      setPlaying(true);
      setError('');
    } catch {
      setPlaying(false);
      setError('Не удалось запустить аудио. Проверь файл, S3-ключи и формат трека.');
    }
  }

  async function toggle() {
    if (!audioRef.current) return;
    if (audioRef.current.paused) await playCurrent();
    else audioRef.current.pause();
  }

  async function changeTrack(direction: number) {
    if (usingLiveStream || !playlist.length) return;
    const next = (queueIndex + direction + playlist.length) % playlist.length;
    setQueueIndex(next);
    setError('');

    requestAnimationFrame(() => {
      if (audioRef.current) {
        audioRef.current.load();
        if (playing) audioRef.current.play().catch(() => setPlaying(false));
      }
    });
  }

  function handleEnded() {
    if (usingLiveStream || !playlist.length) {
      setPlaying(false);
      return;
    }
    setQueueIndex((current) => (current + 1) % playlist.length);
  }

  useEffect(() => {
    if (!audioRef.current || !playing || usingLiveStream) return;
    audioRef.current.load();
    audioRef.current.play().catch(() => setPlaying(false));
  }, [queueIndex]);

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
          <a href="#history">История</a>
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
            <span className="live-pill"><b /> {playing ? 'В ЭФИРЕ' : 'ГОТОВ К ЭФИРУ'}</span>
            <span>{usingLiveStream ? 'LIVE STREAM' : 'АВТОМАТИЧЕСКАЯ РОТАЦИЯ'}</span>
          </div>
          <h1>{track?.title || 'NEXUS RADIO'}</h1>
          <h2>{track?.artist || data?.settings.tagline || 'Добавь музыку в админке'}</h2>
          <div className="tags">
            <span>{track?.genre || 'Radio'}</span>
            <span>{playlist.length} треков</span>
            <span>{usingLiveStream ? 'Live stream' : 'Auto DJ'}</span>
          </div>

          <div className="player-row">
            <button className={`ghost-control ${favorite ? 'favorite active' : 'favorite'}`} onClick={() => setFavorite(!favorite)} aria-label="В избранное">
              <Heart size={22} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="ghost-control" onClick={() => changeTrack(-1)} disabled={usingLiveStream || playlist.length < 2} aria-label="Предыдущий трек">
              <ArrowLeft size={22} />
            </button>
            <button className="play-control" onClick={toggle} disabled={!source} aria-label={playing ? 'Пауза' : 'Воспроизвести'}>
              {playing ? <Pause size={27} fill="currentColor" /> : <Play size={27} fill="currentColor" />}
            </button>
            <button className="ghost-control" onClick={() => changeTrack(1)} disabled={usingLiveStream || playlist.length < 2} aria-label="Следующий трек">
              <ArrowRight size={22} />
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
            preload="metadata"
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onEnded={handleEnded}
            onError={() => source && setError('Источник аудио недоступен. Проверь S3 или URL потока.')}
          />
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
            <h2>{show?.title || 'NEXUS RADIO'}</h2>
            <h4>{show?.host || 'Автоматический эфир'}</h4>
            <p>{show?.description || 'Непрерывная ротация музыки из медиатеки.'}</p>
            <button className="air-btn"><Send size={16} /> Написать в эфир</button>
          </div>
          <img src={show?.imageUrl || 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=900&q=85'} alt="Студия" />
        </article>

        <article className="next-air panel">
          <h3>ДАЛЕЕ В ЭФИРЕ</h3>
          {(data?.shows || []).slice(0, 3).map((item) => (
            <div className="next-item" key={item.id}>
              <div className="avatar-dot"><Radio size={20} /></div>
              <div>
                <small>{String(item.startHour).padStart(2, '0')}:00 — {String(item.endHour).padStart(2, '0')}:00</small>
                <b>{item.title}</b>
                <span>с {item.host}</span>
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
        <div className="section-head"><h3>МЕДИАТЕКА ЭФИРА</h3><span>{playlist.length} активных треков</span></div>
        <div className="track-strip">
          {playlist.slice(0, 6).map((item) => (
            <article className={`track ${track?.id === item.id ? 'current' : ''}`} key={item.id}>
              <img src={item.coverUrl || fallbackCover} alt="" />
              <div><small>{track?.id === item.id ? 'Сейчас выбрано' : 'В ротации'}</small><b>{item.artist}</b><span>{item.title}</span></div>
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
