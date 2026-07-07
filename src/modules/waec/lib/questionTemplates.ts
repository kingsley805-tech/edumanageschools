/** Curriculum-aligned MCQ templates used to build the WAEC question bank per subject/year. */

export type QuestionTemplate = {
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  options: { id: string; text: string }[];
  correct_answer: string;
  explanation: string;
};

export const WAEC_EXAM_YEARS = Array.from({ length: 16 }, (_, i) => 2010 + i); // 2010–2025

function mcq(
  topic: string,
  difficulty: QuestionTemplate["difficulty"],
  question: string,
  options: [string, string, string, string],
  correctIndex: number,
  explanation: string,
): QuestionTemplate {
  const ids = ["A", "B", "C", "D"] as const;
  return {
    topic,
    difficulty,
    question_text: question,
    options: ids.map((id, i) => ({ id, text: options[i] })),
    correct_answer: ids[correctIndex],
    explanation,
  };
}

/** Rotate correct answer position by year + index so options vary across years. */
function rotateCorrect(t: QuestionTemplate, year: number, qIndex: number): QuestionTemplate {
  const shift = (year + qIndex) % 4;
  if (shift === 0) return t;
  const opts = [...t.options];
  const correctIdx = opts.findIndex((o) => o.id === t.correct_answer);
  const newCorrectIdx = (correctIdx + shift) % 4;
  const rotated = opts.map((_, i) => opts[(i - shift + 4) % 4]);
  return {
    ...t,
    options: rotated.map((o, i) => ({ ...o, id: ["A", "B", "C", "D"][i] })),
    correct_answer: ["A", "B", "C", "D"][newCorrectIdx],
  };
}

function withYearContext(t: QuestionTemplate, year: number, qIndex: number): QuestionTemplate {
  const base = rotateCorrect(t, year, qIndex);
  const yearNote = ` (${year} past question style)`;
  if (base.question_text.includes(String(year))) return base;
  return { ...base, question_text: base.question_text.replace(/\?$/, `${yearNote}?`) };
}

const SUBJECT_TEMPLATES: Record<string, QuestionTemplate[]> = {
  Mathematics: [
    mcq("Arithmetic", "easy", "What is 12 + 15?", ["17", "25", "27", "30"], 2, "12 + 15 = 27"),
    mcq("Arithmetic", "easy", "What is 9 × 7?", ["56", "63", "72", "81"], 1, "9 × 7 = 63"),
    mcq("Fractions", "medium", "Simplify 8/12", ["1/3", "2/3", "3/4", "4/6"], 1, "Divide numerator and denominator by 4: 2/3"),
    mcq("Decimals", "medium", "Convert 0.35 to a fraction in lowest terms", ["7/20", "35/100", "3/5", "7/10"], 0, "0.35 = 35/100 = 7/20"),
    mcq("Algebra", "medium", "If 3x = 18, find x", ["3", "6", "9", "15"], 1, "x = 18 ÷ 3 = 6"),
    mcq("Algebra", "hard", "Expand (x + 2)(x + 3)", ["x² + 5x + 6", "x² + 6x + 5", "x² + 5x + 5", "2x + 5"], 0, "(x+2)(x+3) = x² + 3x + 2x + 6"),
    mcq("Geometry", "easy", "How many degrees in a right angle?", ["45°", "90°", "180°", "360°"], 1, "A right angle is 90°"),
    mcq("Geometry", "medium", "Find the area of a rectangle 8 cm by 5 cm", ["13 cm²", "26 cm²", "40 cm²", "80 cm²"], 2, "Area = length × width = 8 × 5 = 40 cm²"),
    mcq("Statistics", "medium", "The average of 4, 6, and 8 is", ["5", "6", "7", "18"], 1, "(4+6+8) ÷ 3 = 6"),
    mcq("Ratio", "medium", "Share GH₵60 in ratio 2:3. The larger share is", ["GH₵24", "GH₵30", "GH₵36", "GH₵40"], 2, "Total parts = 5; larger = 3/5 × 60 = 36"),
    mcq("Percentage", "easy", "Express 1/4 as a percentage", ["20%", "25%", "40%", "50%"], 1, "1/4 = 0.25 = 25%"),
    mcq("Number Bases", "hard", "Convert 1010₂ to base ten", ["8", "10", "12", "14"], 1, "1010₂ = 8 + 2 = 10"),
    mcq("Sets", "medium", "If A = {1,2,3} and B = {2,3,4}, find A ∩ B", ["{1}", "{2,3}", "{4}", "{1,2,3,4}"], 1, "Common elements are 2 and 3"),
    mcq("Mensuration", "hard", "Volume of a cube of side 3 cm is", ["9 cm³", "18 cm³", "27 cm³", "36 cm³"], 2, "V = s³ = 3³ = 27 cm³"),
    mcq("Probability", "medium", "A fair die is thrown once. P(getting an even number) =", ["1/6", "1/3", "1/2", "2/3"], 2, "Even outcomes: 2,4,6 → 3/6 = 1/2"),
  ],
  "Core Mathematics": [
    mcq("Indices", "medium", "Simplify 5² × 5³", ["5⁵", "5⁶", "25⁵", "25⁶"], 0, "Add indices: 5²⁺³ = 5⁵"),
    mcq("Logarithms", "hard", "If log₁₀ 100 = x, find x", ["1", "2", "10", "100"], 1, "10² = 100, so log₁₀ 100 = 2"),
    mcq("Quadratic Equations", "hard", "Solve x² − 9 = 0", ["x = ±3", "x = 3 only", "x = −3 only", "x = 9"], 0, "x² = 9 → x = ±3"),
    mcq("Simultaneous Equations", "medium", "If x + y = 10 and x − y = 2, find x", ["4", "6", "8", "12"], 1, "Adding: 2x = 12 → x = 6"),
    mcq("Trigonometry", "medium", "sin 30° equals", ["1/2", "√3/2", "1", "0"], 0, "sin 30° = 1/2"),
    mcq("Coordinate Geometry", "medium", "Gradient of line through (0,0) and (2,4) is", ["1", "2", "3", "4"], 1, "m = (4−0)/(2−0) = 2"),
    mcq("Statistics", "easy", "The mode of 2, 3, 3, 5, 7 is", ["2", "3", "5", "7"], 1, "3 appears most often"),
    mcq("Sequences", "medium", "Next term: 2, 4, 8, 16, …", ["20", "24", "32", "64"], 2, "Geometric ×2: next is 32"),
    mcq("Variation", "hard", "y varies inversely as x. If x = 4, y = 6, find y when x = 8", ["3", "6", "12", "48"], 0, "xy = constant → 4×6 = 8y → y = 3"),
    mcq("Circle Geometry", "medium", "Angle in a semicircle is", ["45°", "60°", "90°", "180°"], 2, "Angle in semicircle = 90°"),
    mcq("Vectors", "hard", "|(3, 4)| equals", ["5", "7", "12", "25"], 0, "√(9+16) = 5"),
    mcq("Calculus", "hard", "Derivative of x³ is", ["3x", "3x²", "x²", "x³/3"], 1, "d/dx(x³) = 3x²"),
    mcq("Matrices", "medium", "Order of matrix with 2 rows and 3 columns is", ["2×3", "3×2", "6×1", "1×6"], 0, "Rows × columns = 2×3"),
    mcq("Financial Maths", "easy", "Simple interest on GH₵1000 at 10% for 2 years is", ["GH₵100", "GH₵200", "GH₵300", "GH₵1200"], 1, "I = PRT/100 = 1000×10×2/100 = 200"),
    mcq("Surds", "medium", "Simplify √50", ["5√2", "2√5", "25", "10√5"], 0, "√50 = √(25×2) = 5√2"),
  ],
  "English Language": [
    mcq("Grammar", "easy", "Choose the correct verb: She ___ to school daily", ["go", "goes", "going", "gone"], 1, "Third person singular takes 'goes'"),
    mcq("Grammar", "medium", "The plural of 'child' is", ["childs", "childes", "children", "childrens"], 2, "Irregular plural: children"),
    mcq("Vocabulary", "medium", "'Benevolent' means", ["cruel", "kind", "lazy", "proud"], 1, "Benevolent = kind, generous"),
    mcq("Comprehension", "easy", "The main idea of a passage is usually found in the", ["title", "first/last paragraph", "footnotes", "index"], 1, "Main idea often in introduction or conclusion"),
    mcq("Literature", "medium", "A poem of 14 lines is called a", ["ode", "sonnet", "ballad", "epic"], 1, "Sonnet has 14 lines"),
    mcq("Spelling", "easy", "Correct spelling:", ["accomodate", "accommodate", "acommodate", "accomadate"], 1, "Double c, double m: accommodate"),
    mcq("Punctuation", "medium", "Which sentence is correct?", ["Its raining.", "It's raining.", "Its' raining.", "It raining."], 1, "It's = it is"),
    mcq("Synonyms", "easy", "'Rapid' is nearest in meaning to", ["slow", "quick", "heavy", "calm"], 1, "Rapid = quick"),
    mcq("Antonyms", "medium", "Opposite of 'ancient' is", ["old", "modern", "historic", "aged"], 1, "Ancient ↔ modern"),
    mcq("Idioms", "medium", "'Break the ice' means", ["to freeze", "to start conversation", "to break glass", "to end a party"], 1, "Break the ice = initiate social interaction"),
    mcq("Parts of Speech", "easy", "'Quickly' is a/an", ["noun", "verb", "adverb", "adjective"], 2, "Quickly modifies a verb → adverb"),
    mcq("Essay Skills", "medium", "A formal letter should end with", ["Yours faithfully", "Hi there", "See ya", "Bye"], 0, "Formal letters use Yours faithfully/sincerely"),
    mcq("Figurative Language", "hard", "'The classroom was a zoo' is a", ["simile", "metaphor", "personification", "hyperbole"], 1, "Direct comparison without like/as → metaphor"),
    mcq("Phonetics", "medium", "How many vowel letters in English alphabet?", ["5", "6", "21", "26"], 0, "a, e, i, o, u"),
    mcq("Summary", "medium", "When summarising, you should", ["copy everything", "use your own words", "add new facts", "ignore the title"], 1, "Summary = concise restatement in own words"),
  ],
  "Integrated Science": [
    mcq("Biology", "easy", "The basic unit of life is the", ["tissue", "cell", "organ", "organism"], 1, "Cell is the basic unit of life"),
    mcq("Biology", "medium", "Photosynthesis occurs mainly in the", ["roots", "stem", "leaves", "flowers"], 2, "Chloroplasts in leaves capture light"),
    mcq("Chemistry", "easy", "The chemical symbol for water is", ["HO", "H₂O", "OH₂", "H₂O₂"], 1, "Water = H₂O"),
    mcq("Chemistry", "medium", "pH 7 indicates a/an ___ solution", ["acidic", "neutral", "alkaline", "salt"], 1, "pH 7 is neutral"),
    mcq("Physics", "easy", "The SI unit of force is", ["joule", "newton", "watt", "pascal"], 1, "Force measured in newtons"),
    mcq("Physics", "medium", "Speed = distance ÷ ___", ["time", "mass", "force", "volume"], 0, "speed = distance/time"),
    mcq("Ecology", "medium", "Organisms that make their own food are", ["consumers", "producers", "decomposers", "parasites"], 1, "Producers = autotrophs"),
    mcq("Human Body", "easy", "The organ that pumps blood is the", ["lung", "liver", "heart", "kidney"], 2, "Heart pumps blood"),
    mcq("Energy", "medium", "Energy cannot be created or destroyed — this is the law of conservation of", ["momentum", "energy", "mass", "charge"], 1, "First law of thermodynamics"),
    mcq("Electricity", "hard", "Ohm's law states V =", ["IR", "I/R", "R/I", "I+R"], 0, "V = IR"),
    mcq("Reproduction", "medium", "Fertilisation in plants occurs in the", ["petal", "stigma", "ovary", "style"], 2, "Ovary contains ovules"),
    mcq("Matter", "easy", "Which state of matter has fixed volume but no fixed shape?", ["solid", "liquid", "gas", "plasma"], 1, "Liquids have fixed volume, take container shape"),
    mcq("Acids and Bases", "medium", "Litmus turns red in", ["acid", "base", "salt", "water"], 0, "Acids turn blue litmus red"),
    mcq("Genetics", "hard", "Humans have ___ pairs of chromosomes", ["23", "46", "48", "92"], 0, "23 pairs = 46 chromosomes"),
    mcq("Environment", "easy", "Cutting down trees without replanting causes", ["afforestation", "deforestation", "irrigation", "conservation"], 1, "Deforestation"),
  ],
  "Social Studies": [
    mcq("Citizenship", "easy", "Ghana gained independence in", ["1957", "1960", "1966", "1992"], 0, "Ghana became independent on 6 March 1957"),
    mcq("Government", "medium", "Ghana is a", ["monarchy", "republic", "empire", "colony"], 1, "Ghana is a unitary republic"),
    mcq("Geography", "easy", "The capital of Ghana is", ["Kumasi", "Accra", "Tamale", "Cape Coast"], 1, "Accra is the capital"),
    mcq("Economics", "medium", "Scarcity means", ["unlimited resources", "limited resources vs unlimited wants", "no wants", "free goods only"], 1, "Core economic problem: scarcity"),
    mcq("History", "medium", "The first President of Ghana was", ["J.B. Danquah", "Kwame Nkrumah", "J.A. Busia", "J.J. Rawlings"], 1, "Kwame Nkrumah"),
    mcq("Culture", "easy", "Adinkra symbols originate from which Ghanaian ethnic group?", ["Ewe", "Akan", "Ga", "Dagomba"], 1, "Adinkra is Akan"),
    mcq("Rights", "medium", "The right to vote is called", ["suffrage", "marriage", "asylum", "bail"], 0, "Suffrage = voting right"),
    mcq("Environment", "medium", "Global warming is mainly caused by increase in", ["oxygen", "greenhouse gases", "nitrogen", "helium"], 1, "GHG trap heat"),
    mcq("Map Work", "easy", "Lines joining places of equal rainfall are called", ["isobars", "isohyets", "contours", "latitudes"], 1, "Isohyets = equal rainfall"),
    mcq("ECOWAS", "medium", "ECOWAS stands for", ["Economic Community of West African States", "East Community of Africa", "European Council of West Africa", "Economic Council of World African States"], 0, "ECOWAS full name"),
    mcq("Rule of Law", "hard", "No one is above the law means", ["law applies equally", "only leaders follow law", "judges are exempt", "police are above law"], 0, "Equality before the law"),
    mcq("Population", "medium", "A high birth rate and low death rate leads to", ["population decline", "population growth", "zero growth", "migration only"], 1, "Natural increase"),
    mcq("Resources", "easy", "Ghana's major export crop historically is", ["rice", "cocoa", "wheat", "tea"], 1, "Cocoa is key export"),
    mcq("Democracy", "medium", "Elections in a democracy should be", ["rigged", "free and fair", "secret only", "for elites only"], 1, "Democratic elections must be fair"),
    mcq("Conflict", "medium", "Peaceful resolution of disputes is called", ["war", "dialogue/negotiation", "invasion", "sanction only"], 1, "Negotiation resolves conflicts peacefully"),
  ],
};

/** Generic templates for subjects without dedicated banks. */
const GENERIC_TEMPLATES: QuestionTemplate[] = [
  mcq("Fundamentals", "easy", "Which option best represents a key concept in this subject?", ["Option A", "Option B", "Option C", "Option D"], 1, "Review your class notes for this topic."),
  mcq("Application", "medium", "Apply the main principle taught in this area to solve the problem", ["Answer 1", "Answer 2", "Answer 3", "Answer 4"], 2, "Apply the standard method for this topic."),
  mcq("Analysis", "medium", "Which statement is correct for this syllabus topic?", ["Statement A", "Statement B", "Statement C", "Statement D"], 0, "Refer to WAEC marking scheme for detail."),
  mcq("Evaluation", "hard", "Select the best explanation for the phenomenon described", ["Exp. A", "Exp. B", "Exp. C", "Exp. D"], 3, "Compare all options carefully."),
  mcq("Recall", "easy", "Identify the correct definition", ["Def. A", "Def. B", "Def. C", "Def. D"], 1, "Use textbook definitions."),
  mcq("Problem Solving", "hard", "Solve using the appropriate formula or rule", ["Sol. A", "Sol. B", "Sol. C", "Sol. D"], 2, "Show working in the exam."),
  mcq("Interpretation", "medium", "Interpret the data or diagram correctly", ["Int. A", "Int. B", "Int. C", "Int. D"], 1, "Read labels and units carefully."),
  mcq("Comparison", "medium", "Which pair is correctly matched?", ["Pair A", "Pair B", "Pair C", "Pair D"], 0, "Eliminate wrong pairs first."),
  mcq("Synthesis", "hard", "Combine concepts to reach the correct conclusion", ["Con. A", "Con. B", "Con. C", "Con. D"], 2, "Link related topics."),
  mcq("Review", "easy", "A standard WAEC objective question tests", ["memorisation only", "understanding and application", "guesswork", "irrelevant facts"], 1, "WAEC tests understanding and application."),
  mcq("Exam Technique", "medium", "When unsure, you should", ["leave blank always", "eliminate wrong options first", "choose randomly", "stop the exam"], 1, "Elimination improves odds."),
  mcq("Time Management", "easy", "In a timed paper you should", ["spend all time on one question", "allocate time per section", "skip instructions", "ignore the clock"], 1, "Manage time across all questions."),
];

export function getTemplatesForSubject(subjectName: string): QuestionTemplate[] {
  return SUBJECT_TEMPLATES[subjectName] ?? GENERIC_TEMPLATES;
}

export function buildQuestionsForSubjectYear(
  subjectName: string,
  year: number,
  count = 15,
): QuestionTemplate[] {
  const templates = getTemplatesForSubject(subjectName);
  const result: QuestionTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    result.push(withYearContext(t, year, i));
  }
  return result;
}

export function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}
