import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { TechnicalImage } from '../../data/lessons';
import styles from './ImageLightbox.module.css';

interface Props { images: TechnicalImage[]; columns?: number }

export default function ImageLightbox({ images, columns = 1 }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState<number[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = selected === null ? undefined : images[selected];

  const close = () => { setSelected(null); setZoom(1); };
  const move = (direction: number) => {
    if (selected === null) return;
    setSelected((selected + direction + images.length) % images.length);
    setZoom(1);
  };

  useEffect(() => {
    if (selected === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [selected]);

  const requestFullscreen = async () => {
    try { await dialogRef.current?.requestFullscreen(); } catch { /* Fullscreen may be blocked by the browser. */ }
  };

  return <>
    <div className={styles.gallery} data-count={images.length > 1 ? 'multiple' : 'single'} style={{ '--gallery-columns': String(columns) } as CSSProperties}>
      {images.map((image, index) => <figure className={styles.figure} key={`${image.src}-${index}`}>
        <button className={styles.trigger} type="button" onClick={() => setSelected(index)} aria-label={`Ampliar imagen: ${image.alt}`}>
          {failed.includes(index) ? <span className={styles.error}>No se pudo cargar esta imagen técnica.</span> : <img src={image.src} alt={image.alt} loading="lazy" decoding="async" onError={() => setFailed((items) => [...items, index])} />}
          <span className={styles.zoomHint}>Ampliar</span>
        </button>
        {(image.caption || image.credit) && <figcaption className={styles.caption}>
          {image.caption && <span>{image.caption}</span>}
          {image.credit && <cite>Fuente: {image.sourceUrl ? <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.credit}</a> : image.credit}</cite>}
        </figcaption>}
      </figure>)}
    </div>

    {current && <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={`Vista ampliada: ${current.alt}`} ref={dialogRef}>
        <div className={styles.toolbar}><span>{current.alt}</span><span className={styles.counter}>{(selected ?? 0) + 1} / {images.length}</span><div><button type="button" onClick={() => setZoom((value) => Math.max(.75, value - .25))} aria-label="Alejar">−</button><button type="button" onClick={() => setZoom(1)} aria-label="Restablecer zoom">100%</button><button type="button" onClick={() => setZoom((value) => Math.min(3, value + .25))} aria-label="Acercar">+</button><button type="button" onClick={requestFullscreen} aria-label="Ver en pantalla completa">Pantalla</button><button type="button" onClick={close} aria-label="Cerrar imagen">×</button></div></div>
        <div className={styles.stage} style={{ '--image-zoom': zoom } as CSSProperties}>
          {images.length > 1 && <button className={`${styles.navButton} ${styles.previous}`} type="button" onClick={() => move(-1)} aria-label="Imagen anterior">‹</button>}
          <img src={current.src} alt={current.alt} />
          {images.length > 1 && <button className={`${styles.navButton} ${styles.next}`} type="button" onClick={() => move(1)} aria-label="Imagen siguiente">›</button>}
        </div>
        <div className={styles.lightboxCaption}>{current.caption}{current.credit && <> · Fuente: {current.sourceUrl ? <a href={current.sourceUrl} target="_blank" rel="noreferrer">{current.credit}</a> : current.credit}</>}</div>
      </div>
    </div>}
  </>;
}
