/**
 * Public Website - Pricing Page
 * Dynamic pricing with exam-specific plans
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: { monthly: number; yearly: number };
  description: string;
  features: { text: string; included: boolean }[];
  popular?: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    description: 'Get started with basic features',
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
    cta: 'Get Started Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 499, yearly: 3999 },
    description: 'Everything you need to crack exams',
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
    popular: true,
    cta: 'Start Pro Trial',
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
      { text: 'WhatsApp support group', included: true },
      { text: '24/7 priority support', included: true },
    ],
    cta: 'Go Premium',
  },
];

const faqs = [
  { q: 'Can I change plans anytime?', a: 'Yes! Upgrade or downgrade anytime. Changes take effect immediately.' },
  { q: 'Is there a refund policy?', a: 'Yes, 7-day money-back guarantee on all paid plans. No questions asked.' },
  { q: 'Do you offer student discounts?', a: 'Yes! Verified students get 20% off. Email us with your student ID.' },
  { q: 'Can I pause my subscription?', a: 'Yes, you can pause for up to 2 months per year without losing progress.' },
];

export default function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <div className="min-h-screen bg-surface-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-surface-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/website" className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              EduGenius
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Login</Link>
            <Link to="/website/signup" className="btn btn-sm bg-gradient-to-r from-primary-600 to-accent-600">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-12 px-6 text-center">
        <h1 className="text-5xl font-bold text-white mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-surface-400 mb-8">Choose the plan that fits your exam goals</p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center gap-4 p-1 bg-surface-800 rounded-full">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-6 py-2 rounded-full transition-colors ${
              billing === 'monthly' ? 'bg-primary-600 text-white' : 'text-surface-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-6 py-2 rounded-full transition-colors ${
              billing === 'yearly' ? 'bg-primary-600 text-white' : 'text-surface-400'
            }`}
          >
            Yearly
            <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Save 33%</span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-8 rounded-2xl border ${
                plan.popular
                  ? 'bg-gradient-to-b from-primary-900/30 to-surface-800 border-primary-500'
                  : 'bg-surface-800 border-surface-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary-600 text-white text-sm rounded-full">
                  Most Popular
                </div>
              )}

              <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
              <p className="text-surface-400 mt-1">{plan.description}</p>

              <div className="my-6">
                <span className="text-4xl font-bold text-white">
                  ₹{billing === 'monthly' ? plan.price.monthly : Math.round(plan.price.yearly / 12)}
                </span>
                <span className="text-surface-400">/month</span>
                {billing === 'yearly' && plan.price.yearly > 0 && (
                  <p className="text-sm text-surface-500 mt-1">
                    ₹{plan.price.yearly} billed yearly
                  </p>
                )}
              </div>

              <Link
                to={`/website/signup?plan=${plan.id}`}
                className={`btn w-full py-3 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700'
                    : 'bg-surface-700 hover:bg-surface-600'
                }`}
              >
                {plan.cta}
              </Link>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <X className="w-5 h-5 text-surface-600" />
                    )}
                    <span className={feature.included ? 'text-surface-300' : 'text-surface-500'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Exam-Specific Note */}
      <section className="py-12 px-6 bg-surface-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-white mb-4">🎯 Exam-Specific Bundles</h3>
          <p className="text-surface-400 mb-6">
            Get targeted preparation with exam-specific content, mock tests, and strategies.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {['JEE Main', 'JEE Advanced', 'NEET UG', 'CBSE 12', 'CBSE 10', 'CAT'].map((exam) => (
              <Link
                key={exam}
                to={`/website/exams/${exam.toLowerCase().replace(' ', '-')}`}
                className="px-4 py-2 bg-surface-700 rounded-full text-surface-300 hover:bg-surface-600 hover:text-white transition-colors"
              >
                {exam}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i} className="p-6 bg-surface-800 rounded-xl border border-surface-700">
                <h4 className="text-lg font-semibold text-white mb-2">{faq.q}</h4>
                <p className="text-surface-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-6 bg-gradient-to-r from-primary-900/30 to-accent-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Still have questions?</h2>
          <p className="text-surface-400 mb-8">Talk to our team and find the perfect plan for you.</p>
          <div className="flex justify-center gap-4">
            <Link to="/website/contact" className="btn px-6 py-3 bg-surface-700 hover:bg-surface-600">
              Contact Sales
            </Link>
            <Link to="/website/demo" className="btn px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
