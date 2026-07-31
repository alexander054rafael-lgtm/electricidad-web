export type PdfQualityMode = 'auto' | 'high' | 'ultra' | 'economy';

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
  limitationReason: string;
}

// Configurable constants for pixel budgets and output scales per specification
export const PDF_QUALITY_LIMITS = {
  modern: {
    AUTO_MAX_PIXELS: 20_000_000,
    HIGH_MAX_PIXELS: 24_000_000,
    ULTRA_MAX_PIXELS: 32_000_000,
    ECONOMY_MAX_PIXELS: 8_000_000,
    MAX_OUTPUT_SCALE: 4.0,
  },
  legacy: {
    AUTO_MAX_PIXELS: 12_000_000,
    HIGH_MAX_PIXELS: 16_000_000,
    ULTRA_MAX_PIXELS: 18_000_000,
    ECONOMY_MAX_PIXELS: 6_000_000,
    MAX_OUTPUT_SCALE: 3.0,
  },
};

const STORAGE_KEY = 'indutech-pdf-quality';

export function getSavedPdfQualityMode(): PdfQualityMode {
  if (typeof window === 'undefined') return 'high';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'high' || saved === 'ultra' || saved === 'economy' || saved === 'auto') {
      return saved;
    }
  } catch {
    // Ignore localStorage read errors
  }
  // Default to 'high' per requirement if no preference exists
  savePdfQualityMode('high');
  return 'high';
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
 * Calculates adaptive HiDPI output scale adhering to devicePixelRatio and pixel budgets.
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
    case 'ultra':
      // ULTRA: minimum 300% equivalent quality
      requestedOutputScale = Math.max(dpr, 3.0);
      maxPixelsBudget = limits.ULTRA_MAX_PIXELS;
      break;
    case 'high':
      // HIGH: minimum 200% equivalent quality
      requestedOutputScale = Math.max(dpr, 2.0);
      maxPixelsBudget = limits.HIGH_MAX_PIXELS;
      break;
    case 'economy':
      // ECONOMY: output scale = 1.0
      requestedOutputScale = 1.0;
      maxPixelsBudget = limits.ECONOMY_MAX_PIXELS;
      break;
    case 'auto':
    default:
      // AUTO: Math.max(devicePixelRatio, 1.5)
      requestedOutputScale = Math.max(dpr, 1.5);
      maxPixelsBudget = limits.AUTO_MAX_PIXELS;
      break;
  }

  const baseArea = Math.max(1, viewportWidth * viewportHeight);
  const desiredPixels = baseArea * requestedOutputScale * requestedOutputScale;

  let limitedScale = requestedOutputScale;
  let isLimitedByBudget = false;
  let limitationReason = 'None (Within Pixel Budget)';

  if (desiredPixels > maxPixelsBudget) {
    limitedScale = Math.sqrt(maxPixelsBudget / baseArea);
    isLimitedByBudget = true;
    limitationReason = 'pixel-budget';
  } else if (requestedOutputScale > limits.MAX_OUTPUT_SCALE) {
    limitationReason = `MAX_OUTPUT_SCALE_CAP (${limits.MAX_OUTPUT_SCALE}x)`;
  }

  // Final scale is the minimum among requested scale, max allowed scale, and budget-limited scale
  const finalScale = Math.min(requestedOutputScale, limits.MAX_OUTPUT_SCALE, limitedScale);

  return {
    outputScale: Number(Math.max(1, finalScale).toFixed(3)),
    requestedOutputScale: Number(requestedOutputScale.toFixed(3)),
    maxPixelsBudget,
    desiredPixels: Math.round(desiredPixels),
    isLimitedByBudget,
    limitationReason,
  };
}
