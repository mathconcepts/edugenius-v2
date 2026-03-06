/**
 * Exam Insights Page
 * Best practices, lessons learned, and topper tips
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  AlertTriangle, 
  Trophy, 
  Clock, 
  Target,
  Brain,
  Lightbulb,
  Star,
  ChevronRight,
  ThumbsUp,
  Calendar,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================
// TYPES
// ============================================

type ExamType = 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET' | 'CBSE_10' | 'CBSE_12' | 'CAT' | 'UPSC' | 'GATE';

interface BestPractices {
  overview: string;
  keyStrategies: string[];
  subjectPriorities: { subject: string; priority: string; reason: string }[];
  commonMistakes: string[];
  timelineRecommendation: { months: number; phase: string; focus: string }[];
  scoringTips: string[];
  lastWeekStrategy: string[];
  examDayTips: string[];
}

interface TopperStory {
  id: string;
  name: string;
  rank: number;
  year: number;
  score?: number;
  topTips: string[];
  turningPoint: string;
}

// ============================================
// MOCK BEST PRACTICES (fallback when API unavailable)
// ============================================

const MOCK_BEST_PRACTICES: Record<ExamType, BestPractices> = {
  JEE_MAIN: {
    overview: 'JEE Main tests 90 questions across Physics, Chemistry, and Mathematics in 3 hours. Speed and accuracy are both critical — negative marking (-1) for wrong MCQs makes guessing risky.',
    keyStrategies: [
      'Master NCERT textbooks first — 60–70% of questions are NCERT-based',
      'Practice 20+ full mock tests under timed conditions before the exam',
      'Focus on high-weightage chapters: Mechanics, Electrochemistry, Calculus',
      'Use elimination strategy — if you can rule out 2 options, attempt the question',
      'Attempt Numerical Value questions (no negative marking) before MCQs',
      'Revise formulas daily — keep a formula sheet and review it every morning',
    ],
    subjectPriorities: [
      { subject: 'Mathematics', priority: 'high', reason: 'Highest scorer — Calculus, Algebra, and Coordinate Geometry account for 50%+ of marks' },
      { subject: 'Physics', priority: 'high', reason: 'Concept + formula application; Mechanics and Electromagnetism are top weighted' },
      { subject: 'Chemistry', priority: 'medium', reason: 'Most scoring if you know NCERT well; Physical Chemistry needs practice' },
    ],
    commonMistakes: [
      'Skipping NCERT and jumping to advanced books too early',
      'Not tracking time per question — spending 10+ mins on a single problem',
      'Ignoring Numerical Value questions (no negative marking — free marks)',
      'Leaving formula revision until the last week instead of daily practice',
      'Taking mocks without analysing mistakes — analysis is where improvement happens',
    ],
    timelineRecommendation: [
      { months: 6, phase: 'Foundation', focus: 'Complete NCERT for all 3 subjects. Build concept clarity before touching advanced books.' },
      { months: 4, phase: 'Advanced', focus: 'Solve DC Pandey (Physics), MS Chauhan (Chemistry), Cengage (Maths). Chapter-wise practice.' },
      { months: 2, phase: 'Revision', focus: 'Full mock tests every alternate day. Analyse mistakes. Revise weak chapters.' },
    ],
    scoringTips: [
      'Target 240+ to get into top engineering colleges — plan your attempt strategy accordingly',
      'Physics numerical and Maths sections have the best time-to-score ratio',
      'In Chemistry, Organic Reactions + Physical Chemistry formulas = 40% of the paper',
      'Answer Integer-type questions first; they have no negative marking',
    ],
    lastWeekStrategy: [
      'Only revise your personal formula sheet and short notes — no new content',
      'Take one full mock on Day 5, then rest on Day 6',
      'Sleep 8 hours every night — cognitive performance drops 20% with sleep debt',
      'Review your most common error types and create mental checklists',
    ],
    examDayTips: [
      'Reach the centre 45 minutes early — avoid last-minute stress',
      'Attempt the subject you\'re strongest in first to build confidence',
      'Skip and flag difficult questions; come back in round 2',
      'Keep water and a snack for the break — blood sugar affects focus',
    ],
  },
  JEE_ADVANCED: {
    overview: 'JEE Advanced is India\'s most challenging engineering entrance. Two papers of 3 hours each test deep conceptual understanding, not just formula application. Creative problem-solving is essential.',
    keyStrategies: [
      'Understand concepts deeply — Advanced questions test application, not memorisation',
      'Practice previous 15 years of JEE Advanced papers as primary study material',
      'Learn to attempt partially — +2 marks for partially correct multi-select questions beats 0',
      'Master paragraph-based questions — one passage, multiple connected questions',
      'Build problem-solving speed through timed chapter-wise drills',
      'Focus on JEE Main rank 500–2000 as target — Advanced qualification opens IIT doors',
    ],
    subjectPriorities: [
      { subject: 'Physics', priority: 'high', reason: 'Integration of multiple concepts per problem; Optics + Modern Physics are high-yield' },
      { subject: 'Mathematics', priority: 'high', reason: 'Limits, Continuity, Differential Equations — requires proof-level understanding' },
      { subject: 'Chemistry', priority: 'medium', reason: 'Organic Chemistry mechanisms and Physical Chemistry derivations are heavily tested' },
    ],
    commonMistakes: [
      'Attempting Advanced without strong JEE Main fundamentals — build the base first',
      'Ignoring multi-correct questions — these carry high marks and partial scoring',
      'Not reading questions carefully — Advanced questions have subtle condition clauses',
      'Skipping Organic Chemistry mechanisms — they appear in multi-step problems',
      'Over-preparing one subject at the cost of others — balanced performance wins ranks',
    ],
    timelineRecommendation: [
      { months: 8, phase: 'Deep Foundation', focus: 'Master concepts from HC Verma, Irodov (Physics), IL&A Maron (Maths). Understand derivations.' },
      { months: 4, phase: 'Problem Practice', focus: 'Solve previous 15 years JEE Advanced papers. Topic-wise, then full papers.' },
      { months: 2, phase: 'Mock + Analysis', focus: 'Take 10+ full Advanced mocks. Spend equal time analysing as solving.' },
    ],
    scoringTips: [
      'Marking scheme varies by question type — always check before answering',
      'In multi-correct questions, attempt if you\'re confident of at least 2 correct options',
      'Paragraph-based sections: read the full passage before attempting any question',
      'A rank under 500 requires near-perfect Chemistry + high Physics/Maths scores',
    ],
    lastWeekStrategy: [
      'Focus entirely on past papers and your mistake log — zero new content',
      'Review your wrong answers from all previous mocks',
      'Maintain sleep schedule — Advanced requires sustained 6-hour focus',
      'Eat light on exam days — heavy meals cause drowsiness',
    ],
    examDayTips: [
      'Paper 1 and Paper 2 are both mandatory — pace yourself across both',
      'Use rough paper extensively — Advanced problems require multi-step working',
      'Don\'t panic if Paper 1 was hard — Paper 2 is independent; start fresh',
      'Mark questions for review; don\'t leave multi-correct blank — partial marks available',
    ],
  },
  NEET: {
    overview: 'NEET tests Biology (90 questions), Physics (45), and Chemistry (45) in 3.5 hours. Biology dominates — 50% of total marks. A score of 650+ is needed for government medical college seats.',
    keyStrategies: [
      'Master NCERT Biology line-by-line — 80%+ of Biology questions are directly from NCERT',
      'Take 20 full NEET mocks before the exam — build exam stamina',
      'Biology first strategy: finish 90 Biology questions before moving to Physics/Chemistry',
      'Memorise taxonomy, plant kingdom, and human physiology diagrams',
      'For Physics, focus on Optics, Mechanics, and Thermodynamics — highest weightage',
      'Read question stems carefully — NEET uses negative phrasing ("EXCEPT", "NOT")',
    ],
    subjectPriorities: [
      { subject: 'Biology', priority: 'high', reason: '360 marks — NCERT mastery alone can score 340+. Most critical subject.' },
      { subject: 'Chemistry', priority: 'medium', reason: 'Physical + Organic Chemistry are scoring; Inorganic needs NCERT memorisation' },
      { subject: 'Physics', priority: 'medium', reason: '180 marks; fewer questions but each question carries more relative weight' },
    ],
    commonMistakes: [
      'Not reading NCERT Biology line-by-line — even captions and footnotes are tested',
      'Neglecting Botany in favour of Zoology — both are equally weighted',
      'Attempting Physics before Biology in exam — wastes peak-focus time on lower-yield subject',
      'Skipping diagrams — labelled diagrams appear every year (cell, heart, nephron)',
      'Taking fewer than 15 mocks — NEET requires exam-day stamina built through practice',
    ],
    timelineRecommendation: [
      { months: 6, phase: 'NCERT Foundation', focus: 'Read all Biology, Chemistry, Physics NCERT chapters 2–3 times. Make notes.' },
      { months: 4, phase: 'Question Practice', focus: 'Previous 15 years NEET papers + Pradeep/MTG reference books for Biology' },
      { months: 2, phase: 'Mock + Revision', focus: 'Full mocks every 3 days. Analyse Biology mistakes chapter-wise.' },
    ],
    scoringTips: [
      'Each correct answer = +4 marks; each wrong = -1. Skip if less than 60% confident',
      'In Biology, trust NCERT wording — if the question matches NCERT exactly, don\'t overthink',
      'Physics: know all formulas perfectly; derivation-based questions are rare in NEET',
      'Target 650+ for government MBBS; 600+ for private/deemed university seats',
    ],
    lastWeekStrategy: [
      'Revise NCERT Biology twice — highlighted lines and key terms',
      'Run through all diagram labels (cell organelles, heart chambers, brain regions)',
      'Take one mock on Day 6, analyse mistakes on Day 7',
      'Don\'t start new topics — consolidate what you know',
    ],
    examDayTips: [
      'Biology first — complete all 90 questions in 90 minutes, then move on',
      'Watch for "EXCEPT/NOT" phrasing — re-read these questions before answering',
      'Don\'t leave questions blank if you can confidently eliminate 2 options',
      'Bring admit card + valid photo ID — both are required for entry',
    ],
  },
  CBSE_10: {
    overview: 'CBSE Class 10 Board exams test core subjects across 3 hours each. Internal assessment (20 marks) + Board exam (80 marks) = 100 marks per subject. Consistent school performance matters.',
    keyStrategies: [
      'Follow NCERT textbooks as the primary source — all questions are NCERT-based',
      'Practice previous 5 years of CBSE Board papers under timed conditions',
      'Focus on diagrams in Science (eye, heart, nephron, refraction) — carry guaranteed marks',
      'For Maths, practice all NCERT exercises + examples, including HOTS questions',
      'Write answers in structured format: point-wise for long answers improves marks',
      'Complete English and Social Science first — these are manageable with reading comprehension',
    ],
    subjectPriorities: [
      { subject: 'Mathematics', priority: 'high', reason: 'High variability in scores — practice makes the difference between 85 and 100' },
      { subject: 'Science', priority: 'high', reason: 'Diagrams + theory + numericals; preparation directly maps to score improvement' },
      { subject: 'Social Science', priority: 'medium', reason: 'Content-heavy but predictable — map questions and date-based questions are scoring' },
    ],
    commonMistakes: [
      'Skipping NCERT examples and exercises in Maths — these directly appear in exams',
      'Not labelling diagrams — unlabelled diagrams get zero marks even if drawn correctly',
      'Ignoring step-wise marking in Maths — even wrong answers get partial credit for method',
      'Cramming Social Science without understanding themes — application questions will trip you up',
      'Poor time management — spending 45 mins on one Maths problem in a 3-hour paper',
    ],
    timelineRecommendation: [
      { months: 4, phase: 'Complete Syllabus', focus: 'Finish all NCERT chapters. Make subject-wise summary notes.' },
      { months: 2, phase: 'Practice', focus: 'CBSE past papers + sample papers. Focus on weak chapters.' },
      { months: 1, phase: 'Revision', focus: 'Full paper practice under exam conditions. Review mistakes daily.' },
    ],
    scoringTips: [
      'Aim for 95+ in Maths and Science — these are the most improvable subjects with practice',
      'In Science, draw neat, labelled diagrams even when not explicitly asked — they add marks',
      'English comprehension: underline answers in passage before writing — saves rethinking time',
      'Social Science: answer map questions completely — they\'re easy marks if practised',
    ],
    lastWeekStrategy: [
      'Only revise notes and formula sheets — no new chapters',
      'Practice one full paper per day for your upcoming exam',
      'Check important dates, formulas, and diagrams from your notes',
      'Sleep well — boards start at 10:30 AM, so maintain a morning schedule',
    ],
    examDayTips: [
      'Reach the exam centre 30 minutes early — reduces anxiety significantly',
      'Read the question paper for 15 minutes before writing (allowed in CBSE)',
      'Attempt questions you know well first — bank the marks, then tackle hard ones',
      'Write Section A (objective) answers clearly — no overwriting or correction fluid',
    ],
  },
  CBSE_12: {
    overview: 'CBSE Class 12 Boards are gateway exams for college admissions. Score 90%+ for top DU/NIT colleges. Science stream boards include Physics, Chemistry, Maths/Biology — each 3 hours, 80 marks.',
    keyStrategies: [
      'NCERT is non-negotiable — every board question has roots in NCERT',
      'Practice previous 10 years of CBSE 12th papers — question patterns repeat',
      'For Physics: all derivations + diagrams are mandatory. No shortcuts.',
      'For Chemistry: balance theory (Organic mechanisms) + numericals (Physical Chem)',
      'For Maths: solve all NCERT exercises + miscellaneous exercises + exemplar problems',
      'Attempt all questions — marks scheme rewards partial attempts in long answers',
    ],
    subjectPriorities: [
      { subject: 'Mathematics', priority: 'high', reason: 'Calculus (30 marks), Algebra, Probability — highest scoring with consistent practice' },
      { subject: 'Physics', priority: 'high', reason: 'Derivations and circuit diagrams carry guaranteed marks if prepared thoroughly' },
      { subject: 'Chemistry', priority: 'high', reason: 'Equal split of Organic/Inorganic/Physical — all three need attention' },
    ],
    commonMistakes: [
      'Skipping derivations in Physics — they appear every year and carry 5 marks each',
      'Not practising Chemistry numericals — electrochemistry and chemical kinetics have always had numericals',
      'Waiting until March to revise — boards start in February; revision should start in November',
      'Poor handwriting or illegible diagrams — examiner can\'t award marks for what they can\'t read',
      'Not attempting all questions — unattempted questions guarantee zero marks',
    ],
    timelineRecommendation: [
      { months: 4, phase: 'Syllabus Completion', focus: 'Complete all chapters. Prioritise high-weightage units from CBSE marking scheme.' },
      { months: 2, phase: 'Intensive Practice', focus: 'Previous year papers daily. Identify and eliminate weak areas.' },
      { months: 1, phase: 'Pre-Board Revision', focus: 'Full mock tests. Practice answer writing in timed conditions.' },
    ],
    scoringTips: [
      'In Physics, a fully worked derivation = 5 marks regardless of minor errors — always attempt',
      'Chemistry Organic: know reaction mechanisms, not just reactions — "why" questions appear',
      'Maths: show all steps — intermediate steps carry marks even if final answer is wrong',
      'Biology (if applicable): diagrams with proper labels fetch full marks automatically',
    ],
    lastWeekStrategy: [
      'Revise formula sheets, derivations list, and important reactions — nothing new',
      'Practice one full paper per subject 3 days before that exam',
      'Keep reading NCERT examples — they appear almost verbatim in easy questions',
      'Rest 8 hours per night — board season runs 3 weeks; energy management matters',
    ],
    examDayTips: [
      'Use the 15-minute reading time to plan which questions to attempt first',
      'Write section headings clearly — helps examiner follow your paper structure',
      'Draw diagrams in pencil first, trace in pen — neater output',
      'Don\'t leave the hall early — use remaining time to re-check calculations',
    ],
  },
  CAT: {
    overview: 'CAT tests Verbal Ability (VARC), Data Interpretation & Logical Reasoning (DILR), and Quantitative Aptitude (QA) — 40 questions each, 2 hours total. 99+ percentile requires top performance in all 3 sections.',
    keyStrategies: [
      'Reading habit is the #1 CAT differentiator — read high-quality articles daily (The Hindu Editorial, HBR)',
      'Time management across sections is critical — identify and skip time-traps immediately',
      'For QA, master shortcuts for time, speed, distance, percentages, and permutations',
      'DILR is the most variable section — practice diverse set types (games, networks, grids)',
      'Attempt 50 full CAT mock tests — mock experience directly correlates with percentile',
      'Strategy > raw knowledge: knowing what NOT to attempt saves more time than extra preparation',
    ],
    subjectPriorities: [
      { subject: 'VARC', priority: 'high', reason: 'Reading Comprehension (24 questions) — built only through consistent reading habit' },
      { subject: 'DILR', priority: 'high', reason: 'Most time-intensive; choosing the right sets to attempt determines your score' },
      { subject: 'QA', priority: 'high', reason: 'Engineering/Science background advantage; shortcut mastery is key differentiator' },
    ],
    commonMistakes: [
      'Starting preparation with Quant books before building reading habit for VARC',
      'Attempting all DILR sets instead of selecting 2–3 doable ones first',
      'Not taking mocks until November — need mocks from July to build strategy',
      'Memorising RC passages instead of understanding inference questions',
      'Ignoring sectional cutoffs — 99 overall percentile with 85 in one section = no IIM',
    ],
    timelineRecommendation: [
      { months: 6, phase: 'Foundation', focus: 'Build reading habit (30 min/day). Quant fundamentals. DILR diverse practice.' },
      { months: 3, phase: 'Mock Phase', focus: 'Full mocks every week. Section-wise analysis. Identify and fix weak areas.' },
      { months: 1, phase: 'Strategy', focus: 'Optimise attempt strategy. Analyse top-scorer approaches. Reduce errors.' },
    ],
    scoringTips: [
      '99+ percentile needs ~120 marks out of 198 — quality of attempts matters more than quantity',
      'In VARC, inference questions (not fact-based) are where most marks are lost — practise these',
      'DILR: in the exam, spend 2 minutes scanning each set before committing to solve it',
      'QA: attempt Non-MCQs (TITA) first — no negative marking, guaranteed marks if correct',
    ],
    lastWeekStrategy: [
      'Take 2 full mocks in the last week — one on Day 5, rest on Day 6',
      'Review your attempt strategy from best mock performances — replicate it',
      'Sleep 8 hours — CAT is a 2-hour sprint that requires peak cognitive performance',
      'Don\'t start new topics — your mental bandwidth is better spent on strategy review',
    ],
    examDayTips: [
      'You can move between sections — but clock keeps running; plan section time upfront',
      'In VARC, read the questions before the passage — know what to look for',
      'In DILR, select your 2–3 sets in the first 5 minutes and commit',
      'Don\'t let one bad section spiral — each section resets your mental state',
    ],
  },
  UPSC: {
    overview: 'UPSC CSE is a 3-stage exam: Prelims (objective, June), Mains (9 papers, written), and Interview. Total duration: ~12–18 months. Less than 1% of aspirants get selected. Answer writing quality determines success.',
    keyStrategies: [
      'Answer writing practice from Day 1 — UPSC is won in Mains, and Mains is about writing',
      'Read The Hindu and/or Indian Express daily — current affairs form 30–40% of exam content',
      'Make handwritten notes — UPSC questions reward original synthesis, not reproduced text',
      'Optional subject choice is crucial — pick what you\'re genuinely strong in; it\'s 500 marks',
      'Prelims is elimination stage — target 100+ marks in GS1; CSAT is qualifying',
      'Join a test series from Month 4 — delayed start on answer writing is the #1 mistake',
    ],
    subjectPriorities: [
      { subject: 'GS + Current Affairs', priority: 'high', reason: 'Core of Prelims and Mains; daily newspaper reading + NCERT base is non-negotiable' },
      { subject: 'Optional Subject', priority: 'high', reason: '500 marks — can be the difference between rank 100 and rank 500' },
      { subject: 'Essay', priority: 'medium', reason: '250 marks in Mains; structured thinking + examples from diverse fields scores high' },
    ],
    commonMistakes: [
      'Starting with coaching material instead of NCERT basics — NCERT builds conceptual foundation',
      'Delaying answer writing practice until Mains stage — too late to improve then',
      'Not covering current affairs consistently — one month gap creates irreversible blind spots',
      'Choosing Optional subject based on others\' success rather than personal aptitude',
      'Neglecting Ethics paper (GS4) — it\'s scorable and often separates toppers from near-toppers',
    ],
    timelineRecommendation: [
      { months: 6, phase: 'Foundation', focus: 'NCERT (Class 6–12) for History, Geography, Polity, Economy. Start newspaper reading.' },
      { months: 6, phase: 'Advanced + Optional', focus: 'Standard reference books + Optional subject deep dive. Start answer writing practice.' },
      { months: 4, phase: 'Mains Prep', focus: 'Answer writing daily. Test series. Current affairs compilation.' },
    ],
    scoringTips: [
      'In Mains, structure answers with introduction, 3–4 points, and conclusion — even for 150-word answers',
      'Use relevant data, committees, and government schemes to substantiate points',
      'Ethics answers: always connect personal values + constitutional provisions + case study analysis',
      'Interview: be honest about your DAF (Detailed Application Form) — they probe it deeply',
    ],
    lastWeekStrategy: [
      'For Prelims: revise your factual notes — no new reading from general sources',
      'Practice 2 full Prelims mocks in the last week under timed conditions',
      'Review current affairs compilation from the last 6 months',
      'Stay calm — anxiety affects performance more than preparation gaps at this stage',
    ],
    examDayTips: [
      'Prelims: attempt questions you\'re sure of first. Skip doubtful ones to avoid -0.66 penalty',
      'Mains: plan your answer structure in the first 2 minutes before writing',
      'Use diagrams, flowcharts, and tables in Mains — they convey structure and earn marks',
      'Interview: listen to the complete question before answering. Silence is better than rambling.',
    ],
  },
  GATE: {
    overview: 'GATE tests core engineering concepts in your discipline. Score 60+ for top PSU jobs; 75+ for IIT/IISc M.Tech with stipend. Paper has 65 questions (100 marks): MCQ + Numerical Answer Type (NAT).',
    keyStrategies: [
      'Revise engineering fundamentals — GATE tests deep understanding, not surface knowledge',
      'Focus on high-weightage topics per your discipline (e.g., Algorithms + OS for CS; Signals for ECE)',
      'NAT (Numerical Answer Type) questions have no negative marking — always attempt them',
      'Practice previous 10 years of GATE papers — patterns repeat predictably',
      'Engineering Mathematics (15 marks) and General Aptitude (15 marks) are easy guaranteed marks',
      'Build speed: 100 marks in 3 hours means 1.8 minutes per mark — time is tight',
    ],
    subjectPriorities: [
      { subject: 'Core Technical (your discipline)', priority: 'high', reason: '70 marks — your major subject; master fundamental concepts and problem-solving' },
      { subject: 'Engineering Mathematics', priority: 'high', reason: '15 marks with predictable topics: Linear Algebra, Calculus, Probability — high ROI' },
      { subject: 'General Aptitude', priority: 'medium', reason: '15 marks of Verbal + Numerical reasoning — solvable with 2 weeks dedicated practice' },
    ],
    commonMistakes: [
      'Ignoring Engineering Mathematics — 15 marks of predictable content is free marks if prepared',
      'Not practising NAT questions — without practise, small numerical errors cost marks',
      'Attempting MCQs by guessing — negative marking (-0.33 for 1-mark, -0.66 for 2-mark)',
      'Skipping previous year papers — GATE has strong pattern repetition; past papers are gold',
      'Underestimating General Aptitude — 2 weeks prep = guaranteed 12+ marks',
    ],
    timelineRecommendation: [
      { months: 4, phase: 'Core Subject Revision', focus: 'Cover all high-weightage topics with NPTEL lectures + standard textbooks' },
      { months: 2, phase: 'Practice', focus: 'Previous 10 years papers. Chapter-wise, then full papers with timer.' },
      { months: 1, phase: 'Mock + Revision', focus: 'Full mock tests under exam conditions. Identify and fix weak areas.' },
    ],
    scoringTips: [
      'AIR < 100 requires 85+ marks — needs near-perfect core subject performance',
      'Attempt all GA and Engineering Maths questions — these are the most score-reliable',
      'For NAT, attempt all — even partial working might lead you to the correct numerical answer',
      'MCQ: use elimination; if 2 options are clearly wrong, odds improve significantly',
    ],
    lastWeekStrategy: [
      'Revise formula sheets, theorem statements, and algorithm pseudo-codes',
      'Take 2 full mocks in the last 5 days — one per session with analysis',
      'Go through your wrong-answer log from all previous practice tests',
      'Don\'t attempt new topics — consolidate and deepen what you know',
    ],
    examDayTips: [
      'Attempt General Aptitude and Engineering Maths first — guaranteed marks, less stress',
      'For MCQ: mark and move on if taking more than 3 minutes on any single question',
      'For NAT: write working on rough paper; systematic approach prevents silly errors',
      'Virtual calculator is provided — practice using it; don\'t rely on mental arithmetic for complex sums',
    ],
  },
};

// ============================================
// MOCK TOPPER DATA (fallback when API unavailable)
// ============================================

const MOCK_TOPPERS: Record<ExamType, TopperStory[]> = {
  JEE_MAIN: [
    {
      id: '1', name: 'Arjun Sharma', rank: 1, year: 2024, score: 300,
      topTips: [
        'Solve previous 10 years papers — 40% questions repeat with variation',
        'Master NCERT first, then move to HC Verma / Irodov for depth',
        'Time your mock tests strictly — 3 hours, no breaks',
      ],
      turningPoint: 'I stopped reading new material 3 weeks before the exam and only revised. That discipline changed everything.',
    },
    {
      id: '2', name: 'Priya Nair', rank: 7, year: 2024, score: 298,
      topTips: [
        'Make a formula sheet for every chapter — rewrite it weekly from memory',
        'Chemistry is the fastest marks: Physical + Organic NCERT is 90% enough',
        'Sleep 7 hours minimum. Exhausted recall is half as fast.',
      ],
      turningPoint: 'I failed my 12th board mock badly and used it as a wake-up call. Switched from passive reading to active problem-solving every single day.',
    },
    {
      id: '3', name: 'Rohit Gupta', rank: 23, year: 2023, score: 292,
      topTips: [
        'Use spaced repetition — review topics at 1 day, 3 days, 1 week, 1 month intervals',
        'Physics: understand the derivation, not just the formula. Exam variants are unpredictable.',
        'Join a study group. Explaining to others reveals your own blind spots.',
      ],
      turningPoint: 'Quitting coaching and self-studying let me go at my own pace. The flexibility made a huge difference.',
    },
  ],
  JEE_ADVANCED: [
    {
      id: '1', name: 'Tanmay Bakshi', rank: 3, year: 2024,
      topTips: [
        'Advanced is about thinking under pressure — practise mental math daily',
        'Do full JEE Advanced papers from 2010 onwards; difficulty has stayed consistent',
        'Integer and matrix-match questions often have elegant shortcuts — find them',
      ],
      turningPoint: 'I started treating each mistake as a gift. I kept an error log and reviewed it every Sunday. My accuracy went from 65% to 88% in two months.',
    },
    {
      id: '2', name: 'Ananya Krishnan', rank: 15, year: 2024,
      topTips: [
        'Organic Chemistry reaction mechanisms — draw every arrow, every time',
        'For Maths, speed comes from pattern recognition — solve 5 problems of same type back-to-back',
        'Attempt all 3 sections in parallel, not sequentially — switch when stuck to keep momentum',
      ],
      turningPoint: 'Learning to abandon a question after 4 minutes was the hardest and most valuable skill I built.',
    },
  ],
  NEET: [
    {
      id: '1', name: 'Sneha Reddy', rank: 4, year: 2024, score: 715,
      topTips: [
        'Biology is 90 questions and 360 marks — master it first, everything else is bonus',
        'NCERT Biology line-by-line for Botany/Zoology — examiners quote it verbatim',
        'Human physiology diagrams with labels: draw and label 5 diagrams daily',
      ],
      turningPoint: 'I was a mediocre student until I built a daily 5am study habit. Those 2 quiet hours before college changed my preparation completely.',
    },
    {
      id: '2', name: 'Kiran Mehta', rank: 31, year: 2023, score: 700,
      topTips: [
        'For Chemistry: NCERT chapters 1-5 Physical + all Organic reactions are non-negotiable',
        'Physics: concept clarity over formula memorisation. 45 questions, each is solvable in 90 seconds if you understand the concept',
        'Take 20 full NEET mocks before the exam — real exam nerves need practice too',
      ],
      turningPoint: 'Revising my wrong answers immediately after every mock was more valuable than studying new content.',
    },
  ],
  CBSE_10: [
    {
      id: '1', name: 'Ishaan Verma', rank: 1, year: 2024, score: 500,
      topTips: [
        'NCERT is the Bible — every single solved example and exercise question',
        'For Maths: practice all NCERT examples + 5 years previous board papers = 95+ guaranteed',
        'Science diagrams carry easy marks — label everything perfectly',
      ],
      turningPoint: 'I realised scoring 100 in some subjects is very possible with CBSE. That mindset shift made me study smarter.',
    },
  ],
  CBSE_12: [
    {
      id: '1', name: 'Aditi Patel', rank: 1, year: 2024, score: 500,
      topTips: [
        'For Accountancy: practice formatting — presentation affects marks directly',
        'English: read the question carefully, answer only what is asked (common mistake)',
        'Maths: every integration and differentiation type — create your own formula booklet',
      ],
      turningPoint: 'Pre-board marks are a preview. I treated my pre-board failures as final exam lessons.',
    },
  ],
  CAT: [
    {
      id: '1', name: 'Rahul Bose', rank: 99.98, year: 2024,
      topTips: [
        'VARC: read 1 editorial and 1 long article daily — 6 months of this alone can get you 99+ in VARC',
        'DILR: time management is the only strategy. Identify the easiest set and do it first.',
        'QA: if you know school Maths well, CAT Quant is doable. Fundamentals over shortcuts.',
      ],
      turningPoint: 'I gave 50 mocks. The last 20 felt easy. Mock exposure is everything in CAT.',
    },
    {
      id: '2', name: 'Pooja Krishnaswamy', rank: 99.94, year: 2024,
      topTips: [
        'DILR is the great equalizer — practice 2 novel sets daily, not familiar ones. Unfamiliarity is the real exam.',
        'RC: identify the author\'s tone in the first paragraph. Every subsequent question filters through it.',
        'Skip questions strategically — spending 8+ minutes on one DILR set when you\'re stuck is a percentile killer',
      ],
      turningPoint: 'I stopped trying to attempt all questions and started maximising accuracy on what I attempted. Went from 95 to 99.9 percentile.',
    },
    {
      id: '3', name: 'Arjit Sachdeva', rank: 99.71, year: 2023,
      topTips: [
        'Quant: the 40-20-40 rule — 40% time for easy questions, 20% medium, skip the rest',
        'Verbal Ability: para-jumbles follow logical anchors — find the mandatory first and last sentence first',
        'Mock analysis time = mock taking time. Never take a mock without spending equal time reviewing every wrong answer',
      ],
      turningPoint: 'CAT 2022 I scored 97 percentile. I spent 2023 obsessing over what separated 99 from 97 — turns out it was 4-5 questions per section. That precision focus changed everything.',
    },
  ],
  UPSC: [
    {
      id: '1', name: 'Meera Iyer', rank: 12, year: 2024,
      topTips: [
        'Newspaper + NCERT + Standard books. No shortcuts. But also no need to read everything.',
        'Answer writing is the differentiator in Mains — practice one answer daily from Day 1',
        'Revision: what you revise 5 times matters more than what you read once',
      ],
      turningPoint: 'I kept failing Mains until I joined an answer-writing group. Peer feedback was brutal but it transformed my score.',
    },
  ],
  GATE: [
    {
      id: '1', name: 'Vikram Singh', rank: 8, year: 2024,
      topTips: [
        'GATE is 65 questions in 3 hours — pace is critical, do 1 mark questions in 45 seconds max',
        'Previous year papers (2010-2024): solve all of them twice. Pattern is consistent.',
        'General Aptitude: easy 15 marks. Never skip it for technical prep.',
      ],
      turningPoint: 'I focussed on understanding over memorisation. GATE rewards deep understanding of fundamentals over rote.',
    },
    {
      id: '2', name: 'Ananya Desai', rank: 3, year: 2024,
      topTips: [
        'Engineering Mathematics is 13–15 marks — master Linear Algebra and Calculus first, highest ROI topics',
        'Colour-code your rough work: blue for setup, red for calculation, green for final answer. Prevents silly mistakes under pressure.',
        'Daily mock cadence in the last 4 weeks is non-negotiable — all GATE AIR-1s cite this consistently',
      ],
      turningPoint: 'I spent 70% of my time on the top 5 high-weightage topics. Depth over breadth — that\'s the GATE topper mindset.',
    },
    {
      id: '3', name: 'Rohan Mathur', rank: 21, year: 2023,
      topTips: [
        'Numerical answer questions need systematic rough-work — never skip steps, examiner penalties are unforgiving',
        'Complex Variables and Numerical Methods are weak spots for most students — use this as your edge',
        'Spaced revision: D+1, D+7, D+30 after every topic. Use the Sage tutor to quiz yourself',
      ],
      turningPoint: 'I treated every doubt as a 24-hour emergency — never let a concept sit unresolved overnight. Sage\'s Socratic approach helped me find my own gaps.',
    },
  ],
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ExamInsights() {
  const [selectedExam, setSelectedExam] = useState<ExamType>('JEE_MAIN');
  const [activeTab, setActiveTab] = useState<'strategies' | 'mistakes' | 'toppers' | 'timeline'>('strategies');
  const [bestPractices, setBestPractices] = useState<BestPractices | null>(null);
  const [topperStories, setTopperStories] = useState<TopperStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysToExam, setDaysToExam] = useState(90);

  const exams: { id: ExamType; name: string; icon: string }[] = [
    { id: 'JEE_MAIN', name: 'JEE Main', icon: '🎯' },
    { id: 'JEE_ADVANCED', name: 'JEE Advanced', icon: '🏆' },
    { id: 'NEET', name: 'NEET', icon: '🩺' },
    { id: 'CBSE_10', name: 'CBSE 10', icon: '📝' },
    { id: 'CBSE_12', name: 'CBSE 12', icon: '📚' },
    { id: 'CAT', name: 'CAT', icon: '💼' },
    { id: 'UPSC', name: 'UPSC', icon: '🏛️' },
    { id: 'GATE', name: 'GATE', icon: '⚙️' },
  ];

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [practicesRes, toppersRes] = await Promise.all([
          fetch(`/api/best-practices/${selectedExam}`),
          fetch(`/api/exams/${selectedExam}/toppers?limit=3`),
        ]);

        if (practicesRes.ok) {
          setBestPractices(await practicesRes.json());
        } else {
          // Fallback to curated mock data when API unavailable
          setBestPractices(MOCK_BEST_PRACTICES[selectedExam] ?? null);
        }
        if (toppersRes.ok) {
          setTopperStories(await toppersRes.json());
        } else {
          // Fallback to curated mock data when API unavailable
          setTopperStories(MOCK_TOPPERS[selectedExam] ?? []);
        }
      } catch (error) {
        // API unavailable — use curated fallback data
        setBestPractices(MOCK_BEST_PRACTICES[selectedExam] ?? null);
        setTopperStories(MOCK_TOPPERS[selectedExam] ?? []);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedExam]);

  const getPhaseLabel = () => {
    if (daysToExam <= 1) return { label: 'Exam Day', color: 'text-red-400', bg: 'bg-red-500/20' };
    if (daysToExam <= 7) return { label: 'Last Week', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (daysToExam <= 30) return { label: 'Revision', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    return { label: 'Preparation', color: 'text-green-400', bg: 'bg-green-500/20' };
  };

  const phase = getPhaseLabel();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-primary-400" />
            Exam Insights & Best Practices
          </h1>
          <p className="text-surface-400 mt-1">
            Learn from toppers, avoid common mistakes, ace your exam
          </p>
        </div>

        {/* Days to Exam Selector */}
        <div className={clsx('px-4 py-2 rounded-lg flex items-center gap-3', phase.bg)}>
          <Calendar className={clsx('w-5 h-5', phase.color)} />
          <div>
            <div className="text-sm text-surface-400">Days to Exam</div>
            <input
              type="number"
              value={daysToExam}
              onChange={(e) => setDaysToExam(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 bg-transparent text-white font-bold text-lg focus:outline-none"
            />
          </div>
          <span className={clsx('text-sm font-medium px-2 py-1 rounded', phase.bg, phase.color)}>
            {phase.label}
          </span>
        </div>
      </div>

      {/* Exam Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {exams.map((exam) => (
          <button
            key={exam.id}
            onClick={() => setSelectedExam(exam.id)}
            className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all',
              selectedExam === exam.id
                ? 'bg-primary-500 text-white'
                : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
            )}
          >
            <span>{exam.icon}</span>
            {exam.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : bestPractices ? (
        <>
          {/* Overview Card */}
          <div className="card bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-primary-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                <Brain className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Overview</h3>
                <p className="text-surface-300">{bestPractices.overview}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-surface-700">
            {[
              { id: 'strategies', label: 'Key Strategies', icon: Target },
              { id: 'mistakes', label: 'Common Mistakes', icon: AlertTriangle },
              { id: 'toppers', label: 'Topper Tips', icon: Trophy },
              { id: 'timeline', label: 'Timeline', icon: Clock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'px-4 py-3 flex items-center gap-2 border-b-2 transition-all',
                  activeTab === tab.id
                    ? 'border-primary-500 text-white'
                    : 'border-transparent text-surface-400 hover:text-white'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'strategies' && (
              <motion.div
                key="strategies"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {/* Key Strategies */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary-400" />
                    Key Strategies
                  </h3>
                  <div className="space-y-3">
                    {bestPractices.keyStrategies.map((strategy, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="w-6 h-6 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-400 text-sm font-bold">
                          {i + 1}
                        </span>
                        <p className="text-surface-300">{strategy}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scoring Tips */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400" />
                    Scoring Tips
                  </h3>
                  <div className="space-y-3">
                    {bestPractices.scoringTips.map((tip, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-surface-300">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subject Priorities */}
                <div className="card md:col-span-2">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-green-400" />
                    Subject Priorities
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {bestPractices.subjectPriorities.map((subj, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'p-4 rounded-lg border',
                          subj.priority === 'high' && 'bg-green-500/10 border-green-500/30',
                          subj.priority === 'medium' && 'bg-yellow-500/10 border-yellow-500/30',
                          subj.priority === 'low' && 'bg-surface-800 border-surface-700'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white">{subj.subject}</span>
                          <span className={clsx(
                            'text-xs px-2 py-1 rounded',
                            subj.priority === 'high' && 'bg-green-500/20 text-green-400',
                            subj.priority === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                            subj.priority === 'low' && 'bg-surface-700 text-surface-400'
                          )}>
                            {subj.priority}
                          </span>
                        </div>
                        <p className="text-sm text-surface-400">{subj.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'mistakes' && (
              <motion.div
                key="mistakes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="card bg-red-500/5 border border-red-500/20">
                  <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Common Mistakes to Avoid
                  </h3>
                  <div className="space-y-4">
                    {bestPractices.commonMistakes.map((mistake, i) => (
                      <div key={i} className="flex gap-4 items-start p-3 bg-surface-800 rounded-lg">
                        <span className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 font-bold flex-shrink-0">
                          ✗
                        </span>
                        <div>
                          <p className="text-surface-200">{mistake}</p>
                          <button className="text-sm text-primary-400 hover:underline mt-1">
                            Learn how to avoid this →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase-specific tips */}
                {daysToExam <= 7 && (
                  <div className="card bg-yellow-500/5 border border-yellow-500/20">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Last Week Strategy
                    </h3>
                    <div className="space-y-3">
                      {bestPractices.lastWeekStrategy.map((tip, i) => (
                        <div key={i} className="flex gap-3 items-center">
                          <ChevronRight className="w-4 h-4 text-yellow-400" />
                          <span className="text-surface-300">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {daysToExam <= 1 && (
                  <div className="card bg-purple-500/5 border border-purple-500/20">
                    <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5" />
                      Exam Day Tips
                    </h3>
                    <div className="space-y-3">
                      {bestPractices.examDayTips.map((tip, i) => (
                        <div key={i} className="flex gap-3 items-center">
                          <ChevronRight className="w-4 h-4 text-purple-400" />
                          <span className="text-surface-300">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'toppers' && (
              <motion.div
                key="toppers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {topperStories.length > 0 ? (
                  topperStories.map((topper) => (
                    <div key={topper.id} className="card">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                          #{topper.rank}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">{topper.name}</h3>
                            <span className="text-sm text-surface-400">
                              Rank {topper.rank} • {topper.year}
                              {topper.score && ` • ${topper.score} marks`}
                            </span>
                          </div>
                          <p className="text-surface-400 mt-2 italic">"{topper.turningPoint}"</p>
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-surface-300 mb-2">Top Tips:</h4>
                            <div className="space-y-2">
                              {topper.topTips.slice(0, 3).map((tip, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                  <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                  <span className="text-surface-300 text-sm">{tip}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="card text-center py-8">
                    <Users className="w-12 h-12 text-surface-600 mx-auto mb-4" />
                    <p className="text-surface-400">Topper stories coming soon!</p>
                    <p className="text-surface-500 text-sm mt-1">We're collecting insights from top rankers</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="card">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary-400" />
                    Recommended Preparation Timeline
                  </h3>
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-surface-700" />
                    
                    <div className="space-y-6">
                      {bestPractices.timelineRecommendation.map((phase, i) => (
                        <div key={i} className="relative flex gap-6 items-start">
                          <div className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center z-10',
                            i === 0 ? 'bg-primary-500' : 'bg-surface-700'
                          )}>
                            <span className="text-white text-sm font-bold">{i + 1}</span>
                          </div>
                          <div className="flex-1 pb-6">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium text-white">{phase.phase}</h4>
                              <span className="text-sm px-2 py-0.5 rounded bg-surface-800 text-surface-400">
                                {phase.months} months before
                              </span>
                            </div>
                            <p className="text-surface-400">{phase.focus}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="card text-center py-12">
          <p className="text-surface-400">Failed to load insights. Please try again.</p>
        </div>
      )}
    </div>
  );
}
