import React, { useEffect, useRef } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
}

export const PdfPageCanvas: React.FC<Props> = ({ doc, pageNumber, scale, rotation }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRenderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!canvasRef.current || pageNumber < 1 || pageNumber > doc.numPages) return;

      try {
        // Cancel any ongoing render task before starting a new one
        if (currentRenderTaskRef.current) {
          currentRenderTaskRef.current.cancel();
          currentRenderTaskRef.current = null;
        }

        const page = await doc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Support high DPI screens
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: context,
          viewport,
          canvas,
          transform,
        };

        const renderTask = page.render(renderContext);
        currentRenderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: unknown) {
        // Ignore expected rendering cancellations
        if (err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException') {
          return;
        }
        console.warn('[PdfPageCanvas] Error al renderizar la página:', err);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (currentRenderTaskRef.current) {
        currentRenderTaskRef.current.cancel();
        currentRenderTaskRef.current = null;
      }
    };
  }, [doc, pageNumber, scale, rotation]);

  return (
    <div className="pdf-page-container">
      <canvas ref={canvasRef} className="pdf-page-canvas" />
    </div>
  );
};
