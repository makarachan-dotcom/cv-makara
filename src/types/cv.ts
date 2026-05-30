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
