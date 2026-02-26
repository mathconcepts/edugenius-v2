/**
 * Public Website - Exam-Specific Landing Page
 * Dynamic content based on exam from URL
 */

import { useParams, Link } from 'react-router-dom';

interface ExamInfo {
  code: string;
  name: string;
  fullName: string;
  icon: string;
  color: string;
  description: string;
  stats: { label: string; value: string }[];
  subjects: string[];
  features: string[];
  testimonial: { name: string; score: string; quote: string };
}

const examsData: Record<string, ExamInfo> = {
  jee: {
    code: 'JEE',
    name: 'JEE Main & Advanced',
    fullName: 'Joint Entrance Examination',
    icon: '⚡',
    color: 'from-blue-500 to-cyan-500',
    description: 'Crack IIT with AI-powered preparation. Personalized practice, topic-wise tests, and Socratic tutoring designed for JEE aspirants.',
    stats: [
      { label: 'Students', value: '18,000+' },
      { label: 'Questions', value: '85,000+' },
      { label: 'Mock Tests', value: '500+' },
      { label: 'Avg Score Improvement', value: '+45%' },
    ],
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    features: [
      'JEE-pattern mock tests with detailed analysis',
      'Previous year questions with video solutions',
      'Topic-wise practice with adaptive difficulty',
      'Rank predictor based on your performance',
      'Chapter-wise weightage analysis',
      'AI-powered doubt solving in Hinglish',
    ],
    testimonial: { name: 'Rahul S.', score: 'AIR 1,247', quote: 'The adaptive practice knew exactly what I needed. Improved my rank from 15k to 1.2k!' },
  },
  neet: {
    code: 'NEET',
    name: 'NEET UG',
    fullName: 'National Eligibility cum Entrance Test',
    icon: '🧬',
    color: 'from-green-500 to-emerald-500',
    description: 'Your path to MBBS starts here. Master Biology, Physics, and Chemistry with NCERT-focused AI tutoring and extensive practice.',
    stats: [
      { label: 'Students', value: '12,000+' },
      { label: 'Questions', value: '65,000+' },
      { label: 'Mock Tests', value: '400+' },
      { label: 'Avg Score Improvement', value: '+52%' },
    ],
    subjects: ['Physics', 'Chemistry', 'Biology'],
    features: [
      'NCERT-aligned content with every concept covered',
      'Biology diagrams with labeled explanations',
      'NEET-pattern tests with negative marking',
      'Species and disease memory aids',
      'Human Physiology deep-dive modules',
      'Medical college predictor',
    ],
    testimonial: { name: 'Priya P.', score: '685/720', quote: 'The Biology coverage is unmatched. Every NCERT line is covered with practice questions.' },
  },
  cbse: {
    code: 'CBSE',
    name: 'CBSE Boards',
    fullName: 'Central Board of Secondary Education',
    icon: '📚',
    color: 'from-purple-500 to-pink-500',
    description: 'Score 95%+ in boards with structured preparation. NCERT mastery, sample papers, and marking scheme insights.',
    stats: [
      { label: 'Students', value: '15,000+' },
      { label: 'Questions', value: '50,000+' },
      { label: 'Sample Papers', value: '200+' },
      { label: 'Avg Score Improvement', value: '+18%' },
    ],
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'],
    features: [
      'Chapter-wise NCERT solutions',
      'Sample papers with CBSE marking scheme',
      'Diagram practice for Science',
      'Important questions bank',
      'Last-minute revision notes',
      'Previous year papers with solutions',
    ],
    testimonial: { name: 'Ananya S.', score: '97.2%', quote: 'The sample papers were exactly like the actual exam. Perfect preparation!' },
  },
  cat: {
    code: 'CAT',
    name: 'CAT & MBA',
    fullName: 'Common Admission Test',
    icon: '📊',
    color: 'from-orange-500 to-red-500',
    description: 'Crack CAT with structured quant, verbal, and DILR preparation. Time management strategies and sectional practice.',
    stats: [
      { label: 'Students', value: '5,000+' },
      { label: 'Questions', value: '25,000+' },
      { label: 'Mock Tests', value: '150+' },
      { label: 'Avg Percentile Improvement', value: '+15' },
    ],
    subjects: ['Quantitative Aptitude', 'Verbal Ability', 'Data Interpretation', 'Logical Reasoning'],
    features: [
      'CAT-pattern mocks with slot analysis',
      'DILR puzzle sets with explanations',
      'Reading comprehension practice',
      'Quant shortcuts and tricks',
      'Time management strategies',
      'IIM call predictor',
    ],
    testimonial: { name: 'Vikram R.', score: '99.2 percentile', quote: 'The DILR practice sets were game-changers. Improved from 85 to 99+ percentile.' },
  },
  'gate-em': {
    code: 'GATE EM',
    name: 'GATE Engineering Mathematics',
    fullName: 'Graduate Aptitude Test in Engineering — Engineering Mathematics',
    icon: '⚙️',
    color: 'from-violet-500 to-purple-500',
    description: 'Complete Engineering Mathematics preparation for GATE — covering all 10 core topics tested across CS, EC, EE, ME, and CE streams. AI-powered Socratic tutoring and adaptive practice.',
    stats: [
      { label: 'Questions', value: '8,000+' },
      { label: 'Topics', value: '10 Core' },
      { label: 'Mock Tests', value: '50+' },
      { label: 'Avg Score Improvement', value: '+38%' },
    ],
    subjects: [
      'Linear Algebra',
      'Calculus',
      'Differential Equations',
      'Complex Variables',
      'Probability & Statistics',
      'Numerical Methods',
      'Transform Theory',
      'Discrete Mathematics',
      'Graph Theory',
      'Vector Calculus',
    ],
    features: [
      'All 10 GATE EM topics with previous year questions',
      'Adaptive difficulty: 30% easy / 50% medium / 20% hard',
      'Socratic AI tutor explains step-by-step reasoning',
      '65-question full mock tests (3 hrs, GATE pattern)',
      'Numerical Answer Type (NAT) practice — no negative marking',
      'Topic-wise weakness detection and targeted drill',
    ],
    testimonial: {
      name: 'Aditya K.',
      score: 'GATE CS AIR 312',
      quote: 'The Engineering Maths module alone saved me 15 marks. The Socratic tutor explains proofs in a way no textbook does.',
    },
  },
};

export default function ExamPage() {
  const { examCode } = useParams<{ examCode: string }>();
  const exam = examsData[examCode?.toLowerCase() || 'jee'];

  if (!exam) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl">🔍</span>
          <h1 className="text-2xl font-bold text-white mt-4">Exam not found</h1>
          <Link to="/website" className="btn mt-4 bg-primary-600">Go Home</Link>
        </div>
      </div>
    );
  }

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
            <Link to={`/website/signup?exam=${exam.code}`} className="btn btn-sm bg-gradient-to-r from-primary-600 to-accent-600">
              Start {exam.code} Prep
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${exam.color} bg-opacity-20 rounded-full text-white text-sm mb-6`}>
                <span className="text-xl">{exam.icon}</span>
                <span>{exam.fullName}</span>
              </div>
              <h1 className="text-5xl font-bold text-white mb-6">
                Crack {exam.name} with AI
              </h1>
              <p className="text-xl text-surface-300 mb-8">{exam.description}</p>
              <div className="flex gap-4">
                <Link to={`/website/signup?exam=${exam.code}`} className="btn px-8 py-4 text-lg bg-gradient-to-r from-primary-600 to-accent-600">
                  Start Free Trial
                </Link>
                <Link to="/website/demo" className="btn px-8 py-4 text-lg bg-surface-800 border border-surface-600">
                  Watch Demo
                </Link>
              </div>
            </div>
            <div className="flex-1">
              <div className={`p-8 rounded-3xl bg-gradient-to-br ${exam.color} bg-opacity-10 border border-surface-700`}>
                <div className="grid grid-cols-2 gap-6">
                  {exam.stats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <p className="text-3xl font-bold text-white">{stat.value}</p>
                      <p className="text-surface-400">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="py-16 px-6 bg-surface-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Subjects Covered</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {exam.subjects.map((subject) => (
              <div key={subject} className="px-8 py-4 bg-surface-800 rounded-2xl border border-surface-700">
                <span className="text-xl font-semibold text-white">{subject}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">{exam.code}-Specific Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exam.features.map((feature, i) => (
              <div key={i} className="p-6 bg-surface-800 rounded-2xl border border-surface-700">
                <span className="text-2xl text-primary-400">✓</span>
                <p className="text-white mt-2">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary-900/20 to-accent-900/20">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-6xl">{exam.icon}</span>
          <p className="text-2xl text-white mt-6 mb-4">"{exam.testimonial.quote}"</p>
          <p className="text-primary-400 font-semibold">{exam.testimonial.name}</p>
          <p className="text-surface-400">{exam.code} • {exam.testimonial.score}</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Crack {exam.code}?</h2>
          <p className="text-xl text-surface-400 mb-8">Join {exam.stats[0].value} students already preparing with AI</p>
          <Link to={`/website/signup?exam=${exam.code}`} className="btn px-8 py-4 text-lg bg-gradient-to-r from-primary-600 to-accent-600">
            Start Your Free Trial
          </Link>
        </div>
      </section>
    </div>
  );
}
