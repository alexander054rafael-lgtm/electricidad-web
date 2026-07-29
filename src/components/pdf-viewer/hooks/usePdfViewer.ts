import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfDocument } from '../lib/pdf-loader';
import type {
  PdfViewerCapabilities,
  PdfViewerProps,
  PdfViewerState,
  SidebarTab,
  ZoomMode,
} from '../types';

export function usePdfViewer({
  resourceId,
  pdfUrl,
  allowDownload,
  initialPage = 1,
  onProgressChange,
  onError,
}: PdfViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<PdfViewerState>({
    status: 'loading',
    errorMessage: null,
    currentPage: initialPage,
    totalPages: 0,
    zoomMode: 'fit-width',
    zoomScale: 1.0,
    sidebarTab: 'none',
    sidebarOpen: false,
    isFullscreen: false,
    rotation: 0,
  });

  // Load document when pdfUrl changes
  useEffect(() => {
    let isCancelled = false;

    setState((prev) => ({ ...prev, status: 'loading', errorMessage: null }));

    loadPdfDocument(pdfUrl)
      .then((loadedDoc) => {
        if (isCancelled) return;
        setDoc(loadedDoc);
        const total = loadedDoc.numPages;
        const validInitial = Math.max(1, Math.min(initialPage, total));
        setState((prev) => ({
          ...prev,
          status: 'ready',
          totalPages: total,
          currentPage: validInitial,
        }));
      })
      .catch((err) => {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : 'No se pudo cargar el documento PDF.';
        setState((prev) => ({ ...prev, status: 'error', errorMessage: msg }));
        if (onError && err instanceof Error) onError(err);
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl, initialPage, onError]);

  // Recalculate zoom scale for automatic modes ('fit-width', 'fit-page')
  const recalculateAutoZoom = useCallback(async () => {
    if (!doc || state.status !== 'ready' || state.zoomMode === 'custom') return;
    const container = viewportRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    try {
      const page = await doc.getPage(state.currentPage);
      const unscaledViewport = page.getViewport({ scale: 1, rotation: state.rotation });
      const baseWidth = unscaledViewport.width;
      const baseHeight = unscaledViewport.height;

      if (baseWidth <= 0 || baseHeight <= 0) return;

      const paddingX = 32; // 1rem left + 1rem right
      const paddingY = 64; // 2rem top + 2rem bottom

      const availableWidth = Math.max(100, containerWidth - paddingX);
      const availableHeight = Math.max(100, containerHeight - paddingY);

      let targetScale = 1.0;

      if (state.zoomMode === 'fit-width') {
        targetScale = availableWidth / baseWidth;
      } else if (state.zoomMode === 'fit-page') {
        const scaleX = availableWidth / baseWidth;
        const scaleY = availableHeight / baseHeight;
        targetScale = Math.min(scaleX, scaleY);
      }

      const safeScale = Number(Math.min(3.0, Math.max(0.5, targetScale)).toFixed(3));

      setState((prev) => {
        if (prev.zoomMode === 'custom') return prev;
        if (Math.abs(prev.zoomScale - safeScale) < 0.005) return prev;
        return { ...prev, zoomScale: safeScale };
      });
    } catch {
      // Ignore cancellation or temporary loading errors
    }
  }, [doc, state.currentPage, state.rotation, state.zoomMode, state.status]);

  // Recalculate auto zoom on dependencies change & container resize
  useEffect(() => {
    if (state.zoomMode === 'custom') return;
    recalculateAutoZoom();

    const container = viewportRef.current;
    if (!container) return;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        recalculateAutoZoom();
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [recalculateAutoZoom, state.zoomMode]);

  // Report progress change
  useEffect(() => {
    if (state.status === 'ready' && state.totalPages > 0 && onProgressChange) {
      onProgressChange({
        resourceId,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        percentage: Math.round((state.currentPage / state.totalPages) * 100),
        timestamp: Date.now(),
      });
    }
  }, [resourceId, state.currentPage, state.totalPages, state.status, onProgressChange]);

  // Navigation handlers
  const goToPage = useCallback((page: number) => {
    setState((prev) => {
      if (page < 1 || page > prev.totalPages || page === prev.currentPage) return prev;
      return { ...prev, currentPage: page };
    });
  }, []);

  const nextPage = useCallback(() => {
    setState((prev) => {
      if (prev.currentPage >= prev.totalPages) return prev;
      return { ...prev, currentPage: prev.currentPage + 1 };
    });
  }, []);

  const prevPage = useCallback(() => {
    setState((prev) => {
      if (prev.currentPage <= 1) return prev;
      return { ...prev, currentPage: prev.currentPage - 1 };
    });
  }, []);

  // Zoom handlers
  const setZoomScale = useCallback((scale: number) => {
    const clampedScale = Math.max(0.5, Math.min(3.0, scale));
    setState((prev) => ({ ...prev, zoomScale: clampedScale, zoomMode: 'custom' }));
  }, []);

  const zoomIn = useCallback(() => {
    setState((prev) => {
      const nextScale = Math.min(3.0, Number((prev.zoomScale + 0.15).toFixed(2)));
      return { ...prev, zoomScale: nextScale, zoomMode: 'custom' };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setState((prev) => {
      const nextScale = Math.max(0.5, Number((prev.zoomScale - 0.15).toFixed(2)));
      return { ...prev, zoomScale: nextScale, zoomMode: 'custom' };
    });
  }, []);

  const setZoomMode = useCallback((mode: ZoomMode) => {
    setState((prev) => ({ ...prev, zoomMode: mode }));
  }, []);

  // Rotation handler
  const rotateClockwise = useCallback(() => {
    setState((prev) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
  }, []);

  // Sidebar toggle
  const toggleSidebar = useCallback((tab?: SidebarTab) => {
    setState((prev) => {
      const nextTab = tab ?? (prev.sidebarTab === 'none' ? 'thumbnails' : 'none');
      const isOpen = nextTab !== 'none';
      return { ...prev, sidebarTab: nextTab, sidebarOpen: isOpen };
    });
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setState((prev) => ({ ...prev, isFullscreen: true }));
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setState((prev) => ({ ...prev, isFullscreen: false }));
      }).catch(() => {});
    }
  }, []);

  const capabilities: PdfViewerCapabilities = {
    canZoomIn: state.zoomScale < 3.0,
    canZoomOut: state.zoomScale > 0.5,
    canGoNext: state.currentPage < state.totalPages,
    canGoPrev: state.currentPage > 1,
    canDownload: allowDownload,
    canToggleFullscreen: typeof document !== 'undefined' && Boolean(document.fullscreenEnabled),
  };

  return {
    doc,
    state,
    capabilities,
    viewportRef,
    goToPage,
    nextPage,
    prevPage,
    setZoomScale,
    zoomIn,
    zoomOut,
    setZoomMode,
    rotateClockwise,
    toggleSidebar,
    toggleFullscreen,
  };
}
