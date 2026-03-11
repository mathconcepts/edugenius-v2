/**
 * Public Website — Homepage
 * Dynamic growth-orchestrated homepage: SEO meta, funnel tracking,
 * AI-generated hero headline, live exam cards from registry.
 */

import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { growthOrchestrator } from '@/services/growthOrchestrator';
import { websiteSeoService } from '@/services/websiteSeoService';
import { acquisitionFunnelService } from '@/services/acquisitionFunnelService';
import { getLiveExams, type ExamConfig } from '@/data/examRegistry';

// ─── Static fallbacks ─────────────────────────────────────────────────────────

const STATIC_TESTIMONIALS = [
  { id: '1', name: 'Rahul S.', exam: 'JEE Main 2025', score: 'AIR 1,247', quote: 'The AI tutor helped me understand concepts I struggled with for years.', avatar: '👦' },
  { id: '2', name: 'Priya P.', exam: 'NEET 2025', score: '685/720', quote: 'Smart Notebook is amazing! I write equations and get step-by-step solutions.', avatar: '👧' },
  { id: '3', name: 'Arjun K.', exam: 'JEE Advanced 2025', score: 'AIR 856', quote: 'The adaptive practice knew exactly what I needed to work on.', avatar: '👦' },
];

const STATIC_HEADLINE = 'Your AI Tutor for Exam Success';

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [heroHeadline, setHeroHeadline] = useState<string>(STATIC_HEADLINE);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [socialProof, setSocialProof] = useState(growthOrchestrator.getSocialProof());
  const orchestratedRef = useRef(false);

  // ── Growth orchestration on mount ─────────────────────────────────────────

  useEffect(() => {
    if (orchestratedRef.current) return;
    orchestratedRef.current = true;

    // Track funnel: visitor landed on homepage
    acquisitionFunnelService.trackPageView('direct', undefined, 'home');

    // Load live exams from registry
    setExams(getLiveExams());

    // Get hero headline (cached or default)
    const headline = growthOrchestrator.getDefaultHeroHeadline();
    setHeroHeadline(headline);

    // Get social proof numbers
    setSocialProof(growthOrchestrator.getSocialProof());

    // Run scheduled growth cycle in background (non-blocking)
    growthOrchestrator.orchestrateGrowth('scheduled').catch(() => {
      // Graceful failure — never crash the page
    });
  }, []);

  // ── SEO: inject meta tags ─────────────────────────────────────────────────

  useEffect(() => {
    const meta = websiteSeoService.generatePageMeta('home', {});
    document.title = meta.title;

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };
    const setOg = (prop: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
      el.content = content;
    };

    setMeta('description', meta.description);
    setMeta('keywords', meta.keywords.join(', '));
    setOg('og:title', meta.ogTags.title);
    setOg('og:description', meta.ogTags.description);
    setOg('og:image', meta.ogTags.image);
    setOg('og:type', meta.ogTags.type);

    // Inject Organization + Website JSON-LD
    const schemas = [
      websiteSeoService.generateSchemaMarkup('Organization', {}),
      websiteSeoService.generateSchemaMarkup('WebSite', {}),
    ];
    let ldScript = document.getElementById('home-ld-json') as HTMLScriptElement | null;
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.id = 'home-ld-json';
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(schemas);
  }, []);

  // ── Testimonial rotation ──────────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((p) => (p + 1) % STATIC_TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // ── CTA click handler ─────────────────────────────────────────────────────

  const handleCtaClick = (ctaText: string) => {
    acquisitionFunnelService.trackCtaClick(ctaText, 'direct');
  };

  const socialProofStats = [
    { label: 'Students', value: socialProof.students.toLocaleString('en-IN'), suffix: '+' },
    { label: 'Questions', value: '2.5', suffix: 'L+' },
    { label: 'Success Rate', value: socialProof.successRate.toString(), suffix: '%' },
    { label: 'AI Interactions', value: '10', suffix: 'M+' },
  ];

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
          <div className="hidden md:flex items-center gap-8">
            <Link to="/website/features" className="text-surface-300 hover:text-white transition-colors">Features</Link>
            <Link to="/website/pricing" className="text-surface-300 hover:text-white transition-colors">Pricing</Link>
            <Link to="/website/blog" className="text-surface-300 hover:text-white transition-colors">Blog</Link>
            <Link to="/website/about" className="text-surface-300 hover:text-white transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Login</Link>
            <Link
              to="/onboarding"
              onClick={() => handleCtaClick('Start Free Trial')}
              className="btn btn-sm bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/30 rounded-full text-primary-400 text-sm mb-6">
            <span>🚀</span>
            <span>Powered by AI • Trusted by {socialProof.students.toLocaleString('en-IN')}+ Students</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            {heroHeadline.includes('for') ? (
              <>
                {heroHeadline.split('for')[0]}for
                <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                  {heroHeadline.split('for').slice(1).join('for')}
                </span>
              </>
            ) : (
              <>
                {heroHeadline}
                <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent"> with AI</span>
              </>
            )}
          </h1>
          <p className="text-xl text-surface-300 max-w-3xl mx-auto mb-8">
            Personalised Socratic AI tutoring, adaptive practice, and smart study plans —
            built for JEE, NEET, GATE, CBSE & CAT aspirants. Get your doubt cleared in seconds, 24/7.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/onboarding"
              onClick={() => handleCtaClick('Start Free Trial')}
              className="btn px-8 py-4 text-lg bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700"
            >
              Start Free — No Card Required
            </Link>
            <Link
              to="/website/demo"
              onClick={() => handleCtaClick('Watch Demo')}
              className="btn px-8 py-4 text-lg bg-surface-800 border border-surface-600 hover:bg-surface-700"
            >
              🎥 Watch Demo
            </Link>
          </div>

          {/* Dynamic Stats from Oracle / fallbacks */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            {socialProofStats.map((stat) => (
              <div key={stat.label} className="p-6 bg-surface-800/50 rounded-2xl border border-surface-700">
                <p className="text-3xl md:text-4xl font-bold text-white">
                  {stat.value}<span className="text-primary-400">{stat.suffix}</span>
                </p>
                <p className="text-surface-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-surface-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Why Students Love EduGenius</h2>
            <p className="text-xl text-surface-400">AI-powered features designed for exam success</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '🤖', title: 'Sage AI Tutor', desc: '24/7 Socratic tutoring that guides you to answers, not just gives them. Understands your learning style.', link: '/website/features#sage' },
              { icon: '📝', title: 'Smart Notebook', desc: 'Write equations, get instant solutions. Handwriting recognition + step-by-step explanations.', link: '/website/features#notebook' },
              { icon: '🎯', title: 'Adaptive Practice', desc: 'AI selects the perfect questions based on your strengths and weaknesses. Never waste time on what you know.', link: '/website/features#practice' },
              { icon: '📊', title: 'Progress Analytics', desc: 'Know exactly where you stand. Subject-wise breakdown, percentile predictions, weak area identification.', link: '/website/features#analytics' },
              { icon: '🔥', title: 'Gamification', desc: 'Streaks, badges, and leaderboards keep you motivated. Compete with friends, earn rewards.', link: '/website/features#gamification' },
              { icon: '🌐', title: 'Hinglish Support', desc: 'Learn in your language. English, Hindi, or Hinglish — whatever makes concepts click for you.', link: '/website/features#languages' },
            ].map((feature) => (
              <Link key={feature.title} to={feature.link} className="group p-8 bg-surface-800 rounded-2xl border border-surface-700 hover:border-primary-500/50 transition-all">
                <span className="text-4xl">{feature.icon}</span>
                <h3 className="text-xl font-semibold text-white mt-4 mb-2 group-hover:text-primary-400 transition-colors">{feature.title}</h3>
                <p className="text-surface-400">{feature.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Exam Cards — from examRegistry */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Exams We Cover</h2>
            <p className="text-xl text-surface-400">Comprehensive preparation for all major competitive exams</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {(exams.length > 0 ? exams : []).map((exam) => (
              <Link
                key={exam.id}
                to={`/website/exams/${exam.route}`}
                onClick={() => acquisitionFunnelService.trackFunnelEvent({
                  type: 'content_consumed',
                  stage: 'engagement',
                  source: 'direct',
                  examId: exam.id,
                  pageId: 'home',
                })}
                className="group p-6 bg-surface-800 rounded-2xl border border-surface-700 hover:border-primary-500/50 transition-all text-center"
              >
                <span className="text-5xl">{exam.icon}</span>
                <h3 className="text-xl font-semibold text-white mt-4 group-hover:text-primary-400 transition-colors">
                  {exam.name}
                </h3>
                <p className="text-primary-400 mt-2 text-sm">{exam.category}</p>
                {exam.status === 'live' && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary-900/20 to-accent-900/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-12">Success Stories</h2>
          <div className="relative min-h-[160px]">
            {STATIC_TESTIMONIALS.map((t, i) => (
              <div
                key={t.id}
                className={`transition-all duration-500 ${
                  i === currentTestimonial ? 'opacity-100' : 'opacity-0 absolute inset-0'
                }`}
              >
                <p className="text-2xl text-white mb-6">"{t.quote}"</p>
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl">{t.avatar}</span>
                  <div className="text-left">
                    <p className="text-white font-semibold">{t.name}</p>
                    <p className="text-primary-400">{t.exam} • {t.score}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-8">
            {STATIC_TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTestimonial(i)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i === currentTestimonial ? 'bg-primary-500' : 'bg-surface-600'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Ace Your Exam?</h2>
          <p className="text-xl text-surface-400 mb-8">
            Join {socialProof.students.toLocaleString('en-IN')}+ students already learning smarter with AI
          </p>
          <Link
            to="/onboarding"
            onClick={() => {
              handleCtaClick('Start Your Free Trial Today');
              acquisitionFunnelService.trackSignupStart('direct');
            }}
            className="btn px-8 py-4 text-lg bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700"
          >
            Start Your Free Trial Today
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-surface-700">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎓</span>
              <span className="text-xl font-bold text-white">EduGenius</span>
            </div>
            <p className="text-surface-400 text-sm">AI-powered learning for exam success. Made in India 🇮🇳</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-surface-400 text-sm">
              <li><Link to="/website/features" className="hover:text-white">Features</Link></li>
              <li><Link to="/website/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link to="/website/demo" className="hover:text-white">Demo</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Exams</h4>
            <ul className="space-y-2 text-surface-400 text-sm">
              {exams.slice(0, 4).map((exam) => (
                <li key={exam.id}>
                  <Link to={`/website/exams/${exam.route}`} className="hover:text-white">
                    {exam.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-surface-400 text-sm">
              <li><Link to="/website/about" className="hover:text-white">About Us</Link></li>
              <li><Link to="/website/blog" className="hover:text-white">Blog</Link></li>
              <li><Link to="/website/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-surface-800 text-center text-surface-500 text-sm">
          © 2026 EduGenius by MathConcepts. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
