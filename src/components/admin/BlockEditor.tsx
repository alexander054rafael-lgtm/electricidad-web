import BookRelationSelector from './BookRelationSelector'; import ResourceUploader from './ResourceUploader';
import type { AdminBlock, AdminBookOption } from '../../types/admin'; import styles from './AdminBuilder.module.css';
type Props={block:AdminBlock;books:AdminBookOption[];courseId?:string;onChange:(block:AdminBlock)=>void;onDuplicate:()=>void;onMove:(direction:-1|1)=>void};
const text=(value:unknown)=>typeof value==='string'?value:'';
export default function BlockEditor({block,books,courseId,onChange,onDuplicate,onMove}:Props){
 const set=(key:string,value:unknown)=>onChange({...block,content:{...block.content,[key]:value}}); const listLike=['list','steps','gallery','table'].includes(block.type); const media=['image','video','resource'].includes(block.type);
 return <article className={styles.item}><div className={styles.toolbar}><strong>Bloque: {block.type}</strong><div className={styles.actions}><button className={styles.button} onClick={()=>onMove(-1)}>↑</button><button className={styles.button} onClick={()=>onMove(1)}>↓</button><button className={styles.button} onClick={onDuplicate}>Duplicar</button></div></div>
  <div className={styles.grid}><label className={styles.field}>Título<input value={text(block.content.title)} onChange={e=>set('title',e.target.value)} /></label>
  {block.type==='book'?<div className={styles.wide}><BookRelationSelector books={books} selectedIds={Array.isArray(block.content.bookIds)?block.content.bookIds as string[]:[]} onChange={ids=>set('bookIds',ids)} /></div>:<label className={`${styles.field} ${styles.wide}`}>{listLike?'Contenido (una línea por elemento)':'Contenido'}<textarea rows={4} value={text(block.content.body)} onChange={e=>set('body',e.target.value)} placeholder={block.type==='formula'?'Ns = 120 × f / p':undefined}/></label>}
  {media&&<><label className={`${styles.field} ${styles.wide}`}>URL o ruta<input value={text(block.content.url)} onChange={e=>set('url',e.target.value)} /></label><div className={styles.wide}><ResourceUploader bucket={block.type==='video'?'lesson-videos':block.type==='image'?'course-images':'course-resources'} courseId={courseId} onUploaded={r=>set('url',r.publicUrl??r.path)} /></div></>}</div>
  <details><summary>Vista previa</summary><div className={styles.preview}><strong>{text(block.content.title)||block.type}</strong><p style={{whiteSpace:'pre-wrap'}}>{text(block.content.body)||text(block.content.url)||'Completa el contenido del bloque.'}</p></div></details>
 </article>;
}
