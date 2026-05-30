import "server-only";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

// =============================================================================
// Server-side A4 PDF renderer — serverless-hardened.
// -----------------------------------------------------------------------------
// Drives a headless Chromium over the in-app print route (`/print/[id]`), which
// renders ONLY the CvDocument inside `#cv-print-root`. The browser loads the
// self-hosted Khmer woff2 fonts (Kantumruy Pro / Hanuman / Nokora / Siemreap)
// from the same origin and we explicitly wait for `document.fonts.ready` before
// printing, so every ស្រៈ / ជើង is shaped and embedded — no clipping, vector
// text, exact A4 geometry (`@page { size: A4; margin: 0 }` from globals.css).
//
// WHY PNG WORKED BUT PDF CRASHED (the bug this file fixes)
//   PNG export runs client-side (html-to-image) and never touches Chromium.
//   PDF export spins up @sparticuz/chromium inside the Lambda/Vercel container.
//   In that sandbox Chromium refuses to start unless the renderer is launched
//   with `--no-sandbox --disable-setuid-sandbox --disable-gpu` (there is no GPU
//   and the seccomp/user-namespace sandbox is unavailable), and it OOM-kills if
//   `/dev/shm` is used for the shared memory heap. Missing those flags is the
//   classic "PNG fine, PDF 500" failure. We add every required flag below,
//   force single-process where safe, and guarantee page+browser teardown in a
//   `finally` block so a render error can never leak a zombie Chromium that
//   wedges the next invocation.
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

/**
 * Critical Chromium launch flags for serverless containers. These are the
 * difference between a clean render and an instant crash:
 *   --no-sandbox / --disable-setuid-sandbox  Lambda has no user namespaces.
 *   --disable-gpu                            no GPU in the sandbox.
 *   --disable-dev-shm-usage                  /dev/shm is tiny (64MB) → OOM.
 *   --single-process                         avoid zygote fork failures.
 *   --font-render-hinting=none               crisp, stable Khmer glyph shaping.
 */
const HARDENED_ARGS: ReadonlyArray<string> = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-software-rasterizer",
  "--no-zygote",
  "--single-process",
  "--font-render-hinting=none",
  "--hide-scrollbars",
  "--mute-audio",
];

async function launchBrowser(): Promise<Browser> {
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (explicit) {
    // Local / CI Chrome. Keep the same hardening flags so dev mirrors prod.
    return puppeteer.launch({
      executablePath: explicit,
      headless: true,
      args: [...HARDENED_ARGS],
      defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 },
    });
  }

  // Serverless path: the brotli-packed Chromium from @sparticuz/chromium.
  // We merge its recommended args with ours (deduped) so neither set is lost.
  const mergedArgs = Array.from(new Set([...chromium.args, ...HARDENED_ARGS]));
  return puppeteer.launch({
    args: mergedArgs,
    defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export async function renderDraftPdf({ origin, printPath, cookie }: RenderPdfArgs): Promise<Buffer> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  try {
    browser = await launchBrowser();
    page = await browser.newPage();

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
    const response = await page.goto(url, { waitUntil: "networkidle0", timeout: 45_000 });
    if (response && response.status() >= 400) {
      throw new Error(`Print route returned HTTP ${response.status()} for ${printPath}.`);
    }

    // The print route stamps this attribute once it has mounted the document;
    // fail fast (clear error) instead of silently printing a login redirect.
    await page.waitForSelector("#cv-print-root", { timeout: 20_000 });

    // Block until every @font-face (the four Khmer fonts) is fully loaded so
    // glyph shaping is final before the page is rasterised to PDF. Guard with a
    // timeout so a never-resolving fonts.ready can't hang the whole invocation.
    await page.evaluate(async () => {
      const ready = (document as Document).fonts.ready;
      await Promise.race([
        ready,
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);
    });

    const pdf = await page.pdf({
      // puppeteer normalises this, but the canonical casing is "A4".
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    // Structured teardown: close the page first, then the browser. Both are
    // wrapped so one failing close never masks the original error or leaves a
    // zombie Chromium process holding container memory.
    if (page) {
      try {
        await page.close();
      } catch {
        /* page already gone — ignore */
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* browser already gone — ignore */
      }
    }
  }
}
