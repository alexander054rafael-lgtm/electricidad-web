import React from 'react';

interface Props {
  title?: string;
}

export const PdfViewerLoading: React.FC<Props> = ({ title }) => {
  return (
    <div className="pdf-status-screen" role="status" aria-live="polite">
      <div className="pdf-spinner" />
      <div className="pdf-status-screen__title">Cargando documento…</div>
      {title && <div className="pdf-status-screen__desc">{title}</div>}
    </div>
  );
};
