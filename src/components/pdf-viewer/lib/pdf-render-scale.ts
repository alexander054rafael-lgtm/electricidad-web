export type PdfQualityMode = 'auto' | 'high' | 'economy';

export interface PdfOutputScaleParams {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  qualityMode: PdfQualityMode;
  compatibilityMode: 'modern' | 'legacy';
}

export interface PdfOutputScaleResult {
  outputScale: number;
  requestedOutputScale: number;
  maxPixelsBudget: number;
  desiredPixels: number;
  isLimitedByBudget: boolean;
}

// Configurable constants for pixel budgets and output scales
export const PDF_QUALITY_LIMITS = {
  modern: {
    AUTO_MAX_PIXELS: 20_000_000,
    HIGH_MAX_PIXELS: 28_000_000,
    ECONOMY_MAX_PIXELS: 8_000_000,
    MAX_OUTPUT_SCALE: 3.0,
    ECONOMY_MAX_OUTPUT_SCALE: 1.25,
  },
  legacy: {
    AUTO_MAX_PIXELS: 12_000_000,
    HIGH_MAX_PIXELS: 16_000_000,
    ECONOMY_MAX_PIXELS: 6_000_000,
    MAX_OUTPUT_SCALE: 2.5,
    ECONOMY_MAX_OUTPUT_SCALE: 1.0,
  },
};

const STORAGE_KEY = 'indutech-pdf-quality';

export function getSavedPdfQualityMode(): PdfQualityMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'high' || saved === 'economy' || saved === 'auto') {
      return saved;
    }
  } catch {
    // Ignore localStorage read errors
  }
  return 'auto';
}

export function savePdfQualityMode(mode: PdfQualityMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore localStorage write errors
  }
}

/**
 * Calculates adaptive HiDPI output scale adhering to devicePixelRatio and safe pixel budgets.
 */
export function calculatePdfOutputScale({
  viewportWidth,
  viewportHeight,
  devicePixelRatio,
  qualityMode,
  compatibilityMode,
}: PdfOutputScaleParams): PdfOutputScaleResult {
  const dpr = Math.max(1, devicePixelRatio || 1);
  const limits = PDF_QUALITY_LIMITS[compatibilityMode] || PDF_QUALITY_LIMITS.modern;

  let requestedOutputScale: number;
  let maxPixelsBudget: number;

  switch (qualityMode) {
    case 'high':
      // Supersampling target: dpr * 1.25
      requestedOutputScale = dpr * 1.25;
      maxPixelsBudget = limits.HIGH_MAX_PIXELS;
      break;
    case 'economy':
      requestedOutputScale = Math.min(dpr, limits.ECONOMY_MAX_OUTPUT_SCALE);
      maxPixelsBudget = limits.ECONOMY_MAX_PIXELS;
      break;
    case 'auto':
    default:
      requestedOutputScale = dpr;
      maxPixelsBudget = limits.AUTO_MAX_PIXELS;
      break;
  }

  const baseArea = Math.max(1, viewportWidth * viewportHeight);
  const desiredPixels = baseArea * requestedOutputScale * requestedOutputScale;

  let limitedScale = requestedOutputScale;
  let isLimitedByBudget = false;

  if (desiredPixels > maxPixelsBudget) {
    limitedScale = Math.sqrt(maxPixelsBudget / baseArea);
    isLimitedByBudget = true;
  }

  // Final scale is the minimum among requested scale, max allowed scale, and budget-limited scale
  const finalScale = Math.min(requestedOutputScale, limits.MAX_OUTPUT_SCALE, limitedScale);

  return {
    outputScale: Number(Math.max(1, finalScale).toFixed(3)),
    requestedOutputScale: Number(requestedOutputScale.toFixed(3)),
    maxPixelsBudget,
    desiredPixels: Math.round(desiredPixels),
    isLimitedByBudget,
  };
}
