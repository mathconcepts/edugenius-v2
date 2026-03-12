/**
 * RevisionSchedule — full spaced repetition management page
 * Route: /revision
 * - Calendar heatmap (GitHub-style)
 * - Card list with retention bars
 * - Add Card form
 * - Due Today section
 */
import { useState, useEffect } from 'react';
import { Plus, CalendarClock, Brain, X } from 'lucide-react';
import {
  getAllCards,
  getDueCards,
  addCard,
  ensureSampleCards,
  type SRCard,
} from '@/services/spacedRepetition';
import { SpacedRepetitionWidget } from '@/components/SpacedRepetitionWidget';
import { useAppStore } from '@/stores/appStore';

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────

function CalendarHeatmap({ cards }: { cards: SRCard[] }) {
  const today = new Date();
  const days = 35; // 5 weeks

  const dayBuckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const ts = d.getTime();
    const dayStart = new Date(d).setHours(0, 0, 0, 0);
    const dayEnd = dayStart + 86400000;
    const count = cards.filter(c =>
      (c.nextReview >= dayStart && c.nextReview < dayEnd) ||
      (c.lastSeen >= dayStart && c.lastSeen < dayEnd)
    ).length;
    return { date: d, count };
  });

  const maxCount = Math.max(...dayBuckets.map(b => b.count), 1);

  return (
    <div>
      <div className="text-xs text-surface-400 mb-2">Review activity (5 weeks)</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs text-surface-600 pb-1">{d}</div>
        ))}
        {dayBuckets.map((b, i) => {
          const intensity = b.count / maxCount;
          const isToday = b.date.toDateString() === today.toDateString();
          const bg = b.count === 0
            ? 'bg-surface-800'
            : intensity < 0.33 ? 'bg-primary-900'
            : intensity < 0.66 ? 'bg-primary-700'
            : 'bg-primary-500';
          return (
            <div
              key={i}
              title={`${b.date.toDateString()}: ${b.count} cards`}
              className={`aspect-square rounded-sm ${bg} ${isToday ? 'ring-1 ring-white/40' : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Add Card form ────────────────────────────────────────────────────────────

function AddCardForm({ onAdd, onClose }: { onAdd: (c: SRCard) => void; onClose: () => void }) {
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [concept, setConcept] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !concept.trim()) return;
    const card = addCard(topic.trim(), subject.trim() || 'General', concept.trim());
    onAdd(card);
    setTopic(''); setSubject(''); setConcept('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-900 rounded-2xl max-w-md w-full border border-surface-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
          <h3 className="font-semibold text-white">Add Flash Card</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs text-surface-400 block mb-1">Topic *</label>
            <input
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              placeholder="e.g. Faraday's Law"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-surface-400 block mb-1">Subject</label>
            <input
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              placeholder="e.g. Electromagnetics"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-surface-400 block mb-1">Concept / Definition *</label>
            <textarea
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 resize-none"
              placeholder="Key concept, formula, or definition to remember..."
              rows={3}
              value={concept}
              onChange={e => setConcept(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface-800 text-surface-300 text-sm hover:bg-surface-700">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium">
              Add Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Retention Bar ────────────────────────────────────────────────────────────

function RetentionBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-surface-400">{score}%</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RevisionSchedule() {
  const spacedRepetitionEnabled = useAppStore(s => s.spacedRepetitionEnabled);
  const [cards, setCards] = useState<SRCard[]>([]);
  const [dueCards, setDueCards] = useState<SRCard[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadCards = () => {
    ensureSampleCards();
    setCards(getAllCards());
    setDueCards(getDueCards());
  };

  useEffect(() => { loadCards(); }, []);

  if (!spacedRepetitionEnabled) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <Brain className="w-12 h-12 text-surface-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Spaced Repetition is off</h2>
        <p className="text-surface-400 text-sm">Enable it in Settings → Advanced.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-primary-400" /> Revision Schedule
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">SM-2 spaced repetition · {cards.length} cards</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Card
        </button>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl bg-surface-800 border border-surface-700 p-4">
        <CalendarHeatmap cards={cards} />
      </div>

      {/* Due Today */}
      {dueCards.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-surface-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            Due Today ({dueCards.length})
          </h2>
          <SpacedRepetitionWidget />
        </div>
      )}

      {/* All cards */}
      <div>
        <h2 className="text-sm font-medium text-surface-400 uppercase tracking-wide mb-3">All Cards</h2>
        {cards.length === 0 ? (
          <div className="rounded-xl bg-surface-900 border border-surface-700 p-6 text-center">
            <Brain className="w-8 h-8 text-surface-600 mx-auto mb-2" />
            <p className="text-surface-400 text-sm">No cards yet. Add your first card!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map(card => {
              const isDue = card.nextReview <= Date.now();
              const daysUntil = Math.max(0, Math.round((card.nextReview - Date.now()) / 86400000));
              return (
                <div
                  key={card.id}
                  className={`rounded-xl border px-4 py-3 ${
                    isDue
                      ? 'bg-yellow-950/30 border-yellow-800/50'
                      : 'bg-surface-900 border-surface-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-medium text-sm">{card.topic}</span>
                        {isDue && (
                          <span className="text-xs bg-yellow-800 text-yellow-300 px-1.5 py-0.5 rounded-full">Due</span>
                        )}
                      </div>
                      <p className="text-xs text-surface-400 truncate">{card.concept}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <RetentionBar score={card.retentionScore} />
                      <span className="text-xs text-surface-500">
                        {isDue ? 'Review now' : `in ${daysUntil}d`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                    <span>{card.subject}</span>
                    <span>·</span>
                    <span>Rep #{card.repetitions}</span>
                    <span>·</span>
                    <span>EF {card.easeFactor.toFixed(1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddForm && (
        <AddCardForm
          onAdd={() => loadCards()}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
