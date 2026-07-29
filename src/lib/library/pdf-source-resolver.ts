/**
 * Abstraction & Resolver Layer for PDF Resources in InduTech Academy.
 *
 * Uses a Discriminated Union contract to prevent impossible or contradictory states
 * (e.g. available: true with null streamUrl, or available: false with valid streamUrl).
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

export type PdfUnavailableReason = 'missing_file' | 'invalid_resource' | 'unsupported_provider';

export type ResolvedPdfSource =
  | {
      available: true;
      provider: PdfStorageProvider;
      streamUrl: string;
      filename: string;
      mimeType: string;
      fileSize?: string;
      supportsRange: boolean;
      cacheable: boolean;
      capabilities: PdfViewerCapabilities;
    }
  | {
      available: false;
      reason: PdfUnavailableReason;
    };

export interface PdfResourceResolvable {
  id: string;
  source: 'static' | 'database';
  title?: string;
  author?: string;
  storage_backend?: string | null;
  drive_file_id?: string | null;
  drive_file_name?: string | null;
  drive_mime_type?: string | null;
  drive_file_size?: number | null;
  drive_view_link?: string | null;
  drive_download_link?: string | null;
  cover_url?: string | null;
  cover_mime_type?: string | null;
  pdfUrl?: string;
  allowDownload?: boolean;
  fileSize?: string;
}

/**
 * Resolves full PDF metadata and capabilities for a library resource using a Discriminated Union contract.
 */
export function resolvePdfSource(resource: PdfResourceResolvable): ResolvedPdfSource {
  if (!resource || !resource.id) {
    return { available: false, reason: 'invalid_resource' };
  }

  const allowDownload = Boolean(resource.allowDownload);
  const isStatic = resource.source === 'static';

  const capabilities: PdfViewerCapabilities = {
    download: allowDownload,
    print: allowDownload,
    search: true,
    annotations: false,
    bookmarks: false,
    aiAssistant: false,
    fullscreen: typeof window !== 'undefined' && Boolean(document.fullscreenEnabled),
  };

  if (isStatic) {
    if (!resource.pdfUrl || resource.pdfUrl.trim().length === 0) {
      return { available: false, reason: 'missing_file' };
    }
    return {
      available: true,
      provider: 'static',
      streamUrl: resource.pdfUrl,
      filename: `${resource.title || 'documento'}.pdf`,
      mimeType: 'application/pdf',
      fileSize: resource.fileSize || 'PDF',
      supportsRange: true,
      cacheable: true,
      capabilities,
    };
  }

  // Database resource: check drive_file_id
  const fileId = resource.drive_file_id?.trim();
  if (!fileId) {
    return { available: false, reason: 'missing_file' };
  }

  return {
    available: true,
    provider: 'gdrive',
    streamUrl: `/api/library/books/${resource.id}/pdf`,
    filename: resource.drive_file_name || `${resource.title || 'documento'}.pdf`,
    mimeType: resource.drive_mime_type || 'application/pdf',
    fileSize: resource.fileSize,
    supportsRange: true,
    cacheable: true,
    capabilities,
  };
}
