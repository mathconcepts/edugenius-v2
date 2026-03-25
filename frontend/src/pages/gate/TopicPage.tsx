/**
 * TopicPage — Problem list for a specific GATE math topic.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '@/hooks/useApi';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { clsx } from 'clsx';

interface Problem {
  id: string;
  year: number;
  question_text: string;
  difficulty: string;
  marks: number;
  topic: string;
}

export default function TopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  const topicName = (topicId || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    if (!topicId) return;
    apiFetch<{ problems: Problem[] }>(`/api/problems/${topicId}`)
      .then(res => setProblems(res.problems))
      .finally(() => setLoading(false));
  }, [topicId]);

  const difficultyColor = (d: string) => {
    if (d === 'easy') return 'text-emerald-400 bg-emerald-500/10';
    if (d === 'medium') return 'text-amber-400 bg-amber-500/10';
    return 'text-red-400 bg-red-500/10';
  };

  return (
    <div className="space-y-4">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-surface-800 transition-colors">
          <ChevronLeft size={20} className="text-surface-400" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-surface-100">{topicName}</h1>
          <p className="text-xs text-surface-500">{problems.length} problems</p>
        </div>
      </div>

      {/* Problem List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-800/60 animate-pulse" />
          ))}
        </div>
      ) : problems.length === 0 ? (
        <div className="text-center py-12 text-surface-500">
          <p>No problems found for this topic yet.</p>
          <Link to="/" className="text-sky-400 hover:underline text-sm mt-2 inline-block">
            Back to topics
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {problems.map(problem => (
            <Link
              key={problem.id}
              to={`/practice/${problem.id}`}
              className={clsx(
                'flex items-center gap-3 p-4 rounded-xl border transition-all duration-200',
                'bg-surface-900 border-surface-800 hover:border-sky-500/30 hover:bg-surface-800/80',
                'active:scale-[0.99]',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-surface-200 line-clamp-2 leading-snug">
                  {problem.question_text.slice(0, 120)}
                  {problem.question_text.length > 120 ? '...' : ''}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-surface-500">GATE {problem.year}</span>
                  <span className="text-surface-700">|</span>
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', difficultyColor(problem.difficulty))}>
                    {problem.difficulty}
                  </span>
                  <span className="text-surface-700">|</span>
                  <span className="text-xs text-surface-500">{problem.marks}M</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-surface-600 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
