import React, { useEffect, useRef } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { detectPdfCompatibility } from './lib/pdf-browser-polyfills';
import { calculatePdfOutputScale, type PdfQualityMode } from './lib/pdf-render-scale';

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number; // visualZoom (controls CSS size)
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRenderTaskRef = useRef<RenderTask | null>(null);
  const renderCountRef = useRef<number>(0);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!canvasRef.current || !containerRef.current || pageNumber < 1 || pageNumber > doc.numPages) return;

      try {
        // Cancel any ongoing render task before starting a new one
        if (currentRenderTaskRef.current) {
          currentRenderTaskRef.current.cancel();
          currentRenderTaskRef.current = null;
        }

        const page = await doc.getPage(pageNumber);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        const pageContainer = containerRef.current;
        if (!canvas || !pageContainer) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const visualZoom = scale;
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const compatibility = detectPdfCompatibility();

        // 1. CSS Viewport (visual size of the page in screen CSS pixels)
        const cssViewport = page.getViewport({ scale: visualZoom, rotation });
        const cssWidth = Math.floor(cssViewport.width);
        const cssHeight = Math.floor(cssViewport.height);

        // Update container & canvas CSS size so layout dimensions expand naturally for scrollWidth
        pageContainer.style.width = `${cssWidth}px`;
        pageContainer.style.height = `${cssHeight}px`;

        // Manage marginInline dynamically: auto when page fits in viewport, 0 when wider
        const viewportParent = pageContainer.closest('.pdf-viewport');
        if (viewportParent) {
          const parentWidth = viewportParent.clientWidth;
          const pageFits = cssWidth <= parentWidth;
          pageContainer.style.marginInline = pageFits ? 'auto' : '0';
        }

        // 2. Calculate output scale & quality multiplier
        const scaleResult = calculatePdfOutputScale({
          viewportWidth: cssViewport.width,
          viewportHeight: cssViewport.height,
          devicePixelRatio: dpr,
          qualityMode,
          compatibilityMode: compatibility.mode,
        });

        const qualityMultiplier = scaleResult.outputScale;

        // Render strategy check from URL (?pdfRenderStrategy=transform vs ?pdfRenderStrategy=largeViewport)
        let renderStrategy: 'LARGE_RENDER_VIEWPORT' | 'TRANSFORM_OUTPUT_SCALE' = 'LARGE_RENDER_VIEWPORT';
        if (typeof window !== 'undefined') {
          const strategyParam = new URLSearchParams(window.location.search).get('pdfRenderStrategy');
          if (strategyParam === 'transform') {
            renderStrategy = 'TRANSFORM_OUTPUT_SCALE';
          }
        }

        const renderScale = visualZoom * qualityMultiplier;

        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        let renderTask: RenderTask;

        if (renderStrategy === 'LARGE_RENDER_VIEWPORT') {
          // INDEPENDENT LARGE RENDER VIEWPORT
          const renderViewport = page.getViewport({ scale: renderScale, rotation });

          canvas.width = Math.ceil(renderViewport.width);
          canvas.height = Math.ceil(renderViewport.height);

          renderTask = page.render({
            canvasContext: context,
            viewport: renderViewport,
            canvas,
            transform: undefined,
          });
        } else {
          // Fallback comparison strategy: TRANSFORM_OUTPUT_SCALE
          canvas.width = Math.ceil(cssViewport.width * qualityMultiplier);
          canvas.height = Math.ceil(cssViewport.height * qualityMultiplier);
          const transform = qualityMultiplier !== 1 ? [qualityMultiplier, 0, 0, qualityMultiplier, 0, 0] : undefined;

          renderTask = page.render({
            canvasContext: context,
            viewport: cssViewport,
            canvas,
            transform,
          });
        }

        currentRenderTaskRef.current = renderTask;
        await renderTask.promise;

        renderCountRef.current += 1;

        // Calculate effective scale X/Y and audit overflow
        const rect = canvas.getBoundingClientRect();
        const effectiveScaleX = rect.width > 0 ? Number((canvas.width / rect.width).toFixed(2)) : qualityMultiplier;
        const effectiveScaleY = rect.height > 0 ? Number((canvas.height / rect.height).toFixed(2)) : qualityMultiplier;
        const diffX = Math.abs(effectiveScaleX - qualityMultiplier) / qualityMultiplier;
        const diffY = Math.abs(effectiveScaleY - qualityMultiplier) / qualityMultiplier;
        const isStretched = diffX > 0.05 || diffY > 0.05;

        // Store debug info for ?pdfDebug=1 badge
        if (typeof window !== 'undefined') {
          const isDebug = new URLSearchParams(window.location.search).get('pdfDebug') === '1';
          if (isDebug) {
            const scrollContainer = viewportParent as HTMLElement | null;
            const cWidth = scrollContainer?.clientWidth ?? 0;
            const cHeight = scrollContainer?.clientHeight ?? 0;
            const sWidth = scrollContainer?.scrollWidth ?? 0;
            const sHeight = scrollContainer?.scrollHeight ?? 0;
            const sLeft = scrollContainer?.scrollLeft ?? 0;
            const sTop = scrollContainer?.scrollTop ?? 0;
            const maxSLeft = sWidth - cWidth;
            const maxSTop = sHeight - cHeight;
            const pageFits = cssWidth <= cWidth;
            const isLeftInaccessible = !pageFits && (scrollContainer ? getComputedStyle(scrollContainer).justifyContent === 'center' : false);
            const isOverflowNotScrollable = cssWidth > cWidth && sWidth <= cWidth;

            (window as unknown as Record<string, unknown>).__pdf_debug_last_render = {
              qualityMode,
              zoomVisual: `${Math.round(visualZoom * 100)}%`,
              dpr,
              requestedOutputScale: scaleResult.requestedOutputScale,
              finalOutputScale: qualityMultiplier,
              renderScale: Number(renderScale.toFixed(2)),
              cssViewport: `${cssWidth} × ${cssHeight}`,
              renderViewport: `${canvas.width} × ${canvas.height}`,
              canvasPhysicalSize: `${canvas.width} × ${canvas.height}`,
              effectiveScale: `${effectiveScaleX} / ${effectiveScaleY} ${isStretched ? '⚠️ CANVAS STRETCHED' : ''}`,
              pixelBudget: `${scaleResult.maxPixelsBudget} px`,
              limitationReason: scaleResult.limitationReason,
              renderStrategy,
              renderCount: renderCountRef.current,
              activeCanvases: '1 active (visible page)',
              scrollMetrics: {
                cssSize: `${cssWidth} × ${cssHeight}`,
                containerClient: `${cWidth} × ${cHeight}`,
                containerScroll: `${sWidth} × ${sHeight}`,
                scrollLeftTop: `${sLeft} / ${sTop}`,
                maxScrollLeftTop: `${maxSLeft} / ${maxSTop}`,
                pageFitsContainer: pageFits ? 'YES' : 'NO',
                warnings: [
                  isOverflowNotScrollable ? 'HORIZONTAL OVERFLOW NOT SCROLLABLE' : null,
                  isLeftInaccessible ? 'LEFT SIDE INACCESSIBLE' : null,
                ].filter(Boolean).join(' | ') || 'None',
              },
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
    <div ref={containerRef} className="pdf-page-container">
      <canvas ref={canvasRef} className="pdf-page-canvas" />
    </div>
  );
};
