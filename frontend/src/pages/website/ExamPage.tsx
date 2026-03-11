/**
 * Public Website — Per-Exam Landing Page
 * Fully dynamic: reads examId from route params, generates all content
 * from landingPageEngine. Works for ANY exam in examRegistry.
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getExamByRoute, getLiveExams, type ExamConfig } from '@/data/examRegistry';
import { landingPageEngine, type LandingPageConfig, type ContentSection } from '@/services/landingPageEngine';
import { websiteSeoService } from '@/services/websiteSeoService';
import { acquisitionFunnelService } from '@/services/acquisitionFunnelService';

// ─── Section Renderers ────────────────────────────────────────────────────────

function HeroSection({ section, exam }: { section: ContentSection; exam: ExamConfig }) {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/30 rounded-full text-primary-400 text-sm mb-6">
          <span>{exam.icon}</span>
          <span>{exam.shortName} Preparation • AI-Powered</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          {section.headline.includes('—') ? (
            <>
              {section.headline.split('—')[0]}
              <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                — {section.headline.split('—').slice(1).join('—')}
              </span>
            </>
          ) : (
            <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              {section.headline}
            </span>
          )}
        </h1>
        <p className="text-xl text-surface-300 max-w-3xl mx-auto mb-8">{section.body}</p>

        {/* Social proof mini-stats */}
        {section.data?.socialProof && (
          <div className="flex items-center justify-center gap-6 mb-8 text-sm text-surface-400">
            <span>✅ {(section.data.socialProof as { studentCount: string }).studentCount} students</span>
            <span>📈 {(section.data.socialProof as { avgRankImprovement: string }).avgRankImprovement} avg improvement</span>
            <span>⭐ {(section.data.socialProof as { successRate: string }).successRate} success rate</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {section.cta?.primary && (
            <Link
              to={section.cta.primary.href}
              onClick={() => acquisitionFunnelService.trackCtaClick(section.cta!.primary.text, 'organic', exam.id)}
              className="btn px-8 py-4 text-lg bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700"
            >
              {section.cta.primary.text}
            </Link>
          )}
          {section.cta?.secondary && (
            <Link
              to={section.cta.secondary.href}
              className="btn px-8 py-4 text-lg bg-surface-800 border border-surface-600 hover:bg-surface-700"
            >
              {section.cta.secondary.text}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ section }: { section: ContentSection }) {
  const features = (section.data?.features as string[]) ?? [];
  return (
    <section className="py-20 px-6 bg-surface-800/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">{section.headline}</h2>
          <p className="text-surface-400">{section.body}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-surface-800 rounded-xl border border-surface-700">
              <span className="text-primary-400 mt-0.5 flex-shrink-0">✓</span>
              <span className="text-surface-300 text-sm">{feat}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyEduGeniusSection({ section }: { section: ContentSection }) {
  const points = (section.data?.points as Array<{ title: string; body: string }>) ?? [];
  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">{section.headline}</h2>
          <p className="text-surface-400">{section.body}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {points.map((pt, i) => (
            <div key={i} className="p-6 bg-surface-800 rounded-2xl border border-surface-700">
              <h3 className="text-lg font-semibold text-white mb-2">💡 {pt.title}</h3>
              <p className="text-surface-400 text-sm">{pt.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ section }: { section: ContentSection }) {
  const testimonials = (section.data?.testimonials as Array<{ name: string; score: string; quote: string; avatar: string }>) ?? [];
  return (
    <section className="py-20 px-6 bg-gradient-to-r from-primary-900/20 to-accent-900/20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">{section.headline}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="p-6 bg-surface-800/60 rounded-2xl border border-surface-700">
              <p className="text-surface-300 italic mb-4">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{t.avatar}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-primary-400 text-xs">{t.score}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TopicGridSection({ section }: { section: ContentSection }) {
  const topics = (section.data?.topics as string[]) ?? [];
  const weights = (section.data?.topicWeights as Array<{ topicId: string; priority: string }>) ?? [];
  const getWeight = (topicId: string) => weights.find((w) => w.topicId === topicId)?.priority ?? 'medium';

  return (
    <section className="py-20 px-6 bg-surface-800/20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">{section.headline}</h2>
          <p className="text-surface-400">{section.body}</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {topics.map((topic) => {
            const priority = getWeight(topic);
            return (
              <span
                key={topic}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  priority === 'high'
                    ? 'bg-primary-500/20 border-primary-500/50 text-primary-300'
                    : priority === 'medium'
                    ? 'bg-surface-700 border-surface-600 text-surface-300'
                    : 'bg-surface-800 border-surface-700 text-surface-400'
                }`}
              >
                {topic.replace(/-/g, ' ')}
                {priority === 'high' && <span className="ml-1 text-xs">🔥</span>}
              </span>
            );
          })}
        </div>
        <p className="text-center text-surface-500 text-xs mt-4">🔥 = High-priority topics with largest competitor gap</p>
      </div>
    </section>
  );
}

function FaqSection({ section }: { section: ContentSection }) {
  const faqs = (section.data?.faqs as Array<{ q: string; a: string }>) ?? [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">{section.headline}</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
              <button
                className="w-full text-left px-6 py-4 flex items-center justify-between"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <span className="text-white font-medium">{faq.q}</span>
                <span className="text-primary-400 ml-4">{openIdx === i ? '−' : '+'}</span>
              </button>
              {openIdx === i && (
                <div className="px-6 pb-4 text-surface-400 text-sm">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExamCalendarSection({ section }: { section: ContentSection }) {
  const calendar = (section.data?.calendar as Array<{ examId: string; examName: string; date: string; daysAway: number; stage: string }>) ?? [];
  if (!calendar.length) return null;

  return (
    <section className="py-16 px-6 bg-surface-800/20">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-8">{section.headline}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {calendar.map((entry, i) => (
            <div key={i} className="p-4 bg-surface-800 rounded-xl border border-surface-700 flex items-center justify-between">
              <div>
                <p className="text-white font-medium text-sm">{entry.examName}</p>
                <p className="text-surface-400 text-xs mt-0.5">{new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                entry.daysAway < 30 ? 'bg-red-500/20 text-red-400' :
                entry.daysAway < 90 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {entry.daysAway === 0 ? 'Today!' : `${entry.daysAway}d away`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ section, exam }: { section: ContentSection; exam: ExamConfig }) {
  return (
    <section className="py-24 px-6 bg-gradient-to-br from-primary-900/40 to-accent-900/40">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl font-bold text-white mb-4">{section.headline}</h2>
        <p className="text-xl text-surface-400 mb-8">{section.body}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {section.cta?.primary && (
            <Link
              to={section.cta.primary.href}
              onClick={() => {
                acquisitionFunnelService.trackCtaClick(section.cta!.primary.text, 'organic', exam.id);
                acquisitionFunnelService.trackSignupStart('organic', exam.id);
              }}
              className="btn px-8 py-4 text-lg bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700"
            >
              {section.cta.primary.text}
            </Link>
          )}
          {section.cta?.secondary && (
            <Link
              to={section.cta.secondary.href}
              className="btn px-8 py-4 text-lg bg-surface-800 border border-surface-600 hover:bg-surface-700"
            >
              {section.cta.secondary.text}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Section Dispatcher ───────────────────────────────────────────────────────

function RenderSection({ section, exam }: { section: ContentSection; exam: ExamConfig }) {
  switch (section.type) {
    case 'hero':             return <HeroSection section={section} exam={exam} />;
    case 'features':         return <FeaturesSection section={section} />;
    case 'why_edugenius':    return <WhyEduGeniusSection section={section} />;
    case 'testimonials':     return <TestimonialsSection section={section} />;
    case 'topic_grid':       return <TopicGridSection section={section} />;
    case 'faq':              return <FaqSection section={section} />;
    case 'exam_calendar':    return <ExamCalendarSection section={section} />;
    case 'cta':              return <CtaSection section={section} exam={exam} />;
    default:                 return null;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExamPage() {
  const { examCode } = useParams<{ examCode: string }>();
  const navigate = useNavigate();

  const [exam, setExam] = useState<ExamConfig | null>(null);
  const [pageConfig, setPageConfig] = useState<LandingPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examCode) { navigate('/website'); return; }

    const found = getExamByRoute(examCode);
    if (!found) {
      // Exam not found — redirect to homepage
      navigate('/website');
      return;
    }

    setExam(found);

    // Generate landing page config
    const config = landingPageEngine.generateExamLandingPage(found.id);
    setPageConfig(config);
    setLoading(false);

    // Track funnel event
    acquisitionFunnelService.trackPageView('organic', found.id, `exam-${found.id}`);

    // Inject SEO meta
    const meta = websiteSeoService.generatePageMeta('exam', { exam: found });
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

    // Inject JSON-LD schemas
    const schemas = [
      websiteSeoService.generateSchemaMarkup('Course', { exam: found }),
      websiteSeoService.generateSchemaMarkup('FAQPage', { exam: found }),
      websiteSeoService.generateSchemaMarkup('BreadcrumbList', { exam: found }),
    ];
    let ldScript = document.getElementById('exam-ld-json') as HTMLScriptElement | null;
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.id = 'exam-ld-json';
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(schemas);
  }, [examCode, navigate]);

  if (loading || !exam || !pageConfig) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  const otherExams = getLiveExams().filter((e) => e.id !== exam.id).slice(0, 3);

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
          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-sm text-surface-400">
            <Link to="/website" className="hover:text-white">Home</Link>
            <span>/</span>
            <span className="text-white">{exam.shortName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Login</Link>
            <Link
              to="/onboarding"
              onClick={() => acquisitionFunnelService.trackCtaClick('Start Free', 'organic', exam.id)}
              className="btn btn-sm bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Render all sections dynamically */}
      {pageConfig.sections.map((section) => (
        <RenderSection key={section.id} section={section} exam={exam} />
      ))}

      {/* Other Exams */}
      {otherExams.length > 0 && (
        <section className="py-16 px-6 border-t border-surface-800">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-8">Also Preparing For?</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {otherExams.map((e) => (
                <Link
                  key={e.id}
                  to={`/website/exams/${e.route}`}
                  className="group p-5 bg-surface-800 rounded-xl border border-surface-700 hover:border-primary-500/50 transition-all text-center"
                >
                  <span className="text-3xl">{e.icon}</span>
                  <p className="text-white font-medium mt-2 group-hover:text-primary-400 transition-colors">{e.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-surface-700">
        <div className="max-w-7xl mx-auto text-center text-surface-500 text-sm">
          <p>© 2026 EduGenius by MathConcepts. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-3">
            <Link to="/website" className="hover:text-white">Home</Link>
            <Link to="/website/pricing" className="hover:text-white">Pricing</Link>
            <Link to="/website/blog" className="hover:text-white">Blog</Link>
            <Link to="/website/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
