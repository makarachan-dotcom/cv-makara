import {
  EMPTY_DRAFT,
  ExperienceDraft,
  MakaraCvDraft,
} from "@/lib/cv-draft";

// =============================================================================
// AI Khmer Career Interviewer — deterministic engine
// -----------------------------------------------------------------------------
// Drives a deep, industry-aware consultation ENTIRELY in Khmer before any
// template renders. It does not present a cold form: it asks targeted,
// context-aware questions per industry to surface hidden achievements and hard
// metrics, then synthesizes a structured `MakaraCvDraft`.
//
// This rule-based engine is the always-available baseline (no external key
// required, fully deterministic + testable). When an LLM key is configured the
// API route layers richer prose on top (see lib/interview/llm.ts) — but the
// question plan, field mapping and fallbacks all live here.
// =============================================================================

export type QuestionKind = "text" | "longtext" | "list" | "metric";

export interface InterviewQuestion {
  /** Stable id; also the key in the answers map. */
  id: string;
  /** Question text — Khmer. */
  prompt: string;
  /** Helper / coaching line — Khmer. */
  hint?: string;
  /** Input placeholder — Khmer. */
  placeholder?: string;
  kind: QuestionKind;
  /** When true the user may skip without an answer. */
  optional?: boolean;
}

export type IndustryId =
  | "tech"
  | "finance"
  | "marketing"
  | "education"
  | "health"
  | "admin"
  | "design"
  | "engineering"
  | "hospitality"
  | "other";

export interface IndustryMeta {
  id: IndustryId;
  /** Khmer label. */
  label: string;
  /** Khmer one-line descriptor. */
  blurb: string;
}

export const INDUSTRIES: ReadonlyArray<IndustryMeta> = [
  { id: "tech", label: "បច្ចេកវិទ្យា / IT", blurb: "អភិវឌ្ឍន៍កម្មវិធី ទិន្នន័យ ប្រព័ន្ធ និងបណ្តាញ" },
  { id: "finance", label: "ហិរញ្ញវត្ថុ / ធនាគារ", blurb: "គណនេយ្យ ហិរញ្ញវត្ថុ ធនាគារ និងវិនិយោគ" },
  { id: "marketing", label: "ទីផ្សារ / លក់", blurb: "ទីផ្សារឌីជីថល ការលក់ និងម៉ាក" },
  { id: "education", label: "អប់រំ", blurb: "បង្រៀន គ្រប់គ្រងសាលា និងសិក្សា" },
  { id: "health", label: "សុខាភិបាល", blurb: "ពេទ្យ គិលានុបដ្ឋាក និងសេវាសុខភាព" },
  { id: "admin", label: "រដ្ឋបាល / ការិយាល័យ", blurb: "ប្រតិបត្តិការ ធនធានមនុស្ស និងគ្រប់គ្រង" },
  { id: "design", label: "រចនា / ច្នៃប្រឌិត", blurb: "ក្រាហ្វិក UI/UX ម៉ូដ និងមេឌៀ" },
  { id: "engineering", label: "វិស្វកម្ម", blurb: "សំណង់ មេកានិច អគ្គិសនី និងផលិតកម្ម" },
  { id: "hospitality", label: "ទេសចរណ៍ / បដិសណ្ឋារកិច្ច", blurb: "សណ្ឋាគារ ភោជនីយដ្ឋាន និងទេសចរណ៍" },
  { id: "other", label: "ផ្សេងៗ", blurb: "វិជ្ជាជីវៈផ្សេងទៀត" },
];

export function getIndustry(id: string): IndustryMeta | undefined {
  return INDUSTRIES.find((i) => i.id === id);
}

// --- Base questions asked for every industry --------------------------------
const BASE_QUESTIONS: InterviewQuestion[] = [
  {
    id: "fullName",
    prompt: "ជំរាបសួរ! ខ្ញុំជាទីប្រឹក្សាអាជីព AI របស់ Makara CV។ តើអ្នកមានឈ្មោះពេញជាអ្វី?",
    hint: "សរសេរជាអក្សរខ្មែរ ឬឡាតាំងក៏បាន។",
    placeholder: "ឧ. សុខ សុភា",
    kind: "text",
  },
  {
    id: "targetRole",
    prompt: "តើអ្នកកំពុងស្វែងរកតួនាទី ឬមុខតំណែងអ្វី?",
    hint: "ឆ្លើយឱ្យជាក់លាក់ — វាជាចំណងជើងនៅលើ CV របស់អ្នក។",
    placeholder: "ឧ. វិស្វករកម្មវិធីជាន់ខ្ពស់",
    kind: "text",
  },
  {
    id: "years",
    prompt: "តើអ្នកមានបទពិសោធន៍ការងារសរុបប៉ុន្មានឆ្នាំ?",
    hint: "សូមផ្តល់ជាលេខ — យើងនឹងបញ្ចូលវាទៅក្នុងសេចក្តីសង្ខេបវិជ្ជាជីវៈ។",
    placeholder: "ឧ. ៥",
    kind: "metric",
  },
  {
    id: "curCompany",
    prompt: "ឥឡូវនេះ (ឬចុងក្រោយ) អ្នកធ្វើការនៅកន្លែងណា?",
    placeholder: "ឧ. ក្រុមហ៊ុន ABC",
    kind: "text",
  },
  {
    id: "curRole",
    prompt: "តួនាទីរបស់អ្នកនៅទីនោះគឺជាអ្វី?",
    placeholder: "ឧ. ប្រធានផ្នែកលក់",
    kind: "text",
  },
  {
    id: "curPeriod",
    prompt: "តើអ្នកធ្វើការនៅទីនោះចាប់ពីពេលណា ដល់ពេលណា?",
    placeholder: "ឧ. ២០២១ - បច្ចុប្បន្ន",
    kind: "text",
    optional: true,
  },
  {
    id: "curAchievements",
    prompt:
      "ប្រាប់ខ្ញុំពីសមិទ្ធផលធំៗ ៣ យ៉ាងនៅតួនាទីនេះ។ កុំភ្លេចបញ្ចូល 'លេខ' — ភាគរយ ចំនួនទឹកប្រាក់ ឬទំហំក្រុម។",
    hint: "សរសេរមួយជួរក្នុងមួយសមិទ្ធផល។ លេខធ្វើឱ្យ CV គួរឱ្យជឿជាក់។",
    placeholder: "ឧ. បង្កើនការលក់ ៣៥% ក្នុងរយៈពេល ៦ ខែ",
    kind: "list",
  },
  {
    id: "skills",
    prompt: "តើជំនាញសំខាន់ៗរបស់អ្នកមានអ្វីខ្លះ?",
    hint: "សរសេរមួយជំនាញក្នុងមួយជួរ ឬបំបែកដោយសញ្ញាក្បៀស។",
    placeholder: "ឧ. គ្រប់គ្រងគម្រោង, ភាសាអង់គ្លេស, Excel",
    kind: "list",
  },
  {
    id: "education",
    prompt: "ប្រាប់ខ្ញុំពីការអប់រំខ្ពស់បំផុតរបស់អ្នក (សាលា និងសញ្ញាប័ត្រ)។",
    placeholder: "ឧ. សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ — បរិញ្ញាបត្រគ្រប់គ្រងពាណិជ្ជកម្ម",
    kind: "text",
    optional: true,
  },
  {
    id: "languages",
    prompt: "តើអ្នកចេះភាសាអ្វីខ្លះ (និងកម្រិត)?",
    placeholder: "ឧ. ខ្មែរ (កំណើត), អង់គ្លេស (ល្អ)",
    kind: "list",
    optional: true,
  },
  {
    id: "contactTelegram",
    prompt: "ចុងក្រោយ — តើ Telegram របស់អ្នកជាអ្វី? (បន្ថែមអ៊ីមែល ឬលេខទូរស័ព្ទក៏បាន)",
    hint: "ឧ. @username · email@example.com · 012 345 678",
    placeholder: "@username",
    kind: "text",
    optional: true,
  },
];

// --- Industry-specific deep questions, inserted before contact details ------
const INDUSTRY_DEEP: Record<IndustryId, InterviewQuestion[]> = {
  tech: [
    {
      id: "deep_stack",
      prompt: "តើ stack បច្ចេកវិទ្យាដែលអ្នកប្រើស្ទាត់បំផុតមានអ្វីខ្លះ?",
      placeholder: "ឧ. TypeScript, React, Node.js, PostgreSQL",
      kind: "list",
    },
    {
      id: "deep_impact",
      prompt: "តើប្រព័ន្ធ ឬ feature ណាដែលអ្នកសាងសង់បានជះឥទ្ធិពលច្រើនជាងគេ? (បញ្ចូលលេខអ្នកប្រើ ឬ performance)",
      placeholder: "ឧ. កាត់បន្ថយ latency API ៤០% សម្រាប់អ្នកប្រើ ៥ម៉ឺននាក់",
      kind: "longtext",
    },
  ],
  finance: [
    {
      id: "deep_portfolio",
      prompt: "តើទំហំ portfolio ឬថវិកាដែលអ្នកគ្រប់គ្រងធំប៉ុណ្ណា?",
      placeholder: "ឧ. គ្រប់គ្រងផលប័ត្រ $2M, កាត់បន្ថយការចំណាយ ១៥%",
      kind: "longtext",
    },
    {
      id: "deep_compliance",
      prompt: "តើអ្នកមានបទពិសោធន៍ខាងសវនកម្ម បទប្បញ្ញត្តិ ឬគ្រប់គ្រងហានិភ័យដែរឬទេ?",
      placeholder: "ឧ. ដឹកនាំសវនកម្មប្រចាំឆ្នាំដោយគ្មានកំហុស",
      kind: "longtext",
      optional: true,
    },
  ],
  marketing: [
    {
      id: "deep_campaign",
      prompt: "ប្រាប់ខ្ញុំពីយុទ្ធនាការដ៏ជោគជ័យបំផុតរបស់អ្នក — ROI, reach ឬ conversion ប៉ុន្មាន?",
      placeholder: "ឧ. យុទ្ធនាការ Facebook ROAS 6x, reach ២លាននាក់",
      kind: "longtext",
    },
    {
      id: "deep_channels",
      prompt: "តើអ្នកប្រើ channel និងឧបករណ៍ទីផ្សារអ្វីខ្លះ?",
      placeholder: "ឧ. Meta Ads, Google Ads, SEO, TikTok",
      kind: "list",
    },
  ],
  education: [
    {
      id: "deep_outcomes",
      prompt: "តើលទ្ធផលសិស្ស ឬកម្មវិធីសិក្សាដែលអ្នកធ្វើបានប្រសើរឡើងយ៉ាងណា?",
      placeholder: "ឧ. ពិន្ទុជាប់ប្រឡងកើនពី ៧០% ទៅ ៩២%",
      kind: "longtext",
    },
    {
      id: "deep_scope",
      prompt: "តើអ្នកបង្រៀន ឬគ្រប់គ្រងសិស្ស/គ្រូប៉ុន្មាននាក់?",
      placeholder: "ឧ. បង្រៀនសិស្ស ១៥០ នាក់ក្នុងមួយឆ្នាំ",
      kind: "text",
      optional: true,
    },
  ],
  health: [
    {
      id: "deep_care",
      prompt: "តើអ្នកថែទាំអ្នកជំងឺប៉ុន្មាននាក់ ឬមានឯកទេសផ្នែកណា?",
      placeholder: "ឧ. ថែទាំអ្នកជំងឺ ៣០+ នាក់/វេន ផ្នែកសង្គ្រោះបន្ទាន់",
      kind: "longtext",
    },
    {
      id: "deep_cert",
      prompt: "តើអ្នកមានវិញ្ញាបនបត្រ ឬអាជ្ញាប័ណ្ណវិជ្ជាជីវៈអ្វីខ្លះ?",
      placeholder: "ឧ. អាជ្ញាប័ណ្ណគិលានុបដ្ឋាក, BLS/ACLS",
      kind: "list",
      optional: true,
    },
  ],
  admin: [
    {
      id: "deep_ops",
      prompt: "តើដំណើរការ ឬប្រតិបត្តិការណាដែលអ្នកធ្វើឱ្យមានប្រសិទ្ធភាពជាងមុន?",
      placeholder: "ឧ. កាត់បន្ថយពេលដំណើរការឯកសារ ៥០% ដោយប្រើប្រព័ន្ធថ្មី",
      kind: "longtext",
    },
    {
      id: "deep_team",
      prompt: "តើអ្នកគ្រប់គ្រងក្រុម ឬថវិកាប៉ុន្មាន?",
      placeholder: "ឧ. ដឹកនាំក្រុម ៨ នាក់, ថវិកា $50k",
      kind: "text",
      optional: true,
    },
  ],
  design: [
    {
      id: "deep_portfolio",
      prompt: "ប្រាប់ខ្ញុំពីគម្រោងរចនាដែលអ្នកមោទនភាពបំផុត — លទ្ធផលជាអ្វី?",
      placeholder: "ឧ. រចនា UI ថ្មីបង្កើន engagement ២៥%",
      kind: "longtext",
    },
    {
      id: "deep_tools",
      prompt: "តើអ្នកប្រើឧបករណ៍រចនាអ្វីខ្លះ?",
      placeholder: "ឧ. Figma, Photoshop, Illustrator, After Effects",
      kind: "list",
    },
  ],
  engineering: [
    {
      id: "deep_project",
      prompt: "ប្រាប់ខ្ញុំពីគម្រោងវិស្វកម្មធំបំផុត — ទំហំ ថវិកា ឬលទ្ធផល?",
      placeholder: "ឧ. គ្រប់គ្រងសំណង់អគារ ១២ ជាន់ ថវិកា $3M ទាន់ពេល",
      kind: "longtext",
    },
    {
      id: "deep_standards",
      prompt: "តើអ្នកធ្វើការតាមស្តង់ដារ ឬកម្មវិធីបច្ចេកទេសអ្វីខ្លះ?",
      placeholder: "ឧ. AutoCAD, ISO 9001, សុវត្ថិភាពការងារ",
      kind: "list",
      optional: true,
    },
  ],
  hospitality: [
    {
      id: "deep_service",
      prompt: "តើអ្នកបម្រើភ្ញៀវ ឬគ្រប់គ្រងសេវាកម្មយ៉ាងណា — ពិន្ទុ ឬចំនួនភ្ញៀវ?",
      placeholder: "ឧ. រក្សា rating 4.8/5, បម្រើភ្ញៀវ ២០០+ នាក់/ថ្ងៃ",
      kind: "longtext",
    },
    {
      id: "deep_lang",
      prompt: "តើអ្នកមានបទពិសោធន៍បម្រើភ្ញៀវបរទេស ឬប្រើ POS អ្វីខ្លះ?",
      placeholder: "ឧ. បម្រើភ្ញៀវចិន/អង់គ្លេស, ប្រើ POS Micros",
      kind: "text",
      optional: true,
    },
  ],
  other: [
    {
      id: "deep_proud",
      prompt: "ប្រាប់ខ្ញុំពីសមិទ្ធផលដែលអ្នកមោទនភាពបំផុតក្នុងអាជីព — ហើយវាមានលេខអ្វីខ្លះ?",
      placeholder: "ឧ. ដឹកនាំគម្រោងជោគជ័យ បង្កើនលទ្ធផល ៣០%",
      kind: "longtext",
    },
  ],
};

/**
 * Build the ordered Khmer question plan for a given industry: base intro
 * questions, the industry-specific deep questions, then contact details last.
 */
export function buildInterviewPlan(industryId: IndustryId): InterviewQuestion[] {
  const deep = INDUSTRY_DEEP[industryId] ?? INDUSTRY_DEEP.other;
  const contactIndex = BASE_QUESTIONS.findIndex((q) => q.id === "contactTelegram");
  const head = BASE_QUESTIONS.slice(0, contactIndex);
  const tail = BASE_QUESTIONS.slice(contactIndex);
  return [...head, ...deep, ...tail];
}

export type AnswerMap = Record<string, string>;

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|,|;|·/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 30);
}

function firstNumber(value: string | undefined): string | null {
  if (!value) return null;
  const m = value.match(/\d+(?:[.,]\d+)?/);
  return m ? m[0] : null;
}

/**
 * Deterministically synthesize a structured CV draft from the Khmer answers.
 * Surfaces metrics into a professional Khmer summary paragraph.
 */
export function synthesizeDraft(industryId: IndustryId, answers: AnswerMap): MakaraCvDraft {
  const industry = getIndustry(industryId) ?? getIndustry("other")!;
  const draft: MakaraCvDraft = structuredClone(EMPTY_DRAFT);

  draft.fullName = (answers.fullName ?? "").trim() || "ឈ្មោះរបស់អ្នក";
  draft.headline = (answers.targetRole ?? "").trim();

  // Contact: the prompt allows packing telegram/email/phone/location in one line.
  const contactRaw = answers.contactTelegram ?? "";
  const tg = contactRaw.match(/@[A-Za-z0-9_]{3,32}/)?.[0] ?? "";
  const email = contactRaw.match(/[^\s,]+@[^\s,]+\.[^\s,]+/)?.[0] ?? "";
  const phone = contactRaw.match(/(?:\+?\d[\d\s]{6,}\d)/)?.[0]?.trim() ?? "";
  draft.contact = { telegram: tg, email, phone, location: "" };

  // Summary — weave the years + target + the industry deep answer into Khmer prose.
  const years = firstNumber(answers.years);
  const deepKey = Object.keys(answers).find((k) => k.startsWith("deep_"));
  const deepLine = deepKey ? (answers[deepKey] ?? "").trim() : "";
  const summaryParts: string[] = [];
  if (years) {
    summaryParts.push(
      `${draft.headline || "អ្នកជំនាញ"}ដែលមានបទពិសោធន៍ ${years} ឆ្នាំក្នុងវិស័យ${industry.label}។`,
    );
  } else if (draft.headline) {
    summaryParts.push(`${draft.headline}ក្នុងវិស័យ${industry.label}។`);
  }
  if (deepLine) summaryParts.push(deepLine.endsWith("។") ? deepLine : `${deepLine}។`);
  draft.summary = summaryParts.join(" ").trim();

  // Experience — current role with achievement bullets + the deep impact line.
  const bullets = splitList(answers.curAchievements);
  if (deepLine && bullets.length < 6) bullets.push(deepLine);
  const current: ExperienceDraft = {
    company: (answers.curCompany ?? "").trim() || "ក្រុមហ៊ុន",
    role: (answers.curRole ?? "").trim() || draft.headline || "តួនាទី",
    period: (answers.curPeriod ?? "").trim(),
    bullets: bullets.slice(0, 8),
  };
  if (current.company || current.role || current.bullets.length > 0) {
    draft.experience = [current];
  }

  // Skills: merge generic skills + any industry stack/tools/channels list.
  const stackKey = Object.keys(answers).find((k) =>
    ["deep_stack", "deep_tools", "deep_channels", "deep_standards"].includes(k),
  );
  draft.skills = Array.from(
    new Set([...splitList(answers.skills), ...splitList(stackKey ? answers[stackKey] : "")]),
  ).slice(0, 40);

  // Education (single freeform line → institution + credential).
  const edu = (answers.education ?? "").trim();
  if (edu) {
    const [institution, ...rest] = edu.split(/—|–|-|,/);
    draft.education = [
      {
        institution: (institution ?? edu).trim(),
        credential: rest.join(" ").trim(),
        period: "",
      },
    ];
  }

  draft.languages = splitList(answers.languages);
  return draft;
}
