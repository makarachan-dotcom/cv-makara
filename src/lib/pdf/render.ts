import "server-only";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

// =============================================================================
// Server-side A4 PDF renderer.
// -----------------------------------------------------------------------------
// Drives a headless Chromium over the in-app print route (`/print/[id]`), which
// renders ONLY the CvDocument inside `#cv-print-root`. The browser loads the
// self-hosted Khmer woff2 fonts (Kantumruy Pro / Hanuman / Nokora / Siemreap)
// from the same origin and we explicitly wait for `document.fonts.ready` before
// printing, so every ស្រៈ / ជើង is shaped and embedded — no clipping, vector
// text, exact A4 geometry (`@page { size: A4; margin: 0 }` from globals.css).
//
// Executable resolution:
//   • PUPPETEER_EXECUTABLE_PATH  — explicit local/CI Chrome (dev, this VM).
//   • @sparticuz/chromium         — packaged brotli Chromium for serverless
//                                   (Vercel / AWS Lambda), the production path.
// =============================================================================

export interface RenderPdfArgs {
  /** Absolute origin of the running app, e.g. https://makara-cv.vercel.app */
  origin: string;
  /** In-app print path including query string, e.g. /print/42?font=hanuman */
  printPath: string;
  /** Session cookie name + value to forward so the print route authenticates. */
  cookie: { name: string; value: string };
}

async function launchBrowser(): Promise<Browser> {
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (explicit) {
    return puppeteer.launch({
      executablePath: explicit,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
    });
  }

  // Serverless path: the brotli-packed Chromium from @sparticuz/chromium.
  return puppeteer.launch({
    args: [...chromium.args, "--font-render-hinting=none"],
    defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export async function renderDraftPdf({ origin, printPath, cookie }: RenderPdfArgs): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();

    // Forward the session cookie so the print route resolves the same user.
    const { hostname } = new URL(origin);
    await page.setCookie({
      name: cookie.name,
      value: cookie.value,
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: origin.startsWith("https://"),
    });

    const url = `${origin}${printPath}`;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });

    // The print route stamps this attribute once it has mounted the document;
    // fail fast (clear error) instead of silently printing a login redirect.
    await page.waitForSelector("#cv-print-root", { timeout: 15_000 });

    // Block until every @font-face (the four Khmer fonts) is fully loaded so
    // glyph shaping is final before the page is rasterised to PDF.
    await page.evaluate(async () => {
      await (document as Document).fonts.ready;
    });

    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
