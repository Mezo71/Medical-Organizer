// testDictionary.ts — canonical keys, aliases, ranges, units,

type Range = { min: number; max: number; unit: string };

// ===== Canonical names (UPPERCASE, no spaces) =====
export const testDictionary: Record<string, string> = {
  // CBC Core
  HGB: "Hemoglobin",
  HEMOGLOBIN: "Hemoglobin",
  HCT: "Hematocrit (aka PCV)",
  RBC: "Red Blood Cell count",
  WBC: "White Blood Cell count",
  MCV: "Mean Corpuscular Volume",
  MCH: "Mean Corpuscular Hemoglobin",
  MCHC: "Mean Corpuscular Hemoglobin Concentration",
  RDWCV: "Red Cell Distribution Width (CV)",
  RDWSD: "Red Cell Distribution Width (SD)",
  PLT: "Platelet count",
  MPV: "Mean Platelet Volume",
  PDW: "Platelet Distribution Width",
  PCT: "Plateletcrit",

  // Differential WBC — Percentages
  NEUTROPHILS: "Neutrophils (%)",
  LYMPHOCYTES: "Lymphocytes (%)",
  MONOCYTES: "Monocytes (%)",
  EOSINOPHILS: "Eosinophils (%)",
  BASOPHILS: "Basophils (%)",

  // Differential WBC — Absolute
  NEUTROPHILSABS: "Neutrophils (Abs)",
  LYMPHOCYTESABS: "Lymphocytes (Abs)",
  MONOCYTESABS: "Monocytes (Abs)",
  EOSINOPHILSABS: "Eosinophils (Abs)",
  BASOPHILSABS: "Basophils (Abs)",

  // Common metabolic / others
  A1C: "HbA1c (3-month average glucose)",
  GLUCOSE: "Glucose (fasting)",
  TSH: "Thyroid Stimulating Hormone",
  CREATININE: "Serum Creatinine",
  CRP: "C-Reactive Protein",
  HDL: "HDL Cholesterol",
  LDL: "LDL Cholesterol",
};

// ===== Aliases (normalize OCR → canonical) =====
export const testAliases: Record<string, string> = {
  // Hemoglobin
  HB: "HGB",
  HEMOGLOBIN: "HGB",
  HEMOGLOBINHB: "HGB",
  HGBH: "HGB",

  // Hematocrit
  HEMATOCRIT: "HCT",
  PCV: "HCT",
  PACKEDCELLVOLUME: "HCT",

  // RBC
  RBCCOUNT: "RBC",
  TOTALRBC: "RBC",
  RBCC: "RBC",

  // WBC (incl. verbose lab lines)
  WBCCOUNT: "WBC",
  TOTALWBC: "WBC",
  TOTALCOUNTWBC: "WBC",
  TOTALCOUNTWBCEDTABLOOD: "WBC",
  TOTALCOUNT: "WBC", // if it appears near "(WBC)" the resolver below also catches it

  // RDW
  RDW: "RDWCV",
  "RDW-CV": "RDWCV",
  RDWCV: "RDWCV",
  "RDW-SD": "RDWSD",
  RDWSD: "RDWSD",

  // Platelets
  PLATELETCOUNT: "PLT",
  PLATELETS: "PLT",
  PLTCOUNT: "PLT",

  // Diff % aliases
  NEUT: "NEUTROPHILS",
  NEUTROPHIL: "NEUTROPHILS",
  LYMPH: "LYMPHOCYTES",
  LYMPHOCYTE: "LYMPHOCYTES",
  MONO: "MONOCYTES",
  MONOCYTE: "MONOCYTES",
  EOS: "EOSINOPHILS",
  EOSINOPHIL: "EOSINOPHILS",
  BASO: "BASOPHILS",
  BASOPHIL: "BASOPHILS",

  // Diff Abs aliases
  NEUTROPHILSABSOLUTE: "NEUTROPHILSABS",
  NEUTABS: "NEUTROPHILSABS",
  ABSNEUTROPHILS: "NEUTROPHILSABS",
  LYMPHOCYTESABSOLUTE: "LYMPHOCYTESABS",
  LYMPHABS: "LYMPHOCYTESABS",
  ABSLYMPHOCYTES: "LYMPHOCYTESABS",
  MONOCYTESABSOLUTE: "MONOCYTESABS",
  MONOABS: "MONOCYTESABS",
  ABSMONOCYTES: "MONOCYTESABS",
  EOSINOPHILSABSOLUTE: "EOSINOPHILSABS",
  EOSABS: "EOSINOPHILSABS",
  ABSEOSINOPHILS: "EOSINOPHILSABS",
  BASOPHILSABSOLUTE: "BASOPHILSABS",
  BASOABS: "BASOPHILSABS",
  ABSBASOPHILS: "BASOPHILSABS",
};

// ===== Key resolver =====
export function resolveKey(rawName: string): string | null {
  if (!rawName) return null;
  const k = rawName.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // direct hits
  if (testDictionary[k]) return k;
  if (testAliases[k]) return testAliases[k];

  // contains-based fallback (for verbose lab labels like "TOTAL COUNT (WBC), EDTA blood")
  for (const key of Object.keys(testDictionary)) {
    if (k.includes(key)) return key;
  }
  for (const [alias, canonical] of Object.entries(testAliases)) {
    if (k.includes(alias)) return canonical;
  }

  // special: "TOTALCOUNT" appearing next to "(WBC)"
  if (/\bWBC\b/i.test(rawName) && /TOTAL/i.test(rawName)) return "WBC";

  return null;
}

// ===== Units (canonical target units for display) =====
export const getUnit = (label: string): string => {
  const u = resolveKey(label) ?? label.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Percent-type
  if (["NEUTROPHILS","HEMOGLOBIN", "LYMPHOCYTES", "MONOCYTES", "EOSINOPHILS", "BASOPHILS", "HCT", "RDWCV", "PCT", "PDW"].includes(u))
    return "%";

  // g/dL
  if (u === "HGB" || u === "MCHC") return "g/dL";
  if (u ==="HEMOGLOBIN") return "g/dL";
  // fL / pg
  if (u === "MCV") return "fL";
  if (u === "MCH") return "pg";
  if (u === "RDWSD" || u === "MPV") return "fL";

  // counts (canonicalize to x10^9/L)
  if (u === "WBC" || u === "PLT" || u.endsWith("ABS")) return "x10^9/L";

  // metabolic
  if (u === "A1C") return "%";
  if (u === "GLUCOSE") return "mg/dL";
  if (u === "TSH") return "mIU/L";
  if (u === "CREATININE") return "mg/dL";
  if (u === "CRP") return "mg/L";
  if (u === "HDL" || u === "LDL") return "mg/dL";

  return "";
};

// ===== Input unit normalization & safe conversion =====

// شائعة في التقارير: million/cmm ، 10^3/µL ، 10^9/L ، g/dL ، fL ، pg ، % ...
const unitCanonicalMap: Record<string, string> = {
  "%": "%",
  "PERCENT": "%",

  "G/DL": "g/dL",
  "G DL": "g/dL",
  "GPERDL": "g/dL",
  "GPDL": "g/dL",
  "GDL": "g/dL",

  "FL": "fL",
  "F L": "fL",

  "PG": "pg",

  // counts
  "X10^9/L": "x10^9/L",
  "10^9/L": "x10^9/L",
  "X10^3/UL": "x10^9/L",   // numerically identical scale when value is given in thousands/µL
  "10^3/UL": "x10^9/L",
  "K/UL": "x10^9/L",

  // RBC specific legacy
  "MILLION/CMM": "x10^12/L", // numerically identical to millions/µL
  "M/UL": "x10^12/L",
};

function normalizeRawUnit(rawUnit?: string): string | null {
  if (!rawUnit) return null;
  const u = rawUnit.toUpperCase().replace(/[^A-Z0-9^/]/g, "");
  return unitCanonicalMap[u] ?? null;
}

/**
 * يحوّل قيمة بوحدةٍ مُدخلة (من التقرير) إلى الوحدة المعيارية التي نعرضها.
 * ملاحظة: في معظم عدّادات الدم، المقاييس شائعة تكون مكافئة عدديًا:
 *  - WBC/PLT: 10^3/µL ↔ 10^9/L  (القيمة نفسها)
 *  - RBC: million/µL ↔ 10^12/L   (القيمة نفسها)
 */
export function convertToCanonical(
  testName: string,
  value: number,
  rawUnit?: string
): { value: number; unit: string } {
  const key = resolveKey(testName) ?? testName.toUpperCase();
  const targetUnit = getUnit(key);
  const given = normalizeRawUnit(rawUnit);

  if (!given || !targetUnit || !isFinite(value)) {
    return { value, unit: targetUnit || (rawUnit ?? "") };
  }

  // قواعد بسيطة: المقاييس المذكورة أعلاه متكافئة عدديًا
  if (key === "WBC" || key === "PLT" || key.endsWith("ABS")) {
    // treat 10^3/µL and 10^9/L as same numeric scale
    return { value, unit: "x10^9/L" };
  }
  if (key === "RBC") {
    // treat million/µL and 10^12/L as same numeric scale
    return { value, unit: "x10^12/L" };
  }

  // بالنسبة لباقي الاختبارات: إن كانت الوحدة المدخلة تساوي الهدف، نُعيدها كما هي
  if (given === targetUnit) return { value, unit: targetUnit };

  // لا تحويلات إضافية مطلوبة الآن
  return { value, unit: targetUnit };
}

// ===== Ranges (simple adult references) =====
export const testRanges: Record<string, Range> = {
  HGB:   { min: 12.0, max: 17.5, unit: "g/dL" },
  Hemoglobin:   { min: 12.0, max: 17.5, unit: "g/dL" },
  HCT:   { min: 36.0, max: 50.0, unit: "%"  },
  RBC:   { min: 4.2,  max: 6.1,  unit: "x10^12/L" },
  WBC:   { min: 4.0,  max: 11.0, unit: "x10^9/L"  },
  MCV:   { min: 80,   max: 100,  unit: "fL" },
  MCH:   { min: 27,   max: 33,   unit: "pg" },
  MCHC:  { min: 32,   max: 36,   unit: "g/dL" },
  RDWCV: { min: 11,   max: 16,   unit: "%"  },
  RDWSD: { min: 35,   max: 56,   unit: "fL" },
  PLT:   { min: 150,  max: 450,  unit: "x10^9/L" },
  MPV:   { min: 6.5,  max: 12.0, unit: "fL" },
  PDW:   { min: 25.0, max: 65.0, unit: "%"  },
  PCT:   { min: 0.108,max: 0.282,unit: "%"  },

  NEUTROPHILS:  { min: 38, max: 70, unit: "%" },
  LYMPHOCYTES:  { min: 20, max: 45, unit: "%" },
  MONOCYTES:    { min: 2,  max: 8,  unit: "%" },
  EOSINOPHILS:  { min: 1,  max: 4,  unit: "%" },
  BASOPHILS:    { min: 0,  max: 1,  unit: "%" },

  NEUTROPHILSABS: { min: 1.5, max: 7.0, unit: "x10^9/L" },
  LYMPHOCYTESABS: { min: 1.0, max: 3.0, unit: "x10^9/L" },
  MONOCYTESABS:   { min: 0.2, max: 0.8, unit: "x10^9/L" },
  EOSINOPHILSABS: { min: 0.0, max: 0.5, unit: "x10^9/L" },
  BASOPHILSABS:   { min: 0.0, max: 0.1, unit: "x10^9/L" },

  A1C:        { min: 4.0, max: 5.6, unit: "%" },
  GLUCOSE:    { min: 70,  max: 99,  unit: "mg/dL" },
  TSH:        { min: 0.4, max: 4.0, unit: "mIU/L" },
  CREATININE: { min: 0.59, max: 1.35, unit: "mg/dL" },
  CRP:        { min: 0,   max: 10,  unit: "mg/L"   },
  HDL:        { min: 40,  max: 59,  unit: "mg/dL"  },
  LDL:        { min: 0,   max: 129, unit: "mg/dL"  },
};

// ===== Status with Borderline =====
export type RangeStatus =
  | "Low"
  | "Borderline Low"
  | "Normal"
  | "Borderline High"
  | "High"
  | "Unknown";

export function getRangeStatus(
  testName: string,
  numericValue: number,
  opts?: { borderlinePct?: number }
): RangeStatus {
  if (!isFinite(numericValue)) return "Unknown";
  const key = resolveKey(testName) ?? testName.toUpperCase();
  const r = testRanges[key];
  if (!r) return "Unknown";

  const { min, max } = r;
  if (numericValue < min) return "Low";
  if (numericValue > max) return "High";

  const pct = Math.max(0, opts?.borderlinePct ?? 5); // default 5%
  const band = (max - min) * (pct / 100);

  if (numericValue <= min + band) return "Borderline Low";
  if (numericValue >= max - band) return "Borderline High";
  return "Normal";
}

// ===== Decimal-fix helper (for OCR) =====
export function fitToRangeMagnitude(testName: string, rawValue: number): number {
  if (!isFinite(rawValue)) return rawValue;
  const key = resolveKey(testName);
  if (!key) return rawValue;
  const r = testRanges[key];
  if (!r) return rawValue;

  const { min, max } = r;
  const candidates = [rawValue, rawValue / 10, rawValue / 100, rawValue / 1000, rawValue * 10];
  const mid = (min + max) / 2;

  const inRange = candidates
    .filter(v => isFinite(v) && v >= min && v <= max)
    .sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  if (inRange.length) return inRange[0];

  const byDistance = candidates
    .map(v => ({ v, d: v < min ? (min - v) : v > max ? (v - max) : 0 }))
    .sort((a, b) => a.d - b.d);
  return byDistance[0]?.v ?? rawValue;
}

// ===== CENTRALIZED notes =====
const specificNotes: Record<string, Partial<Record<RangeStatus, string>>> = {
  RDWCV: {
    High: "High RDW may indicate mixed anemia — check MCV and MCH.",
    "Borderline High": "RDW near upper limit — review with MCV/MCH.",
  },
  RDWSD: {
    High: "High RDW-SD may suggest anisocytosis — correlate clinically.",
    "Borderline High": "RDW-SD near upper limit — correlate with RDW-CV.",
  },
  WBC: {
    High: "High WBC may indicate infection/inflammation — evaluate clinically.",
    Low: "Low WBC — repeat and review medications/symptoms if persistent.",
  },
  RBC: {
    Low: "Low RBC — consider iron/B12 workup if symptoms are present.",
    "Borderline Low": "RBC near lower limit — monitor and correlate with HGB/HCT.",
  },
  A1C: {
    High: "A1C is high — discuss the plan with your doctor and repeat in ~3 months.",
    "Borderline High": "A1C near upper limit — lifestyle review and follow-up.",
  },
};

// ملاحظات عامة
const genericNotes: Partial<Record<RangeStatus, string>> = {
  High: "The result is above the normal range — follow up with your doctor.",
  "Borderline High": "The result is close to the upper limit — consider retesting and monitoring.",
  Low: "The result is below the normal range — follow up with your doctor.",
  "Borderline Low": "The result is close to the lower limit — monitor symptoms and retest.",
  Unknown: "No reference range is currently available for this test.",
};

// دالة واحدة تُستخدم لإحضار الملاحظة
export function getNote(testName: string, status: RangeStatus): string | null {
  if (status === "Normal") return null;
  const key = resolveKey(testName) ?? testName.toUpperCase();
  const fromSpecific = specificNotes[key]?.[status];
  if (fromSpecific) return fromSpecific;
  return genericNotes[status] ?? null;
}
