import type { SupabaseClient } from '@supabase/supabase-js';
import {
  deleteDriveFile,
  getDriveFileMetadata,
  getLibraryPublicLinks,
  makeDriveFilePublic,
  removeDrivePublicPermission,
  verifyFileBelongsToLibraryFolder,
  type DriveUploadResult,
  type LibraryAssetKind,
} from '../google-drive/server';
import type { AdminLibraryResource } from './types';

export const LIBRARY_ADMIN_SELECT = 'id,title,slug,author,description,category,resource_type,level,language,pages,drive_file_id,drive_view_link,drive_download_link,drive_file_name,drive_mime_type,drive_file_size,drive_public_permission_id,cover_drive_file_id,cover_url,cover_file_name,cover_mime_type,cover_file_size,cover_public_permission_id,tags,topics,badge,accent,allow_download,manual_page_labels_enabled,manual_page_start_physical,manual_page_start_number,manual_page_prefix,manual_page_suffix,manual_page_roman_preliminaries,manual_page_preliminary_end_physical,is_featured,is_published,file_error,created_by,created_at,updated_at';

export class LibraryOperationError extends Error {
  resource?: unknown;
  constructor(message: string, resource?: unknown) {
    super(message);
    this.name = 'LibraryOperationError';
    this.resource = resource;
  }
}

export const getAdminLibraryResource = async (supabase: SupabaseClient, id: string) => {
  const result = await supabase.from('library_resources').select(LIBRARY_ADMIN_SELECT).eq('id', id).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new LibraryOperationError('El recurso dinámico no existe.');
  return result.data as unknown as AdminLibraryResource;
};

const safePublicationFailure = async (supabase: SupabaseClient, id: string, message: string, pdfPermissionId?: string, coverPermissionId?: string) => {
  await supabase.from('library_resources').update({
    is_published: false,
    drive_view_link: null,
    drive_download_link: null,
    cover_url: null,
    drive_public_permission_id: pdfPermissionId ?? null,
    cover_public_permission_id: coverPermissionId ?? null,
    file_error: message.slice(0, 500),
  }).eq('id', id);
};

export const publishLibraryResource = async (supabase: SupabaseClient, id: string) => {
  const operationId = crypto.randomUUID();
  console.info('publish start', { operationId, resourceId: id });

  const resource = await getAdminLibraryResource(supabase, id);

  // If already published, attempt repair of missing links/permissions
  if (resource.is_published) {
    console.info('resource already published, attempting repair', { operationId, resourceId: id });
    return await repairPublication(resource, supabase, operationId);
  }

  if (!resource.drive_file_id) throw new LibraryOperationError('El recurso no tiene PDF.', resource);

  let pdfPermissionId: string | undefined;
  let coverPermissionId: string | undefined;
  const warnings: string[] = [];

  try {
    // Clean any existing permissions
    if (resource.drive_public_permission_id) await removeDrivePublicPermission(resource.drive_file_id, resource.drive_public_permission_id);
    if (resource.cover_drive_file_id && resource.cover_public_permission_id) await removeDrivePublicPermission(resource.cover_drive_file_id, resource.cover_public_permission_id);

    const pdf = await verifyFileBelongsToLibraryFolder(resource.drive_file_id, 'pdf');
    const cover = resource.cover_drive_file_id ? await verifyFileBelongsToLibraryFolder(resource.cover_drive_file_id, 'cover') : null;

    console.info('creating pdf permission', { operationId, resourceId: id, fileId: pdf.id });
    pdfPermissionId = await makeDriveFilePublic(pdf.id);
    
    if (cover) {
      try {
        console.info('creating cover permission', { operationId, resourceId: id, fileId: cover.id });
        coverPermissionId = await makeDriveFilePublic(cover.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('cover permission failed, proceeding without public cover', { operationId, resourceId: id, error: msg });
        warnings.push('Cover permission failed; publication will continue without public cover.');
        coverPermissionId = undefined;
      }
    }

    const pdfMetadata = await getDriveFileMetadata(pdf.id);
    const pdfLinks = getLibraryPublicLinks(pdf.id);
    const coverLinks = cover ? getLibraryPublicLinks(cover.id) : null;

    const update = await supabase.from('library_resources').update({
      is_published: true,
      drive_view_link: pdfMetadata.webViewLink ?? pdfLinks.viewLink,
      drive_download_link: pdfLinks.downloadLink,
      cover_url: coverLinks?.contentLink ?? null,
      drive_public_permission_id: pdfPermissionId,
      cover_public_permission_id: coverPermissionId ?? null,
      file_error: null,
    }).eq('id', id).eq('is_published', false).select(LIBRARY_ADMIN_SELECT).single();

    if (update.error) throw update.error;
    if (!update.data.is_published) throw new Error('Failed to persist publication status');

    console.info('publish succeeded', { operationId, resourceId: id });
    return update.data as AdminLibraryResource;
  } catch (err) {
    if (coverPermissionId && resource.cover_drive_file_id) {
      await Promise.allSettled([removeDrivePublicPermission(resource.cover_drive_file_id, coverPermissionId)]);
    }
    if (pdfPermissionId) {
      await Promise.allSettled([removeDrivePublicPermission(resource.drive_file_id, pdfPermissionId)]);
    }
    await safePublicationFailure(
      supabase,
      id,
      'No se pudo completar la publicación en Google Drive.',
      pdfPermissionId ?? resource.drive_public_permission_id ?? undefined,
      coverPermissionId ?? resource.cover_public_permission_id ?? undefined,
    );
    const draft = await getAdminLibraryResource(supabase, id).catch(() => resource);
    console.error('publish failed', { operationId, resourceId: id, error: err instanceof Error ? err.message : String(err) });
    throw new LibraryOperationError('La publicación falló; el recurso se conservó como borrador.', draft);
  }
};

export const unpublishLibraryResource = async (supabase: SupabaseClient, id: string) => {
  const resource = await getAdminLibraryResource(supabase, id);
  if (!resource.is_published) {
    if (resource.drive_public_permission_id) await removeDrivePublicPermission(resource.drive_file_id, resource.drive_public_permission_id);
    if (resource.cover_drive_file_id && resource.cover_public_permission_id) await removeDrivePublicPermission(resource.cover_drive_file_id, resource.cover_public_permission_id);
    if (resource.drive_public_permission_id || resource.cover_public_permission_id) {
      const cleaned = await supabase.from('library_resources').update({ drive_public_permission_id: null, cover_public_permission_id: null, file_error: null }).eq('id', id).select(LIBRARY_ADMIN_SELECT).single();
      if (cleaned.error) throw cleaned.error;
      return cleaned.data as AdminLibraryResource;
    }
    return resource;
  }
  if (!resource.drive_public_permission_id) throw new LibraryOperationError('Falta el ID del permiso público administrado del PDF.', resource);
  if (resource.cover_drive_file_id && !resource.cover_public_permission_id) throw new LibraryOperationError('Falta el ID del permiso público administrado de la portada.', resource);

  const removed: Array<{ fileId: string; kind: 'pdf' | 'cover' }> = [];
  try {
    await removeDrivePublicPermission(resource.drive_file_id, resource.drive_public_permission_id);
    removed.push({ fileId: resource.drive_file_id, kind: 'pdf' });
    if (resource.cover_drive_file_id && resource.cover_public_permission_id) {
      await removeDrivePublicPermission(resource.cover_drive_file_id, resource.cover_public_permission_id);
      removed.push({ fileId: resource.cover_drive_file_id, kind: 'cover' });
    }
    const update = await supabase.from('library_resources').update({
      is_published: false,
      drive_view_link: null,
      drive_download_link: null,
      cover_url: null,
      drive_public_permission_id: null,
      cover_public_permission_id: null,
      file_error: null,
    }).eq('id', id).eq('is_published', true).select(LIBRARY_ADMIN_SELECT).single();
    if (update.error) throw update.error;
    return update.data as AdminLibraryResource;
  } catch {
    const restored: Partial<Record<'pdf' | 'cover', string>> = {};
    for (const item of removed) {
      try { restored[item.kind] = await makeDriveFilePublic(item.fileId); } catch { /* Se registra abajo sin exponer detalles. */ }
    }
    await supabase.from('library_resources').update({
      ...(restored.pdf ? { drive_public_permission_id: restored.pdf } : {}),
      ...(restored.cover ? { cover_public_permission_id: restored.cover } : {}),
      file_error: 'No se pudo completar la despublicación en Google Drive.',
    }).eq('id', id);
    throw new LibraryOperationError('No se pudo despublicar el recurso de forma segura.', resource);
  }
};

/**
 * Repair a published resource that is missing required links or permissions.
 * Returns the refreshed AdminLibraryResource.
 */
const repairPublication = async (
  resource: AdminLibraryResource,
  supabase: SupabaseClient,
  operationId: string,
): Promise<AdminLibraryResource> => {
  console.info('repairPublication start', { operationId, resourceId: resource.id });

  // Ensure PDF public permission
  if (!resource.drive_public_permission_id) {
    const pdf = await verifyFileBelongsToLibraryFolder(resource.drive_file_id, 'pdf');
    const perm = await makeDriveFilePublic(pdf.id);
    await supabase.from('library_resources').update({ drive_public_permission_id: perm }).eq('id', resource.id);
    resource.drive_public_permission_id = perm;
  }

  // Ensure PDF view & download links
  if (!resource.drive_view_link || !resource.drive_download_link) {
    const pdfMeta = await getDriveFileMetadata(resource.drive_file_id);
    const pdfLinks = getLibraryPublicLinks(resource.drive_file_id);
    await supabase.from('library_resources').update({
      drive_view_link: pdfMeta.webViewLink ?? pdfLinks.viewLink,
      drive_download_link: pdfLinks.downloadLink,
    }).eq('id', resource.id);
    resource.drive_view_link = pdfMeta.webViewLink ?? pdfLinks.viewLink;
    resource.drive_download_link = pdfLinks.downloadLink;
  }

  // Optional cover handling
  if (resource.cover_drive_file_id) {
    if (!resource.cover_public_permission_id) {
      try {
        const cover = await verifyFileBelongsToLibraryFolder(resource.cover_drive_file_id, 'cover');
        const perm = await makeDriveFilePublic(cover.id);
        await supabase.from('library_resources').update({ cover_public_permission_id: perm }).eq('id', resource.id);
        resource.cover_public_permission_id = perm;
      } catch (e) {
        console.warn('repair cover permission failed', { operationId, resourceId: resource.id });
      }
    }
    if (!resource.cover_url) {
      try {
        const coverLinks = getLibraryPublicLinks(resource.cover_drive_file_id);
        await supabase.from('library_resources').update({ cover_url: coverLinks.contentLink }).eq('id', resource.id);
        resource.cover_url = coverLinks.contentLink;
      } catch (e) {
        console.warn('repair cover URL failed', { operationId, resourceId: resource.id });
      }
    }
  }

  // Finally ensure is_published flag is true
  await supabase.from('library_resources').update({ is_published: true }).eq('id', resource.id);
  const refreshed = await getAdminLibraryResource(supabase, resource.id);
  console.info('repairPublication completed', { operationId, resourceId: resource.id });
  return refreshed;
};

export const replaceLibraryAsset = async (
  supabase: SupabaseClient,
  id: string,
  asset: LibraryAssetKind,
  uploaded: DriveUploadResult,
  originalName: string,
) => {
  const resource = await getAdminLibraryResource(supabase, id);
  await verifyFileBelongsToLibraryFolder(uploaded.id, asset);
  const previousId = asset === 'pdf' ? resource.drive_file_id : resource.cover_drive_file_id;
  let permissionId: string | undefined;
  try {
    if (resource.is_published) permissionId = await makeDriveFilePublic(uploaded.id);
    const links = getLibraryPublicLinks(uploaded.id);
    const updates = asset === 'pdf' ? {
      drive_file_id: uploaded.id,
      drive_file_name: originalName,
      drive_mime_type: uploaded.mimeType,
      drive_file_size: uploaded.size ?? null,
      drive_public_permission_id: permissionId ?? null,
      drive_view_link: resource.is_published ? uploaded.webViewLink ?? links.viewLink : null,
      drive_download_link: resource.is_published ? links.downloadLink : null,
      file_error: null,
    } : {
      cover_drive_file_id: uploaded.id,
      cover_file_name: originalName,
      cover_mime_type: uploaded.mimeType,
      cover_file_size: uploaded.size ?? null,
      cover_public_permission_id: permissionId ?? null,
      cover_url: resource.is_published ? links.contentLink : null,
      file_error: null,
    };
    const result = await supabase.from('library_resources').update(updates).eq('id', id).select(LIBRARY_ADMIN_SELECT).single();
    if (result.error) throw result.error;
    let warning: string | undefined;
    if (previousId) {
      try {
        await verifyFileBelongsToLibraryFolder(previousId, asset);
        await deleteDriveFile(previousId);
      } catch {
        warning = `El ${asset === 'pdf' ? 'PDF' : 'archivo de portada'} anterior no pudo eliminarse de Drive.`;
        await supabase.from('library_resources').update({ file_error: warning }).eq('id', id);
      }
    }
    return { resource: result.data as AdminLibraryResource, warning };
  } catch (error) {
    if (permissionId) await Promise.allSettled([removeDrivePublicPermission(uploaded.id, permissionId)]);
    await Promise.allSettled([deleteDriveFile(uploaded.id)]);
    throw error;
  }
};
