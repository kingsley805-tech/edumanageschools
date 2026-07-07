/**
 * Generates public/sql/apply-waec-questions-bank.sql
 * Run: node scripts/generate-waec-question-bank.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const WAEC_EXAM_YEARS = Array.from({ length: 16 }, (_, i) => 2010 + i);

const BECE_SUBJECTS = [
  "Mathematics", "English Language", "Integrated Science", "Social Studies",
  "Religious and Moral Education", "ICT", "Basic Design and Technology",
  "French", "Ghanaian Language", "Creative Arts", "Career Technology",
];

const WASSCE_SUBJECTS = [
  "English Language", "Core Mathematics", "Integrated Science", "Social Studies",
  "Literature in English", "Government", "History", "Geography", "Economics",
  "Christian Religious Studies", "Islamic Religious Studies",
  "Biology", "Chemistry", "Physics", "Elective Mathematics", "ICT",
  "Accounting", "Business Management", "Cost Accounting",
  "General Agriculture", "Crop Husbandry", "Animal Husbandry", "Fisheries",
  "Graphic Design", "Ceramics", "Textiles", "Sculpture", "Picture Making",
  "Technical Drawing", "Building Construction", "Electronics", "Metalwork", "Woodwork",
];

// Inline minimal templates (mirrors questionTemplates.ts for Node script)
function mcq(topic, difficulty, question, options, correctIndex, explanation) {
  const ids = ["A", "B", "C", "D"];
  return {
    topic, difficulty, question_text: question,
    options: ids.map((id, i) => ({ id, text: options[i] })),
    correct_answer: ids[correctIndex],
    explanation,
  };
}

const SUBJECT_TEMPLATES = {
  Mathematics: [
    mcq("Arithmetic", "easy", "What is 12 + 15?", ["17", "25", "27", "30"], 2, "12 + 15 = 27"),
    mcq("Arithmetic", "easy", "What is 9 × 7?", ["56", "63", "72", "81"], 1, "9 × 7 = 63"),
    mcq("Fractions", "medium", "Simplify 8/12", ["1/3", "2/3", "3/4", "4/6"], 1, "Divide by 4: 2/3"),
    mcq("Algebra", "medium", "If 3x = 18, find x", ["3", "6", "9", "15"], 1, "x = 6"),
    mcq("Geometry", "easy", "Degrees in a right angle?", ["45°", "90°", "180°", "360°"], 1, "90°"),
    mcq("Statistics", "medium", "Average of 4, 6, 8?", ["5", "6", "7", "18"], 1, "Mean = 6"),
    mcq("Percentage", "easy", "1/4 as percentage?", ["20%", "25%", "40%", "50%"], 1, "25%"),
    mcq("Ratio", "medium", "GH₵60 in ratio 2:3, larger share?", ["24", "30", "36", "40"], 2, "36"),
    mcq("Mensuration", "hard", "Volume of cube side 3 cm?", ["9", "18", "27", "36"], 2, "27 cm³"),
    mcq("Probability", "medium", "P(even) on a die?", ["1/6", "1/3", "1/2", "2/3"], 2, "3/6 = 1/2"),
    mcq("Sets", "medium", "A={1,2,3}, B={2,3,4}, A∩B?", ["{1}", "{2,3}", "{4}", "{1,2,3,4}"], 1, "{2,3}"),
    mcq("Number Bases", "hard", "1010₂ in base ten?", ["8", "10", "12", "14"], 1, "10"),
    mcq("Decimals", "medium", "0.35 as fraction?", ["7/20", "35/100", "3/5", "7/10"], 0, "7/20"),
    mcq("Algebra", "hard", "Expand (x+2)(x+3)?", ["x²+5x+6", "x²+6x+5", "x²+5x+5", "2x+5"], 0, "x²+5x+6"),
    mcq("Geometry", "medium", "Area of 8×5 rectangle?", ["13", "26", "40", "80"], 2, "40 cm²"),
  ],
  "Core Mathematics": [
    mcq("Indices", "medium", "Simplify 5² × 5³", ["5⁵", "5⁶", "25⁵", "25⁶"], 0, "5⁵"),
    mcq("Quadratic", "hard", "Solve x² − 9 = 0", ["±3", "3 only", "−3 only", "9"], 0, "x = ±3"),
    mcq("Trigonometry", "medium", "sin 30°?", ["1/2", "√3/2", "1", "0"], 0, "1/2"),
    mcq("Statistics", "easy", "Mode of 2,3,3,5,7?", ["2", "3", "5", "7"], 1, "3"),
    mcq("Sequences", "medium", "2,4,8,16, next?", ["20", "24", "32", "64"], 2, "32"),
    mcq("Coordinate", "medium", "Gradient (0,0) to (2,4)?", ["1", "2", "3", "4"], 1, "2"),
    mcq("Logarithms", "hard", "log₁₀ 100?", ["1", "2", "10", "100"], 1, "2"),
    mcq("Simultaneous", "medium", "x+y=10, x−y=2, x?", ["4", "6", "8", "12"], 1, "6"),
    mcq("Surds", "medium", "Simplify √50", ["5√2", "2√5", "25", "10√5"], 0, "5√2"),
    mcq("Matrices", "medium", "2×3 matrix order?", ["2×3", "3×2", "6×1", "1×6"], 0, "2×3"),
    mcq("Calculus", "hard", "d/dx(x³)?", ["3x", "3x²", "x²", "x³/3"], 1, "3x²"),
    mcq("Variation", "hard", "y∝1/x, x=4,y=6, y when x=8?", ["3", "6", "12", "48"], 0, "3"),
    mcq("Circle", "medium", "Angle in semicircle?", ["45°", "60°", "90°", "180°"], 2, "90°"),
    mcq("Vectors", "hard", "|(3,4)|?", ["5", "7", "12", "25"], 0, "5"),
    mcq("Interest", "easy", "SI on 1000 at 10% for 2y?", ["100", "200", "300", "1200"], 1, "200"),
  ],
  "English Language": [
    mcq("Grammar", "easy", "She ___ to school", ["go", "goes", "going", "gone"], 1, "goes"),
    mcq("Vocabulary", "medium", "Benevolent means", ["cruel", "kind", "lazy", "proud"], 1, "kind"),
    mcq("Spelling", "easy", "Correct:", ["accomodate", "accommodate", "acommodate", "accomadate"], 1, "accommodate"),
    mcq("Punctuation", "medium", "Correct:", ["Its raining.", "It's raining.", "Its' raining.", "It raining."], 1, "It's"),
    mcq("Synonyms", "easy", "Rapid ≈", ["slow", "quick", "heavy", "calm"], 1, "quick"),
    mcq("Literature", "medium", "14-line poem?", ["ode", "sonnet", "ballad", "epic"], 1, "sonnet"),
    mcq("Antonyms", "medium", "Opposite of ancient?", ["old", "modern", "historic", "aged"], 1, "modern"),
    mcq("Idioms", "medium", "Break the ice means", ["freeze", "start talk", "break glass", "end party"], 1, "start conversation"),
    mcq("Parts of Speech", "easy", "Quickly is a/an", ["noun", "verb", "adverb", "adjective"], 2, "adverb"),
    mcq("Figurative", "hard", "Classroom was a zoo —", ["simile", "metaphor", "personification", "hyperbole"], 1, "metaphor"),
    mcq("Comprehension", "easy", "Main idea often in", ["footnotes", "intro/conclusion", "index", "appendix"], 1, "intro/conclusion"),
    mcq("Essay", "medium", "Formal letter ends", ["Hi", "Yours faithfully", "See ya", "Bye"], 1, "Yours faithfully"),
    mcq("Phonetics", "medium", "Vowel letters count?", ["5", "6", "21", "26"], 0, "5"),
    mcq("Summary", "medium", "Summarising means", ["copy all", "own words concise", "add facts", "ignore title"], 1, "own words"),
    mcq("Grammar", "medium", "Plural of child?", ["childs", "childes", "children", "childrens"], 2, "children"),
  ],
  "Integrated Science": [
    mcq("Biology", "easy", "Basic unit of life?", ["tissue", "cell", "organ", "organism"], 1, "cell"),
    mcq("Biology", "medium", "Photosynthesis in?", ["roots", "stem", "leaves", "flowers"], 2, "leaves"),
    mcq("Chemistry", "easy", "Water formula?", ["HO", "H₂O", "OH₂", "H₂O₂"], 1, "H₂O"),
    mcq("Physics", "easy", "SI unit of force?", ["joule", "newton", "watt", "pascal"], 1, "newton"),
    mcq("Physics", "medium", "Speed = distance ÷ ?", ["time", "mass", "force", "volume"], 0, "time"),
    mcq("Ecology", "medium", "Food makers are", ["consumers", "producers", "decomposers", "parasites"], 1, "producers"),
    mcq("Human Body", "easy", "Blood pump organ?", ["lung", "liver", "heart", "kidney"], 2, "heart"),
    mcq("Chemistry", "medium", "pH 7 is", ["acidic", "neutral", "alkaline", "salt"], 1, "neutral"),
    mcq("Electricity", "hard", "Ohm's law V =", ["IR", "I/R", "R/I", "I+R"], 0, "IR"),
    mcq("Matter", "easy", "Fixed volume, no fixed shape?", ["solid", "liquid", "gas", "plasma"], 1, "liquid"),
    mcq("Acids", "medium", "Litmus red in", ["acid", "base", "salt", "water"], 0, "acid"),
    mcq("Genetics", "hard", "Human chromosome pairs?", ["23", "46", "48", "92"], 0, "23 pairs"),
    mcq("Energy", "medium", "Conservation of", ["momentum", "energy", "mass only", "charge only"], 1, "energy"),
    mcq("Environment", "easy", "Tree cutting without replanting?", ["afforestation", "deforestation", "irrigation", "conservation"], 1, "deforestation"),
    mcq("Reproduction", "medium", "Plant fertilisation in", ["petal", "stigma", "ovary", "style"], 2, "ovary"),
  ],
  "Social Studies": [
    mcq("History", "easy", "Ghana independence year?", ["1957", "1960", "1966", "1992"], 0, "1957"),
    mcq("Geography", "easy", "Capital of Ghana?", ["Kumasi", "Accra", "Tamale", "Cape Coast"], 1, "Accra"),
    mcq("Government", "medium", "Ghana is a", ["monarchy", "republic", "empire", "colony"], 1, "republic"),
    mcq("Economics", "medium", "Scarcity means", ["unlimited resources", "limited resources vs wants", "no wants", "free only"], 1, "limited resources"),
    mcq("History", "medium", "First President?", ["Danquah", "Nkrumah", "Busia", "Rawlings"], 1, "Nkrumah"),
    mcq("Culture", "easy", "Adinkra from?", ["Ewe", "Akan", "Ga", "Dagomba"], 1, "Akan"),
    mcq("Rights", "medium", "Right to vote =", ["suffrage", "marriage", "asylum", "bail"], 0, "suffrage"),
    mcq("Environment", "medium", "Global warming from", ["oxygen", "GHG", "nitrogen", "helium"], 1, "GHG"),
    mcq("ECOWAS", "medium", "ECOWAS means", ["Economic Community of West African States", "East Africa Council", "European West Africa", "Economic World Africa"], 0, "ECOWAS"),
    mcq("Resources", "easy", "Major Ghana export crop?", ["rice", "cocoa", "wheat", "tea"], 1, "cocoa"),
    mcq("Democracy", "medium", "Elections should be", ["rigged", "free and fair", "secret only", "elite only"], 1, "free and fair"),
    mcq("Map", "easy", "Equal rainfall lines?", ["isobars", "isohyets", "contours", "latitudes"], 1, "isohyets"),
    mcq("Population", "medium", "High birth, low death →", ["decline", "growth", "zero", "migration only"], 1, "growth"),
    mcq("Law", "hard", "No one above the law?", ["equality before law", "leaders exempt", "judges exempt", "police exempt"], 0, "equality"),
    mcq("Conflict", "medium", "Peaceful dispute resolution?", ["war", "dialogue", "invasion", "sanction only"], 1, "dialogue"),
  ],
};

const GENERIC = [
  mcq("Fundamentals", "easy", "Key concept in this subject?", ["A", "B", "C", "D"], 1, "Review syllabus."),
  mcq("Application", "medium", "Apply the main principle", ["1", "2", "3", "4"], 2, "Standard method."),
  mcq("Analysis", "medium", "Correct syllabus statement?", ["A", "B", "C", "D"], 0, "Check notes."),
  mcq("Evaluation", "hard", "Best explanation?", ["A", "B", "C", "D"], 3, "Compare options."),
  mcq("Recall", "easy", "Correct definition?", ["A", "B", "C", "D"], 1, "Textbook."),
  mcq("Problem Solving", "hard", "Solve using formula", ["A", "B", "C", "D"], 2, "Show working."),
  mcq("Interpretation", "medium", "Interpret data correctly", ["A", "B", "C", "D"], 1, "Read units."),
  mcq("Comparison", "medium", "Correctly matched pair?", ["A", "B", "C", "D"], 0, "Eliminate."),
  mcq("Synthesis", "hard", "Correct conclusion?", ["A", "B", "C", "D"], 2, "Link topics."),
  mcq("Review", "easy", "WAEC objectives test", ["memory only", "understanding", "guess", "irrelevant"], 1, "understanding"),
  mcq("Technique", "medium", "When unsure", ["leave blank", "eliminate first", "random", "stop"], 1, "eliminate"),
  mcq("Time", "easy", "Timed paper: allocate time?", ["one question", "per section", "skip instructions", "ignore clock"], 1, "per section"),
  mcq("Practice", "medium", "Past questions help", ["never", "build familiarity", "replace study", "waste time"], 1, "familiarity"),
  mcq("Revision", "easy", "Weak topics need", ["ignore", "more practice", "less study", "skip exam"], 1, "more practice"),
  mcq("Exam", "medium", "Read questions", ["quickly only", "carefully twice", "never", "after submit"], 1, "carefully"),
];

function getTemplates(name) {
  return SUBJECT_TEMPLATES[name] ?? GENERIC;
}

function rotateCorrect(t, year, i) {
  const shift = (year + i) % 4;
  if (shift === 0) return t;
  const opts = [...t.options];
  const ci = opts.findIndex((o) => o.id === t.correct_answer);
  const nci = (ci + shift) % 4;
  const rotated = opts.map((_, j) => opts[(j - shift + 4) % 4]);
  const ids = ["A", "B", "C", "D"];
  return {
    ...t,
    options: rotated.map((o, j) => ({ ...o, id: ids[j] })),
    correct_answer: ids[nci],
  };
}

function esc(s) {
  return s.replace(/'/g, "''");
}

function buildQuestions(subjectName, year, count = 15) {
  const templates = getTemplates(subjectName);
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = rotateCorrect(templates[i % templates.length], year, i);
    const qText = t.question_text.includes(String(year))
      ? t.question_text
      : t.question_text.replace(/\?$/, ` (${year})?`);
    out.push({ ...t, question_text: qText });
  }
  return out;
}

const lines = [];
lines.push("-- WAEC Question Bank: all BECE & WASSCE subjects × years 2010–2025");
lines.push("-- Generated by scripts/generate-waec-question-bank.mjs");
lines.push("-- Run after apply-waec-platform.sql");
lines.push("");
lines.push("CREATE TABLE IF NOT EXISTS public.waec_exam_years (");
lines.push("  level text NOT NULL CHECK (level IN ('bece', 'wassce')),");
lines.push("  year int NOT NULL,");
lines.push("  is_active boolean NOT NULL DEFAULT true,");
lines.push("  PRIMARY KEY (level, year)");
lines.push(");");
lines.push("");
lines.push("INSERT INTO public.waec_exam_years (level, year) VALUES");

const yearRows = [];
for (const level of ["bece", "wassce"]) {
  for (const year of WAEC_EXAM_YEARS) {
    yearRows.push(`  ('${level}', ${year})`);
  }
}
lines.push(yearRows.join(",\n"));
lines.push("ON CONFLICT (level, year) DO NOTHING;");
lines.push("");

lines.push("DO $$");
lines.push("DECLARE");
lines.push("  v_subject_id uuid;");
lines.push("  v_subject_name text;");
lines.push("  v_level text;");
lines.push("  v_year int;");
lines.push("  v_q record;");
lines.push("  v_num int;");
lines.push("BEGIN");

function subjectLoop(level, subjects, questionsPerYear) {
  for (const name of subjects) {
    lines.push(`  -- ${level.toUpperCase()}: ${name}`);
    lines.push(`  SELECT id INTO v_subject_id FROM public.waec_subjects WHERE level = '${level}' AND name = '${esc(name)}' LIMIT 1;`);
    lines.push(`  IF v_subject_id IS NOT NULL THEN`);
    for (const year of WAEC_EXAM_YEARS) {
      lines.push(`    IF NOT EXISTS (SELECT 1 FROM public.waec_questions WHERE subject_id = v_subject_id AND year = ${year} LIMIT 1) THEN`);
      const questions = buildQuestions(name, year, questionsPerYear);
      let n = 0;
      for (const q of questions) {
        n++;
        const opts = JSON.stringify(q.options);
        lines.push(`      INSERT INTO public.waec_questions (subject_id, year, paper_type, topic, difficulty, question_text, options, correct_answer, explanation)`);
        lines.push(`      VALUES (v_subject_id, ${year}, 'paper_1', '${esc(q.topic)}', '${q.difficulty}', '${esc(q.question_text)}', '${esc(opts)}'::jsonb, '${q.correct_answer}', '${esc(q.explanation)}');`);
      }
      lines.push(`    END IF;`);
    }
    lines.push(`  END IF;`);
  }
}

subjectLoop("bece", BECE_SUBJECTS, 15);
subjectLoop("wassce", WASSCE_SUBJECTS, 15);

lines.push("END $$;");
lines.push("");
lines.push("NOTIFY pgrst, 'reload schema';");

const outPath = join(root, "public", "sql", "apply-waec-questions-bank.sql");
writeFileSync(outPath, lines.join("\n"), "utf8");

const beceCount = BECE_SUBJECTS.length * WAEC_EXAM_YEARS.length * 15;
const wassceCount = WASSCE_SUBJECTS.length * WAEC_EXAM_YEARS.length * 15;
console.log(`Wrote ${outPath}`);
console.log(`BECE: ~${beceCount} questions | WASSCE: ~${wassceCount} questions | Total: ~${beceCount + wassceCount}`);
