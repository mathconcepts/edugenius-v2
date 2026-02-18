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

// ============================================
// TYPES
// ============================================

type OnboardingStep = 
  | 'welcome'
  | 'role'
  | 'verify_email'
  | 'exam'
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
}

// ============================================
// EXAM CONFIGURATIONS
// ============================================

const EXAMS: ExamConfig[] = [
  { id: 'JEE_MAIN', name: 'JEE Main', icon: '🎯', subjects: ['Physics', 'Chemistry', 'Mathematics'], grades: [11, 12], color: 'bg-blue-500' },
  { id: 'JEE_ADVANCED', name: 'JEE Advanced', icon: '🏆', subjects: ['Physics', 'Chemistry', 'Mathematics'], grades: [11, 12], color: 'bg-purple-500' },
  { id: 'NEET', name: 'NEET', icon: '🩺', subjects: ['Physics', 'Chemistry', 'Biology'], grades: [11, 12], color: 'bg-green-500' },
  { id: 'CBSE_10', name: 'CBSE Class 10', icon: '📝', subjects: ['Maths', 'Science', 'Social Science', 'English'], grades: [10], color: 'bg-yellow-500' },
  { id: 'CBSE_12', name: 'CBSE Class 12', icon: '📚', subjects: ['Physics', 'Chemistry', 'Maths/Biology'], grades: [12], color: 'bg-red-500' },
  { id: 'CAT', name: 'CAT', icon: '💼', subjects: ['Quant', 'VARC', 'DILR'], grades: [], color: 'bg-indigo-500' },
  { id: 'UPSC', name: 'UPSC CSE', icon: '🏛️', subjects: ['GS', 'Optional'], grades: [], color: 'bg-cyan-500' },
  { id: 'GATE', name: 'GATE', icon: '⚙️', subjects: ['Subject-specific'], grades: [], color: 'bg-lime-500' },
];

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

  const steps: OnboardingStep[] = [
    'welcome',
    'role',
    'verify_email',
    'exam',
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

            {/* Exam Selection */}
            {currentStep === 'exam' && (
              <StepContainer key="exam">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">
                  Which exam are you preparing for?
                </h2>
                <p className="text-surface-400 mb-8 text-center">
                  We'll customize your learning path accordingly
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {EXAMS.map((exam) => (
                    <button
                      key={exam.id}
                      onClick={() => {
                        setUserData({ 
                          ...userData, 
                          selectedExam: exam.id,
                          subjects: exam.subjects,
                        });
                        nextStep();
                      }}
                      className={clsx(
                        'p-4 rounded-xl border-2 text-center transition-all hover:scale-105',
                        userData.selectedExam === exam.id
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-surface-700 bg-surface-800 hover:border-surface-600'
                      )}
                    >
                      <span className="text-3xl mb-2 block">{exam.icon}</span>
                      <h3 className="font-medium text-white">{exam.name}</h3>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-center gap-4">
                  <span className="text-surface-400">Exam Year:</span>
                  <select
                    value={userData.examYear}
                    onChange={(e) => setUserData({ ...userData, examYear: parseInt(e.target.value) })}
                    className="input w-32"
                  >
                    {[0, 1, 2, 3].map((offset) => (
                      <option key={offset} value={new Date().getFullYear() + offset}>
                        {new Date().getFullYear() + offset}
                      </option>
                    ))}
                  </select>
                </div>
              </StepContainer>
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
                        <span className="text-white">{EXAMS.find(e => e.id === userData.selectedExam)?.name}</span>
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
