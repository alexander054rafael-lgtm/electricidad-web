import React from 'react';
import { usePdfViewer } from './hooks/usePdfViewer';
import { PdfPageCanvas } from './PdfPageCanvas';
import { PdfViewerError } from './PdfViewerError';
import { PdfViewerLoading } from './PdfViewerLoading';
import { PdfViewerSidebar } from './PdfViewerSidebar';
import { PdfViewerToolbar } from './PdfViewerToolbar';
import type { PdfViewerProps } from './types';
import './styles/pdf-viewer.css';

export const PdfViewer: React.FC<PdfViewerProps> = (props) => {
  const {
    doc,
    state,
    capabilities,
    goToPage,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    setZoomScale,
    setZoomMode,
    rotateClockwise,
    toggleSidebar,
    toggleFullscreen,
  } = usePdfViewer(props);

  return (
    <div className="pdf-viewer-container">
      <PdfViewerToolbar
        title={props.title}
        state={state}
        capabilities={capabilities}
        onGoToPage={goToPage}
        onNextPage={nextPage}
        onPrevPage={prevPage}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomScaleChange={setZoomScale}
        onZoomModeChange={setZoomMode}
        onRotate={rotateClockwise}
        onToggleSidebar={toggleSidebar}
        onToggleFullscreen={toggleFullscreen}
        downloadUrl={props.allowDownload ? props.pdfUrl : undefined}
      />

      <div className="pdf-body">
        <PdfViewerSidebar
          isOpen={state.sidebarOpen}
          activeTab={state.sidebarTab}
          onTabChange={(tab) => toggleSidebar(tab)}
          title={props.title}
          author={props.author}
          totalPages={state.totalPages}
        />

        <main className="pdf-viewport">
          {state.status === 'loading' && <PdfViewerLoading title={props.title} />}

          {state.status === 'error' && <PdfViewerError message={state.errorMessage || undefined} />}

          {state.status === 'ready' && doc && (
            <div className="pdf-stage">
              <PdfPageCanvas
                doc={doc}
                pageNumber={state.currentPage}
                scale={state.zoomScale}
                rotation={state.rotation}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PdfViewer;
