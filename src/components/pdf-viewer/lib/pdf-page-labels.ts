export interface PdfPageLabelMaps {
  physicalToLabel: string[];
  labelToPhysical: Map<string, number[]>;
  isFallback: boolean;
}

export interface ResolvePageInputResult {
  found: boolean;
  physicalPage: number | null;
  matchedBy: 'label' | 'physical' | null;
  duplicateMatches?: number[];
  resolvedLabel?: string;
  errorMessage?: string;
}

/**
 * Normalizes input for comparison without destroying original label.
 */
export function normalizePageLabel(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Creates bidirectional page label lookup maps.
 */
export function createPdfPageLabelMaps(
  pageLabels: string[] | null,
  totalPages: number,
): PdfPageLabelMaps {
  const physicalToLabel: string[] = new Array(totalPages);
  const labelToPhysical = new Map<string, number[]>();

  const isFallback = !pageLabels || pageLabels.length === 0;

  for (let i = 0; i < totalPages; i += 1) {
    const physicalNum = i + 1;
    const rawLabel = pageLabels && pageLabels[i] ? pageLabels[i].trim() : String(physicalNum);
    const label = rawLabel.length > 0 ? rawLabel : String(physicalNum);

    physicalToLabel[i] = label;

    const normalizedKey = normalizePageLabel(label);
    const existing = labelToPhysical.get(normalizedKey) ?? [];
    existing.push(physicalNum);
    labelToPhysical.set(normalizedKey, existing);
  }

  return {
    physicalToLabel,
    labelToPhysical,
    isFallback,
  };
}

/**
 * Resolves user page input text to target physicalPage number.
 * Sequence:
 * 1. Trim input.
 * 2. Search exact normalized label match.
 * 3. If single match -> return physical page.
 * 4. If multiple label matches -> choose match closest to currentPhysicalPage.
 * 5. If no label match and input is a valid integer -> interpret as physicalPage.
 */
export function resolvePageInput(params: {
  input: string;
  totalPages: number;
  labelToPhysical: Map<string, number[]>;
  currentPhysicalPage: number;
}): ResolvePageInputResult {
  const trimmed = params.input.trim();
  if (!trimmed) {
    return { found: false, physicalPage: null, matchedBy: null, errorMessage: 'No se ingresó ninguna página.' };
  }

  const normalized = normalizePageLabel(trimmed);

  // A. Search in logical label map
  const matches = params.labelToPhysical.get(normalized);
  if (matches && matches.length > 0) {
    if (matches.length === 1) {
      return {
        found: true,
        physicalPage: matches[0],
        matchedBy: 'label',
      };
    }

    // Pick duplicate match closest to currentPhysicalPage
    let closestPage = matches[0];
    let minDiff = Math.abs(matches[0] - params.currentPhysicalPage);

    for (let i = 1; i < matches.length; i += 1) {
      const diff = Math.abs(matches[i] - params.currentPhysicalPage);
      if (diff < minDiff) {
        minDiff = diff;
        closestPage = matches[i];
      }
    }

    return {
      found: true,
      physicalPage: closestPage,
      matchedBy: 'label',
      duplicateMatches: matches,
    };
  }

  // B. Fallback: Parse integer for physical page if no label match found
  if (/^\d+$/.test(trimmed)) {
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= params.totalPages) {
      return {
        found: true,
        physicalPage: parsed,
        matchedBy: 'physical',
      };
    }
  }

  return {
    found: false,
    physicalPage: null,
    matchedBy: null,
    errorMessage: 'No se encontró la página indicada.',
  };
}
