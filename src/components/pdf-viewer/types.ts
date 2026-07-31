import type { PdfQualityMode } from './lib/pdf-render-scale';

export type ViewerStatus = 'idle' | 'loading' | 'rendering' | 'ready' | 'error';

export type ZoomMode = 'fit-width' | 'fit-page' | 'custom';

export type SidebarTab = 'none' | 'thumbnails' | 'outline' | 'bookmarks';

export interface PdfViewerFeatureCapabilities {
  download: boolean;
  print: boolean;
  search: boolean;
  annotations: boolean;
  bookmarks: boolean;
  aiAssistant: boolean;
  fullscreen: boolean;
}

export interface PdfViewerActionCapabilities {
  canZoomIn: boolean;
  canZoomOut: boolean;
  canGoNext: boolean;
  canGoPrev: boolean;
  canDownload: boolean;
  canToggleFullscreen: boolean;
}

export type PdfViewerCapabilities = PdfViewerActionCapabilities;

export interface ReadingProgressEvent {
  resourceId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  timestamp: number;
}

export interface PdfViewerProps {
  resourceId: string;
  title: string;
  author: string;
  pdfUrl: string;
  allowDownload: boolean;
  capabilities?: Partial<PdfViewerFeatureCapabilities>;
  initialPage?: number;
  onProgressChange?: (event: ReadingProgressEvent) => void;
  onError?: (error: Error) => void;
}

export interface PdfViewerState {
  status: ViewerStatus;
  errorMessage: string | null;
  currentPage: number;
  totalPages: number;
  zoomMode: ZoomMode;
  zoomScale: number; // e.g. 1.0 = 100%
  qualityMode: PdfQualityMode;
  sidebarTab: SidebarTab;
  sidebarOpen: boolean;
  isFullscreen: boolean;
  rotation: number; // 0, 90, 180, 270
}
