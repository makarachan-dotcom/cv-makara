"use client";

import { forwardRef } from "react";
import type { MakaraCvDraft } from "@/lib/cv-draft";

// =============================================================================
// CvDocument — the 2D, A4, pixel-perfect, highly-scannable CV.
// -----------------------------------------------------------------------------
// Per spec the CV itself is NOT 3D: it is an executive-grade 2D layout at exact
// A4 proportions (794 × 1123px @96dpi). The 3D experience lives in the studio
// shell around it. Every Khmer text block carries `.khmer-doc` / `.khmer-heading`
// so vowels (ស្រៈ) and subscripts (ជើង) never clip on screen or in export.
// =============================================================================

export interface CvDocumentProps {
  draft: MakaraCvDraft;
  /** Tailwind font-family class for one of the four Khmer fonts. */
  fontClass: string;
  /** Body line-height multiplier (user-adjustable for readability). */
  lineSpacing: number;
  /** Accent color (headings, rules, name). */
  accent: string;
  /** Adds the print-isolation id so window.print() captures only this node. */
  printRoot?: boolean;
}

export const CvDocument = forwardRef<HTMLDivElement, CvDocumentProps>(function CvDocument(
  { draft, fontClass, lineSpacing, accent, printRoot = false },
  ref,
) {
  const contactBits = [
    draft.contact.telegram,
    draft.contact.email,
    draft.contact.phone,
    draft.contact.location,
  ].filter((s) => s && s.trim());

  return (
    <div
      ref={ref}
      id={printRoot ? "cv-print-root" : undefined}
      lang="km"
      className={`khmer-doc ${fontClass} bg-white text-[#15181f]`}
      style={{
        width: "794px",
        minHeight: "1123px",
        padding: "56px 60px",
        lineHeight: lineSpacing,
        boxSizing: "border-box",
      }}
    >
      {/* ----------------------------- Header ----------------------------- */}
      <header style={{ borderBottom: `3px solid ${accent}`, paddingBottom: "16px" }}>
        <h1
          className="khmer-heading"
          style={{ fontSize: "30px", fontWeight: 700, color: accent, margin: 0 }}
        >
          {draft.fullName}
        </h1>
        {draft.headline && (
          <p
            className="khmer-heading"
            style={{ fontSize: "15px", fontWeight: 600, color: "#374151", marginTop: "2px" }}
          >
            {draft.headline}
          </p>
        )}
        {contactBits.length > 0 && (
          <p style={{ fontSize: "11.5px", color: "#4b5563", marginTop: "8px" }}>
            {contactBits.join("  •  ")}
          </p>
        )}
      </header>

      {/* ----------------------------- Summary ----------------------------- */}
      {draft.summary && (
        <Section title="សេចក្តីសង្ខេបវិជ្ជាជីវៈ" accent={accent}>
          <p style={{ fontSize: "12.5px", color: "#1f2430" }}>{draft.summary}</p>
        </Section>
      )}

      {/* --------------------------- Experience --------------------------- */}
      {draft.experience.length > 0 && (
        <Section title="បទពិសោធន៍ការងារ" accent={accent}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {draft.experience.map((job, i) => (
              <div key={i}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "12px",
                  }}
                >
                  <span
                    className="khmer-heading"
                    style={{ fontSize: "13.5px", fontWeight: 700, color: "#111827" }}
                  >
                    {job.role}
                    <span style={{ fontWeight: 500, color: "#374151" }}>
                      {job.company ? ` · ${job.company}` : ""}
                    </span>
                  </span>
                  {job.period && (
                    <span style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap" }}>
                      {job.period}
                    </span>
                  )}
                </div>
                {job.bullets.length > 0 && (
                  <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                    {job.bullets.map((b, j) => (
                      <li
                        key={j}
                        style={{ fontSize: "12px", color: "#1f2430", marginBottom: "2px" }}
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ----------------------------- Skills ----------------------------- */}
      {draft.skills.length > 0 && (
        <Section title="ជំនាញ" accent={accent}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {draft.skills.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: "11.5px",
                  color: "#1f2937",
                  border: "1px solid #d1d5db",
                  borderRadius: "999px",
                  padding: "2px 10px",
                  background: "#f9fafb",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* --------------------------- Education ---------------------------- */}
      {draft.education.length > 0 && (
        <Section title="ការអប់រំ" accent={accent}>
          {draft.education.map((e, i) => (
            <div
              key={i}
              style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}
            >
              <span style={{ fontSize: "12.5px", color: "#111827" }}>
                <strong>{e.credential || e.institution}</strong>
                {e.credential && e.institution ? ` — ${e.institution}` : ""}
              </span>
              {e.period && (
                <span style={{ fontSize: "11px", color: "#6b7280" }}>{e.period}</span>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* ---------------------------- Projects ---------------------------- */}
      {draft.projects.length > 0 && (
        <Section title="គម្រោង" accent={accent}>
          {draft.projects.map((p, i) => (
            <p key={i} style={{ fontSize: "12px", color: "#1f2430", marginBottom: "4px" }}>
              <strong>{p.name}</strong>
              {p.summary ? ` — ${p.summary}` : ""}
            </p>
          ))}
        </Section>
      )}

      {/* ---------------------------- Languages --------------------------- */}
      {draft.languages.length > 0 && (
        <Section title="ភាសា" accent={accent}>
          <p style={{ fontSize: "12px", color: "#1f2430" }}>{draft.languages.join("  •  ")}</p>
        </Section>
      )}
    </div>
  );
});

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: "18px" }}>
      <h2
        className="khmer-heading"
        style={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: "8px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
