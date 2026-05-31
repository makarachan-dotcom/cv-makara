"use client";

import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { MakaraCvDraft } from "@/lib/cv-draft";
import { DEFAULT_CV_LAYOUT, type CvLayoutId } from "@/templates/registry";

// =============================================================================
// CvDocument — the 2D, A4, pixel-perfect, highly-scannable CV.
// -----------------------------------------------------------------------------
// Per spec the CV itself is NOT 3D: it is an executive-grade 2D layout at exact
// A4 proportions (794 × 1123px @96dpi). The vibrant 3D experience lives in the
// studio shell *around* it. Every Khmer text block carries `.khmer-doc` /
// `.khmer-heading` so vowels (ស្រៈ) and subscripts (ជើង) never clip on screen
// or in export.
//
// It now renders THREE distinct, HR-optimised layouts selected by `variant`:
//   • modern-minimalist — sharp typography, top accent band, asymmetric space.
//   • executive-pro     — shaded 2-column grid framing the profile photo.
//   • creative-vibrant  — gradient header, avatar box, timeline experience.
// All three consume the identical draft and export identically.
// =============================================================================

export interface CvDocumentProps {
  draft: MakaraCvDraft;
  /** Tailwind font-family class for one of the four Khmer fonts. */
  fontClass: string;
  /** Body line-height multiplier (user-adjustable for readability). */
  lineSpacing: number;
  /** Accent color (headings, rules, name). */
  accent: string;
  /** Which of the three high-fidelity layouts to render. */
  variant?: CvLayoutId;
  /** Adds the print-isolation id so window.print() captures only this node. */
  printRoot?: boolean;
}

const INK = "#15181f";

export const CvDocument = forwardRef<HTMLDivElement, CvDocumentProps>(function CvDocument(
  { draft, fontClass, lineSpacing, accent, variant = DEFAULT_CV_LAYOUT, printRoot = false },
  ref,
) {
  // Shared A4 frame. Each layout owns its own internal padding/structure, so
  // the root only fixes the page geometry, color model and print fidelity.
  const rootStyle: CSSProperties = {
    width: "794px",
    minHeight: "1123px",
    boxSizing: "border-box",
    lineHeight: lineSpacing,
    background: "#ffffff",
    color: INK,
    position: "relative",
    overflow: "hidden",
    // Keep solid fills + gradients when printing via the browser dialog too.
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
  };

  return (
    <div
      ref={ref}
      id={printRoot ? "cv-print-root" : undefined}
      lang="km"
      className={`khmer-doc ${fontClass}`}
      style={rootStyle}
      data-variant={variant}
    >
      {variant === "executive-pro" ? (
        <ExecutivePro draft={draft} accent={accent} lineSpacing={lineSpacing} />
      ) : variant === "creative-vibrant" ? (
        <CreativeVibrant draft={draft} accent={accent} lineSpacing={lineSpacing} />
      ) : (
        <ModernMinimalist draft={draft} accent={accent} lineSpacing={lineSpacing} />
      )}
    </div>
  );
});

// =============================================================================
// LAYOUT 1 — MODERN MINIMALIST
// Sharp, high-contrast typography. A top color band. Asymmetric header with the
// photo aligned right as a soft-cornered, accent-ringed thumbnail.
// =============================================================================
function ModernMinimalist({
  draft,
  accent,
}: {
  draft: MakaraCvDraft;
  accent: string;
  lineSpacing: number;
}) {
  const contacts = contactBits(draft);
  return (
    <div>
      {/* Full-bleed top accent band. */}
      <div
        style={{
          height: "12px",
          background: `linear-gradient(90deg, ${accent} 0%, ${shade(accent, 28)} 100%)`,
        }}
      />
      <div style={{ padding: "44px 60px 56px" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
          }}
        >
          <div style={{ flex: 1 }}>
            <h1
              className="khmer-heading"
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: INK,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {draft.fullName}
            </h1>
            {draft.headline && (
              <p
                className="khmer-heading"
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: accent,
                  marginTop: "4px",
                }}
              >
                {draft.headline}
              </p>
            )}
            {contacts.length > 0 && (
              <p style={{ fontSize: "11.5px", color: "#4b5563", marginTop: "10px" }}>
                {contacts.join("  •  ")}
              </p>
            )}
          </div>
          <Avatar
            draft={draft}
            accent={accent}
            size={104}
            radius="18px"
            ringWidth={3}
            ringColor={accent}
          />
        </header>

        <div style={{ height: "2px", background: "#e5e7eb", margin: "20px 0 4px" }} />

        {draft.summary && (
          <MinimalSection title="សេចក្តីសង្ខេបវិជ្ជាជីវៈ" accent={accent}>
            <p style={{ fontSize: "12.5px", color: "#1f2430" }}>{draft.summary}</p>
          </MinimalSection>
        )}

        {draft.experience.length > 0 && (
          <MinimalSection title="បទពិសោធន៍ការងារ" accent={accent}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {draft.experience.map((job, i) => (
                <ExperienceItem key={i} job={job} accent={accent} />
              ))}
            </div>
          </MinimalSection>
        )}

        {draft.skills.length > 0 && (
          <MinimalSection title="ជំនាញ" accent={accent}>
            <SkillTags skills={draft.skills} accent={accent} />
          </MinimalSection>
        )}

        {draft.education.length > 0 && (
          <MinimalSection title="ការអប់រំ" accent={accent}>
            {draft.education.map((e, i) => (
              <EducationItem key={i} edu={e} />
            ))}
          </MinimalSection>
        )}

        {draft.projects.length > 0 && (
          <MinimalSection title="គម្រោង" accent={accent}>
            {draft.projects.map((p, i) => (
              <p key={i} style={{ fontSize: "12px", color: "#1f2430", marginBottom: "4px" }}>
                <strong>{p.name}</strong>
                {p.summary ? ` — ${p.summary}` : ""}
              </p>
            ))}
          </MinimalSection>
        )}

        {draft.languages.length > 0 && (
          <MinimalSection title="ភាសា" accent={accent}>
            <p style={{ fontSize: "12px", color: "#1f2430" }}>{draft.languages.join("  •  ")}</p>
          </MinimalSection>
        )}
      </div>
    </div>
  );
}

function MinimalSection({
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
          color: INK,
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "14px",
            height: "3px",
            background: accent,
            borderRadius: "2px",
          }}
        />
        {title}
      </h2>
      {children}
    </section>
  );
}

// =============================================================================
// LAYOUT 2 — EXECUTIVE PRO
// Elegant corporate 2-column grid. A beautifully shaded left sidebar frames the
// profile photo, contact details and key technical skill tags.
// =============================================================================
function ExecutivePro({
  draft,
  accent,
}: {
  draft: MakaraCvDraft;
  accent: string;
  lineSpacing: number;
}) {
  const sidebarBg = `linear-gradient(165deg, ${shade(accent, -8)} 0%, ${shade(accent, -42)} 100%)`;
  const onDark = "rgba(255,255,255,0.92)";
  const onDarkDim = "rgba(255,255,255,0.66)";

  return (
    <div style={{ display: "flex", minHeight: "1123px", alignItems: "stretch" }}>
      {/* ----------------------------- Sidebar ----------------------------- */}
      <aside
        style={{
          width: "270px",
          flexShrink: 0,
          background: sidebarBg,
          color: onDark,
          padding: "40px 26px",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Avatar
            draft={draft}
            accent={accent}
            size={132}
            radius="50%"
            ringWidth={4}
            ringColor="rgba(255,255,255,0.85)"
            onDark
          />
        </div>

        <SidebarBlock title="ទំនាក់ទំនង" onDarkDim={onDarkDim}>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {contactBits(draft).map((c, i) => (
              <span key={i} style={{ fontSize: "11px", color: onDark, wordBreak: "break-word" }}>
                {c}
              </span>
            ))}
          </div>
        </SidebarBlock>

        {draft.skills.length > 0 && (
          <SidebarBlock title="ជំនាញ" onDarkDim={onDarkDim}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {draft.skills.map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "10.5px",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.12)",
                    borderRadius: "999px",
                    padding: "2px 9px",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </SidebarBlock>
        )}

        {draft.languages.length > 0 && (
          <SidebarBlock title="ភាសា" onDarkDim={onDarkDim}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {draft.languages.map((l, i) => (
                <span key={i} style={{ fontSize: "11px", color: onDark }}>
                  {l}
                </span>
              ))}
            </div>
          </SidebarBlock>
        )}

        {draft.education.length > 0 && (
          <SidebarBlock title="ការអប់រំ" onDarkDim={onDarkDim}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {draft.education.map((e, i) => (
                <div key={i}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: onDark, margin: 0 }}>
                    {e.credential || e.institution}
                  </p>
                  {e.credential && e.institution && (
                    <p style={{ fontSize: "10px", color: onDarkDim, margin: 0 }}>{e.institution}</p>
                  )}
                  {e.period && (
                    <p style={{ fontSize: "9.5px", color: onDarkDim, margin: 0 }}>{e.period}</p>
                  )}
                </div>
              ))}
            </div>
          </SidebarBlock>
        )}
      </aside>

      {/* ------------------------------ Main ------------------------------- */}
      <main style={{ flex: 1, padding: "44px 40px" }}>
        <header style={{ borderBottom: `3px solid ${accent}`, paddingBottom: "14px" }}>
          <h1
            className="khmer-heading"
            style={{ fontSize: "30px", fontWeight: 700, color: INK, margin: 0 }}
          >
            {draft.fullName}
          </h1>
          {draft.headline && (
            <p
              className="khmer-heading"
              style={{ fontSize: "15px", fontWeight: 600, color: accent, marginTop: "3px" }}
            >
              {draft.headline}
            </p>
          )}
        </header>

        {draft.summary && (
          <ExecSection title="សេចក្តីសង្ខេបវិជ្ជាជីវៈ" accent={accent}>
            <p style={{ fontSize: "12.5px", color: "#1f2430" }}>{draft.summary}</p>
          </ExecSection>
        )}

        {draft.experience.length > 0 && (
          <ExecSection title="បទពិសោធន៍ការងារ" accent={accent}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {draft.experience.map((job, i) => (
                <ExperienceItem key={i} job={job} accent={accent} />
              ))}
            </div>
          </ExecSection>
        )}

        {draft.projects.length > 0 && (
          <ExecSection title="គម្រោង" accent={accent}>
            {draft.projects.map((p, i) => (
              <p key={i} style={{ fontSize: "12px", color: "#1f2430", marginBottom: "4px" }}>
                <strong>{p.name}</strong>
                {p.summary ? ` — ${p.summary}` : ""}
              </p>
            ))}
          </ExecSection>
        )}
      </main>
    </div>
  );
}

function SidebarBlock({
  title,
  onDarkDim,
  children,
}: {
  title: string;
  onDarkDim: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: "22px" }}>
      <h2
        className="khmer-heading"
        style={{
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: onDarkDim,
          marginBottom: "8px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExecSection({
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

// =============================================================================
// LAYOUT 3 — CREATIVE VIBRANT
// Modern tech resume: a gradient header with a framed avatar box, gradient
// "pill" section headers, and a timeline divider line down the experience.
// =============================================================================
function CreativeVibrant({
  draft,
  accent,
}: {
  draft: MakaraCvDraft;
  accent: string;
  lineSpacing: number;
}) {
  const accent2 = shade(accent, 36);
  const headerBg = `linear-gradient(120deg, ${shade(accent, -10)} 0%, ${accent} 55%, ${accent2} 100%)`;
  const contacts = contactBits(draft);

  return (
    <div>
      {/* Gradient header with the avatar in a polished container box. */}
      <header
        style={{
          background: headerBg,
          color: "#ffffff",
          padding: "34px 48px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.16)",
            borderRadius: "20px",
            padding: "8px",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          <Avatar draft={draft} accent={accent} size={116} radius="14px" ringWidth={0} onDark />
        </div>
        <div style={{ flex: 1 }}>
          <h1
            className="khmer-heading"
            style={{ fontSize: "30px", fontWeight: 700, color: "#fff", margin: 0 }}
          >
            {draft.fullName}
          </h1>
          {draft.headline && (
            <p
              className="khmer-heading"
              style={{
                fontSize: "14.5px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
                marginTop: "4px",
              }}
            >
              {draft.headline}
            </p>
          )}
          {contacts.length > 0 && (
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)", marginTop: "9px" }}>
              {contacts.join("  •  ")}
            </p>
          )}
        </div>
      </header>

      <div style={{ padding: "30px 48px 52px" }}>
        {draft.summary && (
          <CreativeSection title="សេចក្តីសង្ខេបវិជ្ជាជីវៈ" accent={accent} accent2={accent2}>
            <p style={{ fontSize: "12.5px", color: "#1f2430" }}>{draft.summary}</p>
          </CreativeSection>
        )}

        {draft.experience.length > 0 && (
          <CreativeSection title="បទពិសោធន៍ការងារ" accent={accent} accent2={accent2}>
            <Timeline jobs={draft.experience} accent={accent} />
          </CreativeSection>
        )}

        {draft.skills.length > 0 && (
          <CreativeSection title="ជំនាញ" accent={accent} accent2={accent2}>
            <SkillTags skills={draft.skills} accent={accent} gradient accent2={accent2} />
          </CreativeSection>
        )}

        {draft.education.length > 0 && (
          <CreativeSection title="ការអប់រំ" accent={accent} accent2={accent2}>
            {draft.education.map((e, i) => (
              <EducationItem key={i} edu={e} />
            ))}
          </CreativeSection>
        )}

        {draft.projects.length > 0 && (
          <CreativeSection title="គម្រោង" accent={accent} accent2={accent2}>
            {draft.projects.map((p, i) => (
              <p key={i} style={{ fontSize: "12px", color: "#1f2430", marginBottom: "4px" }}>
                <strong>{p.name}</strong>
                {p.summary ? ` — ${p.summary}` : ""}
              </p>
            ))}
          </CreativeSection>
        )}

        {draft.languages.length > 0 && (
          <CreativeSection title="ភាសា" accent={accent} accent2={accent2}>
            <p style={{ fontSize: "12px", color: "#1f2430" }}>{draft.languages.join("  •  ")}</p>
          </CreativeSection>
        )}
      </div>
    </div>
  );
}

function CreativeSection({
  title,
  accent,
  accent2,
  children,
}: {
  title: string;
  accent: string;
  accent2: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: "16px" }}>
      <h2
        className="khmer-heading"
        style={{
          display: "inline-block",
          fontSize: "11.5px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#ffffff",
          background: `linear-gradient(90deg, ${accent} 0%, ${accent2} 100%)`,
          borderRadius: "999px",
          padding: "4px 14px",
          marginBottom: "10px",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Timeline({
  jobs,
  accent,
}: {
  jobs: MakaraCvDraft["experience"];
  accent: string;
}) {
  return (
    <div style={{ position: "relative", paddingLeft: "22px" }}>
      {/* The vertical timeline divider line. */}
      <div
        style={{
          position: "absolute",
          left: "5px",
          top: "4px",
          bottom: "4px",
          width: "2px",
          background: `linear-gradient(${accent}, ${shade(accent, 40)})`,
          borderRadius: "2px",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {jobs.map((job, i) => (
          <div key={i} style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "-21px",
                top: "4px",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: accent,
                border: "2px solid #ffffff",
                boxShadow: `0 0 0 2px ${hexA(accent, 0.35)}`,
              }}
            />
            <ExperienceItem job={job} accent={accent} />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SHARED PARTS
// =============================================================================
function ExperienceItem({
  job,
  accent,
}: {
  job: MakaraCvDraft["experience"][number];
  accent: string;
}) {
  return (
    <div>
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
          <span style={{ fontWeight: 500, color: accent }}>
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
            <li key={j} style={{ fontSize: "12px", color: "#1f2430", marginBottom: "2px" }}>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EducationItem({ edu }: { edu: MakaraCvDraft["education"][number] }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "4px",
      }}
    >
      <span style={{ fontSize: "12.5px", color: "#111827" }}>
        <strong>{edu.credential || edu.institution}</strong>
        {edu.credential && edu.institution ? ` — ${edu.institution}` : ""}
      </span>
      {edu.period && <span style={{ fontSize: "11px", color: "#6b7280" }}>{edu.period}</span>}
    </div>
  );
}

function SkillTags({
  skills,
  accent,
  gradient = false,
  accent2,
}: {
  skills: ReadonlyArray<string>;
  accent: string;
  gradient?: boolean;
  accent2?: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {skills.map((s, i) =>
        gradient ? (
          <span
            key={i}
            style={{
              fontSize: "11.5px",
              color: "#ffffff",
              borderRadius: "999px",
              padding: "3px 11px",
              background: `linear-gradient(90deg, ${hexA(accent, 0.92)} 0%, ${hexA(
                accent2 ?? accent,
                0.92,
              )} 100%)`,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            {s}
          </span>
        ) : (
          <span
            key={i}
            style={{
              fontSize: "11.5px",
              color: "#1f2937",
              border: `1px solid ${hexA(accent, 0.4)}`,
              borderRadius: "999px",
              padding: "2px 10px",
              background: hexA(accent, 0.06),
            }}
          >
            {s}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * Avatar — premium profile-photo treatment. Renders the uploaded photo (kept
 * fully visible per the privacy spec) cropped to the requested shape, or a
 * tasteful accent-tinted monogram fallback when no photo was provided.
 */
function Avatar({
  draft,
  accent,
  size,
  radius,
  ringWidth = 0,
  ringColor,
  onDark = false,
}: {
  draft: MakaraCvDraft;
  accent: string;
  size: number;
  radius: string;
  ringWidth?: number;
  ringColor?: string;
  onDark?: boolean;
}) {
  const ring = ringWidth > 0 ? `${ringWidth}px solid ${ringColor ?? accent}` : "none";
  const common: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: radius,
    border: ring,
    boxShadow: onDark ? "0 6px 18px rgba(0,0,0,0.22)" : "0 4px 14px rgba(15,23,42,0.14)",
    flexShrink: 0,
    objectFit: "cover",
    display: "block",
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
  };

  if (draft.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={draft.photoUrl} alt={draft.fullName} style={common} />;
  }

  return (
    <div
      aria-hidden
      style={{
        ...common,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: onDark
          ? "rgba(255,255,255,0.16)"
          : `linear-gradient(145deg, ${hexA(accent, 0.18)} 0%, ${hexA(accent, 0.32)} 100%)`,
        color: onDark ? "#ffffff" : shade(accent, -28),
        fontSize: `${Math.round(size * 0.36)}px`,
        fontWeight: 700,
      }}
    >
      {initials(draft.fullName)}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================
function contactBits(draft: MakaraCvDraft): string[] {
  return [draft.contact.telegram, draft.contact.email, draft.contact.phone, draft.contact.location]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  const pick = parts.slice(0, 2).map((p) => Array.from(p)[0] ?? "");
  return pick.join("") || "·";
}

/** Convert a #rrggbb hex + alpha into an rgba() string. */
function hexA(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Lighten (positive percent) or darken (negative percent) a hex color by
 * mixing toward white or black. Returns a #rrggbb string.
 */
function shade(hex: string, percent: number): string {
  const { r, g, b } = parseHex(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const mix = (c: number) => Math.round((t - c) * p + c);
  return rgbToHex(mix(r), mix(g), mix(b));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const v = hex.startsWith("#") ? hex.slice(1) : hex;
  if (v.length !== 6) return { r: 15, g: 118, b: 110 };
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (c: number) => c.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
