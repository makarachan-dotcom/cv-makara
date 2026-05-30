import { z } from "zod";
import {
  CertificateRefSchema,
  CvMetaSchema,
  DemographicsSchema,
  EducationJourneySchema,
  EMPTY_DEMOGRAPHICS,
  InterviewPrepItemSchema,
} from "@/types/cv";

// =============================================================================
// MakaraCvDraft
// -----------------------------------------------------------------------------
// The portable, Khmer-first CV model produced by the AI Khmer Interviewer and
// consumed by the 2D A4 document renderer + the multi-format export engine.
// It is intentionally looser than the strict `CVInputSchema` (src/types/cv.ts,
// used for the 3D generation pipeline): the interviewer emits human prose in
// Khmer, so we validate shape/length but not rigid bullet counts.
// =============================================================================

export const ExperienceDraftSchema = z.object({
  company: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(160),
  period: z.string().trim().max(80).default(""),
  bullets: z.array(z.string().trim().min(1).max(400)).max(8).default([]),
});
export type ExperienceDraft = z.infer<typeof ExperienceDraftSchema>;

export const EducationDraftSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  credential: z.string().trim().max(200).default(""),
  period: z.string().trim().max(80).default(""),
});
export type EducationDraft = z.infer<typeof EducationDraftSchema>;

export const ProjectDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(400).default(""),
});
export type ProjectDraft = z.infer<typeof ProjectDraftSchema>;

export const MakaraCvDraftSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  headline: z.string().trim().max(200).default(""),
  /**
   * Candidate profile picture (data URL or remote URL). Per the privacy spec
   * this stays 100% visible/unmasked on the rendered CV for recruiters.
   */
  photoUrl: z.string().trim().max(2_000_000).default(""),
  contact: z
    .object({
      telegram: z.string().trim().max(120).default(""),
      email: z.string().trim().max(160).default(""),
      phone: z.string().trim().max(60).default(""),
      location: z.string().trim().max(160).default(""),
    })
    .default({ telegram: "", email: "", phone: "", location: "" }),
  /** Extended demographics (DOB, place of birth, address, relationship). */
  demographics: DemographicsSchema.default(EMPTY_DEMOGRAPHICS),
  summary: z.string().trim().max(2000).default(""),
  experience: z.array(ExperienceDraftSchema).max(20).default([]),
  education: z.array(EducationDraftSchema).max(10).default([]),
  /** Strict middle/high-school branching captured by the interviewer. */
  educationJourney: EducationJourneySchema.default({}),
  skills: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
  projects: z.array(ProjectDraftSchema).max(20).default([]),
  languages: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  /**
   * Pointers to uploaded, DRM-shielded official credentials. The CV renders
   * these as a "Scan to Verify" QR — never the document image itself.
   */
  certificates: z.array(CertificateRefSchema).max(10).default([]),
  /** AI HR Advisor output: tailored recruiter questions + model answers. */
  interviewPrep: z.array(InterviewPrepItemSchema).max(20).default([]),
  /** Auto-generated footer metadata (created date + IP-derived location). */
  meta: CvMetaSchema.default({ createdAtIso: "", createdLocation: "" }),
});
export type MakaraCvDraft = z.infer<typeof MakaraCvDraftSchema>;

/** The four professional Khmer Unicode fonts users can swap between live. */
export const KHMER_FONT_KEYS = ["kantumruy", "hanuman", "nokora", "siemreap"] as const;
export type KhmerFontKey = (typeof KHMER_FONT_KEYS)[number];

export interface KhmerFontMeta {
  key: KhmerFontKey;
  /** Khmer label shown in the UI. */
  label: string;
  /** Tailwind font-family utility class. */
  className: string;
  note: string;
}

export const KHMER_FONTS: ReadonlyArray<KhmerFontMeta> = [
  {
    key: "kantumruy",
    label: "Kantumruy Pro",
    className: "font-kantumruy",
    note: "ទំនើប · អានស្រួល · សម្រាប់ផ្នែកបច្ចេកវិទ្យា",
  },
  {
    key: "hanuman",
    label: "Hanuman",
    className: "font-hanuman",
    note: "បុរាណ · ផ្លូវការ · សម្រាប់ឯកសារផ្លូវការ",
  },
  {
    key: "nokora",
    label: "Nokora",
    className: "font-nokora",
    note: "រឹងមាំ · ក្បាលធំ · សម្រាប់ចំណងជើង",
  },
  {
    key: "siemreap",
    label: "Siemreap",
    className: "font-siemreap",
    note: "ស្តើង · ឆើតឆាយ · សម្រាប់រចនាបទស្រាល",
  },
];

export function fontClassFor(key: KhmerFontKey): string {
  return KHMER_FONTS.find((f) => f.key === key)?.className ?? "font-kantumruy";
}

export const EMPTY_DRAFT: MakaraCvDraft = {
  fullName: "",
  headline: "",
  photoUrl: "",
  contact: { telegram: "", email: "", phone: "", location: "" },
  demographics: { ...EMPTY_DEMOGRAPHICS },
  summary: "",
  experience: [],
  education: [],
  educationJourney: {},
  skills: [],
  projects: [],
  languages: [],
  certificates: [],
  interviewPrep: [],
  meta: { createdAtIso: "", createdLocation: "" },
};
