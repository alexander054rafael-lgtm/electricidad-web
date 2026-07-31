import React from 'react';
import type { PdfViewerCapabilities, PdfViewerState, SidebarTab, ZoomMode } from './types';

interface Props {
  title: string;
  state: PdfViewerState;
  capabilities: PdfViewerCapabilities;
  onGoToPage: (page: number) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomScaleChange: (scale: number) => void;
  onZoomModeChange: (mode: ZoomMode) => void;
  onRotate: () => void;
  onToggleSidebar: (tab?: SidebarTab) => void;
  onToggleFullscreen: () => void;
  downloadUrl?: string;
}

export const PdfViewerToolbar: React.FC<Props> = ({
  title,
  state,
  capabilities,
  onGoToPage,
  onNextPage,
  onPrevPage,
  onZoomIn,
  onZoomOut,
  onZoomScaleChange,
  onZoomModeChange,
  onRotate,
  onToggleSidebar,
  onToggleFullscreen,
  downloadUrl,
}) => {
  const handlePageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pageVal = parseInt(formData.get('pageNumber') as string, 10);
    if (!isNaN(pageVal)) {
      onGoToPage(pageVal);
    }
  };

  return (
    <header className="pdf-toolbar">
      <div className="pdf-toolbar__left">
        <a href="/biblioteca" className="pdf-toolbar__btn" title="Volver a la Biblioteca">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </a>
        <button
          type="button"
          className={`pdf-toolbar__btn ${state.sidebarOpen ? 'pdf-toolbar__btn--active' : ''}`}
          onClick={() => onToggleSidebar()}
          title="Panel lateral"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
        <span className="pdf-toolbar__title" title={title}>
          {title}
        </span>
      </div>

      <div className="pdf-toolbar__center">
        <button
          type="button"
          className="pdf-toolbar__btn"
          onClick={onPrevPage}
          disabled={!capabilities.canGoPrev}
          title="Página anterior"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <form onSubmit={handlePageSubmit} className="pdf-toolbar__page-indicator">
          <input
            key={state.currentPage}
            name="pageNumber"
            type="number"
            min={1}
            max={state.totalPages || 1}
            defaultValue={state.currentPage}
            className="pdf-toolbar__page-input"
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) onGoToPage(val);
            }}
          />
          <span>/ {state.totalPages || 1}</span>
        </form>

        <button
          type="button"
          className="pdf-toolbar__btn"
          onClick={onNextPage}
          disabled={!capabilities.canGoNext}
          title="Página siguiente"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        <span style={{ width: 1, height: 20, background: 'var(--pdf-border)', margin: '0 0.2rem' }} />

        <button
          type="button"
          className="pdf-toolbar__btn"
          onClick={onZoomOut}
          disabled={!capabilities.canZoomOut}
          title="Alejar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M8 11h6" />
          </svg>
        </button>

        <select
          className="pdf-toolbar__select"
          value={state.zoomMode === 'custom' ? `${Math.round(state.zoomScale * 100)}%` : state.zoomMode}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'fit-width' || val === 'fit-page') {
              onZoomModeChange(val as ZoomMode);
            } else {
              const parsedScale = parseFloat(val) / 100;
              if (Number.isFinite(parsedScale) && parsedScale > 0) {
                onZoomScaleChange(parsedScale);
              }
            }
          }}
        >
          <option value="fit-width">Ajustar al ancho</option>
          <option value="fit-page">Página completa</option>
          <option value="50%">50%</option>
          <option value="60%">60%</option>
          <option value="75%">75%</option>
          <option value="100%">100%</option>
          <option value="125%">125%</option>
          <option value="150%">150%</option>
          <option value="200%">200%</option>
        </select>

        <button
          type="button"
          className="pdf-toolbar__btn"
          onClick={onZoomIn}
          disabled={!capabilities.canZoomIn}
          title="Acercar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
          </svg>
        </button>
      </div>

      <div className="pdf-toolbar__right">
        <button type="button" className="pdf-toolbar__btn" onClick={onRotate} title="Rotar documento">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>

        {capabilities.canDownload && downloadUrl && (
          <a
            href={downloadUrl}
            download
            className="pdf-toolbar__btn pdf-toolbar__btn--primary"
            title="Descargar archivo PDF"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Descargar</span>
          </a>
        )}

        <button
          type="button"
          className="pdf-toolbar__btn"
          onClick={onToggleFullscreen}
          title={state.isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {state.isFullscreen ? (
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            ) : (
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            )}
          </svg>
        </button>

        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pdfDebug') === '1' && (() => {
          const mode = (window as unknown as Record<string, unknown>).__pdfjs_mode === 'legacy' ||
            (new URLSearchParams(window.location.search).get('pdfMode') === 'legacy') ||
            (typeof Uint8Array === 'undefined' || typeof Uint8Array.prototype.toHex !== 'function')
            ? 'LEGACY'
            : 'MODERN';
          const workerName = mode === 'LEGACY' ? 'legacy.compat.v1' : 'modern';
          return (
            <div
              id="pdf-debug-badge"
              style={{
                background: '#f59e0b',
                color: '#000',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                marginLeft: '6px',
                whiteSpace: 'nowrap',
                lineHeight: '1.2',
              }}
            >
              PDF engine: {mode}<br />
              Worker: {workerName}<br />
              PDF.js: 6.2.108
            </div>
          );
        })()}
      </div>
    </header>
  );
};
