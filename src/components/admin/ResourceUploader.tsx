import { useState } from 'react';
import styles from './AdminBuilder.module.css';

type Bucket = 'course-covers'|'course-images'|'course-resources'|'lesson-videos'|'book-covers'|'book-pdfs';
type Props = { bucket: Bucket; courseId?: string; lessonId?: string; bookId?: string; onUploaded?: (result: { path: string; publicUrl?: string }) => void };
const rules: Record<Bucket, { accept: string; max: number }> = {
  'course-covers': { accept: 'image/jpeg,image/png,image/webp', max: 5 }, 'course-images': { accept: 'image/jpeg,image/png,image/webp,image/gif', max: 8 },
  'course-resources': { accept: '.pdf,.zip,.docx,.xlsx,.pptx', max: 25 }, 'lesson-videos': { accept: 'video/mp4,video/webm', max: 200 },
  'book-covers': { accept: 'image/jpeg,image/png,image/webp', max: 5 }, 'book-pdfs': { accept: 'application/pdf', max: 50 },
};
export default function ResourceUploader({ bucket, courseId, lessonId, bookId, onUploaded }: Props) {
  const [file, setFile] = useState<File>(); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const rule = rules[bucket];
  const upload = async () => {
    if (!file) return setMessage('Selecciona un archivo.');
    if (file.size > rule.max * 1024 * 1024) return setMessage(`El máximo permitido es ${rule.max} MB.`);
    setBusy(true); setMessage('');
    const form = new FormData(); form.set('file', file); form.set('bucket', bucket); if (courseId) form.set('courseId', courseId); if (lessonId) form.set('lessonId', lessonId); if (bookId) form.set('bookId', bookId);
    const response = await fetch('/api/admin/storage/upload', { method: 'POST', body: form }); const result = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(result.error ?? 'No se pudo subir el archivo.');
    setMessage('Archivo validado y cargado.'); onUploaded?.(result);
  };
  return <div className={styles.item}><label className={styles.field}>Archivo ({rule.max} MB máximo)<input type="file" accept={rule.accept} onChange={(event) => setFile(event.target.files?.[0])} /></label>
    {file?.type.startsWith('image/') && <img src={URL.createObjectURL(file)} alt="Vista previa" style={{maxWidth:180,maxHeight:120,borderRadius:8,marginTop:8}} />}
    <div className={styles.actions}><button type="button" className={`${styles.button} ${styles.compact}`} onClick={upload} disabled={busy}>{busy ? 'Subiendo…' : 'Subir archivo'}</button></div>
    {message && <p className={message.includes('cargado') ? styles.success : styles.error}>{message}</p>}</div>;
}
