import type { MakaraCvDraft } from "@/lib/cv-draft";
import type { AnswerMap, IndustryMeta } from "@/lib/interview/engine";

// =============================================================================
// Optional LLM enrichment layer.
// -----------------------------------------------------------------------------
// When an OpenAI-compatible endpoint is configured via env, we ask the model to
// rewrite the Khmer professional summary into sharper, recruiter-grade prose.
// Everything is best-effort: any missing config, network error, or malformed
// response falls back silently to the deterministic rule-based draft. This
// keeps the build + runtime fully functional with zero external dependencies.
//
//   INTERVIEW_LLM_API_KEY   — bearer token (OpenAI / NVIDIA NIM / Together / …)
//   INTERVIEW_LLM_BASE_URL  — defaults to https://api.openai.com/v1
//   INTERVIEW_LLM_MODEL     — defaults to gpt-4o-mini
// =============================================================================

interface ChatChoice {
  message?: { content?: string };
}
interface ChatResponse {
  choices?: ChatChoice[];
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.INTERVIEW_LLM_API_KEY);
}

export async function enrichSummary(
  draft: MakaraCvDraft,
  industry: IndustryMeta,
  answers: AnswerMap,
): Promise<string | null> {
  const apiKey = process.env.INTERVIEW_LLM_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.INTERVIEW_LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.INTERVIEW_LLM_MODEL ?? "gpt-4o-mini";

  const facts = Object.entries(answers)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `- ${k}: ${v.trim()}`)
    .join("\n");

  const system =
    "អ្នកគឺជាអ្នកជំនាញសរសេរ CV កម្រិតពិភពលោក។ សរសេរសេចក្តីសង្ខេបវិជ្ជាជីវៈ " +
    "(professional summary) ជា 'ភាសាខ្មែរ' តែប៉ុណ្ណោះ ប្រវែង ២-៣ ប្រយោគ ដែលមាន " +
    "ភាពវិជ្ជាជីវៈ ច្បាស់លាស់ និងបញ្ចូលលេខ/សមិទ្ធផល។ កុំសរសេរអ្វីក្រៅពីសេចក្តីសង្ខេប។";
  const user =
    `វិស័យ: ${industry.label}\nតួនាទីគោលដៅ: ${draft.headline}\n` +
    `ព័ត៌មានពីការសម្ភាសន៍:\n${facts}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 320,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as ChatResponse;
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
