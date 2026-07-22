import { useMemo, useState } from 'react';
import type { AdminBookOption } from '../../types/admin';
import styles from './AdminBuilder.module.css';

type Props = { books: AdminBookOption[]; selectedIds: string[]; onChange: (ids: string[]) => void; label?: string };
export default function BookRelationSelector({ books, selectedIds, onChange, label = 'Libros relacionados' }: Props) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())), [books, query]);
  return <fieldset className={styles.field}><legend>{label}</legend>
    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o autor" />
    <div className={styles.stack}>{visible.length ? visible.map((book) => <label key={book.id} className={styles.item}>
      <input type="checkbox" checked={selectedIds.includes(book.id)} onChange={() => onChange(selectedIds.includes(book.id) ? selectedIds.filter((id) => id !== book.id) : [...selectedIds, book.id])} />{' '}
      <strong>{book.title}</strong> <span className={styles.muted}>— {book.author}</span>
    </label>) : <span className={styles.muted}>No hay libros coincidentes.</span>}</div>
  </fieldset>;
}
