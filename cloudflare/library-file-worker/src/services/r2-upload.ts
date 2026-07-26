import { coverExtension, isUploadId, type UploadDescriptor } from '../security/validation';
import type { Env } from '../types/env';

export type UploadManifest = UploadDescriptor & {
  uploadId: string;
  objectKey: string;
  ownerId: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'validated' | 'synced';
  sha256?: string;
  driveFileId?: string;
  syncedAt?: string;
};

const prefix = (uploadId: string) => `uploads/pending/${uploadId}/`;
const manifestKey = (uploadId: string) => `${prefix(uploadId)}.operation.json`;

export const createObjectKey = (uploadId: string, descriptor: UploadDescriptor) =>
  `${prefix(uploadId)}${descriptor.kind === 'pdf' ? 'document.pdf' : `cover.${coverExtension(descriptor.mimeType)}`}`;

export const saveManifest = async (env: Env, manifest: UploadManifest) => {
  await env.LIBRARY_CACHE.put(manifestKey(manifest.uploadId), JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json' } });
};

export const getManifest = async (env: Env, uploadId: string): Promise<UploadManifest | undefined> => {
  if (!isUploadId(uploadId)) return undefined;
  const object = await env.LIBRARY_CACHE.get(manifestKey(uploadId));
  if (!object) return undefined;
  try {
    const manifest = JSON.parse(await object.text()) as UploadManifest;
    if (!isUploadId(manifest.uploadId) || manifest.uploadId !== uploadId || !manifest.objectKey.startsWith(prefix(uploadId))) return undefined;
    return manifest;
  } catch {
    return undefined;
  }
};

export const deleteUploadOperation = async (env: Env, manifest: UploadManifest) => {
  await env.LIBRARY_CACHE.delete([manifest.objectKey, manifestKey(manifest.uploadId)]);
};

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const hmac = async (key: ArrayBuffer | Uint8Array, value: string) => {
  const rawKey = key instanceof Uint8Array ? new Uint8Array(key).buffer : key;
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
};

const signingKey = async (secret: string, date: string) => {
  const dateKey = await hmac(encoder.encode(`AWS4${secret}`), date);
  const regionKey = await hmac(dateKey, 'auto');
  const serviceKey = await hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
};

export const createPresignedPutUrl = async (env: Env, objectKey: string, mimeType: string, expiresInSeconds = 600) => {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKey = env.R2_ACCESS_KEY_ID?.trim();
  const secret = env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !accessKey || !secret) throw new Error('r2_presign_unavailable');
  const host = `indutech-library-cache.${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const credential = `${accessKey}/${date}/auto/s3/aws4_request`;
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresInSeconds)],
    ['X-Amz-SignedHeaders', 'content-type;host'],
  ].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  const canonicalRequest = `PUT\n${canonicalUri}\n${query}\ncontent-type:${mimeType}\nhost:${host}\n\ncontent-type;host\nUNSIGNED-PAYLOAD`;
  const requestHash = hex(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)));
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${date}/auto/s3/aws4_request\n${requestHash}`;
  const signature = hex(await hmac(await signingKey(secret, date), stringToSign));
  return {
    uploadUrl: `https://${host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`,
    headers: { 'content-type': mimeType },
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
  };
};

export const sha256 = async (bytes: ArrayBuffer) => hex(await crypto.subtle.digest('SHA-256', bytes));
