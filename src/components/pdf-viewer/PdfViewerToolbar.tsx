import React, { useEffect, useState } from 'react';
import type { PdfQualityMode } from './lib/pdf-render-scale';
import type { ManualPageLabelConfig, PdfViewerCapabilities, PdfViewerState, SidebarTab, ZoomMode } from './types';

interface Props {
  title: string;
  state: PdfViewerState;
  capabilities: PdfViewerCapabilities;
  manualPageLabelConfig?: ManualPageLabelConfig | null;
  onGoToPage: (page: number) => void;
  onGoToPageInput: (input: string) => boolean;
  onPageInputChange: (value: string) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomScaleChange: (scale: number) => void;
  onZoomModeChange: (mode: ZoomMode) => void;
  onQualityModeChange: (mode: PdfQualityMode) => void;
  onRotate: () => void;
  onToggleSidebar: (tab?: SidebarTab) => void;
  onToggleFullscreen: () => void;
  downloadUrl?: string;
}

export const PdfViewerToolbar: React.FC<Props> = ({
  title,
  state,
  capabilities,
  manualPageLabelConfig,
  onGoToPageInput,
  onPageInputChange,
  onNextPage,
  onPrevPage,
  onZoomIn,
  onZoomOut,
  onZoomScaleChange,
  onZoomModeChange,
  onQualityModeChange,
  onRotate,
  onToggleSidebar,
  onToggleFullscreen,
  downloadUrl,
}) => {
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDebug = new URLSearchParams(window.location.search).get('pdfDebug') === '1';
    if (!isDebug) return;

    const interval = setInterval(() => {
      const info = (window as unknown as Record<string, unknown>).__pdf_debug_last_render;
      if (info) {
        setDebugData(info as Record<string, unknown>);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const handlePageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onGoToPageInput(state.pageInputValue);
  };

  const isLowMemoryDevice =
    typeof navigator !== 'undefined' &&
    'deviceMemory' in navigator &&
    typeof (navigator as unknown as Record<string, number>).deviceMemory === 'number' &&
    (navigator as unknown as Record<string, number>).deviceMemory <= 4;

  const currentLabel = state.pageLabelMaps?.physicalToLabel[state.currentPage - 1] ?? String(state.currentPage);
  const isLabelDifferent = currentLabel !== String(state.currentPage);

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
            name="pageInput"
            type="text"
            inputMode="text"
            value={state.pageInputValue}
            className="pdf-toolbar__page-input"
            onChange={(e) => onPageInputChange(e.target.value)}
            onBlur={() => onGoToPageInput(state.pageInputValue)}
            aria-label={`Página lógica ${currentLabel}, página física ${state.currentPage} de ${state.totalPages || 1}`}
            title={`Página lógica ${currentLabel}, página física ${state.currentPage} de ${state.totalPages || 1}`}
          />
          <span>
            {isLabelDifferent
              ? ` PDF ${state.currentPage} de ${state.totalPages || 1}`
              : `/ ${state.totalPages || 1}`}
          </span>
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

        <span style={{ width: 1, height: 20, background: 'var(--pdf-border)', margin: '0 0.2rem' }} />

        {/* Discrete Quality Selector */}
        <select
          className="pdf-toolbar__select"
          value={state.qualityMode}
          onChange={(e) => onQualityModeChange(e.target.value as PdfQualityMode)}
          title="Calidad de renderizado interno"
        >
          <option value="auto">Calidad: Automática</option>
          <option value="high">Calidad: Alta — 200 %</option>
          <option value="ultra">Calidad: Ultra — 300 %</option>
          <option value="economy">Calidad: Ahorro de memoria</option>
        </select>

        {(state.qualityMode === 'high' || state.qualityMode === 'ultra') && isLowMemoryDevice && (
          <span
            style={{ fontSize: '10px', color: '#f59e0b', whiteSpace: 'nowrap' }}
            title="Esta calidad puede utilizar más memoria en este dispositivo"
          >
            ⚠️ Poca memoria
          </span>
        )}
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
          const labelSource = state.pageLabelSource ?? (state.pageLabelMaps?.isFallback ? 'physical-fallback' : 'embedded');

          return (
            <div
              id="pdf-debug-badge"
              style={{
                background: '#f59e0b',
                color: '#000',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                marginLeft: '6px',
                whiteSpace: 'nowrap',
                lineHeight: '1.25',
              }}
            >
              PDF Engine: {mode} ({workerName})<br />
              Page label source: {labelSource}<br />
              Current page label: {currentLabel}<br />
              Current physical page: {state.currentPage}<br />
              Total physical pages: {state.totalPages}<br />
              {labelSource === 'manual' && manualPageLabelConfig && (
                <>
                  Manual start physical: {manualPageLabelConfig.startPhysicalPage ?? 'N/A'}<br />
                  Manual start number: {manualPageLabelConfig.startNumber ?? 'N/A'}<br />
                  Prefix: {manualPageLabelConfig.prefix ?? ''}<br />
                  Suffix: {manualPageLabelConfig.suffix ?? ''}<br />
                  Roman preliminaries: {manualPageLabelConfig.romanPreliminaries ? 'true' : 'false'}<br />
                </>
              )}
            </div>
          );
        })()}
      </div>
    </header>
  );
};
