/**
 * Onboarding Flow
 * Multi-step guided onboarding for new users
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Mail, 
  Phone, 
  BookOpen,
  GraduationCap,
  MessageSquare,
  Brain,
  Target,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  saveWhatsAppOptIn,
  saveWhatsAppSkip,
  validateIndianPhone,
  hasWhatsAppOptIn,
} from '@/services/whatsappOptIn';

// ============================================
// TYPES
// ============================================

type OnboardingStep = 
  | 'welcome'
  | 'role'
  | 'verify_email'
  | 'exam'
  | 'whatsapp'
  | 'subjects'
  | 'learning_style'
  | 'channels'
  | 'complete';

type UserRole = 'student' | 'parent' | 'teacher';

type ExamType = 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET' | 'CBSE_10' | 'CBSE_12' | 'CAT' | 'UPSC' | 'GATE';

interface ExamConfig {
  id: ExamType;
  name: string;
  icon: string;
  subjects: string[];
  grades: number[];
  color: string;
  enabled?: boolean;
  enabledYears?: number[];
  requiresApproval?: boolean;
  pricingTier?: string;
}

// ============================================
// EXAM CONFIGURATIONS (defaults, will be overridden by API)
// ============================================

const DEFAULT_EXAMS: ExamConfig[] = [
  { id: 'JEE_MAIN', name: 'JEE Main', icon: '🎯', subjects: ['Physics', 'Chemistry', 'Mathematics'], grades: [11, 12], color: 'bg-blue-500' },
  { id: 'JEE_ADVANCED', name: 'JEE Advanced', icon: '🏆', subjects: ['Physics', 'Chemistry', 'Mathematics'], grades: [11, 12], color: 'bg-purple-500' },
  { id: 'NEET', name: 'NEET', icon: '🩺', subjects: ['Physics', 'Chemistry', 'Biology'], grades: [11, 12], color: 'bg-green-500' },
  { id: 'CBSE_10', name: 'CBSE Class 10', icon: '📝', subjects: ['Maths', 'Science', 'Social Science', 'English'], grades: [10], color: 'bg-yellow-500' },
  { id: 'CBSE_12', name: 'CBSE Class 12', icon: '📚', subjects: ['Physics', 'Chemistry', 'Maths/Biology'], grades: [12], color: 'bg-red-500' },
  { id: 'CAT', name: 'CAT', icon: '💼', subjects: ['Quant', 'VARC', 'DILR'], grades: [], color: 'bg-indigo-500' },
  { id: 'UPSC', name: 'UPSC CSE', icon: '🏛️', subjects: ['GS', 'Optional'], grades: [], color: 'bg-cyan-500' },
  { id: 'GATE', name: 'GATE', icon: '⚙️', subjects: ['Subject-specific'], grades: [], color: 'bg-lime-500' },
];

// Exam icons and colors mapping
const EXAM_ICONS: Record<string, string> = {
  JEE_MAIN: '🎯', JEE_ADVANCED: '🏆', NEET: '🩺', CBSE_10: '📝',
  CBSE_12: '📚', CAT: '💼', UPSC: '🏛️', GATE: '⚙️',
};
const EXAM_COLORS: Record<string, string> = {
  JEE_MAIN: 'bg-blue-500', JEE_ADVANCED: 'bg-purple-500', NEET: 'bg-green-500',
  CBSE_10: 'bg-yellow-500', CBSE_12: 'bg-red-500', CAT: 'bg-indigo-500',
  UPSC: 'bg-cyan-500', GATE: 'bg-lime-500',
};

// ============================================
// LEARNING STYLE QUESTIONS
// ============================================

const LEARNING_STYLE_QUESTIONS = [
  {
    id: 'q1',
    question: 'When learning something new, I prefer to:',
    options: [
      { text: 'Watch a video or see diagrams', style: 'visual' },
      { text: 'Listen to an explanation', style: 'auditory' },
      { text: 'Read about it in detail', style: 'reading' },
      { text: 'Try it hands-on', style: 'kinesthetic' },
    ],
  },
  {
    id: 'q2',
    question: 'I remember things best when I:',
    options: [
      { text: 'See pictures or charts', style: 'visual' },
      { text: 'Hear them explained', style: 'auditory' },
      { text: 'Write them down', style: 'reading' },
      { text: 'Practice doing them', style: 'kinesthetic' },
    ],
  },
  {
    id: 'q3',
    question: 'When solving a problem, I first:',
    options: [
      { text: 'Draw a diagram', style: 'visual' },
      { text: 'Talk through it', style: 'auditory' },
      { text: 'Read the problem carefully', style: 'reading' },
      { text: 'Start working on it', style: 'kinesthetic' },
    ],
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [availableExams, setAvailableExams] = useState<ExamConfig[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const [userData, setUserData] = useState({
    role: '' as UserRole | '',
    email: '',
    emailVerified: false,
    phone: '',
    phoneVerified: false,
    selectedExam: '' as ExamType | '',
    examYear: new Date().getFullYear() + 1,
    subjects: [] as string[],
    learningStyle: '',
    learningStyleAnswers: {} as Record<string, string>,
    connectedChannels: [] as string[],
  });

  // Fetch admin-enabled exams on mount
  useEffect(() => {
    async function fetchEnabledExams() {
      try {
        const response = await fetch('/api/exams/enabled');
        if (response.ok) {
          const data = await response.json();
          // Transform API response to ExamConfig format
          const exams: ExamConfig[] = data.map((exam: any) => ({
            id: exam.examId,
            name: exam.examId.replace(/_/g, ' '),
            icon: EXAM_ICONS[exam.examId] || '📚',
            subjects: exam.enabledSubjects || [],
            grades: exam.enabledGrades || [],
            color: EXAM_COLORS[exam.examId] || 'bg-gray-500',
            enabled: exam.enabled,
            enabledYears: exam.enabledYears || [],
            requiresApproval: exam.requiresApproval,
            pricingTier: exam.pricingTier,
          }));
          setAvailableExams(exams);
        } else {
          // Fallback to defaults if API fails
          setAvailableExams(DEFAULT_EXAMS);
        }
      } catch (error) {
        console.error('Failed to fetch enabled exams:', error);
        setAvailableExams(DEFAULT_EXAMS);
      } finally {
        setLoadingExams(false);
      }
    }
    fetchEnabledExams();
  }, []);

  const steps: OnboardingStep[] = [
    'welcome',
    'role',
    'verify_email',
    'exam',
    'whatsapp',
    'subjects',
    'learning_style',
    'channels',
    'complete',
  ];

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const skipStep = () => {
    nextStep();
  };

  const completeOnboarding = () => {
    // Save user data
    localStorage.setItem('edugenius_onboarding_complete', 'true');
    localStorage.setItem('edugenius_user_data', JSON.stringify(userData));
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">
      {/* Progress Bar */}
      <div className="h-1 bg-surface-800">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
            EduGenius
          </span>
        </div>
        {currentStepIndex > 0 && currentStep !== 'complete' && (
          <button
            onClick={skipStep}
            className="text-surface-400 hover:text-white text-sm"
          >
            Skip for now
          </button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* Welcome */}
            {currentStep === 'welcome' && (
              <StepContainer key="welcome">
                <div className="text-center">
                  <motion.div
                    className="text-7xl mb-6"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    👋
                  </motion.div>
                  <h1 className="text-4xl font-bold text-white mb-4">
                    Welcome to EduGenius!
                  </h1>
                  <p className="text-xl text-surface-300 mb-8">
                    Your AI-powered learning companion. Let's set up your personalized learning experience.
                  </p>
                  <button onClick={nextStep} className="btn-primary text-lg px-8 py-3">
                    Let's Get Started <ArrowRight className="w-5 h-5 ml-2 inline" />
                  </button>
                </div>
              </StepContainer>
            )}

            {/* Role Selection */}
            {currentStep === 'role' && (
              <StepContainer key="role">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">
                  How will you use EduGenius?
                </h2>
                <p className="text-surface-400 mb-8 text-center">
                  Select your role to personalize your experience
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { role: 'student' as UserRole, icon: '🎓', title: 'Student', desc: 'I want to learn and prepare for exams' },
                    { role: 'parent' as UserRole, icon: '👨‍👩‍👧', title: 'Parent', desc: 'I want to track my child\'s progress' },
                    { role: 'teacher' as UserRole, icon: '👩‍🏫', title: 'Teacher', desc: 'I want to create content and track students' },
                  ].map((option) => (
                    <button
                      key={option.role}
                      onClick={() => {
                        setUserData({ ...userData, role: option.role });
                        nextStep();
                      }}
                      className={clsx(
                        'p-6 rounded-2xl border-2 text-left transition-all hover:scale-105',
                        userData.role === option.role
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-surface-700 bg-surface-800 hover:border-surface-600'
                      )}
                    >
                      <span className="text-4xl mb-4 block">{option.icon}</span>
                      <h3 className="text-xl font-semibold text-white mb-1">{option.title}</h3>
                      <p className="text-surface-400 text-sm">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </StepContainer>
            )}

            {/* Email Verification */}
            {currentStep === 'verify_email' && (
              <StepContainer key="verify_email">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-primary-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Verify Your Email
                  </h2>
                  <p className="text-surface-400">
                    We'll send you a verification code
                  </p>
                </div>
                <div className="space-y-4 max-w-md mx-auto">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={userData.email}
                    onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                    className="input w-full text-lg"
                  />
                  <button
                    onClick={() => {
                      // Mock verification
                      setUserData({ ...userData, emailVerified: true });
                      nextStep();
                    }}
                    disabled={!userData.email}
                    className="btn-primary w-full text-lg"
                  >
                    Send Verification Code
                  </button>
                </div>
                <p className="text-center text-surface-500 text-sm mt-4">
                  We'll only use this for important updates and security
                </p>
              </StepContainer>
            )}

            {/* Exam Selection - Admin Controlled */}
            {currentStep === 'exam' && (
              <StepContainer key="exam">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">
                  Which exam are you preparing for?
                </h2>
                <p className="text-surface-400 mb-8 text-center">
                  {loadingExams 
                    ? 'Loading available exams...' 
                    : 'Select from available exams configured by admin'
                  }
                </p>
                
                {loadingExams ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                  </div>
                ) : availableExams.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-surface-400">No exams are currently available.</p>
                    <p className="text-surface-500 text-sm mt-2">Please contact support.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {availableExams.map((exam) => (
                        <button
                          key={exam.id}
                          onClick={async () => {
                            setUserData({ 
                              ...userData, 
                              selectedExam: exam.id,
                              subjects: exam.subjects,
                            });
                            
                            // Check if exam requires approval
                            if (exam.requiresApproval) {
                              setEnrollmentStatus('pending');
                            } else {
                              setEnrollmentStatus('approved');
                            }
                            nextStep();
                          }}
                          className={clsx(
                            'p-4 rounded-xl border-2 text-center transition-all hover:scale-105 relative',
                            userData.selectedExam === exam.id
                              ? 'border-primary-500 bg-primary-500/10'
                              : 'border-surface-700 bg-surface-800 hover:border-surface-600'
                          )}
                        >
                          <span className="text-3xl mb-2 block">{exam.icon}</span>
                          <h3 className="font-medium text-white">{exam.name}</h3>
                          
                          {/* Pricing tier badge */}
                          {exam.pricingTier && (
                            <span className={clsx(
                              'absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full',
                              exam.pricingTier === 'free' && 'bg-green-500/20 text-green-400',
                              exam.pricingTier === 'basic' && 'bg-blue-500/20 text-blue-400',
                              exam.pricingTier === 'premium' && 'bg-purple-500/20 text-purple-400',
                              exam.pricingTier === 'enterprise' && 'bg-yellow-500/20 text-yellow-400',
                            )}>
                              {exam.pricingTier}
                            </span>
                          )}
                          
                          {/* Approval required indicator */}
                          {exam.requiresApproval && (
                            <span className="text-xs text-surface-500 mt-1 block">
                              Requires approval
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {/* Year selection - only show enabled years */}
                    <div className="mt-6 flex items-center justify-center gap-4">
                      <span className="text-surface-400">Exam Year:</span>
                      <select
                        value={userData.examYear}
                        onChange={(e) => setUserData({ ...userData, examYear: parseInt(e.target.value) })}
                        className="input w-32"
                      >
                        {(userData.selectedExam && availableExams.find(e => e.id === userData.selectedExam)?.enabledYears?.length
                          ? availableExams.find(e => e.id === userData.selectedExam)!.enabledYears!
                          : [0, 1, 2, 3].map(o => new Date().getFullYear() + o)
                        ).map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Enrollment status message */}
                    {enrollmentStatus === 'pending' && (
                      <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
                        <p className="text-yellow-400 text-sm">
                          ⏳ This exam requires approval. You'll get access once an admin approves your request.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </StepContainer>
            )}

            {/* WhatsApp Opt-In — inline step */}
            {currentStep === 'whatsapp' && (
              <WhatsAppOnboardingStep
                key="whatsapp"
                examName={availableExams.find(e => e.id === userData.selectedExam)?.name ?? 'JEE Main'}
                onNext={nextStep}
                onSkip={nextStep}
              />
            )}

            {/* Subject Preferences */}
            {currentStep === 'subjects' && (
              <StepContainer key="subjects">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">
                  Set your subject priorities
                </h2>
                <p className="text-surface-400 mb-8 text-center">
                  Drag to reorder by priority, or mark your strong/weak areas
                </p>
                <div className="space-y-3 max-w-md mx-auto">
                  {userData.subjects.map((subject, index) => (
                    <div
                      key={subject}
                      className="p-4 bg-surface-800 rounded-xl border border-surface-700 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-400 font-bold">
                          {index + 1}
                        </span>
                        <span className="text-white font-medium">{subject}</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30">
                          Strong
                        </button>
                        <button className="px-3 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30">
                          Weak
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center mt-8">
                  <button onClick={nextStep} className="btn-primary px-8">
                    Continue <ArrowRight className="w-5 h-5 ml-2 inline" />
                  </button>
                </div>
              </StepContainer>
            )}

            {/* Learning Style */}
            {currentStep === 'learning_style' && (
              <StepContainer key="learning_style">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">
                  How do you learn best?
                </h2>
                <p className="text-surface-400 mb-8 text-center">
                  Quick quiz to understand your learning style
                </p>
                {LEARNING_STYLE_QUESTIONS.map((q, qIndex) => (
                  <div key={q.id} className="mb-6">
                    <p className="text-white font-medium mb-3">
                      {qIndex + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt.text}
                          onClick={() => {
                            setUserData({
                              ...userData,
                              learningStyleAnswers: {
                                ...userData.learningStyleAnswers,
                                [q.id]: opt.style,
                              },
                            });
                          }}
                          className={clsx(
                            'p-3 rounded-lg border text-left text-sm transition-all',
                            userData.learningStyleAnswers[q.id] === opt.style
                              ? 'border-primary-500 bg-primary-500/10 text-white'
                              : 'border-surface-700 bg-surface-800 text-surface-300 hover:border-surface-600'
                          )}
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => {
                      // Determine dominant style
                      const answers = Object.values(userData.learningStyleAnswers);
                      const counts: Record<string, number> = {};
                      answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
                      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
                      setUserData({ ...userData, learningStyle: dominant });
                      nextStep();
                    }}
                    disabled={Object.keys(userData.learningStyleAnswers).length < LEARNING_STYLE_QUESTIONS.length}
                    className="btn-primary px-8"
                  >
                    Analyze My Style <Brain className="w-5 h-5 ml-2 inline" />
                  </button>
                </div>
              </StepContainer>
            )}

            {/* Channel Connection */}
            {currentStep === 'channels' && (
              <StepContainer key="channels">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">
                  Stay connected
                </h2>
                <p className="text-surface-400 mb-8 text-center">
                  Connect your preferred channels for notifications and quick access
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl mx-auto">
                  {[
                    { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: 'bg-green-500' },
                    { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'bg-blue-500' },
                    { id: 'email', name: 'Email', icon: '📧', color: 'bg-purple-500' },
                  ].map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        const channels = userData.connectedChannels.includes(channel.id)
                          ? userData.connectedChannels.filter(c => c !== channel.id)
                          : [...userData.connectedChannels, channel.id];
                        setUserData({ ...userData, connectedChannels: channels });
                      }}
                      className={clsx(
                        'p-6 rounded-xl border-2 text-center transition-all',
                        userData.connectedChannels.includes(channel.id)
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-surface-700 bg-surface-800 hover:border-surface-600'
                      )}
                    >
                      <span className="text-4xl mb-3 block">{channel.icon}</span>
                      <h3 className="font-medium text-white">{channel.name}</h3>
                      {userData.connectedChannels.includes(channel.id) && (
                        <span className="text-green-400 text-sm flex items-center justify-center gap-1 mt-2">
                          <Check className="w-4 h-4" /> Connected
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center mt-8">
                  <button onClick={nextStep} className="btn-primary px-8">
                    Continue <ArrowRight className="w-5 h-5 ml-2 inline" />
                  </button>
                </div>
              </StepContainer>
            )}

            {/* Complete */}
            {currentStep === 'complete' && (
              <StepContainer key="complete">
                <div className="text-center">
                  <motion.div
                    className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                  >
                    <Check className="w-10 h-10 text-green-400" />
                  </motion.div>
                  <h2 className="text-4xl font-bold text-white mb-4">
                    You're all set! 🎉
                  </h2>
                  <p className="text-xl text-surface-300 mb-8">
                    Your personalized learning journey begins now
                  </p>
                  
                  {/* Summary */}
                  <div className="bg-surface-800 rounded-xl p-6 text-left mb-8 max-w-md mx-auto">
                    <h3 className="font-semibold text-white mb-4">Your Profile</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-surface-400">Exam:</span>
                        <span className="text-white">{availableExams.find((e: any) => e.id === userData.selectedExam)?.name ?? userData.selectedExam}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Year:</span>
                        <span className="text-white">{userData.examYear}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Learning Style:</span>
                        <span className="text-white capitalize">{userData.learningStyle || 'Mixed'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Connected:</span>
                        <span className="text-white">{userData.connectedChannels.length} channels</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={completeOnboarding}
                    className="btn-primary text-lg px-8 py-3"
                  >
                    Start Learning <Sparkles className="w-5 h-5 ml-2 inline" />
                  </button>
                </div>
              </StepContainer>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Navigation */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <footer className="p-6 flex justify-between items-center">
          <button
            onClick={prevStep}
            className="flex items-center gap-2 text-surface-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <div className="flex items-center gap-2">
            {steps.slice(1, -1).map((step, index) => (
              <div
                key={step}
                className={clsx(
                  'w-2 h-2 rounded-full transition-colors',
                  index < currentStepIndex - 1
                    ? 'bg-primary-500'
                    : index === currentStepIndex - 1
                    ? 'bg-white'
                    : 'bg-surface-700'
                )}
              />
            ))}
          </div>
          <div className="w-20" /> {/* Spacer for alignment */}
        </footer>
      )}
    </div>
  );
}

// ============================================
// STEP CONTAINER
// ============================================

function StepContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// WHATSAPP ONBOARDING STEP (inline form, no modal overlay)
// ============================================

function WhatsAppOnboardingStep({
  examName,
  onNext,
  onSkip,
}: {
  examName: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(hasWhatsAppOptIn());

  const handleSubmit = () => {
    setError('');
    const raw = countryCode === '+91' ? phone : `${countryCode}${phone}`;
    const { valid, normalized } = validateIndianPhone(raw);
    if (!valid) { setError('Please enter a valid 10-digit mobile number.'); return; }
    if (!consent) { setError('Please accept the consent to continue.'); return; }

    saveWhatsAppOptIn({
      phone: normalized,
      countryCode: 'IN',
      exam: examName,
      consentTimestamp: new Date().toISOString(),
      source: 'onboarding',
    });
    setDone(true);
    setTimeout(onNext, 800);
  };

  const handleSkip = () => {
    saveWhatsAppSkip();
    onSkip();
  };

  if (done) {
    return (
      <StepContainer key="wa-done">
        <div className="text-center py-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-[#25D366]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
          <p className="text-white font-semibold text-lg">WhatsApp connected!</p>
          <p className="text-surface-400 text-sm mt-1">You'll get your first nudge soon 📲</p>
        </div>
      </StepContainer>
    );
  }

  return (
    <StepContainer key="wa-form">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.1 21.9l4.863-1.274A9.947 9.947 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#25D366"/>
              <path d="M17.006 14.547c-.274-.137-1.62-.8-1.871-.89-.252-.092-.435-.137-.617.137-.183.274-.708.891-.868 1.074-.16.183-.32.206-.594.069-.274-.137-1.157-.426-2.203-1.36-.815-.726-1.364-1.622-1.524-1.896-.16-.274-.017-.422.12-.559.124-.123.274-.32.411-.48.137-.16.183-.274.274-.457.092-.183.046-.343-.023-.48-.069-.137-.617-1.487-.845-2.036-.222-.534-.449-.462-.617-.47L8 7.998c-.16 0-.411.069-.627.32-.217.252-.823.805-.823 1.963 0 1.158.845 2.277.962 2.437.117.16 1.655 2.535 4.014 3.555.56.242 1 .387 1.34.495.563.179 1.076.154 1.48.093.452-.068 1.391-.568 1.588-1.118.196-.549.196-1.018.137-1.117-.058-.1-.24-.16-.514-.297z" fill="#fff"/>
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Get nudges on WhatsApp 📲</h2>
            <p className="text-surface-300 text-sm mt-1">
              Exam tips, streak reminders, and weekly progress — on WhatsApp. No spam, ever.
            </p>
          </div>
        </div>

        {/* Benefits */}
        <ul className="space-y-2 mb-6">
          {['Weekly progress digest', 'Streak reminders before you break it', 'Exam day countdown + last-minute tips'].map(b => (
            <li key={b} className="flex items-center gap-2 text-sm text-surface-200">
              <span className="flex-shrink-0 w-5 h-5 bg-[#25D366]/15 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-[#25D366]" />
              </span>
              {b}
            </li>
          ))}
        </ul>

        {/* Exam chip */}
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-surface-700 border border-surface-600 rounded-full text-surface-300">
            📚 {examName}
          </span>
        </div>

        {/* Phone input */}
        <div className="flex gap-2 mb-3">
          <select
            value={countryCode}
            onChange={e => setCountryCode(e.target.value)}
            className="flex-shrink-0 bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#25D366]/60 transition-colors"
          >
            <option value="+91">🇮🇳 +91</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+971">🇦🇪 +971</option>
          </select>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={e => { setPhone(e.target.value.replace(/[^\d\s\-().]/g, '')); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            className={clsx(
              'flex-1 bg-surface-800 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none transition-colors',
              error ? 'border-red-500/60' : 'border-surface-700 focus:border-[#25D366]/60'
            )}
          />
        </div>

        {/* Consent */}
        <label className={clsx(
          'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors mb-4',
          consent ? 'bg-[#25D366]/5 border-[#25D366]/30' : 'border-surface-700 hover:border-surface-600'
        )}>
          <div className="flex-shrink-0 mt-0.5">
            <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError(''); }} className="sr-only" />
            <div className={clsx(
              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
              consent ? 'bg-[#25D366] border-[#25D366]' : 'border-surface-500'
            )}>
              {consent && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
          </div>
          <p className="text-xs text-surface-400 leading-relaxed">
            I agree to receive WhatsApp messages. I can unsubscribe anytime by replying <span className="font-mono font-semibold text-surface-300">STOP</span>.
          </p>
        </label>

        {error && <p className="text-xs text-red-400 mb-3 -mt-2">{error}</p>}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          style={{ backgroundColor: '#25D366' }}
          className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Yes, send me tips 💬
        </button>

        <div className="text-center mt-3">
          <button onClick={handleSkip} className="text-xs text-surface-500 hover:text-surface-300 transition-colors">
            Maybe later
          </button>
        </div>
      </div>
    </StepContainer>
  );
}
