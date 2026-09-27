'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
  const audioRef = useRef<HTMLAudioElement>(null);

  async function load() {
    try {
      const response = await fetch('/api/public/station', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось получить данные станции');
      const json = await response.json();
      setData(json);
      setVolume(json.settings.volume ?? 72);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const source = useMemo(
    () => data?.settings.streamUrl || data?.currentTrack?.audioUrl || '',
    [data]
  );

  async function toggle() {
    if (!audioRef.current || !source) return;

    try {
      if (audioRef.current.paused) {
        await audioRef.current.play();
        setPlaying(true);
      } else {
        audioRef.current.pause();
        setPlaying(false);
      }
    } catch {
      setError('Браузер не смог запустить поток. Проверь URL аудио и CORS S3.');
    }
  }

  const track = data?.currentTrack;
  const show = data?.currentShow;

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
          <span className="live-mini"><i /> LIVE</span>
          <span className="signal"><i /><i /><i /></span>
        </div>
      </header>

      <section id="top" className="hero">
        <div className="hero-cover">
          <img src={track?.coverUrl || fallbackCover} alt="Обложка" />
          <div className="cover-copy">
            <span>{track?.artist || 'NEXUS RADIO'}</span>
            <small>{track?.title || 'ON AIR'}</small>
          </div>
        </div>

        <div className="hero-player">
          <div className="eyebrow">
            <span className="live-pill"><b /> LIVE</span>
            <span>СЕЙЧАС В ЭФИРЕ</span>
          </div>
          <h1>{track?.title || 'NEXUS RADIO'}</h1>
          <h2>{track?.artist || data?.settings.tagline || 'Музыка 24/7'}</h2>
          <div className="tags">
            <span>{track?.genre || 'Radio'}</span>
            <span>24/7</span>
            <span>Live</span>
          </div>

          <div className="player-row">
            <button className="ghost-control" aria-label="В избранное">♡</button>
            <button className="ghost-control" aria-label="Назад">◀</button>
            <button className="play-control" onClick={toggle} aria-label={playing ? 'Пауза' : 'Воспроизвести'}>
              {playing ? 'Ⅱ' : '▶'}
            </button>
            <button className="ghost-control" aria-label="Вперёд">▶</button>
            <div className="waveform" aria-hidden="true">
              {Array.from({ length: 32 }).map((_, i) => (
                <i
                  key={i}
                  className={i < 18 ? 'live' : ''}
                  style={{ height: `${10 + ((i * 17) % 33)}px` }}
                />
              ))}
            </div>
            <div className="volume-wrap">
              <span>🔊</span>
              <input
                aria-label="Громкость"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </div>
          </div>

          <audio
            ref={audioRef}
            src={source}
            preload="none"
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
          {error && <p className="error-banner">{error}</p>}
        </div>

        <aside className="hero-manifesto">
          <p>
            Больше, чем просто музыка.<br />
            NEXUS RADIO — это люди,<br />
            истории и атмосфера,<br />
            которая всегда с тобой.
          </p>
          <span />
        </aside>
      </section>

      <section id="program" className="broadcast-grid">
        <article className="on-air panel">
          <div className="panel-content">
            <h3>СЕЙЧАС В ЭФИРЕ</h3>
            <div className="time-row">
              <span className="live-pill"><b /> LIVE</span>
              <span>
                {show
                  ? `${String(show.startHour).padStart(2, '0')}:00 — ${String(show.endHour).padStart(2, '0')}:00`
                  : '24/7'}
              </span>
            </div>
            <h2>{show?.title || 'NEXUS RADIO'}</h2>
            <h4>{show?.host || 'Автоматический эфир'}</h4>
            <p>{show?.description || 'Непрерывный музыкальный поток.'}</p>
            <button className="air-btn">➤ Написать в эфир →</button>
          </div>
          <img
            src={
              show?.imageUrl ||
              'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=900&q=85'
            }
            alt="Студия"
          />
        </article>

        <article className="next-air panel">
          <h3>ДАЛЕЕ В ЭФИРЕ</h3>
          {(data?.shows || []).slice(0, 3).map((item) => (
            <div className="next-item" key={item.id}>
              <div className="avatar-dot" />
              <div>
                <small>
                  {String(item.startHour).padStart(2, '0')}:00 — {String(item.endHour).padStart(2, '0')}:00
                </small>
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
              <div>
                <b>{item.title}</b>
                <span>{item.description}</span>
              </div>
              {show?.id === item.id && <em><i /> LIVE</em>}
            </div>
          ))}
        </article>
      </section>

      <section id="history" className="track-history panel">
        <div className="section-head">
          <h3>ПОСЛЕДНИЕ ТРЕКИ</h3>
          <span>автообновление каждые 15 секунд</span>
        </div>
        <div className="track-strip">
          {(data?.history || []).map((item, i) => (
            <article className={`track ${i === 0 ? 'current' : ''}`} key={`${item.id}-${i}`}>
              <img src={item.coverUrl || fallbackCover} alt="" />
              <div>
                <small>
                  {i === 0
                    ? 'Сейчас в эфире'
                    : item.playedAt
                    ? new Date(item.playedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                    : 'Недавно'}
                </small>
                <b>{item.artist}</b>
                <span>{item.title}</span>
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
              <img
                src={
                  item.imageUrl ||
                  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80'
                }
                alt=""
              />
              <div>
                <b>{item.title}</b>
                <span>{item.description || item.host}</span>
              </div>
              <button>→</button>
            </article>
          ))}
        </div>
      </section>

      <section className="join-banner">
        <div>
          <h2>Стань частью<br />NEXUS RADIO</h2>
          <p>Делись историями, заказывай треки,<br />участвуй в эфирах и следи за новостями.</p>
        </div>
        <button className="join-btn">➤ Написать в эфир</button>
        <div className="socials"><a>VK</a><a>TG</a><a>▶</a><a>◎</a></div>
      </section>
    </main>
  );
}
