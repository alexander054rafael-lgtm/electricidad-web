/**
 * Abstraction & Resolver Layer for PDF Resources in InduTech Academy.
 *
 * Provides storage decoupling, centralized capability flags, and enriched metadata.
 */

export type PdfStorageProvider = 'gdrive' | 'r2' | 'supabase_storage' | 'static' | 'custom_url';

export interface PdfViewerCapabilities {
  download: boolean;
  print: boolean;
  search: boolean;
  annotations: boolean;
  bookmarks: boolean;
  aiAssistant: boolean;
  fullscreen: boolean;
}

export interface ResolvedPdfSource {
  provider: PdfStorageProvider;
  streamUrl: string;
  filename: string;
  mimeType: string;
  fileSize?: string;
  supportsRange: boolean;
  cacheable: boolean;
  capabilities: PdfViewerCapabilities;
}

export interface PdfResourceResolvable {
  id: string;
  source: 'static' | 'database';
  title?: string;
  author?: string;
  drive_file_id?: string | null;
  drive_file_name?: string | null;
  drive_mime_type?: string | null;
  drive_file_size?: number | null;
  pdfUrl?: string;
  allowDownload?: boolean;
  fileSize?: string;
}

/**
 * Resolves full PDF metadata and capabilities for a library resource.
 */
export function resolvePdfSource(resource: PdfResourceResolvable): ResolvedPdfSource {
  const allowDownload = Boolean(resource.allowDownload);
  const isStatic = resource.source === 'static';

  const capabilities: PdfViewerCapabilities = {
    download: allowDownload,
    print: allowDownload, // Printing requires download access to raw PDF bytes
    search: true,        // Standard PDF.js text search
    annotations: false,  // Prepared for Phase 4+
    bookmarks: false,    // Prepared for Phase 4+
    aiAssistant: false,  // Prepared for Phase 5+
    fullscreen: typeof window !== 'undefined' && Boolean(document.fullscreenEnabled),
  };

  if (isStatic) {
    return {
      provider: 'static',
      streamUrl: resource.pdfUrl || '',
      filename: `${resource.title || 'documento'}.pdf`,
      mimeType: 'application/pdf',
      fileSize: resource.fileSize || 'PDF',
      supportsRange: true,
      cacheable: true,
      capabilities,
    };
  }

  return {
    provider: resource.drive_file_id ? 'gdrive' : 'custom_url',
    streamUrl: `/api/library/books/${resource.id}/pdf`,
    filename: resource.drive_file_name || `${resource.title || 'documento'}.pdf`,
    mimeType: resource.drive_mime_type || 'application/pdf',
    fileSize: resource.fileSize,
    supportsRange: true, // Google Drive proxy endpoint supports HTTP 206 Range requests
    cacheable: true,
    capabilities,
  };
}
