/**
 * DailyBrief page — full brief view with history and channel selector
 * Route: /daily-brief
 */
import { useState } from 'react';
import { MessageCircle, CheckCircle, XCircle, BarChart2, MessageSquare, Smartphone } from 'lucide-react';
import { DailyBriefCard } from '@/components/DailyBriefCard';
import { getBriefHistory } from '@/services/dailyBriefService';
import { useAppStore } from '@/stores/appStore';

type Channel = 'in-app' | 'whatsapp' | 'telegram';

function ChannelOption({
  id,
  icon: Icon,
  label,
  desc,
  active,
  comingSoon,
  onClick,
}: {
  id: Channel;
  icon: React.ElementType;
  label: string;
  desc: string;
  active: boolean;
  comingSoon?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={comingSoon}
      className={`flex items-start gap-3 w-full rounded-xl p-4 border text-left transition-all ${
        active
          ? 'border-primary-500 bg-primary-950/40'
          : comingSoon
          ? 'border-surface-700 bg-surface-900 opacity-50 cursor-not-allowed'
          : 'border-surface-700 bg-surface-900 hover:border-surface-500'
      }`}
    >
      <Icon className={`w-5 h-5 mt-0.5 ${active ? 'text-primary-400' : 'text-surface-400'}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${active ? 'text-white' : 'text-surface-200'}`}>{label}</span>
          {active && <span className="text-xs bg-primary-700 text-primary-200 px-2 py-0.5 rounded-full">Active</span>}
          {comingSoon && <span className="text-xs bg-surface-700 text-surface-400 px-2 py-0.5 rounded-full">Coming Soon</span>}
        </div>
        <p className="text-xs text-surface-400 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

export default function DailyBriefPage() {
  const { dailyBriefEnabled, dailyBriefChannel, setDailyBriefChannel } = useAppStore();
  const history = getBriefHistory(7);

  // Accuracy calculation
  const answered = history.filter(h => h.answered);
  const correct = history.filter(h => h.correct).length;
  const accuracy = answered.length > 0 ? Math.round((correct / answered.length) * 100) : 0;

  if (!dailyBriefEnabled) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <MessageCircle className="w-12 h-12 text-surface-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Daily Brief is off</h2>
        <p className="text-surface-400 text-sm">Enable it in Settings → Advanced to get daily concept briefs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-green-400" />
          Daily Brief
        </h1>
        <p className="text-sm text-surface-400 mt-0.5">One concept a day keeps exam anxiety away 🎯</p>
      </div>

      {/* Accuracy mini-chart */}
      {answered.length > 0 && (
        <div className="rounded-xl bg-surface-800 border border-surface-700 p-4 flex items-center gap-4">
          <BarChart2 className="w-5 h-5 text-green-400" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-surface-300">7-day accuracy</span>
              <span className="text-white font-bold">{accuracy}%</span>
            </div>
            <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  accuracy >= 70 ? 'bg-green-500' : accuracy >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <p className="text-xs text-surface-500 mt-1">{correct}/{answered.length} answered correctly</p>
          </div>
        </div>
      )}

      {/* Today's brief */}
      <div>
        <h2 className="text-sm font-medium text-surface-400 uppercase tracking-wide mb-3">Today's Brief</h2>
        <DailyBriefCard />
      </div>

      {/* Delivery channel selector */}
      <div>
        <h2 className="text-sm font-medium text-surface-400 uppercase tracking-wide mb-3">Delivery Channel</h2>
        <div className="space-y-2">
          <ChannelOption
            id="in-app"
            icon={Smartphone}
            label="In-App"
            desc="Brief appears on your dashboard every day. No setup needed."
            active={dailyBriefChannel === 'in-app'}
            onClick={() => setDailyBriefChannel('in-app')}
          />
          <ChannelOption
            id="whatsapp"
            icon={MessageCircle}
            label="WhatsApp"
            desc="Get your brief on WhatsApp every morning at 7 AM and answer right in chat."
            active={dailyBriefChannel === 'whatsapp'}
            comingSoon
            onClick={() => setDailyBriefChannel('whatsapp')}
          />
          <ChannelOption
            id="telegram"
            icon={MessageSquare}
            label="Telegram"
            desc="Get your brief via Telegram bot. Ideal for study groups."
            active={dailyBriefChannel === 'telegram'}
            comingSoon
            onClick={() => setDailyBriefChannel('telegram')}
          />
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-surface-400 uppercase tracking-wide mb-3">Recent History</h2>
          <div className="space-y-2">
            {history.map(({ brief, answered: ans, correct: cor }, idx) => (
              <div
                key={brief.id}
                className="flex items-center gap-3 rounded-xl bg-surface-900 border border-surface-700 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{brief.concept}</div>
                  <div className="text-xs text-surface-400">{brief.subject} · {idx === 0 ? 'Today' : brief.date}</div>
                </div>
                <div className="flex-shrink-0">
                  {!ans ? (
                    <span className="text-xs text-surface-500">Not answered</span>
                  ) : cor ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
