-- Migration: add_manual_page_labels_to_library_resources
-- Date: 2026-08-03
-- Objective: Manual logical page numbering configuration per book for InduTech Academy

ALTER TABLE public.library_resources
  ADD COLUMN IF NOT EXISTS manual_page_labels_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_page_start_physical integer NULL,
  ADD COLUMN IF NOT EXISTS manual_page_start_number integer NULL,
  ADD COLUMN IF NOT EXISTS manual_page_prefix text NULL,
  ADD COLUMN IF NOT EXISTS manual_page_suffix text NULL,
  ADD COLUMN IF NOT EXISTS manual_page_roman_preliminaries boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_page_preliminary_end_physical integer NULL;

-- Check Constraints for validation
ALTER TABLE public.library_resources
  DROP CONSTRAINT IF EXISTS check_manual_page_start_physical,
  ADD CONSTRAINT check_manual_page_start_physical
    CHECK (manual_page_start_physical IS NULL OR manual_page_start_physical >= 1);

ALTER TABLE public.library_resources
  DROP CONSTRAINT IF EXISTS check_manual_page_start_number,
  ADD CONSTRAINT check_manual_page_start_number
    CHECK (manual_page_start_number IS NULL OR manual_page_start_number >= 0);

ALTER TABLE public.library_resources
  DROP CONSTRAINT IF EXISTS check_manual_page_preliminary_end_physical,
  ADD CONSTRAINT check_manual_page_preliminary_end_physical
    CHECK (manual_page_preliminary_end_physical IS NULL OR manual_page_preliminary_end_physical >= 1);

ALTER TABLE public.library_resources
  DROP CONSTRAINT IF EXISTS check_manual_page_preliminary_before_start,
  ADD CONSTRAINT check_manual_page_preliminary_before_start
    CHECK (
      manual_page_preliminary_end_physical IS NULL 
      OR manual_page_start_physical IS NULL 
      OR manual_page_preliminary_end_physical < manual_page_start_physical
    );

-- Column Comments
COMMENT ON COLUMN public.library_resources.manual_page_labels_enabled IS 'Indica si se utiliza configuración manual de etiquetas de página';
COMMENT ON COLUMN public.library_resources.manual_page_start_physical IS 'Número de página física donde inicia la numeración principal';
COMMENT ON COLUMN public.library_resources.manual_page_start_number IS 'Número lógico inicial para la página de inicio física';
COMMENT ON COLUMN public.library_resources.manual_page_prefix IS 'Prefijo opcional para la etiqueta lógica (ej: A-)';
COMMENT ON COLUMN public.library_resources.manual_page_suffix IS 'Sufijo opcional para la etiqueta lógica (ej:  bis)';
COMMENT ON COLUMN public.library_resources.manual_page_roman_preliminaries IS 'Indica si las páginas anteriores a la de inicio usan numeración romana en minúsculas';
COMMENT ON COLUMN public.library_resources.manual_page_preliminary_end_physical IS 'Última página física de la sección preliminar (opcional)';
