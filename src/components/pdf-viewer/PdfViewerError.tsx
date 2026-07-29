import React from 'react';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export const PdfViewerError: React.FC<Props> = ({ message, onRetry }) => {
  return (
    <div className="pdf-status-screen" role="alert">
      <div className="pdf-status-screen__title">No se pudo cargar el PDF</div>
      <div className="pdf-status-screen__desc">
        {message || 'Ocurrió un error al procesar el archivo. Comprueba tu conexión e intenta de nuevo.'}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        {onRetry && (
          <button type="button" onClick={onRetry} className="pdf-toolbar__btn pdf-toolbar__btn--primary">
            Reintentar
          </button>
        )}
        <a href="/biblioteca" className="pdf-back-btn">
          Volver a la Biblioteca
        </a>
      </div>
    </div>
  );
};
