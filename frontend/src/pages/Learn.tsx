/**
 * Learn Page - Student Learning Interface
 * AI-powered topic exploration and tutoring
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import {
  createRootTrace,
  addNode,
  storeTrace,
} from '@/services/traceabilityEngine';
import type { TraceTree } from '@/services/traceabilityEngine';
// Wire 7 — P1: Persona-driven aiRecommended
import { loadPersona } from '@/services/studentPersonaEngine';
// Customer-centric content framework
import { ContentFeed } from '@/components/ContentFeed';
import type { ContentAtom } from '@/services/contentFramework';

interface Topic {
  id: string;
  name: string;
  subject: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  progress: number;
  mastery: number;
  estimatedTime: number;
  prerequisites: string[];
  aiRecommended: boolean;
}

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  topics: number;
  progress: number;
  nextTopic?: Topic;
}

const subjects: Subject[] = [
  { id: 'physics', name: 'Physics', icon: '⚡', color: 'from-blue-500 to-cyan-500', topics: 45, progress: 68 },
  { id: 'chemistry', name: 'Chemistry', icon: '🧪', color: 'from-green-500 to-emerald-500', topics: 52, progress: 45 },
  { id: 'mathematics', name: 'Mathematics', icon: '📐', color: 'from-purple-500 to-pink-500', topics: 38, progress: 72 },
  { id: 'biology', name: 'Biology', icon: '🧬', color: 'from-orange-500 to-red-500', topics: 48, progress: 35 },
];

const mockTopics: Topic[] = [
  { id: '1', name: 'Electromagnetic Induction', subject: 'physics', chapter: 'Electromagnetism', difficulty: 'medium', progress: 80, mastery: 75, estimatedTime: 45, prerequisites: ['Magnetic Fields'], aiRecommended: true },
  { id: '2', name: 'AC Circuits', subject: 'physics', chapter: 'Electromagnetism', difficulty: 'hard', progress: 30, mastery: 25, estimatedTime: 60, prerequisites: ['Electromagnetic Induction'], aiRecommended: false },
  { id: '3', name: 'Thermodynamics Laws', subject: 'physics', chapter: 'Heat', difficulty: 'medium', progress: 100, mastery: 90, estimatedTime: 40, prerequisites: [], aiRecommended: false },
  { id: '4', name: 'Organic Reactions', subject: 'chemistry', chapter: 'Organic Chemistry', difficulty: 'hard', progress: 50, mastery: 45, estimatedTime: 75, prerequisites: ['Hydrocarbons'], aiRecommended: true },
  { id: '5', name: 'Integration Techniques', subject: 'mathematics', chapter: 'Calculus', difficulty: 'medium', progress: 65, mastery: 60, estimatedTime: 50, prerequisites: ['Differentiation'], aiRecommended: true },
];

export default function Learn() {
  const { subjectId } = useParams();
  const { userRole } = useAppStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(subjectId || null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Wire 2 — Traceability: create root trace on page load, store on unmount
  const learnTrace = useRef<TraceTree | null>(null);

  useEffect(() => {
    const topicLabel = subjectId || 'general';
    const trace = createRootTrace({
      sessionId: `learn-${Date.now()}`,
      entryPoint: 'dashboard',
      examType: undefined,
    });
    // Add a custom entry node describing the learn page
    addNode(trace, {
      traceId: `learn-entry-${Date.now()}`,
      parentTraceId: trace.nodes[0]?.traceId,
      nodeType: 'agent_call',
      agentId: 'sage',
      action: `learn:${topicLabel}`,
      inputSummary: `subject=${topicLabel}`,
      outputSummary: 'Learn page loaded',
      timestamp: new Date().toISOString(),
    });
    learnTrace.current = trace;

    // Store on unmount
    return () => {
      if (learnTrace.current) {
        storeTrace(learnTrace.current);
      }
    };
  }, []);

  useEffect(() => {
    if (subjectId) {
      setSelectedSubject(subjectId);
      // Record subject selection in trace
      if (learnTrace.current) {
        addNode(learnTrace.current, {
          traceId: `learn-subject-${Date.now()}`,
          parentTraceId: learnTrace.current.nodes[0]?.traceId,
          nodeType: 'intent',
          action: `subject_selected:${subjectId}`,
          inputSummary: subjectId,
          outputSummary: `Filtered to ${subjectId}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [subjectId]);

  useEffect(() => {
    // Wire 7 — P1: Compute aiRecommended from persona.weakSubjects × topic names/tags
    setLoading(true);
    const persona = loadPersona();
    const weakSet = persona.weakSubjects.map(s => s.toLowerCase());

    // Update aiRecommended flags dynamically based on persona
    const personaEnrichedTopics = mockTopics.map(topic => ({
      ...topic,
      aiRecommended: weakSet.some(ws =>
        topic.name.toLowerCase().includes(ws) ||
        topic.subject.toLowerCase().includes(ws) ||
        topic.chapter.toLowerCase().includes(ws)
      ),
    }));

    // Build persona-driven suggestions
    const suggestions: string[] = [];
    if (persona.weakSubjects.length > 0) {
      suggestions.push(`Based on your profile, focus on ${persona.weakSubjects[0]} — it needs the most attention.`);
    }
    if (persona.weakSubjects.length > 1) {
      suggestions.push(`${persona.weakSubjects[1]} is another area to strengthen before your exam.`);
    }
    if (persona.daysToExam < 30) {
      suggestions.push(`Only ${persona.daysToExam} days to exam — prioritise high-yield topics from each subject.`);
    } else {
      suggestions.push(`You have ${persona.daysToExam} days — a good time to build solid foundations.`);
    }

    // Replace mockTopics aiRecommended flags with persona-driven flags
    mockTopics.forEach((t, i) => {
      mockTopics[i] = personaEnrichedTopics[i];
    });

    setAiSuggestions(suggestions.length > 0 ? suggestions : [
      "Based on your recent struggles with Electromagnetic Induction, I recommend reviewing Magnetic Fields first.",
      "You're making great progress in Mathematics! Ready to tackle Integration by Parts?",
      "Your Chemistry mastery is improving. Let's solidify Organic Reactions today.",
    ]);
    setLoading(false);
  }, []);

  const filteredTopics = selectedSubject 
    ? mockTopics.filter(t => t.subject === selectedSubject)
    : mockTopics;

  const recommendedTopics = mockTopics.filter(t => t.aiRecommended);

  // Build sample ContentAtoms for the selected topic / subject
  // In production these come from contentGenerationService / Atlas agent
  const persona = loadPersona();
  const sampleAtoms: ContentAtom[] = selectedSubject ? [
    {
      id: `atom-${selectedSubject}-formula-1`,
      type: 'formula_card',
      title: `Key Formula — ${subjects.find(s => s.id === selectedSubject)?.name ?? selectedSubject}`,
      body: 'The fundamental formula for this topic, grounded and verified.',
      bodyMarkdown: '**Core formula** — apply this whenever you see...',
      examId: 'gate-em',
      topic: selectedSubject,
      difficulty: 'medium',
      syllabusPriority: 'high',
      formula: {
        latex: 'E = -\\frac{d\\Phi_B}{dt}',
        plainText: 'E = -dΦ/dt',
        intuition: 'A changing magnetic flux induces an EMF that opposes the change.',
        whenToUse: 'Any problem involving changing magnetic field, moving conductor, or transformer.',
        pitfalls: ['Forgetting the negative sign (Lenz\'s law)', 'Confusing Φ (flux) with B (field)'],
      },
      quality: { accuracy: 0.98, clarity: 0.92, examRelevance: 0.95, engagementScore: 0.78, wolframVerified: true, reviewedByHuman: false },
      generatedBy: 'wolfram', generatedAt: new Date(), sourceType: 'wolfram', version: 1,
      timesServed: 847, avgRating: 4.6, completionRate: 0.91,
    },
    {
      id: `atom-${selectedSubject}-mcq-1`,
      type: 'mcq',
      title: `Practice MCQ — ${subjects.find(s => s.id === selectedSubject)?.name ?? selectedSubject}`,
      body: 'Test your understanding with this exam-style question.',
      bodyMarkdown: '**Practice MCQ** — GATE 2022 style',
      examId: 'gate-em',
      topic: selectedSubject,
      difficulty: persona.daysToExam < 14 ? 'hard' : 'medium',
      syllabusPriority: 'high',
      mcq: {
        question: 'A conducting loop of resistance 2Ω is placed in a magnetic field B = 4sin(100t) T. The area of the loop is 0.01 m². What is the peak value of the induced current?',
        options: { A: '2 A', B: '4 A', C: '8 A', D: '0.5 A' },
        correct: 'A',
        explanation: 'Peak EMF = NBAω = 1 × 4 × 0.01 × 100 = 4V. Peak current = EMF/R = 4/2 = 2A.',
        commonWrongAnswer: 'B',
        examTip: 'Always extract ω from the sin(ωt) term before applying Faraday\'s law.'
      },
      quality: { accuracy: 0.95, clarity: 0.88, examRelevance: 0.92, engagementScore: 0.82, wolframVerified: true, reviewedByHuman: true },
      generatedBy: 'atlas', generatedAt: new Date(), sourceType: 'pyq', version: 2,
      timesServed: 1243, avgRating: 4.4, completionRate: 0.87,
    },
    {
      id: `atom-${selectedSubject}-tip-1`,
      type: 'exam_tip',
      title: `Exam Tip — ${subjects.find(s => s.id === selectedSubject)?.name ?? selectedSubject}`,
      body: 'In GATE, problems often combine Faraday\'s law with circuit analysis. Draw the equivalent circuit first, then apply Faraday. This saves 40 seconds per question.',
      bodyMarkdown: '**Exam Technique:** In GATE, problems often combine Faraday\'s law with circuit analysis...',
      examId: 'gate-em',
      topic: selectedSubject,
      difficulty: 'easy',
      syllabusPriority: 'high',
      quality: { accuracy: 0.9, clarity: 0.95, examRelevance: 0.9, engagementScore: 0.88, wolframVerified: false, reviewedByHuman: true },
      generatedBy: 'atlas', generatedAt: new Date(), sourceType: 'llm', version: 1,
      timesServed: 562, avgRating: 4.7, completionRate: 0.93,
    },
    {
      id: `atom-${selectedSubject}-flashcard-1`,
      type: 'flashcard',
      title: 'What does Lenz\'s Law state?',
      body: 'The induced current flows in a direction that opposes the change in magnetic flux that produced it.',
      bodyMarkdown: 'The induced current flows in a direction that **opposes** the change in flux.',
      examId: 'gate-em',
      topic: selectedSubject,
      difficulty: 'easy',
      syllabusPriority: 'medium',
      quality: { accuracy: 0.99, clarity: 0.97, examRelevance: 0.85, engagementScore: 0.72, wolframVerified: false, reviewedByHuman: true },
      generatedBy: 'atlas', generatedAt: new Date(), sourceType: 'llm', version: 1,
      timesServed: 398, avgRating: 4.5, completionRate: 0.89,
    },
  ] : [];

  // Build the customer profile for the content framework
  const contentProfileRaw = {
    uid: 'student-1',
    name: persona.name,
    role: userRole as 'student' | 'teacher' | 'parent' | 'ceo' | 'admin' | 'guest',
    examId: 'gate-em',
    examName: 'GATE EM',
    daysToExam: persona.daysToExam,
    channel: 'web' as const,
    deviceType: 'desktop' as const,
    masteryPct: selectedSubject ? (filteredTopics.reduce((s, t) => s + t.mastery, 0) / Math.max(filteredTopics.length, 1)) : 50,
    weakTopics: persona.weakSubjects,
    currentTopic: selectedSubject ?? undefined,
  };

  return (
    <div className="space-y-6">
      {/* AI Recommendations Banner */}
      <div className="card bg-gradient-to-r from-primary-600/20 to-accent-600/20 border-primary-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-500/20 rounded-xl">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-2">Sage AI Recommendations</h3>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-surface-700 rounded w-3/4"></div>
                <div className="h-4 bg-surface-700 rounded w-1/2"></div>
              </div>
            ) : (
              <ul className="space-y-1 text-surface-300 text-sm">
                {aiSuggestions.map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary-400">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Subject Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {subjects.map(subject => (
          <button
            key={subject.id}
            onClick={() => setSelectedSubject(subject.id === selectedSubject ? null : subject.id)}
            className={`card p-4 text-left transition-all hover:scale-105 ${
              selectedSubject === subject.id ? 'ring-2 ring-primary-500' : ''
            }`}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${subject.color} flex items-center justify-center text-2xl mb-3`}>
              {subject.icon}
            </div>
            <h3 className="font-semibold text-white">{subject.name}</h3>
            <p className="text-sm text-surface-400">{subject.topics} topics</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-surface-400">Progress</span>
                <span className="text-primary-400">{subject.progress}%</span>
              </div>
              <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${subject.color} rounded-full transition-all`}
                  style={{ width: `${subject.progress}%` }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Topics List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {selectedSubject 
              ? `${subjects.find(s => s.id === selectedSubject)?.name} Topics`
              : 'All Topics'
            }
          </h2>
          <div className="flex gap-2">
            <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">
              📊 By Difficulty
            </button>
            <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">
              🎯 By Priority
            </button>
          </div>
        </div>

        {filteredTopics.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl">📚</span>
            <p className="font-semibold mt-3">No topics loaded yet</p>
            <p className="text-sm text-surface-400 mt-1">Your AI tutor will suggest what to study next</p>
            <Link to="/chat?q=what+should+I+study+today" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-400 transition-all">
              Ask AI what to study
            </Link>
          </div>
        ) : null}

        <div className="space-y-3">
          {filteredTopics.map(topic => (
            <Link
              key={topic.id}
              to={`/chat?topic=${encodeURIComponent(topic.name)}`}
              onClick={() => {
                // Wire 2: record topic click interaction
                if (learnTrace.current) {
                  addNode(learnTrace.current, {
                    traceId: `learn-topic-${Date.now()}`,
                    parentTraceId: learnTrace.current.nodes[0]?.traceId,
                    nodeType: 'intent',
                    action: `topic_click:${topic.id}`,
                    inputSummary: topic.name,
                    outputSummary: `→ /chat?topic=${topic.name}`,
                    timestamp: new Date().toISOString(),
                    metadata: { topicId: topic.id, subject: topic.subject, mastery: topic.mastery },
                  });
                  storeTrace(learnTrace.current);
                }
              }}
              className="block p-4 bg-surface-800/50 rounded-xl border border-surface-700 hover:border-primary-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {topic.aiRecommended && (
                    <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
                      🤖 AI Pick
                    </span>
                  )}
                  <div>
                    <h3 className="font-medium text-white group-hover:text-primary-400 transition-colors">
                      {topic.name}
                    </h3>
                    <p className="text-sm text-surface-400">{topic.chapter}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-surface-300">{topic.estimatedTime} min</div>
                    <div className={`text-xs ${
                      topic.difficulty === 'easy' ? 'text-green-400' :
                      topic.difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {topic.difficulty.charAt(0).toUpperCase() + topic.difficulty.slice(1)}
                    </div>
                  </div>
                  <div className="w-16">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-400">Mastery</span>
                    </div>
                    <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          topic.mastery >= 80 ? 'bg-green-500' :
                          topic.mastery >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${topic.mastery}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-surface-400 group-hover:text-primary-400 transition-colors">
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Content Feed — customer-centric, shows when a subject is selected */}
      {selectedSubject && sampleAtoms.length > 0 && (
        <div className="card p-5">
          <ContentFeed
            atoms={sampleAtoms}
            profileRaw={contentProfileRaw}
            onAtomAction={(atomId, action) => {
              if (action === 'ask_sage') {
                window.location.href = `/chat?topic=${encodeURIComponent(selectedSubject)}`;
              }
            }}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/chat" className="card p-4 hover:border-primary-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500/20 rounded-xl group-hover:bg-primary-500/30 transition-colors">
              <span className="text-xl">💬</span>
            </div>
            <div>
              <h3 className="font-medium text-white">Ask Sage AI</h3>
              <p className="text-sm text-surface-400">Get instant help with any topic</p>
            </div>
          </div>
        </Link>

        <Link to="/notebook" className="card p-4 hover:border-primary-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent-500/20 rounded-xl group-hover:bg-accent-500/30 transition-colors">
              <span className="text-xl">📝</span>
            </div>
            <div>
              <h3 className="font-medium text-white">Smart Notebook</h3>
              <p className="text-sm text-surface-400">Write equations, get explanations</p>
            </div>
          </div>
        </Link>

        <Link to="/progress" className="card p-4 hover:border-primary-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h3 className="font-medium text-white">My Progress</h3>
              <p className="text-sm text-surface-400">Track your learning journey</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
