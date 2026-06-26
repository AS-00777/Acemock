export const INTERVIEW_DOMAIN_CONFIG = {
  "Frontend Engineering": { codingRound: true, nonCodingFocus: ["theory", "scenario", "design"] },
  "Backend Engineering": { codingRound: true, nonCodingFocus: ["theory", "scenario", "architecture"] },
  "Full Stack Development": { codingRound: true, nonCodingFocus: ["theory", "scenario", "architecture"] },
  "Data Science": { codingRound: true, nonCodingFocus: ["theory", "case study", "data analysis"] },
  "Data Analyst": { codingRound: true, nonCodingFocus: ["theory", "case study", "data analysis"] },
  "Machine Learning Engineer": { codingRound: true, nonCodingFocus: ["theory", "scenario", "system design"] },
  "QA / Software Testing": { codingRound: true, nonCodingFocus: ["theory", "scenario", "test design"] },
  "Product Management": { codingRound: false, nonCodingFocus: ["theory", "scenario", "case study"] },
  "UX/UI Design": { codingRound: false, nonCodingFocus: ["theory", "scenario", "design critique"] },
  "Cloud Architecture": { codingRound: false, nonCodingFocus: ["scenario", "architecture", "design"] },
  Cybersecurity: { codingRound: false, nonCodingFocus: ["scenario", "security", "architecture"] },
  "DevOps Engineer": { codingRound: false, nonCodingFocus: ["scenario", "architecture", "operations"] },
} as const;

export type InterviewDomain = keyof typeof INTERVIEW_DOMAIN_CONFIG;
export type QuestionType = "theory" | "coding" | "mcq" | "practical" | "scenario";
export type EvaluationType = "function";

export type CodingQuestionMetadata = {
  skill: string;
  language: string;
  starterCode: string;
  visibleTestCases: Array<{ input: unknown; expectedOutput: unknown }>;
  hiddenTestCases: Array<{ input: unknown; expectedOutput: unknown }>;
  constraints: string[];
  expectedOutput: string;
  evaluationType: EvaluationType;
};

type SkillRule = {
  matches: RegExp;
  language: string;
  evaluationType: EvaluationType;
  template: keyof typeof CODING_TEMPLATES;
};

const SKILL_RULES: SkillRule[] = [
  { matches: /typescript|\bts\b/i, language: "TypeScript", evaluationType: "function", template: "javascript" },
  { matches: /javascript|\bjs\b/i, language: "JavaScript", evaluationType: "function", template: "javascript" },
  { matches: /^python(?:\s+programming)?$/i, language: "Python", evaluationType: "function", template: "python" },
  { matches: /pandas|numpy|scikit|sklearn|machine learning|^ml$/i, language: "Python", evaluationType: "function", template: "python" },
  { matches: /\bjava\b/i, language: "Java", evaluationType: "function", template: "java" },
  { matches: /node|express|nest/i, language: "JavaScript", evaluationType: "function", template: "node" },
  { matches: /c\+\+/i, language: "C++", evaluationType: "function", template: "cpp" },
  { matches: /^(?:c|c language)$/i, language: "C", evaluationType: "function", template: "c" },
];

const CODING_TEMPLATES = {
  javascript: {
    question: "Implement solution(records) to group records by their category. Ignore records without a non-empty category and preserve item order within each group.",
    starterCode: "function solution(records) {\n  // Return an object keyed by category.\n}\n\nmodule.exports = solution;",
    visible: [{ input: [{ category: "a", id: 1 }, { category: "b", id: 2 }, { category: "a", id: 3 }], expectedOutput: { a: [{ category: "a", id: 1 }, { category: "a", id: 3 }], b: [{ category: "b", id: 2 }] } }],
    hidden: [{ input: [{ id: 1 }, { category: "", id: 2 }], expectedOutput: {} }],
    constraints: ["Do not mutate the input", "Handle an empty array", "Target O(n) time"],
    expectedOutput: "An object whose keys are categories and values are ordered record arrays.",
  },
  node: {
    question: "Implement solution(input) for a Node.js API utility. Trim string fields, remove keys whose values are null or undefined, and leave other values unchanged.",
    starterCode: "function solution(input) {\n  // Return a sanitized shallow copy.\n}\n\nmodule.exports = solution;",
    visible: [{ input: { name: "  Ada  ", role: "admin", note: null }, expectedOutput: { name: "Ada", role: "admin" } }],
    hidden: [{ input: { active: false, count: 0, missing: null }, expectedOutput: { active: false, count: 0 } }],
    constraints: ["Do not mutate the input", "Preserve false and zero values", "Return a shallow copy"],
    expectedOutput: "A sanitized object suitable for API validation.",
  },
  python: {
    question: "Implement solution(values) to return the first value that occurs exactly once, or -1 when none exists.",
    starterCode: "def solution(values):\n    # Implement here.\n    return -1",
    visible: [{ input: [4, 5, 4, 6, 5], expectedOutput: 6 }],
    hidden: [{ input: [2, 2], expectedOutput: -1 }],
    constraints: ["Preserve first-occurrence order", "Target O(n) time", "Handle an empty list"],
    expectedOutput: "The first unique value, or -1.",
  },
  java: {
    question: "Implement solution(int[] values) to return the first value that occurs exactly once, or -1 when none exists.",
    starterCode: "import java.util.*;\n\nclass Solution {\n    static int solution(int[] values) {\n        // Implement here.\n        return -1;\n    }\n}",
    visible: [{ input: [4, 5, 4, 6, 5], expectedOutput: 6 }],
    hidden: [{ input: [2, 2], expectedOutput: -1 }],
    constraints: ["Preserve first-occurrence order", "Target O(n) time", "Handle an empty array"],
    expectedOutput: "The first unique integer, or -1.",
  },
  c: {
    question: "Implement solution to return the first integer that occurs exactly once, or -1 when none exists.",
    starterCode: "int solution(const int *values, int length) {\n    /* Implement here. */\n    return -1;\n}",
    visible: [{ input: [4, 5, 4, 6, 5], expectedOutput: 6 }],
    hidden: [{ input: [2, 2], expectedOutput: -1 }],
    constraints: ["Preserve first-occurrence order", "Handle an empty array", "Do not read beyond array bounds"],
    expectedOutput: "The first unique integer, or -1.",
  },
  cpp: {
    question: "Implement solution to return the first integer that occurs exactly once, or -1 when none exists.",
    starterCode: "#include <vector>\nusing namespace std;\n\nint solution(const vector<int>& values) {\n    // Implement here.\n    return -1;\n}",
    visible: [{ input: [4, 5, 4, 6, 5], expectedOutput: 6 }],
    hidden: [{ input: [2, 2], expectedOutput: -1 }],
    constraints: ["Preserve first-occurrence order", "Target O(n) time", "Do not mutate the input"],
    expectedOutput: "The first unique integer, or -1.",
  },
} as const;

const NON_CODING_FALLBACKS: Record<string, string[]> = {
  "Data Science": [
    "How do you decide between dropping, imputing, or explicitly modeling missing values in a dataset?",
    "Explain overfitting and underfitting, and describe how you would recognize each during model development.",
    "When would you choose logistic regression instead of a decision tree for a classification problem?",
    "How would you evaluate a classification model when the positive class is rare?",
    "A model performs well offline but poorly after deployment. What data and modeling issues would you investigate?",
    "How do you detect and prevent data leakage before training a model?",
    "Explain how you would validate whether a new feature genuinely improves a model.",
    "When is cross-validation more useful than a single train-validation split?",
    "How would you handle strongly correlated input features, and when does that correlation matter?",
    "Walk through the checks you perform before trusting a dataset for model training.",
  ],
  "Product Management": [
    "A key activation metric drops 15% after a release. How would you investigate and prioritize the response?",
    "Two customer segments request conflicting features. How would you decide what enters the next quarter's roadmap?",
    "A newly launched feature has strong adoption but no measurable retention impact. What would you examine next?",
    "How would you define success metrics for improving a marketplace checkout experience?",
    "Sales promises an enterprise feature that is not on the roadmap. How would you handle the situation?",
    "A product experiment improves conversion but increases support tickets. How would you make the launch decision?",
    "How would you validate demand for a collaboration feature before committing engineering capacity?",
    "A competitor releases a popular feature your customers now request. How would you assess whether to respond?",
    "Monthly active users are growing while paid conversion is falling. Walk through your diagnosis.",
    "Describe how you would communicate a difficult roadmap tradeoff to engineering and leadership.",
  ],
  "UX/UI Design": [
    "A checkout page has high mobile abandonment. What usability issues would you investigate first?",
    "How would you make a complex data table usable for keyboard and screen-reader users?",
    "A design system has inconsistent button patterns across products. How would you guide consolidation?",
    "Walk through how you would test whether a redesigned onboarding flow is easier to understand.",
    "A stakeholder asks to hide advanced settings to simplify the interface. What tradeoffs would you explore?",
    "How would you design an error state for a payment that may have succeeded despite a network timeout?",
    "Users frequently abandon a long registration form. How would you identify and address the causes?",
    "Critique the risks of relying on color alone to communicate status in a dashboard.",
    "How would you adapt a desktop navigation pattern for a small mobile viewport?",
    "Describe the evidence you would collect before changing an established interaction pattern.",
  ],
  "Cloud Architecture": [
    "Design a scalable file upload system and explain storage, security, and cost considerations.",
    "How would you design a multi-region API that can tolerate a regional outage?",
    "A service experiences unpredictable traffic spikes. How would you choose scaling and queueing strategies?",
    "Explain how you would isolate public, application, and database resources in a cloud network.",
    "A workload's cloud bill doubles without traffic growth. How would you investigate it?",
    "How would you migrate a stateful application with minimal downtime and a safe rollback path?",
    "Design backup and recovery controls for a customer-facing database with a strict recovery objective.",
    "When would you choose managed services over self-hosted infrastructure for a critical workload?",
    "How would you protect and rotate secrets used by workloads across multiple environments?",
    "A downstream dependency is intermittently slow. How should the architecture limit cascading failures?",
  ],
  Cybersecurity: [
    "A production account shows suspicious privileged access. Walk through containment, investigation, and recovery.",
    "How would you assess an API endpoint that accepts user-controlled file uploads?",
    "A web application reflects untrusted input in the browser. What risks and mitigations would you investigate?",
    "Design an access-control approach for administrators with different operational responsibilities.",
    "An employee reports entering credentials on a suspicious page. What actions should follow?",
    "How would you prioritize remediation when a scan reports hundreds of vulnerabilities?",
    "Explain how you would investigate repeated failed logins followed by a successful privileged login.",
    "What controls would you require before exposing a new internal service to the internet?",
    "How would you reduce the impact of a compromised application credential?",
    "A dependency has a critical vulnerability but no patch. How would you manage the risk?",
  ],
  "DevOps Engineer": [
    "A deployment causes elevated errors in one region. Explain your rollback and diagnosis approach.",
    "A CI pipeline becomes unreliable and frequently fails on reruns. How would you isolate the cause?",
    "Pods are healthy but receive no traffic. What Kubernetes components would you inspect?",
    "How would you design a deployment pipeline with approvals, observability, and safe rollback?",
    "A container works locally but exits immediately in production. How would you debug it?",
    "Disk usage grows continuously on a Linux host. Walk through diagnosis and remediation.",
    "How would you manage application secrets across development, staging, and production?",
    "A release requires a database migration that is not backward compatible. How would you deploy safely?",
    "What signals would you use to distinguish application latency from infrastructure saturation?",
    "How would you reduce build times without weakening test coverage or artifact integrity?",
  ],
};

const CODING_QUESTION_VARIANTS: Record<keyof typeof CODING_TEMPLATES, string[]> = {
  javascript: [
    "Given a list of records, group entries by category, ignore entries with a missing category, and preserve their original order.",
    "An event pipeline receives categorized records. Return an object keyed by category while skipping malformed entries.",
    "A catalog API returns items with category fields. Organize valid items into category groups without mutating the input.",
  ],
  node: [
    "An API receives a shallow JSON payload. Trim string values and remove fields whose values are null or undefined.",
    "Before persisting request data, return a sanitized copy that preserves false and zero while removing missing values.",
    "Normalize a request body by trimming its string fields and omitting null or undefined properties without changing the original object.",
  ],
  python: [
    "Given a sequence of values, return the first value that appears exactly once, or -1 when every value is repeated.",
    "A processing queue may contain duplicate identifiers. Find the earliest identifier that occurs only once.",
    "From an ordered list of event codes, return the first unique code while preserving arrival order.",
  ],
  java: [
    "Given an integer array, return the first value that appears exactly once, or -1 when none exists.",
    "A stream of integer identifiers contains duplicates. Find the earliest identifier with a frequency of one.",
    "From an ordered array of event codes, return the first unique code without changing the input.",
  ],
  c: [
    "Given an integer array and its length, return the first value that occurs exactly once, or -1 when none exists.",
    "Scan a bounded integer buffer and find the earliest value whose total frequency is one.",
    "Return the first unique integer in an array while respecting the provided length and memory bounds.",
  ],
  cpp: [
    "Given a vector of integers, return the first value that occurs exactly once, or -1 when none exists.",
    "Find the earliest unique identifier in an ordered vector without modifying the input.",
    "A vector contains repeated event codes. Return the first code whose frequency is one.",
  ],
};

export function domainNeedsCoding(role: string) {
  const configured = INTERVIEW_DOMAIN_CONFIG[role as InterviewDomain];
  if (configured) return Boolean(configured.codingRound);
  if (/ui\s*\/\s*ux|ux\s*\/\s*ui|design|human resources|^hr$/i.test(role)) return false;
  return /frontend|front-end|backend|back-end|full stack|full-stack|software (?:developer|engineer)|programmer/i.test(role);
}

export function getNonCodingFocus(role: string) {
  return INTERVIEW_DOMAIN_CONFIG[role as InterviewDomain]?.nonCodingFocus ?? ["theory", "scenario"];
}

export function getSkillRule(skill: string) {
  return SKILL_RULES.find((rule) => rule.matches.test(skill));
}

export function getCodingEligibleSkills(role: string, selectedSkills: string[]) {
  if (!domainNeedsCoding(role)) return [];
  return selectedSkills.filter((skill) => Boolean(getSkillRule(skill)));
}

export function buildCodingFallback(skill: string, variant = 0): CodingQuestionMetadata & { question: string } {
  const rule = getSkillRule(skill);
  if (!rule) throw new Error(`No coding template is configured for skill: ${skill}`);
  const template = CODING_TEMPLATES[rule.template];
  return {
    question: CODING_QUESTION_VARIANTS[rule.template][variant % CODING_QUESTION_VARIANTS[rule.template].length],
    skill,
    language: rule.language,
    starterCode: template.starterCode,
    visibleTestCases: [...template.visible],
    hiddenTestCases: [...template.hidden],
    constraints: [...template.constraints],
    expectedOutput: template.expectedOutput,
    evaluationType: rule.evaluationType,
  };
}

export function getNonCodingFallback(role: string, skill: string, index: number) {
  const domainTemplates = NON_CODING_FALLBACKS[role];
  if (domainTemplates?.length) return domainTemplates[index % domainTemplates.length];
  if (/html|css|tailwind|bootstrap/i.test(skill)) {
    const prompts = [
      "How would you structure a responsive profile card so it remains readable and keyboard accessible on small screens?",
      "Explain when CSS Grid is a better choice than Flexbox for a dashboard layout.",
      "A navigation bar overflows on narrow screens. Walk through a robust responsive solution.",
      "How do semantic elements and heading order improve an interface for assistive technology?",
      "Create a responsive card layout and explain the breakpoints, spacing, and accessibility decisions.",
      "A page shifts while images load. What HTML and CSS changes would reduce layout instability?",
      "How would you build a form layout that remains usable at 200 percent zoom?",
      "Explain how specificity and the cascade can create difficult styling bugs in a large application.",
      "What would you inspect when a component looks correct in one browser but breaks in another?",
      "Design a mobile-first pricing section and describe how its visual hierarchy changes on larger screens.",
    ];
    return prompts[index % prompts.length];
  }
  const prompts = [
    `Explain a production decision where ${skill} introduces an important tradeoff.`,
    "Describe how you would diagnose a defect that appears only under production traffic.",
    "How would you structure a feature so its behavior remains easy to test and change?",
    "Explain a performance problem you would measure before attempting to optimize it.",
    "What edge cases would you discuss before approving this feature for release?",
    "Compare two plausible implementation approaches and explain how you would choose between them.",
    "How would you review this implementation for correctness, maintainability, and operational risk?",
    "Describe a testing strategy that covers expected behavior, failures, and boundary conditions.",
    "How would you refactor a fragile module without changing its public behavior?",
    `What production failure modes matter most when a service depends on ${skill}?`,
  ];
  return prompts[index % prompts.length];
}

export function getFallbackQuestionType(role: string, skill: string, index: number): QuestionType {
  if (/html|css|figma|ux|ui|react|next\.js|sql|pandas|qa|test/i.test(skill) && index % 3 === 0) return "practical";
  if (!domainNeedsCoding(role)) return (["mcq", "scenario", "practical", "theory"] as QuestionType[])[index % 4];
  return index % 4 === 1 ? "mcq" : index % 4 === 2 ? "scenario" : "theory";
}

export function buildMcqFallback(role: string, skill: string, variant = 0) {
  const common = [
    { question: "Which practice provides the strongest evidence that a change behaves as intended?", options: ["Automated validation", "Skipping edge cases", "Removing monitoring", "Avoiding reviews"], correctOption: "A", explanation: "Automated validation provides repeatable evidence and catches regressions early." },
    { question: "Which action should come first when a key metric changes unexpectedly?", options: ["Verify the data and segment the change", "Immediately reverse every release", "Ignore the change for a month", "Add more dashboard colors"], correctOption: "A", explanation: "Data quality and segmentation should be checked before drawing conclusions or taking broad action." },
    { question: "Which approach best reduces risk before a broad release?", options: ["A measured staged rollout", "Removing observability", "Skipping acceptance criteria", "Changing multiple unknowns at once"], correctOption: "A", explanation: "A staged rollout limits impact and provides evidence before full exposure." },
  ];
  const firstByDomain: Record<string, (typeof common)[number]> = {
    "Product Management": { question: "Which metric best measures whether new users reach a product's core value?", options: ["Activation rate", "Page views", "Total signups", "Email sends"], correctOption: "A", explanation: "Activation rate measures completion of the behavior associated with receiving initial product value." },
    "UX/UI Design": { question: "Which change most directly improves keyboard accessibility?", options: ["Visible focus states", "Smaller labels", "Hover-only menus", "Lower contrast"], correctOption: "A", explanation: "Visible focus states let keyboard users track the currently active control." },
    "Cloud Architecture": { question: "Which component distributes requests across healthy service instances?", options: ["Load balancer", "Object store", "DNS zone file", "Key vault"], correctOption: "A", explanation: "A load balancer routes traffic across healthy targets and supports availability." },
    Cybersecurity: { question: "Which control best reduces SQL injection risk?", options: ["Parameterized queries", "Client-side validation", "Longer URLs", "Base64 encoding"], correctOption: "A", explanation: "Parameterized queries separate executable SQL from untrusted values." },
    "DevOps Engineer": { question: "What is the main purpose of a Kubernetes readiness probe?", options: ["Control whether a pod receives traffic", "Restart the node", "Build a container image", "Encrypt a secret"], correctOption: "A", explanation: "Readiness probes remove unready pods from service endpoints until they can accept traffic." },
  };
  const choices = [firstByDomain[role] ?? common[0], common[1], common[2]];
  return choices[variant % choices.length];
}

export function languageMatchesSkill(skill: string, language: string) {
  return getSkillRule(skill)?.language.toLowerCase() === language.trim().toLowerCase();
}

export function hasInvalidHtmlFunctionWording(question: string, skill: string) {
  if (!/html|css/i.test(skill)) return false;
  return /function\s+(?:in|using)\s+html|html\s+function|css\s+function|function\s+(?:in|using)\s+css/i.test(question);
}
