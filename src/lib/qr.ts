import QRCode from "qrcode";

// =============================================================================
// Isomorphic QR-code generation.
// -----------------------------------------------------------------------------
// Used to render the "Scan to Verify Official Certificate" code on the 2D CV.
// The CV is rendered BOTH server-side (the /print/[id] route the PDF engine
// drives) and client-side (the live studio preview + html-to-image PNG export),
// so the QR must be producible in either environment. `qrcode` is isomorphic;
// we emit a self-contained PNG data URL so it embeds cleanly in the PDF vector
// pipeline and in the PNG raster without any external fetch.
// =============================================================================

export interface QrOptions {
  /** Module size in px before scaling. Higher = crisper in print. */
  scale?: number;
  /** Quiet-zone margin in modules. */
  margin?: number;
  /** Foreground (dark) hex color. */
  dark?: string;
  /** Background (light) hex color. */
  light?: string;
}

/**
 * Render the given text/URL as a PNG data URL (data:image/png;base64,...).
 * Uses error-correction level "M" — robust against partial occlusion while
 * keeping the code compact enough for a CV footer block.
 */
export async function qrDataUrl(text: string, opts: QrOptions = {}): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    type: "image/png",
    scale: opts.scale ?? 6,
    margin: opts.margin ?? 1,
    color: {
      dark: opts.dark ?? "#0f172a",
      light: opts.light ?? "#ffffff",
    },
  });
}

/**
 * Render the given text/URL as a standalone SVG string. Handy where a crisp,
 * resolution-independent vector mark is preferred over a raster data URL.
 */
export async function qrSvg(text: string, opts: QrOptions = {}): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 1,
    color: {
      dark: opts.dark ?? "#0f172a",
      light: opts.light ?? "#ffffff",
    },
  });
}

/**
 * Build the absolute verification URL embedded in the certificate QR. Always
 * resolves to OUR domain — no external third-party redirects (privacy spec).
 */
export function certificateVerifyUrl(origin: string, verifyToken: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/verify/cv/${encodeURIComponent(verifyToken)}/certificate`;
}
