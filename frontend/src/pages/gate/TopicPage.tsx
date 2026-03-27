/**
 * TopicPage — Problem list with staggered animations, mastery header, and solved indicators.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { MasteryRing } from '@/components/gate/MasteryRing';
import { ChevronLeft, ChevronRight, CheckCircle, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';

interface Problem {
  id: string;
  year: number;
  question_text: string;
  difficulty: string;
  marks: number;
  topic: string;
}

interface TopicMastery {
  topic: string;
  mastery: number;
  correct: number;
  attempts: number;
}

export default function TopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const sessionId = useSession();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [mastery, setMastery] = useState<TopicMastery | null>(null);
  const [loading, setLoading] = useState(true);

  const topicName = (topicId || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    if (!topicId) return;
    trackEvent('page_view', { page: 'topic', topic: topicId });

    Promise.all([
      apiFetch<{ problems: Problem[] }>(`/api/problems/${topicId}`),
      apiFetch<{ topics: TopicMastery[] }>(`/api/progress/${sessionId}`).catch(() => ({ topics: [] as TopicMastery[] })),
    ]).then(([problemRes, progressRes]) => {
      setProblems(problemRes.problems);
      const topicProgress = (progressRes.topics || []).find(t => t.topic === topicId);
      if (topicProgress) setMastery(topicProgress);
    }).finally(() => setLoading(false));
  }, [topicId, sessionId]);

  const difficultyColor = (d: string) => {
    if (d === 'easy') return 'text-emerald-400 bg-emerald-500/10';
    if (d === 'medium') return 'text-amber-400 bg-amber-500/10';
    return 'text-red-400 bg-red-500/10';
  };

  const masteryPct = mastery ? Math.round(mastery.mastery * 100) : 0;

  return (
    <motion.div
      className="space-y-5"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Back + Title + Mastery Ring */}
      <motion.div variants={fadeInUp} className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-surface-800 transition-colors">
          <ChevronLeft size={20} className="text-surface-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-surface-100">{topicName}</h1>
          <p className="text-xs text-surface-500">
            {problems.length} problems
            {mastery ? ` · ${mastery.correct}/${mastery.attempts} correct` : ''}
          </p>
        </div>
        {mastery && mastery.attempts > 0 && (
          <MasteryRing value={masteryPct} size={44} strokeWidth={3}>
            <span className="text-[10px] font-bold text-surface-300">{masteryPct}%</span>
          </MasteryRing>
        )}
      </motion.div>

      {/* Problem List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-800/60 animate-pulse" />
          ))}
        </div>
      ) : problems.length === 0 ? (
        <motion.div
          variants={fadeInUp}
          className="text-center py-16 space-y-3"
        >
          <BookOpen size={40} className="text-surface-700 mx-auto" />
          <p className="text-surface-400 font-medium">Coming soon!</p>
          <p className="text-sm text-surface-600">Problems for this topic are being verified and added.</p>
          <Link to="/" className="text-sky-400 hover:underline text-sm mt-2 inline-block">
            Back to topics
          </Link>
        </motion.div>
      ) : (
        <motion.div className="space-y-2" variants={staggerContainer}>
          {problems.map((problem, index) => (
            <motion.div key={problem.id} variants={fadeInUp}>
              <Link
                to={`/practice/${problem.id}`}
                className={clsx(
                  'flex items-center gap-3 p-4 rounded-xl border transition-all duration-200',
                  'bg-surface-900 border-surface-800 hover:border-sky-500/30 hover:bg-surface-800/80',
                  'active:scale-[0.99] group',
                )}
                onClick={() => trackEvent('problem_view', { problemId: problem.id, topic: topicId })}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200 line-clamp-2 leading-snug">
                    {problem.question_text.slice(0, 120)}
                    {problem.question_text.length > 120 ? '...' : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-surface-500">GATE {problem.year}</span>
                    <span className="text-surface-700">|</span>
                    <span className={clsx(
                      'text-xs px-1.5 py-0.5 rounded-full',
                      difficultyColor(problem.difficulty),
                      problem.difficulty === 'hard' && 'animate-pulse',
                    )}>
                      {problem.difficulty}
                    </span>
                    <span className="text-surface-700">|</span>
                    <span className="text-xs text-surface-500">{problem.marks}M</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-surface-600 shrink-0 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
