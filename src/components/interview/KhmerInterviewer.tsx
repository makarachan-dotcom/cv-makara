"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  EMPTY_DRAFT,
  MakaraCvDraftSchema,
  type ExperienceDraft,
  type MakaraCvDraft,
  type ProjectDraft,
} from "@/lib/cv-draft";
import { INDUSTRIES, type IndustryId } from "@/lib/interview/engine";
import { buildInterviewPrep } from "@/lib/interview/hr-advisor";
import {
  RELATIONSHIP_STATUS_OPTIONS,
  type CertificateRef,
  type EducationJourney,
  type HighSchool,
  type HighSchoolOutcome,
  type MiddleSchool,
  type MiddleSchoolStatus,
  type RelationshipStatus,
} from "@/types/cv";

// =============================================================================
// KhmerInterviewer — strict one-by-one stepper with additive (+) data harvest.
// -----------------------------------------------------------------------------
// Presents EXACTLY one focused interaction per stage and validates it before
// revealing the next. Repetitive datasets (experience, skills, projects,
// languages) are built with an explicit (+) append button instead of long
// prose. The educational branching matrix forks middle-school and high-school
// into independent paths, and the BacII "passed" branch reveals a secure
// certificate upload that is vaulted server-side (only a QR-verifiable
// reference ever touches the CV). The whole flow can be re-hydrated from a
// historical draft for the "Rewrite" (កែប្រែឡើងវិញ) lifecycle.
// =============================================================================

interface KhmerInterviewerProps {
  onComplete: (draft: MakaraCvDraft, industry: IndustryId, draftId: string | null) => void;
  /** When true, attempts a server-side finalize (geo footer + persistence). */
  persist?: boolean;
  /** Re-hydration: pre-fill the entire stepper from a historical draft. */
  initialDraft?: MakaraCvDraft | null;
  initialIndustry?: IndustryId | null;
  /**
   * Optional live hook. Fires a best-effort, unvalidated projection of the
   * in-progress draft on EVERY edit so a side-by-side 2D `CvDocument` preview
   * can reflect each keystroke. Purely additive — it never blocks the stepper,
   * never throws, and does not touch the one-question-at-a-time navigation, the
   * additive (+) array controllers, the educational branching, or the final
   * validated `finish()`/`onComplete` synthesis path.
   */
  onDraftChange?: (draft: MakaraCvDraft) => void;
}

const STAGES = [
  "industry",
  "identity",
  "contact",
  "demographics",
  "summary",
  "experience",
  "skills",
  "projects",
  "middleSchool",
  "highSchool",
  "languages",
  "review",
] as const;
type Stage = (typeof STAGES)[number];

const STAGE_TITLES: Record<Stage, string> = {
  industry: "តើអ្នកធ្វើការក្នុងវិស័យអ្វី?",
  identity: "ព័ត៌មានផ្ទាល់ខ្លួន",
  contact: "ព័ត៌មានទំនាក់ទំនង",
  demographics: "ប្រវត្តិរូបបន្ថែម",
  summary: "សេចក្ដីសង្ខេបវិជ្ជាជីវៈ",
  experience: "បទពិសោធន៍ការងារ",
  skills: "ជំនាញ",
  projects: "គម្រោង",
  middleSchool: "ការសិក្សា — អនុវិទ្យាល័យ",
  highSchool: "ការសិក្សា — វិទ្យាល័យ",
  languages: "ភាសា",
  review: "ពិនិត្យ និងបង្កើត CV",
};

const MIDDLE_GRADES = ["ទី៧", "ទី៨", "ទី៩"] as const;
const HIGH_GRADES = ["ទី១០", "ទី១១", "ទី១២"] as const;

/** Read a File into a base64 data URL (client-side, no upload). */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

export function KhmerInterviewer({
  onComplete,
  persist = false,
  initialDraft = null,
  initialIndustry = null,
  onDraftChange,
}: KhmerInterviewerProps) {
  // ----- navigation -----
  const [stageIndex, setStageIndex] = useState(initialDraft ? 1 : 0);
  const [status, setStatus] = useState<"editing" | "synthesizing" | "error">("editing");
  const [error, setError] = useState<string | null>(null);
  // `stageIndex` is always clamped within bounds by the nav handlers; the
  // `?? STAGES[0]` fallback satisfies noUncheckedIndexedAccess without changing
  // behavior (the tuple's literal-index access is non-undefined).
  const stage = STAGES[stageIndex] ?? STAGES[0];

  // ----- core fields (optionally seeded from a historical draft) -----
  const [industry, setIndustry] = useState<IndustryId | null>(
    initialIndustry ?? null,
  );
  const [fullName, setFullName] = useState(initialDraft?.fullName ?? "");
  const [headline, setHeadline] = useState(initialDraft?.headline ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialDraft?.photoUrl ?? "");
  const [contact, setContact] = useState(
    initialDraft?.contact ?? { telegram: "", email: "", phone: "", location: "" },
  );
  const [dateOfBirth, setDateOfBirth] = useState(
    initialDraft?.demographics?.dateOfBirth ?? "",
  );
  const [placeOfBirth, setPlaceOfBirth] = useState(
    initialDraft?.demographics?.placeOfBirth ?? "",
  );
  const [currentAddress, setCurrentAddress] = useState(
    initialDraft?.demographics?.currentAddress ?? "",
  );
  const [relationship, setRelationship] = useState<RelationshipStatus | "">(
    initialDraft?.demographics?.relationshipStatus ?? "",
  );
  const [summary, setSummary] = useState(initialDraft?.summary ?? "");

  // ----- additive arrays -----
  const [experiences, setExperiences] = useState<ExperienceDraft[]>(
    initialDraft?.experience ?? [],
  );
  const [expCompany, setExpCompany] = useState("");
  const [expRole, setExpRole] = useState("");
  const [expPeriod, setExpPeriod] = useState("");
  const [expBullets, setExpBullets] = useState<string[]>([]);
  const [expBulletInput, setExpBulletInput] = useState("");

  const [skills, setSkills] = useState<string[]>(initialDraft?.skills ?? []);
  const [skillInput, setSkillInput] = useState("");

  const [projects, setProjects] = useState<ProjectDraft[]>(initialDraft?.projects ?? []);
  const [projName, setProjName] = useState("");
  const [projSummary, setProjSummary] = useState("");

  const [languages, setLanguages] = useState<string[]>(initialDraft?.languages ?? []);
  const [langInput, setLangInput] = useState("");

  // ----- middle school branch -----
  const seedMs = initialDraft?.educationJourney?.middleSchool;
  const [msStatus, setMsStatus] = useState<MiddleSchoolStatus | "">(seedMs?.status ?? "");
  const [msSchool, setMsSchool] = useState(
    seedMs?.status === "graduated" ? seedMs.school : "",
  );
  const [msGradYear, setMsGradYear] = useState(
    seedMs?.status === "graduated" ? seedMs.graduationYear : "",
  );
  const [msStoppedGrade, setMsStoppedGrade] = useState(
    seedMs?.status === "dropped" ? seedMs.stoppedAtGrade : "",
  );
  const [msStoppedYear, setMsStoppedYear] = useState(
    seedMs?.status === "dropped" ? seedMs.stoppedYear : "",
  );
  const [msReason, setMsReason] = useState(
    seedMs?.status === "dropped" || seedMs?.status === "never_studied" ? seedMs.reason : "",
  );

  // ----- high school branch -----
  const seedHs = initialDraft?.educationJourney?.highSchool;
  const [hsOutcome, setHsOutcome] = useState<HighSchoolOutcome | "">(seedHs?.outcome ?? "");
  const [hsSchool, setHsSchool] = useState(
    seedHs && seedHs.outcome !== "dropped" ? seedHs.school : "",
  );
  const [hsExamYear, setHsExamYear] = useState(
    seedHs && seedHs.outcome !== "dropped" ? seedHs.examYear : "",
  );
  const [hsGrade, setHsGrade] = useState(
    seedHs?.outcome === "passed_bac2" ? seedHs.grade : "",
  );
  const [hsAltTraining, setHsAltTraining] = useState(
    seedHs?.outcome === "failed_bac2" ? seedHs.alternativeTraining : "",
  );
  const [hsPractical, setHsPractical] = useState<string[]>(
    seedHs?.outcome === "failed_bac2" ? seedHs.practicalSkills : [],
  );
  const [hsPracticalInput, setHsPracticalInput] = useState("");
  const [hsStoppedGrade, setHsStoppedGrade] = useState(
    seedHs?.outcome === "dropped" ? seedHs.stoppedAtGrade : "",
  );
  const [hsStoppedYear, setHsStoppedYear] = useState(
    seedHs?.outcome === "dropped" ? seedHs.stoppedYear : "",
  );
  const [hsReason, setHsReason] = useState(
    seedHs?.outcome === "dropped" ? seedHs.reason : "",
  );
  const [hsCerts, setHsCerts] = useState<CertificateRef[]>(() => {
    if (seedHs?.outcome === "passed_bac2" && seedHs.certificate) return [seedHs.certificate];
    if (seedHs?.outcome === "failed_bac2") return seedHs.certificates;
    return [];
  });
  const [certBusy, setCertBusy] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  const progress = Math.round((stageIndex / (STAGES.length - 1)) * 100);

  // --------------------------------------------------------- live preview hook
  // Project the current (possibly partial) form state into a MakaraCvDraft so a
  // side-by-side 2D document can re-render on every keystroke. This is a READ
  // ONLY mirror of state — it reuses the same branching/derivation helpers used
  // by the final synthesis (`buildDraft`) but skips strict validation so the
  // preview stays live even while fields are incomplete.
  const previewDraft = useMemo<MakaraCvDraft>(() => {
    const journey: EducationJourney = {
      middleSchool: buildMiddleSchool(),
      highSchool: buildHighSchool(),
    };
    return {
      ...structuredClone(EMPTY_DRAFT),
      fullName: fullName.trim(),
      headline: headline.trim(),
      photoUrl,
      contact: {
        telegram: contact.telegram.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        location: contact.location.trim(),
      },
      demographics: {
        dateOfBirth: dateOfBirth.trim(),
        placeOfBirth: placeOfBirth.trim(),
        currentAddress: currentAddress.trim(),
        relationshipStatus: relationship || undefined,
      },
      summary: summary.trim(),
      experience: experiences,
      education: deriveEducationEntries(journey),
      educationJourney: journey,
      skills,
      projects,
      languages,
      certificates: [...hsCerts],
    };
    // helpers (buildMiddleSchool/buildHighSchool/deriveEducationEntries) are
    // stable hoisted closures; the underlying state is fully enumerated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fullName,
    headline,
    photoUrl,
    contact,
    dateOfBirth,
    placeOfBirth,
    currentAddress,
    relationship,
    summary,
    experiences,
    skills,
    projects,
    languages,
    hsCerts,
    msStatus,
    msSchool,
    msGradYear,
    msStoppedGrade,
    msStoppedYear,
    msReason,
    hsOutcome,
    hsSchool,
    hsExamYear,
    hsGrade,
    hsAltTraining,
    hsPractical,
    hsStoppedGrade,
    hsStoppedYear,
    hsReason,
  ]);

  useEffect(() => {
    onDraftChange?.(previewDraft);
  }, [previewDraft, onDraftChange]);

  // -------------------------------------------------------------- navigation
  function next() {
    setError(null);
    if (stage === "identity" && !fullName.trim()) {
      setError("សូមបញ្ចូលឈ្មោះពេញរបស់អ្នកជាមុនសិន។");
      return;
    }
    if (stageIndex < STAGES.length - 1) setStageIndex(stageIndex + 1);
  }
  function back() {
    setError(null);
    if (stageIndex > 0) setStageIndex(stageIndex - 1);
  }
  function pickIndustry(id: IndustryId) {
    setIndustry(id);
    setStageIndex(stageIndex + 1);
  }

  // ----------------------------------------------- additive array operations
  function addExperience() {
    if (!expCompany.trim() || !expRole.trim()) {
      setError("បទពិសោធន៍ត្រូវការយ៉ាងហោចណាស់ ឈ្មោះក្រុមហ៊ុន និងតួនាទី។");
      return;
    }
    setError(null);
    setExperiences((prev) => [
      ...prev,
      {
        company: expCompany.trim(),
        role: expRole.trim(),
        period: expPeriod.trim(),
        bullets: expBullets.slice(0, 8),
      },
    ]);
    setExpCompany("");
    setExpRole("");
    setExpPeriod("");
    setExpBullets([]);
    setExpBulletInput("");
  }
  function addBullet() {
    const v = expBulletInput.trim();
    if (!v) return;
    setExpBullets((prev) => (prev.length >= 8 ? prev : [...prev, v]));
    setExpBulletInput("");
  }
  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    setSkills((prev) => (prev.includes(v) || prev.length >= 60 ? prev : [...prev, v]));
    setSkillInput("");
  }
  function addProject() {
    if (!projName.trim()) return;
    setProjects((prev) => [...prev, { name: projName.trim(), summary: projSummary.trim() }]);
    setProjName("");
    setProjSummary("");
  }
  function addLanguage() {
    const v = langInput.trim();
    if (!v) return;
    setLanguages((prev) => (prev.includes(v) || prev.length >= 12 ? prev : [...prev, v]));
    setLangInput("");
  }
  function addPractical() {
    const v = hsPracticalInput.trim();
    if (!v) return;
    setHsPractical((prev) => (prev.includes(v) || prev.length >= 20 ? prev : [...prev, v]));
    setHsPracticalInput("");
  }

  // ------------------------------------------------------------ photo upload
  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("សូមជ្រើសរើសរូបភាព (PNG/JPEG)។");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("រូបភាពធំពេក (អតិបរមា ២MB)។");
      return;
    }
    setError(null);
    try {
      setPhotoUrl(await fileToDataUrl(file));
    } catch {
      setError("មិនអាចអានរូបភាពបានទេ។");
    }
  }

  // ----------------------- secure certificate upload (vaulted server-side) --
  async function onCertificate(
    e: ChangeEvent<HTMLInputElement>,
    kind: "bac2" | "certificate",
    label: string,
  ) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const ok = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!ok.includes(file.type)) {
      setCertError("សូមជ្រើស PNG, JPEG, WEBP ឬ PDF។");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setCertError("ឯកសារធំពេក (អតិបរមា ៦MB)។");
      return;
    }
    setCertError(null);
    setCertBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, kind, dataUrl }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("សូមចូលគណនី Telegram មុននឹងបង្ហោះសញ្ញាប័ត្រ។");
        }
        throw new Error(`ការបង្ហោះបរាជ័យ (${res.status}).`);
      }
      const json = (await res.json()) as { certificate: CertificateRef };
      setHsCerts((prev) => [...prev, json.certificate]);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : "ការបង្ហោះបរាជ័យ។");
    } finally {
      setCertBusy(false);
    }
  }

  // ----------------------------------------------- assemble education branch
  function buildMiddleSchool(): MiddleSchool | undefined {
    if (msStatus === "graduated") {
      return { status: "graduated", school: msSchool.trim(), graduationYear: msGradYear.trim() };
    }
    if (msStatus === "dropped") {
      return {
        status: "dropped",
        stoppedAtGrade: msStoppedGrade.trim(),
        stoppedYear: msStoppedYear.trim(),
        reason: msReason.trim(),
      };
    }
    if (msStatus === "never_studied") {
      return { status: "never_studied", reason: msReason.trim() };
    }
    return undefined;
  }
  function buildHighSchool(): HighSchool | undefined {
    if (hsOutcome === "passed_bac2") {
      return {
        outcome: "passed_bac2",
        school: hsSchool.trim(),
        examYear: hsExamYear.trim(),
        grade: hsGrade.trim(),
        certificate: hsCerts[0],
      };
    }
    if (hsOutcome === "failed_bac2") {
      return {
        outcome: "failed_bac2",
        school: hsSchool.trim(),
        examYear: hsExamYear.trim(),
        alternativeTraining: hsAltTraining.trim(),
        practicalSkills: hsPractical,
        certificates: hsCerts,
      };
    }
    if (hsOutcome === "dropped") {
      return {
        outcome: "dropped",
        stoppedAtGrade: hsStoppedGrade.trim(),
        stoppedYear: hsStoppedYear.trim(),
        reason: hsReason.trim(),
      };
    }
    return undefined;
  }

  // Map the branching journey into simple Education rows for the CV body.
  function deriveEducationEntries(journey: EducationJourney) {
    const rows: MakaraCvDraft["education"] = [];
    const hs = journey.highSchool;
    if (hs?.outcome === "passed_bac2") {
      rows.push({
        institution: hs.school || "វិទ្យាល័យ",
        credential:
          "សញ្ញាប័ត្រមធ្យមសិក្សាទុតិយភូមិ (BacII)" + (hs.grade ? ` · និទ្ទេស ${hs.grade}` : ""),
        period: hs.examYear,
      });
    } else if (hs?.outcome === "failed_bac2") {
      rows.push({
        institution: hs.school || "វិទ្យាល័យ",
        credential:
          "បានសិក្សាថ្នាក់វិទ្យាល័យ" + (hs.alternativeTraining ? ` · ${hs.alternativeTraining}` : ""),
        period: hs.examYear,
      });
    } else if (hs?.outcome === "dropped") {
      rows.push({
        institution: "វិទ្យាល័យ",
        credential: `បានឈប់រៀននៅ${hs.stoppedAtGrade || "ថ្នាក់វិទ្យាល័យ"}`,
        period: hs.stoppedYear,
      });
    }
    const ms = journey.middleSchool;
    if (ms?.status === "graduated") {
      rows.push({
        institution: ms.school || "អនុវិទ្យាល័យ",
        credential: "បានបញ្ចប់ថ្នាក់អនុវិទ្យាល័យ",
        period: ms.graduationYear,
      });
    } else if (ms?.status === "dropped") {
      rows.push({
        institution: "អនុវិទ្យាល័យ",
        credential: `បានឈប់រៀននៅ${ms.stoppedAtGrade || "ថ្នាក់អនុវិទ្យាល័យ"}`,
        period: ms.stoppedYear,
      });
    }
    return rows.slice(0, 10);
  }

  function autoSummary(role: string): string {
    if (summary.trim()) return summary.trim();
    const ind = INDUSTRIES.find((i) => i.id === industry);
    const parts: string[] = [];
    if (role) parts.push(`${role}${ind ? `ក្នុងវិស័យ${ind.label}` : ""}។`);
    if (experiences[0]?.bullets[0]) parts.push(experiences[0].bullets[0]);
    return parts.join(" ").trim();
  }

  // ------------------------------------------------------- build + complete
  function buildDraft(): MakaraCvDraft | null {
    if (!industry) return null;
    const journey: EducationJourney = {
      middleSchool: buildMiddleSchool(),
      highSchool: buildHighSchool(),
    };
    const certificates: CertificateRef[] = [...hsCerts];

    const candidate: MakaraCvDraft = {
      ...structuredClone(EMPTY_DRAFT),
      fullName: fullName.trim() || "ឈ្មោះរបស់អ្នក",
      headline: headline.trim(),
      photoUrl,
      contact: {
        telegram: contact.telegram.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        location: contact.location.trim(),
      },
      demographics: {
        dateOfBirth: dateOfBirth.trim(),
        placeOfBirth: placeOfBirth.trim(),
        currentAddress: currentAddress.trim(),
        relationshipStatus: relationship || undefined,
      },
      summary: autoSummary(headline.trim()),
      experience: experiences,
      education: deriveEducationEntries(journey),
      educationJourney: journey,
      skills,
      projects,
      languages,
      certificates,
      meta: { createdAtIso: new Date().toISOString(), createdLocation: "" },
    };

    // AI HR Advisor runs here (pure, client-safe) once all fields are set.
    candidate.interviewPrep = buildInterviewPrep(industry, candidate);

    const parsed = MakaraCvDraftSchema.safeParse(candidate);
    if (!parsed.success) {
      setError("ទិន្នន័យមិនត្រឹមត្រូវ៖ " + parsed.error.issues[0]?.message);
      return null;
    }
    return parsed.data;
  }

  function collectAnswers(): Record<string, unknown> {
    return {
      industry,
      fullName,
      headline,
      contact,
      demographics: { dateOfBirth, placeOfBirth, currentAddress, relationshipStatus: relationship },
      experiences,
      skills,
      projects,
      languages,
      educationJourney: { middleSchool: buildMiddleSchool(), highSchool: buildHighSchool() },
    };
  }

  async function finish() {
    setError(null);
    const draft = buildDraft();
    if (!draft || !industry) {
      setStatus("error");
      return;
    }
    setStatus("synthesizing");
    let finalDraft = draft;
    let draftId: string | null = null;

    // Best-effort server finalize: enriches the footer geolocation + persists.
    // Forward-compatible — if the route does not yet support "finalize" we fall
    // back to the fully-built client draft (HR advisor already attached).
    if (persist) {
      try {
        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "finalize", industry, draft, answers: collectAnswers() }),
        });
        if (res.ok) {
          const json = (await res.json()) as { draft?: MakaraCvDraft; draftId?: string | null };
          if (json.draft) finalDraft = json.draft;
          draftId = json.draftId ?? null;
        }
      } catch {
        /* offline / route not yet updated — use client draft */
      }
    }
    onComplete(finalDraft, industry, draftId);
  }

  // =================================================================== render
  if (status === "synthesizing") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
        <p className="text-sm text-ink-200">AI កំពុងសរសេរ CV របស់អ្នក…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-accent-rose">{error ?? "មានបញ្ហា។ សូមព្យាយាមម្ដងទៀត។"}</p>
        <button
          type="button"
          onClick={() => setStatus("editing")}
          className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-ink-950"
        >
          ត្រឡប់ក្រោយ
        </button>
      </div>
    );
  }

  // ---- industry picker (its own full-bleed stage) ----
  if (stage === "industry") {
    return (
      <div className="space-y-4">
        <Header progress={progress} title={STAGE_TITLES.industry} index={stageIndex} />
        <p className="text-xs leading-khmer-tight text-ink-200">
          ជ្រើសរើសវិស័យ ដើម្បីឱ្យ AI សួរសំណួរស៊ីជម្រៅ និងរៀបចំសំណួរសម្ភាសន៍ត្រៀមសម្រាប់អ្នក។
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind.id}
              type="button"
              onClick={() => pickIndustry(ind.id)}
              className={
                "rounded-lg border p-3 text-left transition hover:border-accent-cyan/60 hover:bg-ink-800 " +
                (industry === ind.id ? "border-accent-cyan bg-accent-cyan/10" : "border-ink-700 bg-ink-900/70")
              }
            >
              <span className="block text-sm font-semibold text-ink-100">{ind.label}</span>
              <span className="mt-0.5 block text-[10.5px] leading-khmer-tight text-ink-200">
                {ind.blurb}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header progress={progress} title={STAGE_TITLES[stage]} index={stageIndex} />

      <div className="space-y-3">
        {stage === "identity" && (
          <>
            <Labeled label="ឈ្មោះពេញ *">
              <Text value={fullName} onChange={setFullName} placeholder="ឧ. សុខ សុភា" autoFocus />
            </Labeled>
            <Labeled label="តួនាទីដែលចង់បាន (Headline)">
              <Text value={headline} onChange={setHeadline} placeholder="ឧ. វិស្វករកម្មវិធីជាន់ខ្ពស់" />
            </Labeled>
            <Labeled label="រូបថតប្រវត្តិរូប (បង្ហាញលើ CV)">
              <div className="flex items-center gap-3">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="profile" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-ink-700 text-[10px] text-ink-500">
                    រូបថត
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPhoto}
                  className="text-[11px] text-ink-200 file:mr-2 file:rounded file:border-0 file:bg-ink-800 file:px-2 file:py-1 file:text-ink-100"
                />
              </div>
            </Labeled>
          </>
        )}

        {stage === "contact" && (
          <>
            <Labeled label="Telegram">
              <Text
                value={contact.telegram}
                onChange={(v) => setContact({ ...contact, telegram: v })}
                placeholder="@username"
              />
            </Labeled>
            <Labeled label="អ៊ីមែល">
              <Text
                value={contact.email}
                onChange={(v) => setContact({ ...contact, email: v })}
                placeholder="email@example.com"
              />
            </Labeled>
            <Labeled label="លេខទូរស័ព្ទ">
              <Text
                value={contact.phone}
                onChange={(v) => setContact({ ...contact, phone: v })}
                placeholder="012 345 678"
              />
            </Labeled>
            <Labeled label="ទីកន្លែង">
              <Text
                value={contact.location}
                onChange={(v) => setContact({ ...contact, location: v })}
                placeholder="ឧ. ភ្នំពេញ"
              />
            </Labeled>
          </>
        )}

        {stage === "demographics" && (
          <>
            <Labeled label="ថ្ងៃខែឆ្នាំកំណើត">
              <Text value={dateOfBirth} onChange={setDateOfBirth} placeholder="ឧ. ១៥ មករា ១៩៩៥" />
            </Labeled>
            <Labeled label="ទីកន្លែងកំណើត">
              <Text value={placeOfBirth} onChange={setPlaceOfBirth} placeholder="ឧ. ខេត្តកំពង់ចាម" />
            </Labeled>
            <Labeled label="អាសយដ្ឋានបច្ចុប្បន្ន">
              <Text value={currentAddress} onChange={setCurrentAddress} placeholder="ឧ. សង្កាត់ទួលទំពូង ភ្នំពេញ" />
            </Labeled>
            <Labeled label="ស្ថានភាពគ្រួសារ">
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as RelationshipStatus | "")}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 p-2.5 text-sm text-ink-100 outline-none focus:border-accent-cyan"
              >
                <option value="">— ជ្រើសរើស —</option>
                {RELATIONSHIP_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.labelKm} ({o.labelEn})
                  </option>
                ))}
              </select>
            </Labeled>
          </>
        )}

        {stage === "summary" && (
          <Labeled label="សេចក្ដីសង្ខេបខ្លី (បើទុកទទេ AI នឹងបង្កើតឱ្យ)">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="ឧ. វិស្វករកម្មវិធីដែលមានបទពិសោធន៍ ៥ ឆ្នាំ…"
              className="w-full resize-none rounded-lg border border-ink-700 bg-ink-950 p-3 text-sm leading-khmer text-ink-100 outline-none focus:border-accent-cyan"
            />
          </Labeled>
        )}

        {stage === "experience" && (
          <div className="space-y-3">
            <ChipList items={experiences.map((e) => `${e.role} · ${e.company}`)} onRemove={(i) =>
              setExperiences((p) => p.filter((_, idx) => idx !== i))
            } />
            <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-900/60 p-3">
              <Text value={expCompany} onChange={setExpCompany} placeholder="ឈ្មោះក្រុមហ៊ុន *" />
              <Text value={expRole} onChange={setExpRole} placeholder="តួនាទី *" />
              <Text value={expPeriod} onChange={setExpPeriod} placeholder="រយៈពេល (ឧ. ២០២១ - បច្ចុប្បន្ន)" />
              <div className="space-y-1">
                {expBullets.map((b, i) => (
                  <p key={i} className="flex items-center justify-between text-[11px] text-ink-300">
                    <span className="leading-khmer-tight">• {b}</span>
                    <button
                      type="button"
                      onClick={() => setExpBullets((p) => p.filter((_, idx) => idx !== i))}
                      className="text-accent-rose"
                    >
                      ✕
                    </button>
                  </p>
                ))}
                <AddRow
                  value={expBulletInput}
                  onChange={setExpBulletInput}
                  onAdd={addBullet}
                  placeholder="សមិទ្ធផល (បញ្ចូលលេខ) → ចុច +"
                />
              </div>
              <button
                type="button"
                onClick={addExperience}
                className="w-full rounded-lg bg-accent-emerald/20 px-3 py-2 text-xs font-semibold text-accent-emerald hover:bg-accent-emerald/30"
              >
                + បន្ថែមបទពិសោធន៍
              </button>
            </div>
          </div>
        )}

        {stage === "skills" && (
          <div className="space-y-3">
            <ChipList items={skills} onRemove={(i) => setSkills((p) => p.filter((_, idx) => idx !== i))} />
            <AddRow value={skillInput} onChange={setSkillInput} onAdd={addSkill} placeholder="ឧ. គ្រប់គ្រងគម្រោង → ចុច +" />
          </div>
        )}

        {stage === "projects" && (
          <div className="space-y-3">
            <ChipList items={projects.map((p) => p.name)} onRemove={(i) =>
              setProjects((p) => p.filter((_, idx) => idx !== i))
            } />
            <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-900/60 p-3">
              <Text value={projName} onChange={setProjName} placeholder="ឈ្មោះគម្រោង" />
              <Text value={projSummary} onChange={setProjSummary} placeholder="សេចក្ដីពិពណ៌នាខ្លី" />
              <button
                type="button"
                onClick={addProject}
                className="w-full rounded-lg bg-accent-emerald/20 px-3 py-2 text-xs font-semibold text-accent-emerald hover:bg-accent-emerald/30"
              >
                + បន្ថែមគម្រោង
              </button>
            </div>
          </div>
        )}

        {stage === "middleSchool" && (
          <div className="space-y-3">
            <Labeled label="ការសិក្សាថ្នាក់អនុវិទ្យាល័យ">
              <select
                value={msStatus}
                onChange={(e) => setMsStatus(e.target.value as MiddleSchoolStatus | "")}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 p-2.5 text-sm text-ink-100 outline-none focus:border-accent-cyan"
              >
                <option value="">— ជ្រើសរើស —</option>
                <option value="graduated">រៀនចប់ (Graduated)</option>
                <option value="dropped">ឈប់រៀន (Dropped)</option>
                <option value="never_studied">អត់បានរៀន (Never studied)</option>
              </select>
            </Labeled>
            {msStatus === "graduated" && (
              <>
                <Text value={msSchool} onChange={setMsSchool} placeholder="ឈ្មោះអនុវិទ្យាល័យ" />
                <Text value={msGradYear} onChange={setMsGradYear} placeholder="ឆ្នាំបញ្ចប់ (ឧ. ២០១៣)" />
              </>
            )}
            {msStatus === "dropped" && (
              <>
                <select
                  value={msStoppedGrade}
                  onChange={(e) => setMsStoppedGrade(e.target.value)}
                  className="w-full rounded-lg border border-ink-700 bg-ink-950 p-2.5 text-sm text-ink-100 outline-none focus:border-accent-cyan"
                >
                  <option value="">ឈប់នៅថ្នាក់ណា?</option>
                  {MIDDLE_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <Text value={msStoppedYear} onChange={setMsStoppedYear} placeholder="ឆ្នាំ​ឈប់រៀន" />
                <Text value={msReason} onChange={setMsReason} placeholder="មូលហេតុ" />
              </>
            )}
            {msStatus === "never_studied" && (
              <Text value={msReason} onChange={setMsReason} placeholder="មូលហេតុ (ស្រេចចិត្ត)" />
            )}
          </div>
        )}

        {stage === "highSchool" && (
          <div className="space-y-3">
            <Labeled label="តើអ្នកប្រឡងបាក់ឌុប (BacII) ជាប់ឬទេ?">
              <select
                value={hsOutcome}
                onChange={(e) => setHsOutcome(e.target.value as HighSchoolOutcome | "")}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 p-2.5 text-sm text-ink-100 outline-none focus:border-accent-cyan"
              >
                <option value="">— ជ្រើសរើស —</option>
                <option value="passed_bac2">ជាប់បាក់ឌុប (Passed BacII)</option>
                <option value="failed_bac2">ធ្លាក់បាក់ឌុប (Failed BacII)</option>
                <option value="dropped">ឈប់រៀន (Dropped)</option>
              </select>
            </Labeled>

            {hsOutcome === "passed_bac2" && (
              <>
                <Text value={hsSchool} onChange={setHsSchool} placeholder="ឈ្មោះវិទ្យាល័យ" />
                <Text value={hsExamYear} onChange={setHsExamYear} placeholder="ឆ្នាំប្រឡង (ឧ. ២០១៦)" />
                <Text value={hsGrade} onChange={setHsGrade} placeholder="និទ្ទេស (A–E) ស្រេចចិត្ត" />
                <CertUploader
                  busy={certBusy}
                  error={certError}
                  certs={hsCerts}
                  note="ភ្ជាប់សញ្ញាប័ត្រ BacII ផ្លូវការ (ក្រសួងអប់រំ)។ វានឹងលាក់ពីសាធារណៈ ហើយបង្ហាញតែ QR ផ្ទៀងផ្ទាត់។"
                  onPick={(e) => onCertificate(e, "bac2", "សញ្ញាប័ត្រ BacII")}
                  onRemove={(i) => setHsCerts((p) => p.filter((_, idx) => idx !== i))}
                />
              </>
            )}

            {hsOutcome === "failed_bac2" && (
              <>
                <Text value={hsSchool} onChange={setHsSchool} placeholder="ឈ្មោះវិទ្យាល័យ" />
                <Text value={hsExamYear} onChange={setHsExamYear} placeholder="ឆ្នាំប្រឡង" />
                <Text value={hsAltTraining} onChange={setHsAltTraining} placeholder="វគ្គបណ្ដុះបណ្ដាល / ជំនាញវិជ្ជាជីវៈ" />
                <ChipList items={hsPractical} onRemove={(i) => setHsPractical((p) => p.filter((_, idx) => idx !== i))} />
                <AddRow value={hsPracticalInput} onChange={setHsPracticalInput} onAdd={addPractical} placeholder="ជំនាញដៃ → ចុច +" />
                <CertUploader
                  busy={certBusy}
                  error={certError}
                  certs={hsCerts}
                  note="ភ្ជាប់វិញ្ញាបនបត្រវគ្គបណ្ដុះបណ្ដាល (ស្រេចចិត្ត)។"
                  onPick={(e) => onCertificate(e, "certificate", "វិញ្ញាបនបត្របណ្ដុះបណ្ដាល")}
                  onRemove={(i) => setHsCerts((p) => p.filter((_, idx) => idx !== i))}
                />
              </>
            )}

            {hsOutcome === "dropped" && (
              <>
                <select
                  value={hsStoppedGrade}
                  onChange={(e) => setHsStoppedGrade(e.target.value)}
                  className="w-full rounded-lg border border-ink-700 bg-ink-950 p-2.5 text-sm text-ink-100 outline-none focus:border-accent-cyan"
                >
                  <option value="">ឈប់នៅថ្នាក់ណា?</option>
                  {HIGH_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <Text value={hsStoppedYear} onChange={setHsStoppedYear} placeholder="ឆ្នាំ​ឈប់រៀន" />
                <Text value={hsReason} onChange={setHsReason} placeholder="មូលហេតុ" />
              </>
            )}
          </div>
        )}

        {stage === "languages" && (
          <div className="space-y-3">
            <ChipList items={languages} onRemove={(i) => setLanguages((p) => p.filter((_, idx) => idx !== i))} />
            <AddRow value={langInput} onChange={setLangInput} onAdd={addLanguage} placeholder="ឧ. អង់គ្លេស (ល្អ) → ចុច +" />
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 p-3 text-[11.5px] leading-khmer-tight text-ink-200">
            <p><span className="text-ink-500">ឈ្មោះ៖</span> {fullName || "—"}</p>
            <p><span className="text-ink-500">តួនាទី៖</span> {headline || "—"}</p>
            <p><span className="text-ink-500">បទពិសោធន៍៖</span> {experiences.length} · ជំនាញ៖ {skills.length} · គម្រោង៖ {projects.length}</p>
            <p><span className="text-ink-500">សញ្ញាប័ត្រដែលបានការពារ៖</span> {hsCerts.length}</p>
            <p className="text-[10.5px] text-ink-500">
              AI នឹងភ្ជាប់សំណួរសម្ភាសន៍ HR ត្រៀមជាមួយចម្លើយគំរូ បន្ទាប់ពីបង្កើតរួច។
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-accent-rose">{error}</p>}

      {/* navigation controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={back}
          disabled={stageIndex === 0}
          className="rounded-lg border border-ink-700 px-4 py-2.5 text-sm text-ink-200 hover:bg-ink-800 disabled:opacity-30"
        >
          ← ថយក្រោយ
        </button>
        {stage === "review" ? (
          <button
            type="button"
            onClick={finish}
            className="flex-1 rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-accent-cyan/90"
          >
            បង្កើត CV ✦
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="flex-1 rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-accent-cyan/90"
          >
            បន្ទាប់ →
          </button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- subcomponents
function Header({ progress, title, index }: { progress: number; title: string; index: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-ink-200">
        <span className="font-mono uppercase tracking-widest text-accent-cyan">
          ជំហាន {index + 1}/{STAGES.length}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-accent-cyan transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <h2 className="mt-2 text-base font-semibold leading-khmer text-ink-100">{title}</h2>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-ink-200">{label}</span>
      {children}
    </label>
  );
}

function Text({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-ink-700 bg-ink-950 p-2.5 text-sm leading-khmer text-ink-100 outline-none focus:border-accent-cyan"
    />
  );
}

function AddRow({
  value,
  onChange,
  onAdd,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-ink-700 bg-ink-950 p-2.5 text-sm leading-khmer text-ink-100 outline-none focus:border-accent-cyan"
      />
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg bg-accent-cyan px-4 py-2 text-lg font-bold leading-none text-ink-950 hover:bg-accent-cyan/90"
        aria-label="Add"
      >
        +
      </button>
    </div>
  );
}

function ChipList({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11px] text-ink-100"
        >
          <span className="leading-khmer-tight">{item}</span>
          <button type="button" onClick={() => onRemove(i)} className="text-accent-rose">
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}

function CertUploader({
  busy,
  error,
  certs,
  note,
  onPick,
  onRemove,
}: {
  busy: boolean;
  error: string | null;
  certs: CertificateRef[];
  note: string;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-accent-gold/40 bg-accent-gold/5 p-3">
      <p className="text-[10.5px] leading-khmer-tight text-ink-200">🔒 {note}</p>
      {certs.map((c, i) => (
        <p key={c.id} className="flex items-center justify-between text-[11px] text-accent-emerald">
          <span>✓ {c.label} · បានការពារ</span>
          <button type="button" onClick={() => onRemove(i)} className="text-accent-rose">
            ✕
          </button>
        </p>
      ))}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        disabled={busy}
        onChange={onPick}
        className="text-[11px] text-ink-200 file:mr-2 file:rounded file:border-0 file:bg-ink-800 file:px-2 file:py-1 file:text-ink-100 disabled:opacity-50"
      />
      {busy && <p className="text-[11px] text-ink-200">កំពុងបង្ហោះ និងការពារ…</p>}
      {error && <p className="text-[11px] text-accent-rose">{error}</p>}
    </div>
  );
}
