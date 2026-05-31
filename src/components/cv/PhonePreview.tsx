"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CvDocument } from "@/components/cv/CvDocument";
import { fontClassFor, type KhmerFontKey, type MakaraCvDraft } from "@/lib/cv-draft";
import type { CvLayoutId } from "@/templates/registry";

// =============================================================================
// PhonePreview — an interactive, CSS-rendered premium smartphone mockup that
// frames the live, CSS-scaled A4 CvDocument.
// =============================================================================

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const BEZEL = 11; // chassis padding around the screen (px)

interface Props {
  draft: MakaraCvDraft;
  font: KhmerFontKey;
  lineSpacing: number;
  accent: string;
  variant: CvLayoutId;
  /** Outer device width in px. The screen + scale derive from this. */
  deviceWidth?: number;
  className?: string;
}

export function PhonePreview({
  draft,
  font,
  lineSpacing,
  accent,
  variant,
  deviceWidth = 340,
  className,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [naturalHeight, setNaturalHeight] = useState(A4_HEIGHT);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setNaturalHeight(Math.max(el.offsetHeight, A4_HEIGHT));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [draft, font, lineSpacing, accent, variant]);

  const screenWidth = deviceWidth - BEZEL * 2;
  const scale = screenWidth / A4_WIDTH;
  
  // Optimized: Use a slightly more flexible height calculation to avoid excessive vertical scrolling
  // on smaller viewports while maintaining the premium aspect ratio.
  const screenHeight = Math.round(screenWidth * 2.1); 
  const trackHeight = Math.round(naturalHeight * scale);

  return (
    <div className={"mx-auto select-none " + (className ?? "")} style={{ width: deviceWidth }}>
      <div
        className="relative rounded-[42px]"
        style={{
          padding: BEZEL,
          background: "linear-gradient(150deg, #3b3f4a 0%, #15171d 38%, #0b0c11 70%, #2a2d36 100%)",
          boxShadow:
            "0 2px 1px rgba(255,255,255,0.18) inset, 0 -2px 2px rgba(0,0,0,0.6) inset, 0 30px 60px -20px rgba(0,0,0,0.75), 0 12px 24px -12px rgba(34,211,238,0.25)",
        }}
      >
        {/* Side buttons (volume + power) — pure CSS accents. */}
        <span className="absolute -left-[2px] top-[110px] h-9 w-[3px] rounded-l bg-ink-700" />
        <span className="absolute -left-[2px] top-[154px] h-12 w-[3px] rounded-l bg-ink-700" />
        <span className="absolute -right-[2px] top-[132px] h-16 w-[3px] rounded-r bg-ink-700" />

        {/* Screen */}
        <div
          className="relative overflow-hidden rounded-[32px] bg-white"
          style={{ width: screenWidth, height: screenHeight }}
        >
          {/* Speaker notch / dynamic-island pill. */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/90 px-3 py-1.5 shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-700" />
            <span className="h-1 w-8 rounded-full bg-ink-800" />
          </div>

          {/* Scrollable document viewport. */}
          <div
            className="h-full w-full overflow-y-auto overflow-x-hidden scrollbar-hide"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div style={{ height: trackHeight, width: screenWidth, position: "relative" }}>
              <div
                ref={innerRef}
                style={{
                  width: A4_WIDTH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <CvDocument
                  draft={draft}
                  fontClass={fontClassFor(font)}
                  lineSpacing={lineSpacing}
                  accent={accent}
                  variant={variant}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Home-bar hint under the chassis for that finished, lively feel. */}
      <div className="mx-auto mt-3 h-1 w-24 rounded-full bg-ink-700/70" />
    </div>
  );
}
