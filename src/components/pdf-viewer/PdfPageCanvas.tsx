import React, { useEffect, useRef } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { detectPdfCompatibility } from './lib/pdf-browser-polyfills';
import { calculatePdfOutputScale, type PdfQualityMode } from './lib/pdf-render-scale';

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  qualityMode: PdfQualityMode;
}

export const PdfPageCanvas: React.FC<Props> = ({
  doc,
  pageNumber,
  scale,
  rotation,
  qualityMode,
}) => {
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

        // Detect devicePixelRatio & compatibility mode
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const compatibility = detectPdfCompatibility();

        // Calculate adaptive output scale
        const scaleResult = calculatePdfOutputScale({
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          devicePixelRatio: dpr,
          qualityMode,
          compatibilityMode: compatibility.mode,
        });

        const finalOutputScale = scaleResult.outputScale;

        // Logical CSS dimensions matching viewport scale exactly (Visual Zoom unchanged)
        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        // Physical backing store resolution (High resolution internal canvas)
        const canvasWidth = Math.ceil(viewport.width * finalOutputScale);
        const canvasHeight = Math.ceil(viewport.height * finalOutputScale);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Transform for scaling PDF.js rendering context to backing store
        const transform = finalOutputScale !== 1 ? [finalOutputScale, 0, 0, finalOutputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: context,
          viewport,
          canvas,
          transform,
        };

        const renderTask = page.render(renderContext);
        currentRenderTaskRef.current = renderTask;

        await renderTask.promise;

        // Calculate effective scale X/Y and detect CSS stretching
        const rect = canvas.getBoundingClientRect();
        const effectiveScaleX = rect.width > 0 ? Number((canvas.width / rect.width).toFixed(2)) : finalOutputScale;
        const effectiveScaleY = rect.height > 0 ? Number((canvas.height / rect.height).toFixed(2)) : finalOutputScale;
        const diffX = Math.abs(effectiveScaleX - finalOutputScale) / finalOutputScale;
        const diffY = Math.abs(effectiveScaleY - finalOutputScale) / finalOutputScale;
        const isStretched = diffX > 0.05 || diffY > 0.05;

        // Store debug info for ?pdfDebug=1 badge
        if (typeof window !== 'undefined') {
          const isDebug = new URLSearchParams(window.location.search).get('pdfDebug') === '1';
          if (isDebug) {
            (window as unknown as Record<string, unknown>).__pdf_debug_last_render = {
              qualityMode,
              zoomVisual: `${Math.round(scale * 100)}%`,
              dpr,
              requestedOutputScale: scaleResult.requestedOutputScale,
              finalOutputScale,
              cssSize: `${cssWidth} × ${cssHeight}`,
              canvasPhysicalSize: `${canvasWidth} × ${canvasHeight}`,
              effectiveScale: `${effectiveScaleX} / ${effectiveScaleY} ${isStretched ? '⚠️ CANVAS STRETCHED' : ''}`,
              pixelBudget: `${scaleResult.maxPixelsBudget} px`,
              limitationReason: scaleResult.limitationReason,
              activeCanvases: '1 active (pág. actual)',
            };
          }
        }
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
      // Memory cleanup: release physical backing store immediately
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    };
  }, [doc, pageNumber, scale, rotation, qualityMode]);

  return (
    <div className="pdf-page-container">
      <canvas ref={canvasRef} className="pdf-page-canvas" />
    </div>
  );
};
