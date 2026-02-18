/**
 * CEO Pricing Dashboard
 * 
 * Full control over:
 * - Pricing plans (CRUD)
 * - Feature gates
 * - Exam-specific configs
 * - A/B tests
 * - Agent recommendations
 */

import { useState } from 'react';
import { usePricingStore } from '@/stores/pricingStore';
import type { PricingPlan, PricingTier, FeatureGate, ExamPricingConfig } from '@/types/pricing';

// ============================================
// MAIN DASHBOARD
// ============================================

export default function PricingDashboard() {
  const [activeTab, setActiveTab] = useState<'plans' | 'gates' | 'exams' | 'tests' | 'settings'>('plans');
  const store = usePricingStore();

  const tabs = [
    { id: 'plans', label: 'Pricing Plans', icon: '💰' },
    { id: 'gates', label: 'Feature Gates', icon: '🚪' },
    { id: 'exams', label: 'Exam Configs', icon: '📚' },
    { id: 'tests', label: 'A/B Tests', icon: '🔬' },
    { id: 'settings', label: 'Global Settings', icon: '⚙️' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pricing Configuration</h1>
          <p className="text-surface-400">Manage freemium model and pricing tiers</p>
        </div>
        <div className="flex gap-3">
          {store.hasUnsavedChanges && (
            <span className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-full text-sm">
              Unsaved changes
            </span>
          )}
          <button
            onClick={() => store.publishConfig()}
            className="btn btn-primary"
            disabled={!store.hasUnsavedChanges}
          >
            Publish Changes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-700 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'text-surface-400 hover:text-white hover:bg-surface-800'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'gates' && <FeatureGatesTab />}
        {activeTab === 'exams' && <ExamConfigsTab />}
        {activeTab === 'tests' && <ABTestsTab />}
        {activeTab === 'settings' && <GlobalSettingsTab />}
      </div>

      {/* Agent Recommendations Panel */}
      <AgentRecommendationsPanel />
    </div>
  );
}

// ============================================
// PLANS TAB
// ============================================

function PlansTab() {
  const store = usePricingStore();
  const plans = store.getPlans();
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Plans" value={plans.length} icon="📋" />
        <StatCard label="Freemium" value={plans.filter(p => p.tier === 'free').length > 0 ? 'Enabled' : 'Disabled'} icon="🆓" />
        <StatCard label="Avg Price" value={`₹${Math.round(plans.filter(p => p.pricing.monthlyPrice > 0).reduce((a, p) => a + p.pricing.monthlyPrice, 0) / plans.filter(p => p.pricing.monthlyPrice > 0).length || 0)}`} icon="💵" />
        <StatCard label="Popular Plan" value={plans.find(p => p.isPopular)?.name || 'None'} icon="⭐" />
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={() => setEditingPlan(plan)}
            onDelete={() => store.deletePlan(plan.id)}
            onDuplicate={() => store.duplicatePlan(plan.id, `${plan.name} Copy`)}
          />
        ))}
        <AddPlanCard onClick={() => setEditingPlan({} as PricingPlan)} />
      </div>

      {/* Plan Editor Modal */}
      {editingPlan && (
        <PlanEditorModal
          plan={editingPlan}
          onSave={(plan) => {
            if (plan.id) {
              store.updatePlan(plan.id, plan);
            } else {
              store.createPlan(plan);
            }
            setEditingPlan(null);
          }}
          onClose={() => setEditingPlan(null)}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, onEdit, onDelete, onDuplicate }: {
  plan: PricingPlan;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const tierColors: Record<PricingTier, string> = {
    free: 'border-gray-500',
    starter: 'border-blue-500',
    pro: 'border-purple-500',
    unlimited: 'border-yellow-500',
    enterprise: 'border-green-500',
  };

  return (
    <div className={`card p-4 border-2 ${tierColors[plan.tier]} relative`}>
      {plan.isPopular && (
        <div className="absolute -top-2 -right-2 px-2 py-1 bg-primary-600 text-white text-xs rounded-full">
          Popular
        </div>
      )}
      
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white text-lg">{plan.name}</h3>
        <span className="text-xs text-surface-400 uppercase">{plan.tier}</span>
      </div>
      
      <p className="text-surface-400 text-sm mb-3">{plan.tagline}</p>
      
      <div className="mb-4">
        <span className="text-3xl font-bold text-white">₹{plan.pricing.monthlyPrice}</span>
        <span className="text-surface-400">/mo</span>
        {plan.pricing.yearlyDiscount > 0 && (
          <div className="text-xs text-green-400">
            Save {plan.pricing.yearlyDiscount}% yearly
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className={plan.limits.dailyQuestions === -1 ? 'text-green-400' : 'text-surface-400'}>
            {plan.limits.dailyQuestions === -1 ? '∞' : plan.limits.dailyQuestions} questions/day
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={plan.features.pyqAccess ? 'text-green-400' : 'text-surface-500'}>
            {plan.features.pyqAccess ? '✓' : '✗'} PYQ Access
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={plan.features.interactiveSimulations ? 'text-green-400' : 'text-surface-500'}>
            {plan.features.interactiveSimulations ? '✓' : '✗'} Simulations
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={plan.features.whatsappAccess ? 'text-green-400' : 'text-surface-500'}>
            {plan.features.whatsappAccess ? '✓' : '✗'} WhatsApp
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onEdit} className="btn btn-sm flex-1 bg-surface-700">Edit</button>
        <button onClick={onDuplicate} className="btn btn-sm bg-surface-700">📋</button>
        <button onClick={onDelete} className="btn btn-sm bg-red-600/20 text-red-400">🗑️</button>
      </div>
    </div>
  );
}

function AddPlanCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card p-4 border-2 border-dashed border-surface-600 hover:border-primary-500 flex items-center justify-center min-h-[300px] transition-colors"
    >
      <div className="text-center">
        <span className="text-4xl mb-2 block">➕</span>
        <span className="text-surface-400">Add New Plan</span>
      </div>
    </button>
  );
}

// ============================================
// FEATURE GATES TAB
// ============================================

function FeatureGatesTab() {
  const store = usePricingStore();
  const gates = store.getFeatureGates();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Feature Access Gates</h2>
        <p className="text-sm text-surface-400">Control which features are available at each tier</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-400">Feature</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-surface-400">Free</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-surface-400">Starter</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-surface-400">Pro</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-surface-400">Unlimited</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-surface-400">Hits</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-surface-400">Conv %</th>
            </tr>
          </thead>
          <tbody>
            {gates.map((gate) => (
              <FeatureGateRow key={gate.id} gate={gate} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureGateRow({ gate }: { gate: FeatureGate }) {
  const store = usePricingStore();
  const tiers: PricingTier[] = ['free', 'starter', 'pro', 'unlimited'];

  const getValue = (tier: PricingTier) => {
    if (gate.gateType === 'boolean') {
      return gate.enabledTiers?.includes(tier) ? '✓' : '✗';
    }
    if (gate.gateType === 'limit') {
      const limit = gate.limitByTier?.[tier] ?? 0;
      return limit === -1 ? '∞' : limit;
    }
    if (gate.gateType === 'tier_minimum') {
      const tierOrder: PricingTier[] = ['free', 'starter', 'pro', 'unlimited', 'enterprise'];
      return tierOrder.indexOf(tier) >= tierOrder.indexOf(gate.minimumTier!) ? '✓' : '✗';
    }
    return '-';
  };

  const getColor = (tier: PricingTier) => {
    const value = getValue(tier);
    if (value === '✓' || value === '∞') return 'text-green-400';
    if (value === '✗') return 'text-red-400';
    return 'text-surface-300';
  };

  return (
    <tr className="border-t border-surface-700 hover:bg-surface-800/50">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-white">{gate.displayName}</p>
          <p className="text-xs text-surface-400">{gate.description}</p>
        </div>
      </td>
      {tiers.map((tier) => (
        <td key={tier} className={`px-4 py-3 text-center ${getColor(tier)}`}>
          {getValue(tier)}
        </td>
      ))}
      <td className="px-4 py-3 text-center text-surface-400">{gate.gateHitCount}</td>
      <td className="px-4 py-3 text-center text-primary-400">{gate.conversionRate}%</td>
    </tr>
  );
}

// ============================================
// EXAM CONFIGS TAB
// ============================================

function ExamConfigsTab() {
  const store = usePricingStore();
  const configs = store.getExamConfigs();
  const [selectedExam, setSelectedExam] = useState<string | null>(null);

  const defaultExams = ['JEE Main', 'JEE Advanced', 'NEET', 'CBSE 10', 'CBSE 12', 'CAT', 'UPSC'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Exam-Specific Pricing</h2>
        <button className="btn btn-primary btn-sm">+ Add Exam Config</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {defaultExams.map((exam) => {
          const config = configs.find((c) => c.examType === exam);
          return (
            <div
              key={exam}
              className={`card p-4 cursor-pointer transition-colors ${
                selectedExam === exam ? 'border-primary-500' : 'hover:border-surface-600'
              }`}
              onClick={() => setSelectedExam(exam)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">{exam}</h3>
                {config?.pilotMode && (
                  <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded">
                    Pilot
                  </span>
                )}
              </div>
              
              {config ? (
                <div className="space-y-1 text-sm">
                  <p className="text-surface-400">
                    Competitors tracked: {config.competitorPricing?.length || 0}
                  </p>
                  <p className="text-surface-400">
                    Custom pricing: {config.pricingOverrides ? 'Yes' : 'No'}
                  </p>
                  {config.launchDate && (
                    <p className="text-green-400">
                      Launch: {new Date(config.launchDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-surface-500 text-sm">Not configured</p>
              )}
            </div>
          );
        })}
      </div>

      {selectedExam && (
        <ExamConfigEditor
          examType={selectedExam}
          config={configs.find((c) => c.examType === selectedExam)}
          onSave={(config) => {
            if (configs.find((c) => c.examType === selectedExam)) {
              store.updateExamConfig(selectedExam, config);
            } else {
              store.createExamConfig({ ...config, examType: selectedExam, examName: selectedExam, pilotMode: true });
            }
          }}
        />
      )}
    </div>
  );
}

function ExamConfigEditor({ examType, config, onSave }: {
  examType: string;
  config?: ExamPricingConfig;
  onSave: (config: Partial<ExamPricingConfig>) => void;
}) {
  const [pilotMode, setPilotMode] = useState(config?.pilotMode ?? true);
  const [pilotUserLimit, setPilotUserLimit] = useState(config?.pilotUserLimit ?? 100);

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{examType} Configuration</h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-white mb-3">Launch Settings</h4>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pilotMode}
                onChange={(e) => setPilotMode(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-surface-200">Pilot Mode (limited users)</span>
            </label>
            
            {pilotMode && (
              <div>
                <label className="text-sm text-surface-400">Pilot User Limit</label>
                <input
                  type="number"
                  value={pilotUserLimit}
                  onChange={(e) => setPilotUserLimit(Number(e.target.value))}
                  className="w-full mt-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-medium text-white mb-3">Competitor Data (from Scout)</h4>
          {config?.competitorPricing && config.competitorPricing.length > 0 ? (
            <div className="space-y-2">
              {config.competitorPricing.map((comp, i) => (
                <div key={i} className="p-2 bg-surface-800 rounded text-sm">
                  <span className="text-white">{comp.competitor}</span>
                  <span className="text-surface-400 ml-2">₹{comp.monthlyPrice}/mo</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 text-sm">No competitor data. Scout agent will populate this.</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => onSave({ pilotMode, pilotUserLimit })}
          className="btn btn-primary"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}

// ============================================
// A/B TESTS TAB
// ============================================

function ABTestsTab() {
  const store = usePricingStore();
  const tests = store.getABTests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Pricing A/B Tests</h2>
        <button className="btn btn-primary btn-sm">+ Create Test</button>
      </div>

      {tests.length > 0 ? (
        <div className="space-y-4">
          {tests.map((test) => (
            <ABTestCard key={test.id} test={test} />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <span className="text-4xl mb-3 block">🔬</span>
          <h3 className="font-semibold text-white mb-2">No A/B Tests</h3>
          <p className="text-surface-400 mb-4">Create pricing experiments to optimize conversion</p>
          <button className="btn btn-primary">Create Your First Test</button>
        </div>
      )}
    </div>
  );
}

function ABTestCard({ test }: { test: any }) {
  const store = usePricingStore();
  
  const statusColors = {
    draft: 'bg-gray-600',
    running: 'bg-green-600',
    paused: 'bg-yellow-600',
    completed: 'bg-blue-600',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white">{test.name}</h3>
          <span className={`px-2 py-1 text-xs rounded ${statusColors[test.status as keyof typeof statusColors]} text-white`}>
            {test.status}
          </span>
        </div>
        <div className="flex gap-2">
          {test.status === 'draft' && (
            <button onClick={() => store.startABTest(test.id)} className="btn btn-sm bg-green-600">
              Start
            </button>
          )}
          {test.status === 'running' && (
            <button onClick={() => store.stopABTest(test.id)} className="btn btn-sm bg-yellow-600">
              Pause
            </button>
          )}
        </div>
      </div>
      
      <p className="text-surface-400 text-sm mb-3">{test.description}</p>
      
      {test.results && (
        <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-surface-800 rounded-lg">
          <div>
            <p className="text-xs text-surface-400">Control Conversion</p>
            <p className="text-lg font-bold text-white">{test.results.conversionRates?.control || 0}%</p>
          </div>
          <div>
            <p className="text-xs text-surface-400">Variant Conversion</p>
            <p className="text-lg font-bold text-primary-400">{test.results.conversionRates?.variant || 0}%</p>
          </div>
          <div>
            <p className="text-xs text-surface-400">Significance</p>
            <p className="text-lg font-bold text-green-400">{test.results.statisticalSignificance || 0}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// GLOBAL SETTINGS TAB
// ============================================

function GlobalSettingsTab() {
  const store = usePricingStore();
  const settings = store.getGlobalSettings();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Global Pricing Settings</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Freemium Settings */}
        <div className="card p-4">
          <h3 className="font-medium text-white mb-4">Freemium Model</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-surface-200">Enable Freemium</span>
              <input
                type="checkbox"
                checked={settings.freemiumEnabled}
                onChange={(e) => store.updateGlobalSettings({ freemiumEnabled: e.target.checked })}
                className="w-4 h-4 rounded"
              />
            </label>
            <div>
              <label className="text-sm text-surface-400">Conversion Target (%)</label>
              <input
                type="number"
                value={settings.freemiumConversionTarget}
                onChange={(e) => store.updateGlobalSettings({ freemiumConversionTarget: Number(e.target.value) })}
                className="w-full mt-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Trial Settings */}
        <div className="card p-4">
          <h3 className="font-medium text-white mb-4">Trial Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-surface-400">Default Trial Days</label>
              <input
                type="number"
                value={settings.globalTrialDays}
                onChange={(e) => store.updateGlobalSettings({ globalTrialDays: Number(e.target.value) })}
                className="w-full mt-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <label className="flex items-center justify-between">
              <span className="text-surface-200">Allow Trial Extension</span>
              <input
                type="checkbox"
                checked={settings.trialExtensionAllowed}
                onChange={(e) => store.updateGlobalSettings({ trialExtensionAllowed: e.target.checked })}
                className="w-4 h-4 rounded"
              />
            </label>
          </div>
        </div>

        {/* Discount Settings */}
        <div className="card p-4">
          <h3 className="font-medium text-white mb-4">Discounts & Referrals</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-surface-400">Max Discount (%)</label>
              <input
                type="number"
                value={settings.maxDiscountPercent}
                onChange={(e) => store.updateGlobalSettings({ maxDiscountPercent: Number(e.target.value) })}
                className="w-full mt-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-surface-400">Referral Reward (₹)</label>
              <input
                type="number"
                value={settings.referralRewardAmount}
                onChange={(e) => store.updateGlobalSettings({ referralRewardAmount: Number(e.target.value) })}
                className="w-full mt-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-surface-400">Referral Discount (%)</label>
              <input
                type="number"
                value={settings.referralDiscountPercent}
                onChange={(e) => store.updateGlobalSettings({ referralDiscountPercent: Number(e.target.value) })}
                className="w-full mt-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="card p-4">
          <h3 className="font-medium text-white mb-4">Display Options</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-surface-200">Show Comparison Table</span>
              <input
                type="checkbox"
                checked={settings.showComparisonTable}
                onChange={(e) => store.updateGlobalSettings({ showComparisonTable: e.target.checked })}
                className="w-4 h-4 rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-surface-200">Show Monthly by Default</span>
              <input
                type="checkbox"
                checked={settings.showMonthlyByDefault}
                onChange={(e) => store.updateGlobalSettings({ showMonthlyByDefault: e.target.checked })}
                className="w-4 h-4 rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-surface-200">Highlight Yearly Savings</span>
              <input
                type="checkbox"
                checked={settings.highlightSavings}
                onChange={(e) => store.updateGlobalSettings({ highlightSavings: e.target.checked })}
                className="w-4 h-4 rounded"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// AGENT RECOMMENDATIONS PANEL
// ============================================

function AgentRecommendationsPanel() {
  const store = usePricingStore();
  const competitorData = store.competitorData;
  const analyticsData = store.analyticsData;

  return (
    <div className="card p-4 bg-gradient-to-r from-primary-900/20 to-purple-900/20 border-primary-500/30">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🤖</span>
        <h3 className="font-semibold text-white">Agent Recommendations</h3>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Scout Insights */}
        <div className="p-3 bg-surface-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span>🔍</span>
            <span className="font-medium text-blue-400">Scout (Market Intel)</span>
          </div>
          {competitorData ? (
            <div className="text-sm text-surface-300">
              <p>Last updated: {new Date