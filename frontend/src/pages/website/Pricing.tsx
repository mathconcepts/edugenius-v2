/**
 * Public Website - Pricing Page
 * Plans + chatbot channel add-ons
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, MessageCircle, Send, Video, Zap, Plus } from 'lucide-react';
import { clsx } from 'clsx';

interface Feature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: { monthly: number; yearly: number };
  description: string;
  features: Feature[];
  chatbotAccess: {
    whatsapp: 'included' | 'addon' | false;
    telegram: 'included' | 'addon' | false;
    meet: number;  // 0 = no, N = sessions/month
  };
  popular?: boolean;
  cta: string;
  ctaVariant?: 'primary' | 'outline';
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    description: 'Start learning with AI assistance',
    features: [
      { text: '50 AI tutor interactions/month', included: true },
      { text: 'Access to free practice questions', included: true },
      { text: 'Basic progress tracking', included: true },
      { text: 'Community forums', included: true },
      { text: 'Smart Notebook', included: false },
      { text: 'Full mock tests', included: false },
      { text: 'Video solutions', included: false },
      { text: 'Parent dashboard', included: false },
    ],
    chatbotAccess: { whatsapp: false, telegram: false, meet: 0 },
    cta: 'Get Started Free',
    ctaVariant: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 499, yearly: 3999 },
    description: 'Everything to crack competitive exams',
    features: [
      { text: 'Unlimited AI tutor interactions', included: true },
      { text: 'Full question bank access', included: true },
      { text: 'Smart Notebook with handwriting', included: true },
      { text: 'Unlimited mock tests', included: true },
      { text: 'Detailed analytics & insights', included: true },
      { text: 'Video solutions', included: true },
      { text: 'Parent dashboard', included: true },
      { text: 'Priority support', included: false },
    ],
    chatbotAccess: { whatsapp: 'addon', telegram: 'addon', meet: 0 },
    popular: true,
    cta: 'Start Pro Trial',
    ctaVariant: 'primary',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: { monthly: 999, yearly: 7999 },
    description: 'Maximum support for serious aspirants',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: '1-on-1 mentor sessions (2/month)', included: true },
      { text: 'Personalized study plans', included: true },
      { text: 'Live doubt clearing sessions', included: true },
      { text: 'Priority AI responses', included: true },
      { text: 'Exclusive content & tips', included: true },
      { text: 'WhatsApp + Telegram AI tutor', included: true },
      { text: '24/7 priority support', included: true },
    ],
    chatbotAccess: { whatsapp: 'included', telegram: 'included', meet: 2 },
    cta: 'Go Premium',
    ctaVariant: 'primary',
  },
  {
    id: 'elite',
    name: 'Elite',
    price: { monthly: 1499, yearly: 11999 },
    description: 'Concierge AI learning — study anywhere, anytime',
    features: [
      { text: 'Everything in Premium', included: true },
      { text: '1-on-1 mentor sessions (4/month)', included: true },
      { text: 'Dedicated study manager', included: true },
      { text: 'Exam-day strategy call', included: true },
      { text: 'Offline content downloads', included: true },
      { text: 'First access to new features', included: true },
      { text: 'WhatsApp + Telegram AI tutor', included: true },
      { text: 'Google Meet AI sessions (4/month)', included: true },
    ],
    chatbotAccess: { whatsapp: 'included', telegram: 'included', meet: 4 },
    cta: 'Go Elite',
    ctaVariant: 'primary',
  },
];

interface AddOn {
  id: string;
  name: string;
  icon: typeof MessageCircle;
  iconColor: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  eligiblePlans: string[];
  badge?: string;
}

const addOns: AddOn[] = [
  {
    id: 'chatbot_whatsapp',
    name: 'WhatsApp Access',
    icon: MessageCircle,
    iconColor: 'text-green-400',
    priceMonthly: 99,
    priceYearly: 799,
    description: 'Ask doubts, get reminders, practise MCQs — all inside WhatsApp.',
    eligiblePlans: ['pro'],
  },
  {
    id: 'chatbot_telegram',
    name: 'Telegram Access',
    icon: Send,
    iconColor: 'text-blue-400',
    priceMonthly: 99,
    priceYearly: 799,
    description: 'Full AI tutor on Telegram — rich media, inline quizzes, formula rendering.',
    eligiblePlans: ['pro'],
  },
  {
    id: 'chatbot_all',
    name: 'All Chatbots',
    icon: Zap,
    iconColor: 'text-yellow-400',
    priceMonthly: 149,
    priceYearly: 1199,
    description: 'WhatsApp + Telegram in one bundle. Best value for mobile-first learners.',
    eligiblePlans: ['pro'],
    badge: 'Best Value',
  },
];

const faqs = [
  { q: 'Can I use EduGenius on WhatsApp without changing my plan?', a: 'Yes! Pro plan users can add WhatsApp or Telegram access for just ₹99/month each, or both for ₹149/month. Premium and Elite plans include both channels at no extra cost.' },
  { q: 'How does the WhatsApp/Telegram tutor work?', a: 'Just message our bot your doubt, topic, or question. Sage (your AI tutor) responds with explanations, MCQs, formula help, and even study reminders — all within the chat app.' },
  { q: 'Can I change plans anytime?', a: 'Yes! Upgrade or downgrade anytime. Changes take effect immediately. Add-ons can be cancelled monthly.' },
  { q: 'Is there a refund policy?', a: 'Yes, 7-day money-back guarantee on all paid plans and add-ons. No questions asked.' },
  { q: 'Can I pause my subscription?', a: 'Yes, pause for up to 2 months per year without losing progress or linked chatbot accounts.' },
  { q: 'What happens to my WhatsApp/Telegram access if I downgrade?', a: 'You will keep access until the end of your billing period. After that, you will need to add the chatbot add-on or upgrade to Premium.' },
];

function ChannelBadge({ type }: { type: 'included' | 'addon' | false | number }) {
  if (type === false || type === 0) {
    return <X className="w-4 h-4 text-surface-600 flex-shrink-0" />;
  }
  if (type === 'included' || (typeof type === 'number' && type > 0)) {
    return <Check className="w-4 h-4 text-green-400 flex-shrink-0" />;
  }
  // addon
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold flex-shrink-0">+Add-on</span>
  );
}

export default function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-20">

        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-xl text-surface-400 mb-8">Choose the plan that fits your exam goals. Study on portal, WhatsApp, or Telegram.</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-surface-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setBilling('monthly')}
              className={clsx('px-5 py-2 rounded-lg text-sm font-medium transition-all', billing === 'monthly' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white')}
            >Monthly</button>
            <button
              onClick={() => setBilling('yearly')}
              className={clsx('px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2', billing === 'yearly' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white')}
            >
              Yearly <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Save 33%</span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={clsx(
                'rounded-2xl border p-6 flex flex-col',
                plan.popular
                  ? 'border-primary-500 bg-primary-500/5 relative'
                  : 'border-surface-700 bg-surface-800/50'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-surface-400 text-sm mt-1">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    ₹{billing === 'monthly' ? plan.price.monthly : Math.round(plan.price.yearly / 12)}
                  </span>
                  {plan.price.monthly > 0 && (
                    <span className="text-surface-400 text-sm">/month</span>
                  )}
                  {billing === 'yearly' && plan.price.yearly > 0 && (
                    <p className="text-xs text-green-400 mt-1">₹{plan.price.yearly} billed yearly</p>
                  )}
                </div>
              </div>

              <Link
                to={`/website/signup?plan=${plan.id}`}
                className={clsx(
                  'block text-center py-2.5 rounded-xl font-semibold text-sm mb-6 transition-all',
                  plan.ctaVariant === 'primary'
                    ? 'bg-primary-500 hover:bg-primary-400 text-white'
                    : 'border border-surface-600 hover:border-surface-500 text-surface-300 hover:text-white'
                )}
              >{plan.cta}</Link>

              {/* Core features */}
              <div className="space-y-2 mb-5 flex-1">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {feature.included
                      ? <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      : <X className="w-4 h-4 text-surface-600 flex-shrink-0 mt-0.5" />}
                    <span className={clsx('text-sm', feature.included ? 'text-surface-200' : 'text-surface-500')}>{feature.text}</span>
                  </div>
                ))}
              </div>

              {/* Chatbot access section */}
              <div className="border-t border-surface-700 pt-4 mt-2">
                <p className="text-xs text-surface-500 font-semibold uppercase tracking-wide mb-2">Study via</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-surface-300"><span className="text-base">🌐</span> Web Portal</span>
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-surface-300"><MessageCircle className="w-3.5 h-3.5 text-green-400" /> WhatsApp</span>
                    <ChannelBadge type={plan.chatbotAccess.whatsapp} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-surface-300"><Send className="w-3.5 h-3.5 text-blue-400" /> Telegram</span>
                    <ChannelBadge type={plan.chatbotAccess.telegram} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-surface-300"><Video className="w-3.5 h-3.5 text-red-400" /> Google Meet</span>
                    {plan.chatbotAccess.meet > 0
                      ? <span className="text-xs text-green-400">{plan.chatbotAccess.meet}/month</span>
                      : <X className="w-4 h-4 text-surface-600 flex-shrink-0" />}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add-ons section */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Chatbot Add-ons for Pro</h2>
            <p className="text-surface-400">On the Pro plan? Add WhatsApp or Telegram access to study in your favourite chat app.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {addOns.map(addon => (
              <div key={addon.id} className={clsx('rounded-2xl border p-5 relative', addon.badge ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-surface-700 bg-surface-800/50')}>
                {addon.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">{addon.badge}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <addon.icon className={clsx('w-6 h-6', addon.iconColor)} />
                  <h3 className="font-bold">{addon.name}</h3>
                </div>
                <p className="text-surface-400 text-sm mb-4">{addon.description}</p>
                <div className="mb-4">
                  <span className="text-2xl font-bold">₹{billing === 'monthly' ? addon.priceMonthly : Math.round(addon.priceYearly / 12)}</span>
                  <span className="text-surface-400 text-sm">/month</span>
                  {billing === 'yearly' && <p className="text-xs text-green-400 mt-0.5">₹{addon.priceYearly} billed yearly</p>}
                </div>
                <button
                  onClick={() => setSelectedAddOns(prev => {
                    const next = new Set(prev);
                    next.has(addon.id) ? next.delete(addon.id) : next.add(addon.id);
                    return next;
                  })}
                  className={clsx(
                    'w-full py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    selectedAddOns.has(addon.id)
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                      : 'bg-surface-700 hover:bg-surface-600 text-white'
                  )}
                >
                  {selectedAddOns.has(addon.id) ? <><Check className="w-4 h-4" /> Added</> : <><Plus className="w-4 h-4" /> Add to Pro</>}
                </button>
                <p className="text-[10px] text-surface-500 text-center mt-2">Requires Pro plan · Cancel anytime</p>
              </div>
            ))}
          </div>
        </div>

        {/* Channel comparison table */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-6">Where can you study?</h2>
          <div className="overflow-x-auto">
            <table className="w-full max-w-3xl mx-auto text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left py-3 pr-4 text-surface-400 font-normal">Channel</th>
                  {plans.map(p => (
                    <th key={p.id} className={clsx('text-center py-3 px-3 font-semibold', p.popular ? 'text-primary-400' : 'text-white')}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: '🌐 Web Portal', key: 'portal' },
                  { label: '💬 WhatsApp', key: 'whatsapp' },
                  { label: '📱 Telegram', key: 'telegram' },
                  { label: '🎥 Google Meet', key: 'meet' },
                ].map(row => (
                  <tr key={row.key} className="border-b border-surface-800">
                    <td className="py-3 pr-4 text-surface-300">{row.label}</td>
                    {plans.map(p => (
                      <td key={p.id} className="py-3 px-3 text-center">
                        {row.key === 'portal' && <Check className="w-4 h-4 text-green-400 mx-auto" />}
                        {row.key === 'whatsapp' && <ChannelBadge type={p.chatbotAccess.whatsapp} />}
                        {row.key === 'telegram' && <ChannelBadge type={p.chatbotAccess.telegram} />}
                        {row.key === 'meet' && (
                          p.chatbotAccess.meet > 0
                            ? <span className="text-xs text-green-400">{p.chatbotAccess.meet}/mo</span>
                            : <X className="w-4 h-4 text-surface-600 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-surface-500 mt-3">+Add-on = available as optional add-on for Pro plan (from ₹99/month)</p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl bg-surface-800 border border-surface-700 p-5">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-surface-400 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="text-center rounded-2xl bg-surface-800 border border-surface-700 p-10">
          <h2 className="text-2xl font-bold mb-2">Coaching centres & schools?</h2>
          <p className="text-surface-400 mb-6">Custom plans for institutions — bulk student accounts, teacher dashboards, and dedicated WhatsApp/Telegram bot numbers for your brand.</p>
          <Link to="/website/contact" className="inline-block bg-white text-surface-900 px-8 py-3 rounded-xl font-semibold hover:bg-surface-100 transition-colors">
            Talk to our team
          </Link>
        </div>
      </div>
    </div>
  );
}
