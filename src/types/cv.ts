import { z } from "zod";

// =============================================================================
// Strict Enterprise CV Schema
// Every field below is the explicit, validated input layer for the AI parser.
// =============================================================================

export const TelegramHandleRegex = /^@?[A-Za-z0-9_]{3,32}$/;
export const Iso8601Regex = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))?$/;

export const ProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(64),
  lastName: z.string().trim().min(1).max(64),
  headline: z.string().trim().min(1).max(160),
  bio: z.string().trim().min(40).max(1200),
  telegramHandle: z.string().regex(TelegramHandleRegex, "Invalid Telegram handle"),
  email: z.string().email().optional(),
  location: z.string().trim().max(120).optional(),
  portfolioLinks: z.array(z.string().url()).max(8),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ExperienceEntrySchema = z
  .object({
    company: z.string().trim().min(1).max(128),
    role: z.string().trim().min(1).max(128),
    startDate: z.string().regex(Iso8601Regex, "startDate must be ISO-8601"),
    endDate: z
      .union([z.string().regex(Iso8601Regex, "endDate must be ISO-8601"), z.literal("present")])
      .nullable(),
    achievements: z
      .array(z.string().trim().min(8).max(280))
      .length(5, "Each role requires exactly 5 structural achievement bullets"),
  })
  .superRefine((entry, ctx) => {
    if (entry.endDate && entry.endDate !== "present") {
      const start = Date.parse(entry.startDate);
      const end = Date.parse(entry.endDate);
      if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endDate must be on or after startDate",
          path: ["endDate"],
        });
      }
    }
  });
export type ExperienceEntry = z.infer<typeof ExperienceEntrySchema>;

export const SkillDomainEnum = z.enum([
  "language",
  "framework",
  "platform",
  "tooling",
  "design",
  "infrastructure",
  "data",
  "leadership",
]);
export type SkillDomain = z.infer<typeof SkillDomainEnum>;

export const SkillSchema = z.object({
  name: z.string().trim().min(1).max(64),
  domain: SkillDomainEnum,
  proficiency: z.number().int().min(1).max(100),
});
export type Skill = z.infer<typeof SkillSchema>;

export const EducationEntrySchema = z.object({
  institution: z.string().trim().min(1).max(160),
  degree: z.string().trim().min(1).max(160),
  field: z.string().trim().max(160).optional(),
  startDate: z.string().regex(Iso8601Regex),
  endDate: z.union([z.string().regex(Iso8601Regex), z.literal("present")]).nullable(),
  highlights: z.array(z.string().trim().min(1).max(240)).max(6).default([]),
});
export type EducationEntry = z.infer<typeof EducationEntrySchema>;

export const ArchitecturalProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  repositoryUrl: z.string().url().optional(),
  liveUrl: z.string().url().optional(),
  summary: z.string().trim().min(20).max(480),
  stack: z.array(z.string().trim().min(1).max(64)).max(20),
});
export type ArchitecturalProject = z.infer<typeof ArchitecturalProjectSchema>;

export const CVInputSchema = z.object({
  profile: ProfileSchema,
  experience: z.array(ExperienceEntrySchema).min(1).max(20),
  skills: z.array(SkillSchema).min(1).max(40),
  education: z.array(EducationEntrySchema).max(10).default([]),
  projects: z.array(ArchitecturalProjectSchema).max(20).default([]),
});
export type CVInput = z.infer<typeof CVInputSchema>;

// =============================================================================
// Visual / Scene Configuration
// Reactive state that mutates the WebGL scene WITHOUT triggering re-render.
// All numeric values are clamped at the input boundary; the R3F component
// reads these from a ref so changing them never re-runs the canvas.
// =============================================================================

const HexColor = z.string().regex(/^#(?:[0-9a-fA-F]{6})$/);

export const SceneConfigSchema = z.object({
  palette: z.object({
    primary: HexColor,
    secondary: HexColor,
    accent: HexColor,
    background: HexColor,
  }),
  material: z.object({
    roughness: z.number().min(0).max(1),
    metalness: z.number().min(0).max(1),
    envIntensity: z.number().min(0).max(4),
  }),
  lighting: z.object({
    ambientIntensity: z.number().min(0).max(4),
    directionalIntensity: z.number().min(0).max(8),
    directionalPosition: z.tuple([z.number(), z.number(), z.number()]),
  }),
  camera: z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    target: z.tuple([z.number(), z.number(), z.number()]),
    minDistance: z.number().min(0.1).max(50),
    maxDistance: z.number().min(0.5).max(200),
    minPolar: z.number().min(0).max(Math.PI),
    maxPolar: z.number().min(0).max(Math.PI),
    enableRotate: z.boolean(),
    autoRotateSpeed: z.number().min(0).max(20),
  }),
});
export type SceneConfig = z.infer<typeof SceneConfigSchema>;

export const DEFAULT_SCENE_CONFIG: SceneConfig = {
  palette: {
    primary: "#22d3ee",
    secondary: "#8b5cf6",
    accent: "#facc15",
    background: "#05060a",
  },
  material: { roughness: 0.35, metalness: 0.65, envIntensity: 1.0 },
  lighting: {
    ambientIntensity: 0.6,
    directionalIntensity: 1.8,
    directionalPosition: [5, 8, 6],
  },
  camera: {
    position: [4, 3, 6],
    target: [0, 0, 0],
    minDistance: 2,
    maxDistance: 18,
    minPolar: 0.1,
    maxPolar: Math.PI - 0.1,
    enableRotate: true,
    autoRotateSpeed: 0.6,
  },
};

// =============================================================================
// Hex -> linear RGB conversion (used by R3F material binding).
// =============================================================================
export function hexToRgb(hex: string): [number, number, number] {
  const v = hex.startsWith("#") ? hex.slice(1) : hex;
  if (v.length !== 6) throw new Error(`Invalid hex color: ${hex}`);
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  return [r, g, b];
}


// =============================================================================
// EXTENDED DEMOGRAPHICS + RIGID EDUCATIONAL BRANCHING MATRIX
// -----------------------------------------------------------------------------
// These schemas back the Khmer Interviewer's one-question-at-a-time stepper and
// are shared by the looser `MakaraCvDraft` model (src/lib/cv-draft.ts). They are
// deliberately strict conditional trees: each educational fork is an
// independent discriminated union so impossible states are unrepresentable.
// =============================================================================

/**
 * Relationship status. Options are pinned to the exact Facebook profile fields
 * per spec so the demographics block feels familiar to Khmer users.
 */
export const RelationshipStatusEnum = z.enum([
  "single",
  "in_relationship",
  "married",
  "engaged",
  "complicated",
]);
export type RelationshipStatus = z.infer<typeof RelationshipStatusEnum>;

export interface RelationshipStatusOption {
  value: RelationshipStatus;
  /** Khmer label. */
  labelKm: string;
  /** English label (matches Facebook exactly). */
  labelEn: string;
}

export const RELATIONSHIP_STATUS_OPTIONS: ReadonlyArray<RelationshipStatusOption> = [
  { value: "single", labelKm: "នៅលីវ", labelEn: "Single" },
  { value: "in_relationship", labelKm: "កំពុងមានទំនាក់ទំនង", labelEn: "In a relationship" },
  { value: "married", labelKm: "រៀបការ", labelEn: "Married" },
  { value: "engaged", labelKm: "ភ្ជាប់ពាក្យ", labelEn: "Engaged" },
  { value: "complicated", labelKm: "ស្មុគស្មាញ", labelEn: "It's complicated" },
];

export function relationshipLabelKm(value: RelationshipStatus | undefined): string {
  if (!value) return "";
  return RELATIONSHIP_STATUS_OPTIONS.find((o) => o.value === value)?.labelKm ?? "";
}

/**
 * Extended personal demographics. Per the privacy spec these fields stay 100%
 * visible/unmasked on the rendered CV (only uploaded official credentials are
 * shielded behind the verification QR — see CertificateRefSchema below).
 */
export const DemographicsSchema = z.object({
  dateOfBirth: z.string().trim().max(40).default(""),
  placeOfBirth: z.string().trim().max(160).default(""),
  currentAddress: z.string().trim().max(240).default(""),
  relationshipStatus: RelationshipStatusEnum.optional(),
});
export type Demographics = z.infer<typeof DemographicsSchema>;

export const EMPTY_DEMOGRAPHICS: Demographics = {
  dateOfBirth: "",
  placeOfBirth: "",
  currentAddress: "",
  relationshipStatus: undefined,
};

// -----------------------------------------------------------------------------
// Certificate reference (NEVER the raw file). The actual uploaded credential is
// stored server-side in the `certificates` table and surfaced ONLY through the
// DRM verification sub-page. The CV/draft carries this opaque pointer; the 2D
// document renders it as a "Scan to Verify" QR — never the document image.
// -----------------------------------------------------------------------------
export const CertificateRefSchema = z.object({
  /** Server certificate row id (stringified BigInt). */
  id: z.string().min(1).max(32),
  /** Opaque, unguessable token embedded in the verification QR URL. */
  verifyToken: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid certificate verify token"),
  /** Human label, e.g. "សញ្ញាប័ត្រ BacII". */
  label: z.string().trim().min(1).max(160),
  /** Issuing authority. Defaults to the Cambodian Ministry of Education. */
  issuer: z.string().trim().max(200).default("ក្រសួងអប់រំ យុវជន និងកីឡា"),
  /** Kind discriminator so multiple credential types can coexist. */
  kind: z.enum(["bac2", "diploma", "certificate", "other"]).default("certificate"),
});
export type CertificateRef = z.infer<typeof CertificateRefSchema>;

// -----------------------------------------------------------------------------
// MIDDLE SCHOOL (អនុវិទ្យាល័យ) — three explicit, mutually-exclusive paths.
//   • graduated     (រៀនចប់)      → capture school + graduation year
//   • dropped       (ឈប់រៀន)      → capture the grade + year stopped + reason
//   • never_studied (អត់បានរៀន)   → capture reason only
// -----------------------------------------------------------------------------
export const MiddleSchoolStatusEnum = z.enum(["graduated", "dropped", "never_studied"]);
export type MiddleSchoolStatus = z.infer<typeof MiddleSchoolStatusEnum>;

export const MiddleSchoolSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("graduated"),
    school: z.string().trim().max(200).default(""),
    graduationYear: z.string().trim().max(12).default(""),
  }),
  z.object({
    status: z.literal("dropped"),
    /** ទី៧ / ទី៨ / ទី៩ — the grade at which they stopped. */
    stoppedAtGrade: z.string().trim().max(24).default(""),
    stoppedYear: z.string().trim().max(12).default(""),
    reason: z.string().trim().max(400).default(""),
  }),
  z.object({
    status: z.literal("never_studied"),
    reason: z.string().trim().max(400).default(""),
  }),
]);
export type MiddleSchool = z.infer<typeof MiddleSchoolSchema>;

// -----------------------------------------------------------------------------
// HIGH SCHOOL (វិទ្យាល័យ) — branch on the BacII outcome.
//   • passed_bac2 (ជាប់បាក់ឌុប)   → reveal a secure cert upload (CertificateRef)
//   • failed_bac2 (ធ្លាក់បាក់ឌុប)  → capture alternative training / practical skills
//   • dropped     (ឈប់រៀន)        → capture the exact grade stopped at (ទី១០/ទី១១/ទី១២)
// -----------------------------------------------------------------------------
export const HighSchoolOutcomeEnum = z.enum(["passed_bac2", "failed_bac2", "dropped"]);
export type HighSchoolOutcome = z.infer<typeof HighSchoolOutcomeEnum>;

export const HighSchoolSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("passed_bac2"),
    school: z.string().trim().max(200).default(""),
    examYear: z.string().trim().max(12).default(""),
    /** BacII letter grade A–E (optional). */
    grade: z.string().trim().max(4).default(""),
    /** Pointer to the uploaded, DRM-shielded BacII certificate. */
    certificate: CertificateRefSchema.optional(),
  }),
  z.object({
    outcome: z.literal("failed_bac2"),
    school: z.string().trim().max(200).default(""),
    examYear: z.string().trim().max(12).default(""),
    /** Targeted track: vocational / alternative training program. */
    alternativeTraining: z.string().trim().max(400).default(""),
    /** Practical, hands-on skills surfaced instead of an academic credential. */
    practicalSkills: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    /** Optional supporting certificates (vocational, short-course, etc.). */
    certificates: z.array(CertificateRefSchema).max(10).default([]),
  }),
  z.object({
    outcome: z.literal("dropped"),
    /** ទី១០ / ទី១១ / ទី១២ — the grade at which they stopped. */
    stoppedAtGrade: z.string().trim().max(24).default(""),
    stoppedYear: z.string().trim().max(12).default(""),
    reason: z.string().trim().max(400).default(""),
  }),
]);
export type HighSchool = z.infer<typeof HighSchoolSchema>;

/**
 * The full educational journey. Both forks are optional so the interviewer can
 * progressively build it, but each present fork is internally fully-consistent.
 */
export const EducationJourneySchema = z.object({
  middleSchool: MiddleSchoolSchema.optional(),
  highSchool: HighSchoolSchema.optional(),
});
export type EducationJourney = z.infer<typeof EducationJourneySchema>;

// -----------------------------------------------------------------------------
// AI HR Interview Prep item — a single recruiter question + model answer pair.
// -----------------------------------------------------------------------------
export const InterviewPrepItemSchema = z.object({
  question: z.string().trim().min(1).max(400),
  answer: z.string().trim().min(1).max(1200),
});
export type InterviewPrepItem = z.infer<typeof InterviewPrepItemSchema>;

// -----------------------------------------------------------------------------
// Post-generation footer metadata. Both values are AUTO-GENERATED at synthesis
// time; the user can neither pick nor edit the location (server IP geolocation).
// -----------------------------------------------------------------------------
export const CvMetaSchema = z.object({
  createdAtIso: z.string().trim().max(40).default(""),
  createdLocation: z.string().trim().max(160).default(""),
});
export type CvMeta = z.infer<typeof CvMetaSchema>;
