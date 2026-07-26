# Arquitectura de archivos de Biblioteca

## Estado de Fase 1

El flujo activo continúa siendo `drive-browser`: el panel obtiene un token
temporal de Google Identity Services y sube directamente a Google Drive. No se
ha cambiado la ruta de subida existente.

La Fase 1 añade un Worker independiente y un binding privado de R2. El Worker
solo expone comprobaciones de salud y de administrador; todavía no genera URLs
firmadas, no acepta archivos y no copia nada hacia Drive.

```text
Actual:      Admin -> Google Identity Services -> Google Drive -> Astro -> Supabase
Fase 1:      Admin -> Worker (JWT Supabase + profiles.role) -> estado de R2
Fase futura: Admin -> URL temporal R2 -> R2 -> Worker -> Google Drive -> Supabase
```

Google Drive seguirá siendo el original permanente. R2 será una caché temporal,
nunca la única copia.

## Límites de responsabilidad

- Astro/Vercel: interfaz y el backend actual mientras `LIBRARY_FILE_BACKEND=drive-browser`.
- Worker: frontera futura de autenticación, R2, sincronización y descargas.
- Supabase: identidad, `profiles.role` y metadatos.
- Google Drive: almacenamiento principal de los archivos dinámicos.

No se modifica `src/data/books.ts` ni se migran recursos de muestra.
