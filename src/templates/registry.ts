/**
 * Static template registry. 2 entries are FREE (always usable), 18 are LOCKED
 * (require a completed 7-day consecutive check-in streak before "Deploy to
 * Web" is enabled). Locked templates still render their 3D scene in full so
 * users can inspect them — only the deploy action is gated.
 */

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category:
    | "voxel"
    | "cyberpunk"
    | "gallery"
    | "nodemesh"
    | "terminal"
    | "particle"
    | "architecture"
    | "minimal"
    | "data"
    | "abstract";
  access: "free" | "locked";
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
  tags: ReadonlyArray<string>;
}

export const TEMPLATES: ReadonlyArray<TemplateMeta> = [
  // ------------------------------------------------------------- FREE (2)
  {
    id: "voxel-office",
    name: "Voxel Office",
    description: "Isometric voxel workspace with floating cards for each experience entry.",
    category: "voxel",
    access: "free",
    preview: { primary: "#22d3ee", secondary: "#8b5cf6", accent: "#facc15" },
    tags: ["isometric", "voxel", "playful"],
  },
  {
    id: "minimalist-gallery",
    name: "Minimalist Interactive Gallery",
    description: "White-room gallery with framed achievement panels and soft directional light.",
    category: "minimal",
    access: "free",
    preview: { primary: "#e5e7eb", secondary: "#9ca3af", accent: "#111827" },
    tags: ["minimal", "gallery", "professional"],
  },
  // ----------------------------------------------------------- LOCKED (18)
  {
    id: "cyberpunk-terminal",
    name: "Cyber-Cyberpunk Terminal",
    description: "Neon-soaked CRT terminal floating in volumetric fog with scanlines.",
    category: "cyberpunk",
    access: "locked",
    preview: { primary: "#22d3ee", secondary: "#f472b6", accent: "#facc15" },
    tags: ["neon", "terminal", "scanline"],
  },
  {
    id: "floating-node-mesh",
    name: "Floating 3D Node Mesh",
    description: "Force-directed skill graph of glowing nodes connected by animated edges.",
    category: "nodemesh",
    access: "locked",
    preview: { primary: "#a78bfa", secondary: "#34d399", accent: "#22d3ee" },
    tags: ["graph", "skills", "interactive"],
  },
  {
    id: "particle-portfolio",
    name: "Particle Portfolio",
    description: "Tens of thousands of GPU particles assemble into your portfolio links.",
    category: "particle",
    access: "locked",
    preview: { primary: "#fb7185", secondary: "#22d3ee", accent: "#facc15" },
    tags: ["particles", "gpu", "animated"],
  },
  {
    id: "arch-blueprint",
    name: "Architectural Blueprint",
    description: "Wireframe blueprint of your projects rendered as if printed on graph paper.",
    category: "architecture",
    access: "locked",
    preview: { primary: "#60a5fa", secondary: "#1e3a8a", accent: "#facc15" },
    tags: ["wireframe", "blueprint", "technical"],
  },
  {
    id: "data-observatory",
    name: "Data Observatory",
    description: "Skill-by-domain 3D bar chart orbiting around a central pedestal of your bio.",
    category: "data",
    access: "locked",
    preview: { primary: "#34d399", secondary: "#facc15", accent: "#f472b6" },
    tags: ["data", "chart", "skills"],
  },
  {
    id: "holographic-shelf",
    name: "Holographic Shelf",
    description: "Floating shelf of glassy cards. Each card is a project, rotated by orbit controls.",
    category: "gallery",
    access: "locked",
    preview: { primary: "#67e8f9", secondary: "#c084fc", accent: "#ffffff" },
    tags: ["glass", "hologram", "shelf"],
  },
  {
    id: "neon-grid-runner",
    name: "Neon Grid Runner",
    description: "Synthwave grid extending to the horizon with your name floating in chrome.",
    category: "cyberpunk",
    access: "locked",
    preview: { primary: "#f472b6", secondary: "#22d3ee", accent: "#facc15" },
    tags: ["synthwave", "grid", "chrome"],
  },
  {
    id: "constellation-bio",
    name: "Constellation Bio",
    description: "Skill nodes arranged as constellations against a deep-space backdrop.",
    category: "abstract",
    access: "locked",
    preview: { primary: "#fde68a", secondary: "#312e81", accent: "#22d3ee" },
    tags: ["space", "stars", "abstract"],
  },
  {
    id: "kintsugi-portfolio",
    name: "Kintsugi Portfolio",
    description: "Cracked ceramic plates mended with gold seams — one plate per project.",
    category: "abstract",
    access: "locked",
    preview: { primary: "#fde68a", secondary: "#451a03", accent: "#dc2626" },
    tags: ["ceramic", "gold", "minimal"],
  },
  {
    id: "monolith-cv",
    name: "Monolith CV",
    description: "Towering obsidian monolith etched with your achievements; revolves slowly.",
    category: "minimal",
    access: "locked",
    preview: { primary: "#1f2937", secondary: "#9ca3af", accent: "#f3f4f6" },
    tags: ["monolith", "stone", "elegant"],
  },
  {
    id: "neural-lab",
    name: "Neural Lab",
    description: "Layered MLP visualisation where neurons fire as you scroll your experience.",
    category: "data",
    access: "locked",
    preview: { primary: "#8b5cf6", secondary: "#22d3ee", accent: "#facc15" },
    tags: ["ml", "neurons", "interactive"],
  },
  {
    id: "atrium-gallery",
    name: "Atrium Gallery",
    description: "Tall daylight atrium with floor-to-ceiling project banners.",
    category: "gallery",
    access: "locked",
    preview: { primary: "#fef3c7", secondary: "#92400e", accent: "#1f2937"},
    tags: ["architectural", "warm", "spacious"],
  },
  {
    id: "lowpoly-isle",
    name: "Low-poly Isle",
    description: "Floating low-poly island. Each landmark is a skill domain.",
    category: "voxel",
    access: "locked",
    preview: { primary: "#34d399", secondary: "#60a5fa", accent: "#facc15" },
    tags: ["lowpoly", "island", "playful"],
  },
  {
    id: "fractal-bio",
    name: "Fractal Bio",
    description: "Recursive fractal tree where each branch unfolds into an experience bullet.",
    category: "abstract",
    access: "locked",
    preview: { primary: "#c084fc", secondary: "#f472b6", accent: "#fef3c7" },
    tags: ["fractal", "branch", "recursive"],
  },
  {
    id: "cathedral-cv",
    name: "Cathedral CV",
    description: "Gothic cathedral interior with stained-glass windows depicting each role.",
    category: "architecture",
    access: "locked",
    preview: { primary: "#7c3aed", secondary: "#f59e0b", accent: "#1e293b" },
    tags: ["gothic", "ornate", "narrative"],
  },
  {
    id: "synthcity-skyline",
    name: "Synthcity Skyline",
    description: "Animated cityscape skyline; building heights map to skill proficiency.",
    category: "cyberpunk",
    access: "locked",
    preview: { primary: "#22d3ee", secondary: "#f472b6", accent: "#fde68a" },
    tags: ["city", "neon", "dynamic"],
  },
  {
    id: "ribbon-of-time",
    name: "Ribbon of Time",
    description: "Spiraling Möbius ribbon engraved with your timeline of roles.",
    category: "abstract",
    access: "locked",
    preview: { primary: "#22d3ee", secondary: "#a78bfa", accent: "#ffffff" },
    tags: ["timeline", "ribbon", "elegant"],
  },
  {
    id: "kanban-cube",
    name: "Kanban Cube",
    description: "Rotating cube whose faces are kanban boards of your shipped projects.",
    category: "minimal",
    access: "locked",
    preview: { primary: "#60a5fa", secondary: "#34d399", accent: "#f472b6" },
    tags: ["kanban", "cube", "shipping"],
  },
] as const;

if (TEMPLATES.filter((t) => t.access === "free").length !== 2) {
  throw new Error("Template registry invariant: must have exactly 2 free templates");
}
if (TEMPLATES.filter((t) => t.access === "locked").length !== 18) {
  throw new Error("Template registry invariant: must have exactly 18 locked templates");
}

export const FREE_TEMPLATE_IDS: ReadonlyArray<string> = TEMPLATES
  .filter((t) => t.access === "free")
  .map((t) => t.id);

export const LOCKED_TEMPLATE_IDS: ReadonlyArray<string> = TEMPLATES
  .filter((t) => t.access === "locked")
  .map((t) => t.id);

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function isLocked(id: string): boolean {
  const t = getTemplate(id);
  return !!t && t.access === "locked";
}
