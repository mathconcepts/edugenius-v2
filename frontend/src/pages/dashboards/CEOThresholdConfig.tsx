/**
 * CEO Autonomy Settings — /autonomy-settings
 *
 * Live-editable threshold config.
 * Agent recommendations shown inline with confidence bars.
 * Changes save instantly to localStorage + broadcast to all agents.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Zap,
  Brain,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  loadThresholds,
  saveThresholds,
  applyAgentRecommendations,
  resetToDefaults,
  AGENT_RECOMMENDATIONS,
  type AgentRecommendation,
  type CEOThresholds,
} from '../../services/thresholdService';

// ── Config sections ────────────────────────────────────────────────────────────

interface ThresholdField {
  key: keyof CEOThresholds;
  label: string;
  description: string;
  type: 'currency' | 'percent' | 'count' | 'boolean' | 'confidence';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  emoji: string;
}

const THRESHOLD_FIELDS: { section: string; emoji: string; fields: ThresholdField[] }[] = [
  {
    section: 'Financial Autonomy',
    emoji: '💰',
    fields: [
      {
        key: 'maxSpendAutonomous',
        label: 'Max Autonomous Spend',
        description: 'Per-action spend limit before CEO approval required',
        type: 'currency',
        min: 500,
        max: 50000,
        step: 500,
        unit: '₹',
        emoji: '💸',
      },
      {
        key: 'maxDiscountPercent',
        label: 'Max Auto-Discount',
        description: 'Agents can offer discounts up to this % without asking',
        type: 'percent',
        min: 5,
        max: 50,
        step: 5,
        unit: '%',
        emoji: '🏷️',
      },
      {
        key: 'maxPriceChangePercent',
        label: 'Max Price Change',
        description: 'Pricing adjustments beyond this % need your approval',
        type: 'percent',
        min: 5,
        max: 40,
        step: 5,
        unit: '%',
        emoji: '📊',
      },
    ],
  },
  {
    section: 'Content & Marketing',
    emoji: '📢',
    fields: [
      {
        key: 'maxBlogPostsPerDay',
        label: 'Blog Posts per Day',
        description: 'Atlas publishes this many posts autonomously',
        type: 'count',
        min: 1,
        max: 10,
        step: 1,
        unit: '/day',
        emoji: '✍️',
      },
      {
        key: 'maxEmailsPerWeek',
        label: 'Emails per Week',
        description: 'Herald sends this many campaign emails per week',
        type: 'count',
        min: 1,
        max: 14,
        step: 1,
        unit: '/week',
        emoji: '📧',
      },
      {
        key: 'maxWhatsAppBlastsPerWeek',
        label: 'WhatsApp Blasts per Week',
        description: 'Mentor sends proactive messages up to this many times',
        type: 'count',
        min: 1,
        max: 7,
        step: 1,
        unit: '/week',
        emoji: '💬',
      },
    ],
  },
  {
    section: 'Operations',
    emoji: '⚙️',
    fields: [
      {
        key: 'maxNewStudentsAutoOnboard',
        label: 'Auto-Onboard Limit',
        description: 'Mentor handles onboarding autonomously up to this many new students',
        type: 'count',
        min: 50,
        max: 2000,
        step: 50,
        unit: '/day',
        emoji: '🎓',
      },
      {
        key: 'maxTicketsAutoResolve',
        label: 'Auto-Resolve Tickets',
        description: 'Nexus resolves tickets autonomously up to this many per day',
        type: 'count',
        min: 10,
        max: 500,
        step: 10,
        unit: '/day',
        emoji: '🎫',
      },
    ],
  },
  {
    section: 'AI Confidence Gate',
    emoji: '🧠',
    fields: [
      {
        key: 'minConfidenceToAct',
        label: 'Minimum Confidence to Act',
        description: 'Agents only act autonomously when their confidence score meets this bar',
        type: 'confidence',
        min: 0.5,
        max: 0.99,
        step: 0.05,
        unit: '%',
        emoji: '🎯',
      },
    ],
  },
  {
    section: 'Always Require Approval',
    emoji: '🔒',
    fields: [
      {
        key: 'requireApprovalForNewExam',
        label: 'New Exam Launches',
        description: 'Agents will always ask before launching a new exam',
        type: 'boolean',
        emoji: '📚',
      },
      {
        key: 'requireApprovalForPriceIncrease',
        label: 'Price Increases',
        description: 'Any price increase always requires your sign-off',
        type: 'boolean',
        emoji: '📈',
      },
      {
        key: 'requireApprovalForNewAgent',
        label: 'New Agent Deployment',
        description: 'Deploying a new AI agent always needs CEO approval',
        type: 'boolean',
        emoji: '🤖',
      },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatValue(field: ThresholdField, value: number | boolean): string {
  if (field.type === 'boolean') return value ? 'Required' : 'Auto-allowed';
  if (field.type === 'confidence') return `${((value as number) * 100).toFixed(0)}%`;
  if (field.type === 'currency') return `₹${(value as number).toLocaleString('en-IN')}`;
  if (field.type === 'percent') return `${value}%`;
  return String(value);
}

function formatRecValue(field: ThresholdField, val: number | boolean): string {
  if (field.type === 'confidence') return `${((val as number) * 100).toFixed(0)}%`;
  if (field.type === 'currency') return `₹${(val as number).toLocaleString('en-IN')}`;
  return `${val}${field.unit ?? ''}`;
}

function formatMin(field: ThresholdField): string {
  if (field.type === 'currency') return `₹${field.min?.toLocaleString('en-IN')}`;
  if (field.type === 'confidence') return `${((field.min ?? 0) * 100).toFixed(0)}%`;
  return `${field.min}${field.unit}`;
}

function formatMax(field: ThresholdField): string {
  if (field.type === 'currency') return `₹${field.max?.toLocaleString('en-IN')}`;
  if (field.type === 'confidence') return `${((field.max ?? 1) * 100).toFixed(0)}%`;
  return `${field.max}${field.unit}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CEOThresholdConfig() {
  const [thresholds, setThresholds] = useState<CEOThresholds>(loadThresholds);
  const [saved, setSaved] = useState(false);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'edugenius_ceo_thresholds' && e.newValue) {
        setThresholds(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateField = (key: keyof CEOThresholds, value: number | boolean) => {
    const updated = { ...thresholds, [key]: value };
    setThresholds(updated);
    saveThresholds(updated);
    flash();
  };

  const handleApplyRecommendations = () => {
    const updated = applyAgentRecommendations(thresholds);
    setThresholds(updated);
    saveThresholds(updated);
    flash();
  };

  const handleReset = () => {
    const defaults = resetToDefaults();
    setThresholds(defaults);
    flash();
  };

  const getRecommendation = (key: keyof CEOThresholds): AgentRecommendation | undefined =>
    AGENT_RECOMMENDATIONS.find(r => r.field === key);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary-400" />
            Autonomy Settings
          </h1>
          <p className="text-surface-400 mt-1 text-sm">
            Define what your agents decide alone vs what needs your approval.
            Changes apply instantly — agents check these on every action.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {saved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-emerald-400 text-sm"
            >
              <Check className="w-4 h-4" /> Saved
            </motion.span>
          )}
          <button
            onClick={handleApplyRecommendations}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Brain className="w-4 h-4" />
            Apply Agent Recommendations
          </button>
          <button
            onClick={handleReset}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Agent Recommendations Banner */}
      <div className="bg-primary-500/10 border border-primary-500/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-white font-medium text-sm">
              Your agents have analysed the data and have recommendations
            </p>
            <p className="text-surface-400 text-xs mt-1">
              Based on campaign performance, student engagement patterns, and market benchmarks.
              Click "Apply Agent Recommendations" to use all, or review each one below.
            </p>
          </div>
        </div>
      </div>

      {/* Threshold sections */}
      {THRESHOLD_FIELDS.map(section => (
        <div
          key={section.section}
          className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-surface-800">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span>{section.emoji}</span> {section.section}
            </h2>
          </div>
          <div className="divide-y divide-surface-800">
            {section.fields.map(field => {
              const rec = getRecommendation(field.key);
              const currentValue = thresholds[field.key] as number | boolean;
              const hasRec = rec !== undefined && rec.recommendedValue !== currentValue;

              return (
                <div key={field.key} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Label + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{field.emoji}</span>
                        <span className="text-white font-medium text-sm">{field.label}</span>
                        {hasRec && rec && (
                          <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Agent rec: {formatRecValue(field, rec.recommendedValue)}
                          </span>
                        )}
                      </div>
                      <p className="text-surface-400 text-xs mt-0.5">{field.description}</p>
                    </div>

                    {/* Control */}
                    <div className="flex-shrink-0 text-right min-w-[140px]">
                      {field.type === 'boolean' ? (
                        <button
                          onClick={() => updateField(field.key, !currentValue)}
                          className={clsx(
                            'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                            currentValue
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
                          )}
                        >
                          {currentValue ? '🔒 Required' : '✅ Auto-allowed'}
                        </button>
                      ) : (
                        <div>
                          <div className="text-white font-bold text-lg">
                            {formatValue(field, currentValue)}
                          </div>
                          <input
                            type="range"
                            min={field.type === 'confidence' ? (field.min ?? 0) * 100 : field.min}
                            max={field.type === 'confidence' ? (field.max ?? 1) * 100 : field.max}
                            step={field.type === 'confidence' ? (field.step ?? 0.05) * 100 : field.step}
                            value={
                              field.type === 'confidence'
                                ? (currentValue as number) * 100
                                : (currentValue as number)
                            }
                            onChange={e => {
                              const raw = parseFloat(e.target.value);
                              updateField(
                                field.key,
                                field.type === 'confidence' ? raw / 100 : raw,
                              );
                            }}
                            className="w-full mt-1 accent-primary-500"
                          />
                          <div className="flex justify-between text-xs text-surface-500 mt-0.5">
                            <span>{formatMin(field)}</span>
                            <span>{formatMax(field)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent recommendation detail */}
                  {rec && (
                    <div className="mt-3">
                      <button
                        onClick={() =>
                          setExpandedRec(expandedRec === field.key ? null : field.key)
                        }
                        className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
                      >
                        <Info className="w-3 h-3" />
                        Why {rec.computedBy} recommends{' '}
                        {formatRecValue(field, rec.recommendedValue)}
                        {expandedRec === field.key ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      {expandedRec === field.key && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 p-3 bg-surface-800 rounded-xl overflow-hidden"
                        >
                          <p className="text-xs text-surface-400 mb-2">{rec.reasoning}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-surface-500">Confidence:</span>
                            <div className="flex-1 bg-surface-700 rounded-full h-1.5">
                              <div
                                className="bg-primary-500 h-1.5 rounded-full"
                                style={{ width: `${rec.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-primary-400">
                              {(rec.confidence * 100).toFixed(0)}%
                            </span>
                            {field.type !== 'boolean' && (
                              <button
                                onClick={() =>
                                  updateField(field.key, rec.recommendedValue as number)
                                }
                                className="text-xs text-primary-400 hover:text-primary-300 underline ml-2"
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Current config JSON (for devs) */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-surface-400 mb-3">Current Config (JSON)</h3>
        <pre className="text-xs text-surface-300 overflow-auto bg-surface-950 p-4 rounded-xl">
          {JSON.stringify(thresholds, null, 2)}
        </pre>
      </div>
    </div>
  );
}
