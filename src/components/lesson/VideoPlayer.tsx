import { useState } from 'react';
import type { VideoProvider } from '../../data/lessons';
import styles from './VideoPlayer.module.css';

interface Props { provider: VideoProvider; source: string; thumbnail: string; title: string; placeholder?: boolean }

const youtubeUrl = (source: string) => {
  const match = source.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  return `https://www.youtube-nocookie.com/embed/${match?.[1] ?? source}?autoplay=1&rel=0`;
};
const vimeoUrl = (source: string) => {
  const match = source.match(/(?:vimeo\.com\/|video\/)(\d+)/);
  return `https://player.vimeo.com/video/${match?.[1] ?? source}?autoplay=1`;
};

export default function VideoPlayer({ provider, source, thumbnail, title, placeholder = false }: Props) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);

  const activate = () => { setError(false); setActive(true); };
  const fail = () => setError(true);

  return <div className={styles.player}>
    {!active && <button className={styles.poster} type="button" onClick={activate} aria-label={`Reproducir video: ${title}`}>
      <img src={thumbnail} alt="" loading="lazy" decoding="async" />
      {placeholder && <span className={styles.placeholder}>Video placeholder</span>}
      <span className={styles.overlay}><span className={styles.play} aria-hidden="true">▶</span></span>
    </button>}

    {active && !error && <div className={styles.media}>
      {provider === 'youtube' && <iframe src={youtubeUrl(source)} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" onError={fail} />}
      {provider === 'vimeo' && <iframe src={vimeoUrl(source)} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" onError={fail} />}
      {provider === 'external' && <iframe src={source} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" onError={fail} />}
      {provider === 'local' && <video src={source} controls autoPlay playsInline preload="metadata" onError={fail}>Tu navegador no puede reproducir este video.</video>}
      <span className={styles.loading}>Cargando contenido multimedia…</span>
    </div>}

    {error && <div className={styles.error} role="alert"><strong>No se pudo cargar el video</strong><p>{placeholder ? 'Este archivo local es un placeholder identificado y debe reemplazarse por el video definitivo.' : 'Comprueba la URL o intenta nuevamente.'}</p><button type="button" onClick={() => setActive(false)}>Volver a la miniatura</button></div>}
  </div>;
}
