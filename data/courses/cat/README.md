# CAT & MBA Entrance — EduGenius Course Material

This directory contains the complete course material for the CAT (Common Admission Test) and other MBA entrance exams, structured for use with EduGenius's AI tutoring platform.

## Structure

```
data/courses/cat/
├── README.md               ← You are here
├── syllabus.md             ← Full CAT 2024 syllabus
├── study-roadmap.md        ← 90-day preparation plan
├── blog/
│   └── crack-cat-in-90-days.md
└── topics/
    ├── 01-quantitative-aptitude/
    │   ├── lecture-notes.md
    │   ├── formula-sheet.md
    │   ├── mcqs.json         ← 15 MCQs
    │   └── teaching-tips.md
    ├── 02-verbal-ability/
    │   ├── lecture-notes.md
    │   ├── formula-sheet.md
    │   ├── mcqs.json         ← 15 MCQs
    │   └── teaching-tips.md
    ├── 03-reading-comprehension/
    │   ├── lecture-notes.md
    │   ├── formula-sheet.md
    │   ├── mcqs.json         ← 15 MCQs
    │   └── teaching-tips.md
    └── 04-dilr/
        ├── lecture-notes.md
        ├── formula-sheet.md
        ├── mcqs.json         ← 15 MCQs
        └── teaching-tips.md
```

## Content Summary

| Topic | MCQs | Difficulty Split | Key Coverage |
|-------|------|-----------------|--------------|
| Quantitative Aptitude | 15 | 5E/7M/3H | Number Systems, Arithmetic, Algebra, Geometry, Modern Math |
| Verbal Ability | 15 | 5E/7M/3H | Para-jumbles, Para-summary, Odd Sentence, Grammar |
| Reading Comprehension | 15 | 5E/7M/3H | Inference, Tone, Main Idea, Detail, Vocab-in-context |
| DILR | 15 | 5E/7M/3H | Tables, Charts, Arrangements, Grouping, Set Theory |
| **Total** | **60** | | All CAT 2024 sections covered |

## Exam Format (CAT 2024)

| Parameter | Value |
|-----------|-------|
| Total Questions | 66 |
| Duration | 120 minutes |
| Sections | VARC (24), DILR (22), Quant (22) |
| MCQ Marking | +3 / −1 |
| TITA Marking | +3 / 0 |
| Sectional Time Limit | 40 minutes per section |

## Usage in EduGenius

- **Sage (AI Tutor)**: Uses `catPyqContext.ts` for RAG-style grounding — 30 static PYQs (2019–2024) injected into Gemini context window
- **Practice Mode**: MCQs served from these JSON files
- **Topic Selection**: Topics map to `examRegistry.ts` topic slugs (`quantitative-aptitude`, `verbal-ability`, `reading-comprehension`, `dilr`)
- **Competitor Gap**: DILR and RC have weakest competitor coverage — prioritise in content marketing

## PYQ Coverage (in catPyqContext.ts)

30 questions from CAT 2019–2024 across all sections, embedded as static TypeScript for zero-latency context injection. No database required.
