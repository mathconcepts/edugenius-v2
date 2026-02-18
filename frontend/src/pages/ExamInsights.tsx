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
        }
        if (toppersRes.ok) {
          setTopperStories(await toppersRes.json());
        } else {
          // Fallback to curated mock data when API unavailable
          setTopperStories(MOCK_TOPPERS[selectedExam] ?? []);
        }
      } catch (error) {
        // API unavailable — use curated fallback data
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
