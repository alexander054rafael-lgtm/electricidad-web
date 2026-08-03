import type { ManualPageLabelConfig, PageLabelSource } from '../types';

export interface PdfPageLabelMaps {
  physicalToLabel: string[];
  labelToPhysical: Map<string, number[]>;
  isFallback: boolean;
  source: PageLabelSource;
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
 * Converts a positive integer to lower-case Roman numerals.
 */
export function integerToRoman(num: number): string {
  if (!Number.isInteger(num) || num < 1) return String(num);
  const lookup: Array<[number, string]> = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];

  let result = '';
  let n = num;
  for (const [value, symbol] of lookup) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

/**
 * Creates manual page labels if configuration is enabled and valid.
 */
export function createManualPageLabels(params: {
  totalPages: number;
  config: ManualPageLabelConfig | null | undefined;
}): string[] | null {
  const { totalPages, config } = params;
  if (!config || !config.enabled) return null;
  if (
    config.startPhysicalPage == null ||
    config.startNumber == null ||
    isNaN(config.startPhysicalPage) ||
    isNaN(config.startNumber) ||
    config.startPhysicalPage < 1 ||
    config.startNumber < 0
  ) {
    return null;
  }

  const {
    startPhysicalPage,
    startNumber,
    prefix,
    suffix,
    romanPreliminaries,
    preliminaryEndPhysicalPage,
  } = config;

  const labels: string[] = [];
  const pref = prefix ?? '';
  const suff = suffix ?? '';

  for (let physicalPage = 1; physicalPage <= totalPages; physicalPage++) {
    if (physicalPage < startPhysicalPage) {
      if (
        romanPreliminaries &&
        (preliminaryEndPhysicalPage == null || physicalPage <= preliminaryEndPhysicalPage)
      ) {
        labels.push(integerToRoman(physicalPage));
      } else {
        labels.push(String(physicalPage));
      }
    } else {
      const logicalNumber = startNumber + (physicalPage - startPhysicalPage);
      const labelStr = `${pref}${logicalNumber}${suff}`;
      labels.push(labelStr.length > 0 ? labelStr : String(physicalPage));
    }
  }

  return labels;
}

/**
 * Normalizes input for comparison without destroying original label.
 */
export function normalizePageLabel(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Creates bidirectional page label lookup maps with source priority:
 * 1. Manual config
 * 2. Embedded PDF labels
 * 3. Physical page fallback
 */
export function createPdfPageLabelMaps(
  embeddedLabels: string[] | null,
  totalPages: number,
  manualConfig?: ManualPageLabelConfig | null
): PdfPageLabelMaps {
  const manualLabels = createManualPageLabels({ totalPages, config: manualConfig });

  let effectiveLabels: string[] | null = null;
  let source: PageLabelSource = 'physical-fallback';

  if (manualLabels && manualLabels.length === totalPages) {
    effectiveLabels = manualLabels;
    source = 'manual';
  } else if (embeddedLabels && embeddedLabels.length > 0) {
    effectiveLabels = embeddedLabels;
    source = 'embedded';
  } else {
    effectiveLabels = null;
    source = 'physical-fallback';
  }

  const physicalToLabel: string[] = new Array(totalPages);
  const labelToPhysical = new Map<string, number[]>();

  const isFallback = source === 'physical-fallback';

  for (let i = 0; i < totalPages; i += 1) {
    const physicalNum = i + 1;
    const rawLabel = effectiveLabels && effectiveLabels[i] ? effectiveLabels[i].trim() : String(physicalNum);
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
    source,
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
