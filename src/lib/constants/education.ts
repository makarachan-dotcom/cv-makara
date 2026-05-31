export const HIGH_SCHOOL_GRADES = [
  "ថ្នាក់ទី ៧",
  "ថ្នាក់ទី ៨",
  "ថ្នាក់ទី ៩",
  "ថ្នាក់ទី ១០",
  "ថ្នាក់ទី ១១",
  "ថ្នាក់ទី ១១ (BACII)",
  "ថ្នាក់ទី ១២",
] as const;

export type HighSchoolGrade = (typeof HIGH_SCHOOL_GRADES)[number];

export const UNIVERSITY_YEARS = [
  "ឆ្នាំទី ១",
  "ឆ្នាំទី ២",
  "ឆ្នាំទី ៣",
  "ឆ្នាំទី ៤",
  "ឆ្នាំទី ៥",
  "ឆ្នាំទី ៦",
  "ឆ្នាំទី ៧",
  "ឆ្នាំទី ៨",
] as const;

export type UniversityYear = (typeof UNIVERSITY_YEARS)[number];

export type EducationLevel = "high_school" | "university";

export function getGradeOptions(level: EducationLevel): readonly string[] {
  return level === "high_school" ? HIGH_SCHOOL_GRADES : UNIVERSITY_YEARS;
}