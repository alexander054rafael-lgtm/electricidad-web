import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfDocument } from '../lib/pdf-loader';
import { getSavedPdfQualityMode, savePdfQualityMode, type PdfQualityMode } from '../lib/pdf-render-scale';
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
  const hasLoadedInitialPageRef = useRef<boolean>(false);
  const [state, setState] = useState<PdfViewerState>({
    status: 'loading',
    errorMessage: null,
    currentPage: initialPage,
    totalPages: 0,
    zoomMode: 'fit-width',
    zoomScale: 1.0,
    qualityMode: getSavedPdfQualityMode(),
    sidebarTab: 'none',
    sidebarOpen: false,
    isFullscreen: false,
    rotation: 0,
  });

  // Load saved reading progress from Supabase on init
  useEffect(() => {
    if (state.status !== 'ready' || !resourceId || hasLoadedInitialPageRef.current) {
      return;
    }

    hasLoadedInitialPageRef.current = true;

    const fetchProgress = async () => {
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return;
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.log("USER:", user);

      if (!user || !user.id) {
        return;
      }

      const { data, error } = await supabase
        .from('user_reading_progress')
        .select('last_page')
        .eq('user_id', user.id)
        .eq('resource_id', resourceId)
        .maybeSingle();

      if (error || !data || !data.last_page) {
        return;
      }

      const lastPage = data.last_page;

      if (lastPage > 1 && lastPage <= state.totalPages) {
        if (import.meta.env.DEV) {
          console.log('Cargando progreso:', lastPage);
        }
        setState((prev) => ({ ...prev, currentPage: lastPage }));
      }
    };

    fetchProgress();
  }, [state.status, state.totalPages, resourceId]);

  // Load document when pdfUrl changes
  useEffect(() => {
    let isCancelled = false;
    hasLoadedInitialPageRef.current = false;

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

  // Zoom helper with focal point preservation
  const changeZoomWithFocal = useCallback((newScale: number, focalXParam?: number, focalYParam?: number) => {
    const container = viewportRef.current;
    const clampedScale = Number(Math.max(0.5, Math.min(4.0, newScale)).toFixed(2));

    if (!container) {
      setState((prev) => ({ ...prev, zoomScale: clampedScale, zoomMode: 'custom' }));
      return;
    }

    const oldZoom = state.zoomScale;
    if (Math.abs(clampedScale - oldZoom) < 0.005) return;

    const focalX = focalXParam ?? container.clientWidth / 2;
    const focalY = focalYParam ?? container.clientHeight / 2;
    const oldScrollLeft = container.scrollLeft;
    const oldScrollTop = container.scrollTop;

    const ratio = clampedScale / oldZoom;
    const targetScrollLeft = (oldScrollLeft + focalX) * ratio - focalX;
    const targetScrollTop = (oldScrollTop + focalY) * ratio - focalY;

    setState((prev) => ({ ...prev, zoomScale: clampedScale, zoomMode: 'custom' }));

    // Apply focal scroll position across two animation frames after React layout updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (container) {
          const maxScrollLeft = container.scrollWidth - container.clientWidth;
          const maxScrollTop = container.scrollHeight - container.clientHeight;
          container.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
          container.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
        }
      });
    });
  }, [state.zoomScale]);

  // Pinch-to-zoom implementation with focal point scroll preservation
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    let initialDistance = 0;
    let initialZoom = 1.0;
    let initialScrollLeft = 0;
    let initialScrollTop = 0;
    let focalX = 0;
    let focalY = 0;
    let pinchFactor = 1.0;
    let isPinching = false;
    let stageElem: HTMLElement | null = null;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true;
        stageElem = container.querySelector('.pdf-stage');
        initialDistance = getDistance(e.touches);
        initialZoom = state.zoomScale;
        initialScrollLeft = container.scrollLeft;
        initialScrollTop = container.scrollTop;

        // Focal center relative to viewport container
        const rect = container.getBoundingClientRect();
        focalX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        focalY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching) {
        if (e.cancelable) {
          e.preventDefault(); // Prevent native browser zoom ONLY during 2-finger pinch
        }

        const dist = getDistance(e.touches);
        if (initialDistance > 0) {
          pinchFactor = dist / initialDistance;
          if (stageElem) {
            stageElem.style.transformOrigin = `${focalX + initialScrollLeft}px ${focalY + initialScrollTop}px`;
            stageElem.style.transform = `scale(${pinchFactor})`;
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isPinching && e.touches.length < 2) {
        isPinching = false;
        if (stageElem) {
          stageElem.style.transform = '';
          stageElem.style.transformOrigin = '';
        }

        const MIN_ZOOM = 0.5;
        const MAX_ZOOM = 4.0;
        const newVisualZoom = Number(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom * pinchFactor)).toFixed(2));

        if (Math.abs(newVisualZoom - initialZoom) > 0.02) {
          changeZoomWithFocal(newVisualZoom, focalX, focalY);
        }

        pinchFactor = 1.0;
        initialDistance = 0;
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [state.zoomScale, changeZoomWithFocal]);

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

  // Report progress change & save to Supabase
  useEffect(() => {
    if (state.status !== 'ready' || !state.totalPages || !resourceId) {
      return;
    }

    if (onProgressChange) {
      onProgressChange({
        resourceId,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        percentage: Math.round((state.currentPage / state.totalPages) * 100),
        timestamp: Date.now(),
      });
    }

    const timer = setTimeout(async () => {
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return;
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.id) {
        return;
      }

      if (import.meta.env.DEV) {
        console.log('Guardando progreso:', state.currentPage);
      }

      const progress = (state.currentPage / state.totalPages) * 100;

      await supabase.from('user_reading_progress').upsert(
        {
          user_id: user.id,
          resource_id: resourceId,
          last_page: state.currentPage,
          total_pages: state.totalPages,
          progress_percent: progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,resource_id' }
      );
    }, 500);

    return () => {
      clearTimeout(timer);
    };
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

  // Zoom handlers using focal center preservation
  const setZoomScale = useCallback((scale: number) => {
    changeZoomWithFocal(scale);
  }, [changeZoomWithFocal]);

  const zoomIn = useCallback(() => {
    changeZoomWithFocal(state.zoomScale + 0.15);
  }, [state.zoomScale, changeZoomWithFocal]);

  const zoomOut = useCallback(() => {
    changeZoomWithFocal(state.zoomScale - 0.15);
  }, [state.zoomScale, changeZoomWithFocal]);

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
      }).catch(() => { });
    } else {
      document.exitFullscreen().then(() => {
        setState((prev) => ({ ...prev, isFullscreen: false }));
      }).catch(() => { });
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

  const setQualityMode = useCallback((mode: PdfQualityMode) => {
    savePdfQualityMode(mode);
    setState((prev) => ({ ...prev, qualityMode: mode }));
  }, []);

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
    setQualityMode,
    rotateClockwise,
    toggleSidebar,
    toggleFullscreen,
  };
}

