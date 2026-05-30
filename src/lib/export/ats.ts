import type { MakaraCvDraft } from "@/lib/cv-draft";

// =============================================================================
// ATS (Applicant Tracking System) export.
// -----------------------------------------------------------------------------
// Produces a clean, single-column, machine-parseable representation with no
// tables, columns, or glyph tricks — exactly what ATS parsers expect. Two
// shapes are offered: human-readable plain text (.txt) and structured JSON
// (.json) for systems that ingest fielded data. Both are pure functions so
// they are trivially unit-testable and run on server or client.
// =============================================================================

const RULE = "============================================================";

export function toAtsText(cv: MakaraCvDraft): string {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push(cv.fullName.toUpperCase());
  if (cv.headline) push(cv.headline);

  const contactBits = [
    cv.contact.telegram && `Telegram: ${cv.contact.telegram}`,
    cv.contact.email && `Email: ${cv.contact.email}`,
    cv.contact.phone && `Phone: ${cv.contact.phone}`,
    cv.contact.location && `Location: ${cv.contact.location}`,
  ].filter(Boolean);
  if (contactBits.length) push(contactBits.join(" | "));

  if (cv.summary) {
    push();
    push("PROFESSIONAL SUMMARY / សេចក្តីសង្ខេប");
    push(RULE);
    push(cv.summary);
  }

  if (cv.experience.length) {
    push();
    push("EXPERIENCE / បទពិសោធន៍ការងារ");
    push(RULE);
    for (const job of cv.experience) {
      push(`${job.role} — ${job.company}${job.period ? ` (${job.period})` : ""}`);
      for (const b of job.bullets) push(`- ${b}`);
      push();
    }
  }

  if (cv.skills.length) {
    push("SKILLS / ជំនាញ");
    push(RULE);
    push(cv.skills.join(", "));
    push();
  }

  if (cv.education.length) {
    push("EDUCATION / ការអប់រំ");
    push(RULE);
    for (const e of cv.education) {
      push(`${e.credential ? `${e.credential} — ` : ""}${e.institution}${e.period ? ` (${e.period})` : ""}`);
    }
    push();
  }

  if (cv.projects.length) {
    push("PROJECTS / គម្រោង");
    push(RULE);
    for (const p of cv.projects) push(`${p.name}: ${p.summary}`);
    push();
  }

  if (cv.languages.length) {
    push("LANGUAGES / ភាសា");
    push(RULE);
    push(cv.languages.join(", "));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function toAtsJson(cv: MakaraCvDraft): string {
  return JSON.stringify(
    {
      schema: "makara-cv/ats/v1",
      generatedAt: new Date().toISOString(),
      basics: {
        name: cv.fullName,
        headline: cv.headline,
        summary: cv.summary,
        contact: cv.contact,
      },
      work: cv.experience.map((e) => ({
        position: e.role,
        company: e.company,
        period: e.period,
        highlights: e.bullets,
      })),
      skills: cv.skills,
      education: cv.education.map((e) => ({
        institution: e.institution,
        credential: e.credential,
        period: e.period,
      })),
      projects: cv.projects,
      languages: cv.languages,
    },
    null,
    2,
  );
}
