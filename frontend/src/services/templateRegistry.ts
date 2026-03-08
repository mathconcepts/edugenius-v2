/**
 * templateRegistry.ts — Exam × Topic × Style × Objective Template Overrides
 *
 * Template resolution order (most specific wins):
 *   exam × topic × style × objective  → full template    key: "${examId}__${topicSlug}__${style}__${objective}"
 *   exam × style × objective          → exam-level       key: "${examId}__${style}__${objective}"
 *   style × objective                 → generic          key: "${style}__${objective}"
 *   objective only                    → base             key: "${objective}"
 *
 * Key conventions:
 *   - examId    : lowercase prefix used in contentPersonaEngine (gate_em → "gate")
 *   - topicSlug : kebab-case topic name (spaces → hyphens, lowercase)
 *   - style     : matches LearningStyle enum values
 *   - objective : matches LearningObjective enum values
 *   - Use "__" (double underscore) as the level separator
 *
 * Templates are ADDITIVE by default: prefix/suffix are spliced into the generic
 * system prompt assembled by renderPrompt(). A userPromptOverride replaces
 * the user-prompt entirely.
 */

// ─── Interface ────────────────────────────────────────────────────────────────

export interface TemplateOverride {
  /** Unique readable ID (matches the registry key for traceability). */
  id: string;

  /**
   * Inserted at the TOP of the assembled system prompt, before exam/style
   * directives. Use for high-priority framing that must come first.
   */
  systemPromptPrefix?: string;

  /**
   * Appended at the BOTTOM of the assembled system prompt, after all
   * generic directives. Use for exam-/topic-specific extra rules.
   */
  systemPromptSuffix?: string;

  /**
   * When set, COMPLETELY replaces the default user prompt built by
   * renderPrompt(). Use when the generic "Generate X for Topic / Exam"
   * sentence is insufficient for highly-specific templates.
   */
  userPromptOverride?: string;

  /**
   * Post-generation validation checklist. Oracle agent (or automated QA)
   * should run these checks on the generated output and score accordingly.
   */
  qualityChecks: string[];

  /**
   * Override the default token budget. Useful for templates that need
   * significantly more/less output than the generic estimate.
   * Unit: tokens (approximate — 1 token ≈ 4 characters).
   */
  tokenBudget?: number;
}

// ─── Helper to build a key ────────────────────────────────────────────────────

/** Normalise a topic name to a URL-safe slug used as registry key segment. */
export function topicSlug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Generate the 4 candidate lookup keys from most-specific to least-specific.
 * Callers should iterate and pick the first key present in TEMPLATE_REGISTRY.
 */
export function buildLookupKeys(
  examId: string,
  topic: string,
  style: string,
  objective: string,
): [string, string, string, string] {
  const slug = topicSlug(topic);
  const exam = examId.toLowerCase().split('_')[0]; // "gate_em" → "gate"
  return [
    `${exam}__${slug}__${style}__${objective}`,    // most specific
    `${exam}__${style}__${objective}`,             // exam-level
    `${style}__${objective}`,                      // generic
    `${objective}`,                                // base
  ];
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TEMPLATE_REGISTRY: Record<string, TemplateOverride> = {

  // ══════════════════════════════════════════════════════════════════════════
  //  GATE EM — MOST-SPECIFIC (exam × topic × style × objective)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GATE EM × Electromagnetic Waves × analytical × exam_readiness
   */
  'gate__electromagnetic-waves__analytical__exam_readiness': {
    id: 'gate__electromagnetic-waves__analytical__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: GATE EM — Electromagnetic Waves (Analytical / Exam Readiness)',
      'Optimised for GATE Electronics & Communication, 2-mark NAT and MCQ on EM Waves.',
      '',
      'CRITICAL EXAM RULES:',
      '  1. Always state Maxwell curl equations (differential form) before any EM wave derivation.',
      '     Faraday: ∇ × E = −∂B/∂t   |   Ampere-Maxwell: ∇ × H = J + ∂D/∂t',
      '  2. Wave equation from Maxwell: ∇²E − με(∂²E/∂t²) = 0. Show each curl step.',
      '  3. Phase velocity v_p = 1/√(με). Group velocity v_g = dω/dβ. Always distinguish.',
      '  4. Boundary conditions: E_tan continuous; H_tan discontinuous at surface current;',
      '     D_normal continuous (no free charge). Cite boundary condition for every interface.',
      '  5. NAT answers: 2 decimal places unless problem specifies significant figures. Strip units for NAT.',
      '  6. Skin depth: δ = 1/√(πfμσ). Include derivation for good-conductor assumption.',
      '  7. Poynting vector: S = E × H. Time-averaged: <S> = ½ Re(E × H*).',
      '  8. Polarisation: linear / circular / elliptical — include Jones vector table where relevant.',
    ].join('\n'),
    systemPromptSuffix: [
      '',
      '## POST-ANSWER CHECKLIST (add for every numerical):',
      '  ☐ SI units consistent (V/m, A/m, W/m², m/s)',
      '  ☐ Boundary condition explicitly cited',
      '  ☐ NAT significant-figure guidance stated',
      '  ☐ Common GATE trap flagged (e.g., confusing ε₀ and ε for dielectric media)',
    ].join('\n'),
    qualityChecks: [
      'Maxwell curl equations stated before derivation',
      'Phase velocity formula present',
      'Boundary conditions cited for every interface',
      'NAT significant-figure guidance included',
      'Poynting vector used for power calculation',
      'Skin depth formula present where conductors appear',
    ],
    tokenBudget: 2800,
  },

  /**
   * GATE EM × Electric Field × analytical × conceptual_understanding
   */
  'gate__electric-field__analytical__conceptual_understanding': {
    id: 'gate__electric-field__analytical__conceptual_understanding',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: GATE EM — Electric Field (Analytical / Conceptual Understanding)',
      '',
      'DERIVATION-FIRST PROTOCOL:',
      '  1. Start from Coulomb\'s Law (vector): E = (1/4πε₀) ∫ (ρ_v/R²) â_R dv\'',
      '  2. Derive Gauss\'s Law integral form: ∮ D · dS = Q_enclosed.',
      '  3. Apply to three canonical geometries with step-by-step Gaussian surface construction:',
      '     (a) Infinite line charge: cylindrical surface → E = ρ_L/(2πεr) â_r',
      '     (b) Infinite plane: pillbox surface → E = ρ_S/(2ε) â_n',
      '     (c) Sphere of uniform charge: E = ρ_v r/(3ε) â_r inside; E = Q/(4πεr²) outside',
      '  4. Electric potential: V = −∫ E · dl. Gradient: ∇V = −E.',
      '  5. Laplace/Poisson: ∇²V = 0 (charge-free) or ∇²V = −ρ_v/ε (with charge).',
      '',
      'GUARDRAILS:',
      '  - Show WHY superposition holds (linearity of Maxwell\'s equations).',
      '  - Distinguish conductor boundary (E_tan = 0, E_normal = ρ_s/ε) from dielectric boundary.',
      '  - Flag where Gauss\'s law is NOT directly applicable (non-symmetric distributions).',
    ].join('\n'),
    qualityChecks: [
      'Coulomb\'s law in vector form',
      'Gauss\'s law integral form derived or stated',
      'At least 2 canonical geometries solved with Gaussian surface',
      'Equipotential surface concept explained',
      'Laplace or Poisson equation present',
      'Conductor boundary condition stated',
    ],
    tokenBudget: 2400,
  },

  /**
   * GATE EM × Electric Field and Potential × analytical × conceptual_understanding
   * (Alternate slug for the full topic name as it appears in syllabus)
   */
  'gate__electric-field-and-potential__analytical__conceptual_understanding': {
    id: 'gate__electric-field-and-potential__analytical__conceptual_understanding',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: GATE EM — Electric Field and Potential (Analytical / Conceptual)',
      '',
      'Cover BOTH field and potential rigorously:',
      '  FIELD: E-field from Coulomb\'s law → Gauss\'s law → canonical geometries (see electric-field template)',
      '  POTENTIAL: V = −∫ E · dl, V = kQ/r for point charge, V superposition for distributions',
      '  LINK: ∇V = −E (gradient relationship). Use this to move between field and potential.',
      '',
      'Three solution strategies and when to use each:',
      '  1. Direct integration — non-symmetric distributions',
      '  2. Gauss\'s law — highly symmetric distributions (sphere, cylinder, plane)',
      '  3. Laplace/Poisson — boundary value problems (given V at boundaries)',
    ].join('\n'),
    qualityChecks: [
      'Both E-field and potential covered',
      'Gradient relationship ∇V = −E stated',
      'Three solution strategies distinguished',
    ],
    tokenBudget: 2400,
  },

  /**
   * GATE EM × Maxwell's Equations × analytical × conceptual_understanding
   */
  'gate__maxwells-equations__analytical__conceptual_understanding': {
    id: 'gate__maxwells-equations__analytical__conceptual_understanding',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: GATE EM — Maxwell\'s Equations (Analytical / Conceptual)',
      '',
      'CANONICAL FOUR-EQUATION FRAMEWORK (time-varying, differential form):',
      '  ∇ × E = −∂B/∂t         (Faraday — changing B induces E)',
      '  ∇ × H = J + ∂D/∂t      (Ampere-Maxwell — current + changing D induces H)',
      '  ∇ · D = ρ_v             (Gauss electric — charge is E-field source)',
      '  ∇ · B = 0               (Gauss magnetic — no magnetic monopoles)',
      '',
      'Constitutive relations: D = εE, B = μH, J = σE',
      '',
      'DERIVATION CHAIN TO INCLUDE:',
      '  Faraday → Continuity equation (∇ · J + ∂ρ_v/∂t = 0) → Displacement current → EM wave equation.',
      '  Show WHY displacement current (∂D/∂t) was needed to fix Ampere\'s law inconsistency.',
      '',
      'EXAM TRAP: Many students conflate static (∂/∂t = 0) and time-varying forms.',
      'Always state which regime you are working in.',
    ].join('\n'),
    qualityChecks: [
      'All 4 Maxwell equations listed (differential form)',
      'Physical interpretation given for each equation',
      'Displacement current concept and motivation explained',
      'Constitutive relations stated',
      'Static vs time-varying regime distinction made',
    ],
    tokenBudget: 2600,
  },

  /**
   * GATE EM × Transmission Lines × analytical × exam_readiness
   */
  'gate__transmission-lines__analytical__exam_readiness': {
    id: 'gate__transmission-lines__analytical__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: GATE EM — Transmission Lines (Analytical / Exam Readiness)',
      '',
      'HIGH-FREQUENCY GATE TARGETS:',
      '  1. Telegrapher\'s equations: ∂V/∂z = −(R+jωL)I,  ∂I/∂z = −(G+jωC)V',
      '  2. Characteristic impedance: Z₀ = √((R+jωL)/(G+jωC))',
      '     Lossless simplification: Z₀ = √(L/C)',
      '  3. Propagation constant: γ = α + jβ = √((R+jωL)(G+jωC))',
      '     Lossless: α = 0, β = ω√(LC), v_p = 1/√(LC)',
      '  4. Reflection coefficient: Γ = (Z_L − Z₀)/(Z_L + Z₀)',
      '  5. VSWR = (1 + |Γ|)/(1 − |Γ|)',
      '  6. Input impedance: Z_in = Z₀ (Z_L + jZ₀tanβl)/(Z₀ + jZ_Ltanβl)',
      '  7. Quarter-wave transformer: Z_in = Z₀²/Z_L',
      '  8. Short-circuit stub: Z_in = jZ₀ tanβl (pure reactive)',
      '     Open-circuit stub: Z_in = −jZ₀ cotβl',
      '',
      'NAT PATTERNS: VSWR calculation, |Γ| for mixed terminations, Z_in at specific electrical lengths.',
      'Speed trick: Short-circuit stub at λ/4 → open circuit. Open-circuit stub at λ/4 → short circuit.',
    ].join('\n'),
    qualityChecks: [
      'Telegrapher\'s equations present',
      'Characteristic impedance with lossless simplification',
      'Reflection coefficient formula',
      'VSWR formula',
      'Input impedance for general termination',
      'Quarter-wave transformer case covered',
    ],
    tokenBudget: 2600,
  },

  /**
   * GATE EM × Waveguides × analytical × exam_readiness
   */
  'gate__waveguides__analytical__exam_readiness': {
    id: 'gate__waveguides__analytical__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: GATE EM — Waveguides (Analytical / Exam Readiness)',
      '',
      'CRITICAL WAVEGUIDE FACTS FOR GATE:',
      '  1. Mode classification: TE (H_z ≠ 0, E_z = 0), TM (E_z ≠ 0, H_z = 0). TEM impossible in hollow guide.',
      '  2. Rectangular guide (a × b, a > b):',
      '     Cutoff frequency: f_c(mn) = (c/2)√((m/a)² + (n/b)²)',
      '  3. Dominant mode TE₁₀: f_c = c/(2a)',
      '     H_z = H₀cos(πx/a)e^{−jβz}. No E_z component.',
      '  4. Phase/group velocities:',
      '     v_p = c/√(1−(f_c/f)²) > c    (phase: faster than light)',
      '     v_g = c√(1−(f_c/f)²) < c     (group: energy travels slower)',
      '     Identity: v_p × v_g = c²  ← frequent NAT trap answer',
      '  5. Single-mode bandwidth: frequencies between f_c(TE₁₀) and f_c(TE₂₀) = c/a.',
      '',
      'EXAM TRAP: v_p > c does not violate relativity — phase velocity carries no energy.',
    ].join('\n'),
    qualityChecks: [
      'TE/TM mode classification stated',
      'TEM impossibility in hollow guide stated',
      'Cutoff frequency formula for rectangular guide',
      'Dominant mode TE₁₀ identified with f_c formula',
      'v_p × v_g = c² identity stated',
      'Single-mode bandwidth concept explained',
    ],
    tokenBudget: 2400,
  },

  /**
   * GATE EM × Antennas × analytical × exam_readiness
   */
  'gate__antennas__analytical__exam_readiness': {
    id: 'gate__antennas__analytical__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: GATE EM — Antennas (Analytical / Exam Readiness)',
      '',
      'HIGH-VALUE GATE ANTENNA FORMULAS:',
      '  1. Hertzian dipole radiation resistance: R_rad = 80π²(dl/λ)²',
      '  2. Half-wave dipole: R_rad ≈ 73 Ω, gain G = 1.64 (2.15 dBi)',
      '  3. Directivity: D = 4πU_max / P_rad',
      '  4. Gain: G = η × D (η = antenna efficiency)',
      '  5. Effective aperture: A_e = Gλ²/(4π)',
      '  6. Friis transmission: P_r/P_t = G_t G_r (λ/4πR)²',
      '  7. HPBW of isotropic: not defined (uniform). HPBW of half-wave dipole: 78°.',
      '',
      'GATE TRAP: Gain and directivity are equal only for lossless antennas (η = 1).',
    ].join('\n'),
    qualityChecks: [
      'Hertzian dipole radiation resistance present',
      'Half-wave dipole gain stated (dBi)',
      'Directivity definition used',
      'Friis transmission equation applied',
      'Gain vs directivity distinction made',
    ],
    tokenBudget: 2200,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  GATE EM — EXAM-LEVEL (exam × style × objective)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GATE × visual × conceptual_understanding
   */
  'gate__visual__conceptual_understanding': {
    id: 'gate__visual__conceptual_understanding',
    systemPromptSuffix: [
      '',
      '## GATE EM VISUAL PROTOCOL',
      'For every electromagnetic field concept include ASCII art showing:',
      '',
      '  1. Field line pattern:',
      '       [+] -------→ [-]     (E-field from + to -)',
      '       Closed loops around current: ⊙ → counterclockwise B loops',
      '',
      '  2. Equipotential surfaces (⊥ to field lines):',
      '       ===  ===  ===   (equipotentials in uniform field between plates)',
      '',
      '  3. Vector cross-product directions (right-hand rule):',
      '       â_x × â_y = â_z.  Out-of-page: ⊙   Into-page: ⊗',
      '',
      '  4. Current loop and magnetic moment:',
      '       →→→ current loop → ↑ magnetic moment (right-hand curl)',
      '',
      'After every diagram add a "Reading the Diagram" paragraph mapping each visual element to physics.',
    ].join('\n'),
    qualityChecks: [
      'At least 1 ASCII field diagram present',
      'Vector directions shown (⊙ / ⊗ or arrows)',
      'Equipotential surfaces shown where relevant',
      '"Reading the Diagram" explanation present',
    ],
    tokenBudget: 2200,
  },

  /**
   * GATE × visual × exam_readiness
   */
  'gate__visual__exam_readiness': {
    id: 'gate__visual__exam_readiness',
    systemPromptSuffix: [
      '',
      '## GATE EM VISUAL EXAM-READINESS PROTOCOL',
      'Lead every MCQ or NAT solution with a quick ASCII sketch of the geometry.',
      'GATE best practice: draw first, calculate second.',
      '',
      'Diagram conventions:',
      '  Conductor surfaces:   ████',
      '  Dielectric boundary:  - - - - -',
      '  E-field vectors:      → E',
      '  B-field vectors:      ↑ B',
      '  H out-of-page:        ⊙ H',
      '  Current into page:    ⊗ J',
      '  Charge:               [+]  [-]',
      '',
      'For NAT problems: annotate diagram with known numerical values at each point.',
    ].join('\n'),
    qualityChecks: [
      'ASCII problem-setup diagram present before solution',
      'Field/current direction indicators used',
      'Known values annotated on diagram',
      'Diagram-first → calculation-second flow',
    ],
    tokenBudget: 2000,
  },

  /**
   * GATE × analytical × competitive_edge
   */
  'gate__analytical__competitive_edge': {
    id: 'gate__analytical__competitive_edge',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: GATE — Analytical × Competitive Edge',
      '',
      'TOPPER PROTOCOL FOR GATE:',
      '  1. Include at least one GATE PYQ (Previous Year Question) from 2019–2024 with full solution.',
      '  2. Show the "trap path" first (wrong approach many students take), then the correct approach.',
      '  3. For 2-mark problems: verify with dimensional analysis and limiting-case check.',
      '  4. Cross-topic connections: e.g. Transmission Lines ↔ LC circuits ↔ Complex impedance.',
      '  5. Flag every GATE-specific numerical precision requirement.',
    ].join('\n'),
    qualityChecks: [
      'PYQ (Previous Year Question) style problem included',
      'Trap path shown before correct solution',
      'Dimensional analysis verification present',
      'Cross-topic connection identified',
      'Numerical precision guidance for NAT',
    ],
    tokenBudget: 2800,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CAT — MOST-SPECIFIC (exam × topic × style × objective)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * CAT × Quantitative Aptitude × practice_first × exam_readiness
   */
  'cat__quantitative-aptitude__practice_first__exam_readiness': {
    id: 'cat__quantitative-aptitude__practice_first__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: CAT — Quantitative Aptitude (Practice First / Exam Readiness)',
      '',
      'CAT QA EXAM STRATEGY RULES:',
      '  1. TIME BUDGET: 90 seconds max per question. If not solved in 60s → SKIP (MCQ has −1 penalty).',
      '  2. TITA questions (Type In The Answer): No negative marking → attempt these FIRST.',
      '  3. APPROACH ORDER: Visualise → Estimate → Shortcut → Algebra (use algebra as last resort).',
      '  4. SPEED SHORTCUTS to demonstrate:',
      '     - Percentages: multiplier method (25% up = ×1.25, 20% down = ×0.80)',
      '     - Mixtures: alligation method for 2-component problems',
      '     - Work-time: LCM method (avoid fraction arithmetic)',
      '     - Number theory: unit-digit cyclicity for last-digit questions',
      '     - Geometry: Pythagorean triplets (3-4-5, 5-12-13, 8-15-17) before trigonometry',
      '  5. ELIMINATION: Test boundary values (x=0, x=1, x→∞) on MCQ options to eliminate 2 fast.',
      '  6. TRAP PATTERNS: "at least/at most", unordered vs ordered counting, inclusive/exclusive ranges.',
      '',
      'FORMAT REQUIREMENT: Solved example → shortcut → why it works (3-step structure per problem).',
    ].join('\n'),
    systemPromptSuffix: [
      '',
      '## TITA SECTION PROTOCOL',
      'For TITA-format problems in the batch:',
      '  - Label: [TITA — No Negative Marking]',
      '  - Show BOTH: algebraic approach AND estimation/shortcut',
      '  - Provide range check: "Answer must be between X and Y."',
    ].join('\n'),
    qualityChecks: [
      'Time budget (90s) strategy stated',
      'TITA vs MCQ approach differentiated',
      'At least 2 speed shortcut methods demonstrated',
      'Elimination strategy shown on at least 1 problem',
      'CAT trap patterns called out explicitly',
    ],
    tokenBudget: 2400,
  },

  /**
   * CAT × Reading Comprehension × story_driven × exam_readiness
   */
  'cat__reading-comprehension__story_driven__exam_readiness': {
    id: 'cat__reading-comprehension__story_driven__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: CAT — Reading Comprehension (Story-Driven / Exam Readiness)',
      '',
      'CAT RC META-STRATEGY (narrative framing):',
      '  Frame the student as a "passage detective" — they are hunting for:',
      '    🔍 The author\'s central claim',
      '    🔍 The evidence trail',
      '    🔍 The concession to the other side',
      '    🔍 What is implied but NOT stated',
      '',
      '  1. PASSAGE MAPPING (first 90 seconds):',
      '     Read para 1 + last para + first sentence of each middle para.',
      '     Goal: identify structure (argument / narrative / descriptive) before full reading.',
      '',
      '  2. AUTHOR INTENT:',
      '     Persuasive (argues a position): watch for "however", "but", "unfortunately".',
      '     Descriptive (explains): neutral tone, no clear stance.',
      '     Critical (challenges mainstream): compare current view vs author\'s challenge.',
      '',
      '  3. INFERENCE vs STATED vs OUT-OF-SCOPE (most common CAT RC traps):',
      '     STATED: explicitly in passage → mentally cite line.',
      '     INFERRED: logically follows but not stated → strongly supported by text.',
      '     OUT-OF-SCOPE: sounds reasonable but absent from passage → wrong answer.',
      '',
      '  4. TONE/ATTITUDE QUESTIONS:',
      '     Academic markers: albeit, notwithstanding, purported, erstwhile.',
      '     Emotional markers: alarming, unfortunate, surprisingly, ironically.',
    ].join('\n'),
    qualityChecks: [
      'Passage mapping technique demonstrated',
      'Author intent classification shown',
      'Inference vs stated vs out-of-scope distinction made',
      'Tone/attitude question strategy present',
      'At least 1 "Out-of-Scope" trap explained with example',
    ],
    tokenBudget: 2200,
  },

  /**
   * CAT × DILR × practice_first × exam_readiness
   */
  'cat__dilr__practice_first__exam_readiness': {
    id: 'cat__dilr__practice_first__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: CAT — DILR (Practice First / Exam Readiness)',
      '',
      'DILR EXAM PLAYBOOK:',
      '  1. SET SELECTION (2–3 min): Read all sets, attempt easier set first.',
      '     Easy signals: small grid (≤4 rows), few constraints, no circular arrangements.',
      '  2. SETUP BEFORE SOLVING:',
      '     - DI: Build the complete table/matrix before answering any question.',
      '     - LR: Draw a diagram (grid, Venn, ordering line, house matrix) before solving.',
      '  3. CONSTRAINTS FIRST: Fix the most restrictive constraint to anchor the solution.',
      '  4. ELIMINATION OVER DERIVATION: Eliminate impossible options to narrow the space.',
      '  5. PARTIAL-SET STRATEGY: If 3/4 questions in a set are solved → guess the 4th (positive EV).',
      '',
      'STRUCTURE: Problem set → Table/Diagram → Constraint deductions → Answers → Verification.',
    ].join('\n'),
    qualityChecks: [
      'Set selection strategy mentioned',
      'Table or diagram constructed before solving',
      'Constraint-first approach demonstrated',
      'All questions linked to same structured setup',
      'Verification step included',
    ],
    tokenBudget: 2400,
  },

  /**
   * CAT × Verbal Ability × story_driven × exam_readiness
   */
  'cat__verbal-ability__story_driven__exam_readiness': {
    id: 'cat__verbal-ability__story_driven__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: CAT — Verbal Ability (Story-Driven / Exam Readiness)',
      '',
      'CAT VA QUESTION TYPES AND STRATEGY:',
      '  1. PARA JUMBLES: Find the anchor sentence (most independent, often contains a proper noun or definition).',
      '     Link sentences in logical pairs before building the full sequence.',
      '  2. ODD SENTENCE OUT: The sentence that introduces a new topic, changes pronoun reference,',
      '     or contradicts the paragraph theme is the odd one.',
      '  3. PARA SUMMARY: The correct summary includes the central idea + at least 1 supporting point.',
      '     Trap: an answer that is true but too narrow (covers only one example) is wrong.',
      '',
      'STORY FRAME: Treat each paragraph as a short story:',
      '  Who? (subject) → Does what? (action) → Why? (reason) → So what? (implication)',
      'Map every sentence to this frame. Mismatches reveal the odd sentence or jumble errors.',
    ].join('\n'),
    qualityChecks: [
      'Para jumble anchor-sentence strategy shown',
      'Odd-sentence identification technique present',
      'Para summary trap explained',
      'Story frame applied to at least 1 example',
    ],
    tokenBudget: 2000,  },

  // ══════════════════════════════════════════════════════════════════════════
  //  JEE — EXAM-LEVEL (exam × style × objective)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * JEE × analytical × competitive_edge
   */
  'jee__analytical__competitive_edge': {
    id: 'jee__analytical__competitive_edge',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: JEE — Analytical × Competitive Edge',
      '',
      'JEE ADVANCED TOPPER PROTOCOL:',
      '  1. BOUNDARY CASE EMPHASIS: For every formula, state the boundary where it FAILS.',
      '     Example: F = ma fails at v → c (relativistic correction needed).',
      '     Example: Ideal gas law fails at high P or low T → Van der Waals.',
      '  2. MULTI-CORRECT VIGILANCE: JEE Advanced multi-correct — ALL correct options required.',
      '     Trap: a physically true statement that does not answer the specific question asked.',
      '  3. CROSS-TOPIC CONNECTIONS: Show linkages between domains.',
      '     Mechanics ↔ Electrostatics (energy methods), Thermodynamics ↔ Waves (resonance energy).',
      '  4. DERIVATION COMPLETENESS: Show steps that textbooks call "obvious" but JEE tests.',
      '     In EMI: explicitly apply Faraday before invoking Lenz\'s law.',
      '  5. SIGN CONVENTION RIGOUR: State sign convention at derivation start.',
      '     "Taking rightward as positive" — then maintain rigorously throughout.',
      '  6. PROBLEM STYLE: JEE Advanced integer-type, matrix-match, paragraph-based.',
    ].join('\n'),
    systemPromptSuffix: [
      '',
      '## TOPPER TWIST (REQUIRED)',
      'End with 1 problem where the expected shortcut FAILS and first-principles are needed.',
      'Format: "⚡ Topper Twist: [problem] — Warning: the obvious approach gives the wrong answer."',
    ].join('\n'),
    qualityChecks: [
      'At least 1 boundary case / limit analysis',
      'Multi-correct format awareness stated',
      'Cross-topic link identified',
      'Sign convention explicitly stated at derivation start',
      'Topper Twist question present',
    ],
    tokenBudget: 3000,
  },

  /**
   * JEE × practice_first × exam_readiness
   */
  'jee__practice_first__exam_readiness': {
    id: 'jee__practice_first__exam_readiness',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: JEE — Practice First × Exam Readiness',
      '',
      'JEE EXAM-CONDITION PROTOCOL:',
      '  1. Present a JEE-style problem FIRST — no theory preamble.',
      '  2. State time budget before solving: 2 min per 1-mark, 3 min per 2-mark.',
      '  3. Use JEE notation: |v| for speed (not v alone), â for unit vectors.',
      '  4. NEGATIVE MARKING:',
      '     JEE Main: −1 for wrong. Skip if P(correct) < 33%.',
      '     JEE Advanced: −2 for wrong multi-correct. Only attempt if very confident.',
      '  5. State answer in JEE key format: letter for MCQ, integer for integer-type.',
    ].join('\n'),
    qualityChecks: [
      'Problem presented before theory',
      'Time estimate stated',
      'Negative marking strategy mentioned',
      'Answer stated in exam-key format',
    ],
    tokenBudget: 2200,
  },

  /**
   * JEE × visual × conceptual_understanding
   */
  'jee__visual__conceptual_understanding': {
    id: 'jee__visual__conceptual_understanding',
    systemPromptSuffix: [
      '',
      '## JEE VISUAL PROTOCOL',
      'JEE problems are frequently set from diagrams. For EVERY concept:',
      '  1. Draw the physical setup first (free-body, circuit, ray diagram, etc.).',
      '  2. Label: forces with arrows ↑↓←→, angles with θ, distances with letters.',
      '  3. Show: before state and after state for dynamic problems.',
      '  4. Use: flow charts for multi-step reasoning chains.',
      '',
      'JEE-specific diagram types:',
      '  - Free body diagram: [object] with all forces labelled',
      '  - Circuit: R in series —|— parallel in brackets',
      '  - Ray diagrams: incident → normal → refracted with angles',
      '  - P-V diagrams: axes labelled, process path with direction arrow',
    ].join('\n'),
    qualityChecks: [
      'Physical setup diagram drawn before solving',
      'All forces/vectors labelled',
      'Before/after states shown for dynamic problems',
      'Diagram type appropriate to topic',
    ],
    tokenBudget: 2200,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  GENERIC — style × objective
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Generic: visual × conceptual_understanding
   */
  'visual__conceptual_understanding': {
    id: 'visual__conceptual_understanding',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: Generic Visual × Conceptual Understanding',
      '',
      'DIAGRAM-FIRST PROTOCOL:',
      'Draw an ASCII diagram of the concept BEFORE writing any prose.',
      '',
      'Diagram must:',
      '  (a) Label every component with a short descriptor',
      '  (b) Show cause → effect with arrows (→)',
      '  (c) Indicate relative magnitude where possible (longer arrow = stronger)',
      '  (d) Use spatial arrangement to communicate relationships',
      '',
      'DIAGRAM TEMPLATES:',
      '  Process/Flow:',
      '    [Input] → [Process A] → [Intermediate] → [Process B] → [Output]',
      '',
      '  Hierarchy:',
      '    Concept',
      '    ├── Sub-concept 1',
      '    │   ├── Property A',
      '    │   └── Property B',
      '    └── Sub-concept 2',
      '',
      '  Comparison table:',
      '    | Property | Option A | Option B |',
      '    |----------|----------|----------|',
      '    | X        | value    | value    |',
      '',
      'After each diagram: 2–3 sentence "What you\'re seeing" explanation.',
    ].join('\n'),
    qualityChecks: [
      'ASCII diagram present before text explanation',
      'All diagram components labelled',
      'Arrows used for cause-effect',
      '"What you\'re seeing" explanation present',
      'Hierarchy or comparison table used where appropriate',
    ],
    tokenBudget: 1800,
  },

  /**
   * Generic: analytical × quick_revision
   */
  'analytical__quick_revision': {
    id: 'analytical__quick_revision',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: Generic Analytical × Quick Revision',
      '',
      'CONDENSED DERIVATION PROTOCOL — student has < 5 minutes. Every word earns its place.',
      '',
      'MANDATORY FORMAT FOR EACH CONCEPT:',
      '  1. FORMULA (bold): **[result]**',
      '  2. DERIVATION (max 3 bullets):',
      '     • Start: [starting equation/principle]',
      '     • Step: [1 key transformation]',
      '     • Result: [final form]',
      '  3. WHEN TO USE: 1 line only.',
      '  4. TRAP: 1 line only.',
      '  5. EXAMPLE: plug-and-chug in 2 lines. No English narration.',
      '',
      'BANNED in quick revision:',
      '  ✗ "As we know from earlier..."',
      '  ✗ "It is interesting to note..."',
      '  ✗ Paragraphs longer than 2 sentences',
      '  ✗ Motivational introductions',
      '  ✗ Conclusions that restate the formula',
    ].join('\n'),
    qualityChecks: [
      'Formula bolded at top of each concept',
      'Derivation ≤ 3 bullets',
      'When-to-use stated in 1 line',
      'Trap stated in 1 line',
      'Example in ≤ 2 lines',
      'No filler text or motivational sentences',
    ],
    tokenBudget: 1200,
  },

  /**
   * Generic: story_driven × conceptual_understanding
   */
  'story_driven__conceptual_understanding': {
    id: 'story_driven__conceptual_understanding',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: Generic Story-Driven × Conceptual Understanding',
      '',
      'NARRATIVE STRUCTURE:',
      '  Act 1 — THE SITUATION: Set a relatable Indian student scene where the concept appears naturally.',
      '           (e.g., "Imagine you\'re on a train pulling out of Chennai Central station...")',
      '  Act 2 — THE PROBLEM: Something unexpected happens — the concept is the explanation.',
      '  Act 3 — THE REVEAL: The physics/math behind the situation, explained through the story.',
      '  Act 4 — THE PRINCIPLE: Now state the abstract concept, since the intuition is built.',
      '  Act 5 — WHERE IT BREAKS DOWN: The story analogy fails here — be honest about limitations.',
      '',
      'CULTURAL GROUNDING RULES:',
      '  - Use Indian contexts: train journeys, cricket, monsoon, autorickshaw physics, IRCTC scenarios.',
      '  - Avoid US-centric examples (baseball, Fahrenheit, miles).',
      '  - Use relatable numbers: ₹ for money, km/h for speed, °C for temperature.',
    ].join('\n'),
    qualityChecks: [
      'Story sets an Indian-context scene',
      'Concept revealed through narrative (not stated upfront)',
      'Abstract principle stated AFTER intuition is built',
      'Analogy breakdown/limitation stated',
      'No US-centric examples',
    ],
    tokenBudget: 1800,
  },

  /**
   * Generic: practice_first × skill_building
   */
  'practice_first__skill_building': {
    id: 'practice_first__skill_building',
    systemPromptPrefix: [
      '## TEMPLATE OVERRIDE: Generic Practice First × Skill Building',
      '',
      'SKILL-BUILDING THROUGH WORKED EXAMPLES:',
      '  Present problems in increasing difficulty: Easy → Medium → Hard.',
      '  For each: show the PROBLEM → SOLUTION → GENERALISATION (what pattern this teaches).',
      '',
      '  After 3 problems, add:',
      '  "PATTERN: All three problems share [X]. When you see [trigger], apply [strategy]."',
      '',
      '  End with an UNSOLVED PRACTICE PROBLEM with only a hint (not the solution).',
      '  "Now you try: [problem]. Hint: [single-sentence strategy hint]."',
    ].join('\n'),
    qualityChecks: [
      '3 worked examples in increasing difficulty',
      'Generalisation pattern extracted after examples',
      'Trigger → strategy mapping stated',
      'Unsolved practice problem with hint at end',
    ],
    tokenBudget: 2000,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  OBJECTIVE-ONLY BASE TEMPLATES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Base: competitive_edge (any exam, any style)
   */
  'competitive_edge': {
    id: 'competitive_edge',
    systemPromptSuffix: [
      '',
      '## COMPETITIVE EDGE BASELINE',
      'Regardless of exam or style, competitive_edge content must:',
      '  - Include at least one problem where the "obvious" shortcut fails.',
      '  - Show a boundary case or limiting behaviour of the main formula.',
      '  - Reference the highest-difficulty question variant tested in this exam.',
      '  - Treat the student as a peer who can handle rigorous content.',
    ].join('\n'),
    qualityChecks: [
      'Shortcut-failure example present',
      'Boundary case or limiting behaviour shown',
      'Highest-difficulty variant referenced',
    ],
    tokenBudget: 2500,
  },

  /**
   * Base: quick_revision (any exam, any style)
   */
  'quick_revision': {
    id: 'quick_revision',
    systemPromptSuffix: [
      '',
      '## QUICK REVISION BASELINE',
      'For ALL quick revision content:',
      '  - Total output must be skimmable in < 5 minutes.',
      '  - Use bullet points exclusively. No prose paragraphs.',
      '  - Bold every formula and key term.',
      '  - End with exactly 1 practice question (answer below it, separated by ----).',
    ].join('\n'),
    qualityChecks: [
      'Output can be read in < 5 minutes',
      'Bullet-point format throughout',
      'All formulas and key terms bolded',
      'Exactly 1 practice question with answer at end',
    ],
    tokenBudget: 900,
  },

  /**
   * Base: doubt_clearing (any exam, any style)
   */
  'doubt_clearing': {
    id: 'doubt_clearing',
    systemPromptSuffix: [
      '',
      '## DOUBT CLEARING BASELINE',
      'For ALL doubt-clearing content:',
      '  - Start by naming the likely source of confusion (specific, not generic).',
      '  - Address ONE idea at a time. Do not jump to the next until the first is clear.',
      '  - Use "Let\'s slow down here" markers before the hardest step.',
      '  - End with a CHECK QUESTION: if the student answers this correctly, the doubt is resolved.',
      '  - Never use "obviously" or "clearly".',
    ].join('\n'),
    qualityChecks: [
      'Likely confusion source named specifically',
      '"Let\'s slow down" marker used at hardest step',
      'Check question present at end',
      'No use of "obviously" or "clearly"',
    ],
    tokenBudget: 1500,
  },
};

// ─── Registry Lookup ──────────────────────────────────────────────────────────

/**
 * Look up the best matching template override for a given persona context.
 * Returns the override and the matched key, or null if no match found.
 */
export function resolveTemplate(
  examId: string,
  topic: string,
  style: string,
  objective: string,
): { override: TemplateOverride; key: string } | null {
  const keys = buildLookupKeys(examId, topic, style, objective);
  for (const key of keys) {
    if (TEMPLATE_REGISTRY[key]) {
      return { override: TEMPLATE_REGISTRY[key], key };
    }
  }
  return null;
}

/** Total number of template overrides in the registry (useful for tests/logging). */
export const REGISTRY_SIZE = Object.keys(TEMPLATE_REGISTRY).length;
