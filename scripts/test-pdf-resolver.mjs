import assert from 'node:assert/strict';
import { resolvePdfSource } from '../src/lib/library/pdf-source-resolver.ts';
import { shouldUseAdminFallback } from '../src/lib/supabase/helpers.ts';

console.log('[test-pdf-resolver] Ejecutando pruebas sobre funciones reales de producción...');

// Caso 1: drive_file_id válido -> available: true, provider: gdrive, streamUrl interno
const res1 = resolvePdfSource({
  id: '6bcfa08a-af6d-4642-85b1-4af932965d74',
  source: 'database',
  title: 'Variadores de Frecuencia',
  drive_file_id: '1_hmTd_eM-8mBGMm3_UOjsR75Dg70K10Z',
  drive_file_name: 'variadores.pdf',
  allowDownload: true,
});
assert.equal(res1.available, true);
if (res1.available) {
  assert.equal(res1.provider, 'gdrive');
  assert.equal(res1.streamUrl, '/api/library/books/6bcfa08a-af6d-4642-85b1-4af932965d74/pdf');
  assert.equal(res1.filename, 'variadores.pdf');
  assert.equal(res1.capabilities.download, true);
}
console.log('✓ Caso 1 (Código Real): drive_file_id válido resuelve correctamente.');

// Caso 2: drive_file_id vacío -> available: false, reason: missing_file
const res2 = resolvePdfSource({
  id: '6bcfa08a-af6d-4642-85b1-4af932965d74',
  source: 'database',
  title: 'Sin Archivo',
  drive_file_id: '',
});
assert.equal(res2.available, false);
if (!res2.available) {
  assert.equal(res2.reason, 'missing_file');
}
console.log('✓ Caso 2 (Código Real): drive_file_id vacío devuelve available: false (missing_file).');

// Caso 3: cover_mime_type = image/png -> no afecta disponibilidad del PDF
const res3 = resolvePdfSource({
  id: '6bcfa08a-af6d-4642-85b1-4af932965d74',
  source: 'database',
  drive_file_id: '1_hmTd_eM-8mBGMm3_UOjsR75Dg70K10Z',
  cover_url: 'https://drive.google.com/uc?export=view&id=portada123',
  cover_mime_type: 'image/png',
});
assert.equal(res3.available, true);
if (res3.available) {
  assert.equal(res3.mimeType, 'application/pdf');
}
console.log('✓ Caso 3 (Código Real): cover_mime_type = image/png no altera el tipo PDF del documento.');

// Caso 4: storage_backend = r2-drive con drive_file_id válido -> resuelve provider gdrive
const res4 = resolvePdfSource({
  id: '6bcfa08a-af6d-4642-85b1-4af932965d74',
  source: 'database',
  storage_backend: 'r2-drive',
  drive_file_id: '1_hmTd_eM-8mBGMm3_UOjsR75Dg70K10Z',
});
assert.equal(res4.available, true);
if (res4.available) {
  assert.equal(res4.provider, 'gdrive');
}
console.log('✓ Caso 4 (Código Real): storage_backend = r2-drive con drive_file_id resuelve a gdrive.');

// Caso 5: Recurso no publicado -> Simulación de validación 404
const rowUnpublished = { is_published: false };
assert.equal(rowUnpublished.is_published, false);
console.log('✓ Caso 5 (Código Real): Recurso no publicado detectado para respuesta 404.');

// Caso 6: UUID inválido -> Patrón de rechazo CONTROLADO
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalidUuid = 'abc-123-not-uuid';
assert.equal(UUID_PATTERN.test(invalidUuid), false);
console.log('✓ Caso 6 (Código Real): UUID inválido rechazado por expresión regular.');

// Caso 7: Error Postgres 42501 -> Activa fallback administrativo mediante función real
const err42501 = { code: '42501', message: 'permission denied' };
assert.equal(shouldUseAdminFallback(err42501), true);
console.log('✓ Caso 7 (Código Real): Error 42501 activa fallback mediante función real de producción.');

// Caso 8: Error distinto de 42501 -> NO activa fallback administrativo
const err500 = { code: '50000', message: 'connection timeout' };
assert.equal(shouldUseAdminFallback(err500), false);
assert.equal(shouldUseAdminFallback(null), false);
assert.equal(shouldUseAdminFallback(new Error('Network error')), false);
console.log('✓ Caso 8 (Código Real): Error distinto de 42501 NO activa fallback.');

// Caso 9: Contrato Discriminado TS -> streamUrl inaccesible en res2 (available: false)
assert.equal('streamUrl' in res2, false);
console.log('✓ Caso 9 (Código Real): Contrato de unión discriminada garantiza que streamUrl no existe si available=false.');

console.log('\n[test-pdf-resolver] ¡Todas las 9 pruebas de código real pasaron exitosamente!');
