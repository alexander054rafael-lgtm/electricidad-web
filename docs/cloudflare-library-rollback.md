# Rollback de Biblioteca hacia Drive directo

La Fase 1 no cambia el tráfico de archivos, por lo que su rollback consiste en
mantener o restaurar estas variables de Vercel:

```text
LIBRARY_FILE_BACKEND=drive-browser
PUBLIC_LIBRARY_FILE_BACKEND=drive-browser
```

Si un despliegue del Worker presenta problemas, retire su ruta o dominio y no
continúe con Fase 2. No borre el bucket ni archivos de Google Drive como parte
de este rollback. Los recursos estáticos y los registros existentes de
Supabase no requieren cambios.
