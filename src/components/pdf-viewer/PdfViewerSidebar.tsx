import React from 'react';
import type { SidebarTab } from './types';

interface Props {
  isOpen: boolean;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  title?: string;
  author?: string;
  totalPages: number;
}

export const PdfViewerSidebar: React.FC<Props> = ({
  isOpen,
  activeTab,
  onTabChange,
  title,
  author,
  totalPages,
}) => {
  return (
    <aside className={`pdf-sidebar ${isOpen ? '' : 'pdf-sidebar--collapsed'}`} aria-expanded={isOpen}>
      <div className="pdf-sidebar__header">Información del documento</div>
      <div className="pdf-sidebar__content">
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--pdf-text)' }}>
            {title || 'Documento PDF'}
          </h3>
          {author && <p style={{ fontSize: '0.85rem', color: 'var(--pdf-text-muted)', margin: 0 }}>Por {author}</p>}
          <p style={{ fontSize: '0.8rem', color: 'var(--pdf-text-muted)', marginTop: '0.5rem' }}>
            Total de páginas: <strong>{totalPages}</strong>
          </p>
        </div>

        <div
          style={{
            padding: '1rem',
            background: 'var(--pdf-bg)',
            borderRadius: '8px',
            border: '1px solid var(--pdf-border)',
            fontSize: '0.8rem',
            color: 'var(--pdf-text-muted)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--pdf-text)', display: 'block', marginBottom: '0.3rem' }}>
            Visualizador Premium Base
          </strong>
          Las funciones avanzadas (índice, miniaturas, notas y marcadores) se habilitarán en las siguientes fases.
        </div>
      </div>
    </aside>
  );
};
