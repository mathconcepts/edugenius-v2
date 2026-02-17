/**
 * Teaching Strategy Service
 * Implements robust teaching strategies with interactive resources
 * Creates "WOW factor" learning experiences
 */

import type {
  TeachingStrategy,
  TeachingPhase,
  EnhancedContent,
  InteractiveResource,
  WowElement,
  ResourceRecommendation,
  VisualizedStep,
} from '@/types/teaching';
import type { PracticeProblem } from '@/types/notebook';

// ============================================
// TEACHING STRATEGY TEMPLATES
// ============================================

export const teachingStrategies: Record<string, TeachingStrategy> = {
  // Strategy 1: Socratic Discovery (for conceptual understanding)
  socratic_discovery: {
    id: 'socratic_discovery',
    name: 'Socratic Discovery Learning',
    description: 'Guide students to discover concepts through questioning',
    approach: 'socratic',
    bestFor: {
      conceptTypes: ['abstract', 'theoretical'],
      learnerTypes: ['logical', 'reflective'],
      difficultyLevels: ['intermediate', 'advanced'],
      timeAvailable: 'medium',
    },
    phases: [
      {
        order: 1,
        name: 'Hook & Curiosity',
        description: 'Present a puzzling question or paradox',
        durationMinutes: 2,
        activities: [
          {
            type: 'explore',
            content: 'Present an intriguing problem that challenges intuition',
            hints: ['Start with "What do you think happens when..."', 'Use real-world scenarios'],
            timeMinutes: 2,
          },
        ],
        understandingCheck: 'Can you predict what might happen?',
      },
      {
        order: 2,
        name: 'Interactive Exploration',
        description: 'Let student explore with simulation',
        durationMinutes: 5,
        activities: [
          {
            type: 'explore',
            content: 'Open the interactive simulation and experiment',
            resourceId: 'dynamic', // Will be filled based on topic
            hints: ['Try changing one variable at a time', 'Look for patterns'],
            timeMinutes: 5,
          },
        ],
        understandingCheck: 'What patterns did you notice?',
      },
      {
        order: 3,
        name: 'Guided Questioning',
        description: 'Ask probing questions to develop understanding',
        durationMinutes: 5,
        activities: [
          {
            type: 'discuss',
            content: 'Series of questions leading to the concept',
            aiPrompt: 'Ask 3-4 questions that lead student to discover the principle',
            hints: ['Why do you think that happened?', 'What if we changed...?'],
            timeMinutes: 5,
          },
        ],
        successCriteria: ['Student articulates the core concept', 'Can explain the "why"'],
      },
      {
        order: 4,
        name: 'Formalization',
        description: 'Present the formal definition/formula',
        durationMinutes: 3,
        activities: [
          {
            type: 'explain',
            content: 'Now that you discovered it, here\'s the formal way we write this...',
            hints: ['Connect to what they discovered', 'Show formula derivation'],
            timeMinutes: 3,
          },
        ],
      },
      {
        order: 5,
        name: 'Apply & Celebrate',
        description: 'Practice with immediate feedback',
        durationMinutes: 5,
        activities: [
          {
            type: 'practice',
            content: 'Solve 2-3 problems using the concept',
            hints: ['Start easy', 'Gradually increase difficulty'],
            timeMinutes: 5,
          },
        ],
      },
    ],
    resourcesUsed: [],
    successRate: 0.87,
    avgTimeMinutes: 20,
    studentSatisfactionScore: 4.6,
  },

  // Strategy 2: Visual-First (for visual learners)
  visual_first: {
    id: 'visual_first',
    name: 'Visual-First Learning',
    description: 'Lead with visualizations, then formalize',
    approach: 'discovery',
    bestFor: {
      conceptTypes: ['geometric', 'graphical', 'spatial'],
      learnerTypes: ['visual', 'kinesthetic'],
      difficultyLevels: ['beginner', 'intermediate'],
      timeAvailable: 'medium',
    },
    phases: [
      {
        order: 1,
        name: 'Visual Hook',
        description: 'Start with a striking visualization',
        durationMinutes: 2,
        activities: [
          {
            type: 'demonstrate',
            content: 'Show animation/simulation that captures the concept',
            resourceId: 'dynamic',
            hints: ['Make it visually striking', 'Show before explaining'],
            timeMinutes: 2,
          },
        ],
      },
      {
        order: 2,
        name: 'Interactive Manipulation',
        description: 'Let student interact with the visualization',
        durationMinutes: 5,
        activities: [
          {
            type: 'explore',
            content: 'Manipulate the visualization, observe changes',
            resourceId: 'dynamic',
            hints: ['Drag points', 'Change parameters', 'Watch what happens'],
            timeMinutes: 5,
          },
        ],
      },
      {
        order: 3,
        name: 'Pattern Recognition',
        description: 'Identify patterns from visual exploration',
        durationMinutes: 3,
        activities: [
          {
            type: 'discuss',
            content: 'What patterns emerge? What stays constant?',
            aiPrompt: 'Help student articulate visual patterns mathematically',
            hints: [],
            timeMinutes: 3,
          },
        ],
      },
      {
        order: 4,
        name: 'Mathematical Connection',
        description: 'Link visual patterns to formulas',
        durationMinutes: 5,
        activities: [
          {
            type: 'explain',
            content: 'Show how the visual pattern translates to equations',
            hints: ['Use color coding', 'Animate the derivation'],
            timeMinutes: 5,
          },
        ],
      },
      {
        order: 5,
        name: 'Practice with Visual Support',
        description: 'Solve problems while referencing visualization',
        durationMinutes: 5,
        activities: [
          {
            type: 'practice',
            content: 'Solve problems, use visualization to verify',
            resourceId: 'dynamic',
            hints: ['Check your answer visually', 'Does it make sense on the graph?'],
            timeMinutes: 5,
          },
        ],
      },
    ],
    resourcesUsed: [],
    successRate: 0.89,
    avgTimeMinutes: 20,
    studentSatisfactionScore: 4.7,
  },

  // Strategy 3: Problem-First (for practical learners)
  problem_first: {
    id: 'problem_first',
    name: 'Problem-First Learning',
    description: 'Start with a challenging problem, learn concepts to solve it',
    approach: 'problem_based',
    bestFor: {
      conceptTypes: ['procedural', 'applied'],
      learnerTypes: ['practical', 'kinesthetic'],
      difficultyLevels: ['intermediate', 'advanced'],
      timeAvailable: 'long',
    },
    phases: [
      {
        order: 1,
        name: 'Challenge Presentation',
        description: 'Present a real-world problem that needs the concept',
        durationMinutes: 3,
        activities: [
          {
            type: 'explain',
            content: 'Here\'s a real problem engineers/scientists face...',
            hints: ['Use engaging real-world context', 'Make it relevant'],
            timeMinutes: 3,
          },
        ],
      },
      {
        order: 2,
        name: 'Initial Attempt',
        description: 'Let student try with existing knowledge',
        durationMinutes: 5,
        activities: [
          {
            type: 'practice',
            content: 'Try to solve with what you know',
            hints: ['It\'s okay to struggle', 'Note where you get stuck'],
            timeMinutes: 5,
          },
        ],
        understandingCheck: 'Where did you get stuck? What do you need to know?',
      },
      {
        order: 3,
        name: 'Concept Introduction',
        description: 'Introduce the concept as a tool to solve the problem',
        durationMinutes: 5,
        activities: [
          {
            type: 'explain',
            content: 'Here\'s the tool that will help you...',
            resourceId: 'dynamic',
            hints: ['Frame as a solution to their struggle', 'Show immediate application'],
            timeMinutes: 5,
          },
        ],
      },
      {
        order: 4,
        name: 'Guided Solution',
        description: 'Apply the new concept to solve the original problem',
        durationMinutes: 7,
        activities: [
          {
            type: 'practice',
            content: 'Now solve the original problem with your new knowledge',
            hints: ['Guide but don\'t solve for them'],
            timeMinutes: 7,
          },
        ],
      },
      {
        order: 5,
        name: 'Extension & Mastery',
        description: 'Apply to similar and varied problems',
        durationMinutes: 5,
        activities: [
          {
            type: 'practice',
            content: 'Try these variations',
            hints: ['Increase complexity gradually'],
            timeMinutes: 5,
          },
        ],
      },
    ],
    resourcesUsed: [],
    successRate: 0.85,
    avgTimeMinutes: 25,
    studentSatisfactionScore: 4.5,
  },

  // Strategy 4: Scaffolded Mastery (for building foundation)
  scaffolded_mastery: {
    id: 'scaffolded_mastery',
    name: 'Scaffolded Mastery',
    description: 'Build understanding step by step with checkpoints',
    approach: 'scaffolded',
    bestFor: {
      conceptTypes: ['procedural', 'sequential'],
      learnerTypes: ['sequential', 'methodical'],
      difficultyLevels: ['beginner', 'intermediate'],
      timeAvailable: 'long',
    },
    phases: [
      {
        order: 1,
        name: 'Prerequisite Check',
        description: 'Verify foundation knowledge',
        durationMinutes: 3,
        activities: [
          {
            type: 'assess',
            content: 'Quick check of prerequisite concepts',
            hints: ['2-3 quick questions', 'Identify gaps'],
            timeMinutes: 3,
          },
        ],
        successCriteria: ['80% correct on prerequisites'],
      },
      {
        order: 2,
        name: 'Concept 1: Foundation',
        description: 'First building block',
        durationMinutes: 5,
        activities: [
          {
            type: 'explain',
            content: 'Introduce first component with visualization',
            resourceId: 'dynamic',
            hints: [],
            timeMinutes: 3,
          },
          {
            type: 'practice',
            content: 'Practice first component',
            hints: ['2-3 problems'],
            timeMinutes: 2,
          },
        ],
        understandingCheck: 'Can you explain this in your own words?',
        successCriteria: ['Correct application', 'Can explain reasoning'],
      },
      {
        order: 3,
        name: 'Concept 2: Building',
        description: 'Add next layer',
        durationMinutes: 5,
        activities: [
          {
            type: 'explain',
            content: 'Build on first concept',
            hints: ['Connect to what they just learned'],
            timeMinutes: 3,
          },
          {
            type: 'practice',
            content: 'Practice combined concepts',
            hints: [],
            timeMinutes: 2,
          },
        ],
      },
      {
        order: 4,
        name: 'Integration',
        description: 'Combine all components',
        durationMinutes: 7,
        activities: [
          {
            type: 'practice',
            content: 'Problems requiring all components',
            resourceId: 'dynamic',
            hints: ['Show connections between parts'],
            timeMinutes: 7,
          },
        ],
      },
      {
        order: 5,
        name: 'Mastery Check',
        description: 'Verify complete understanding',
        durationMinutes: 5,
        activities: [
          {
            type: 'assess',
            content: 'Challenge problems to verify mastery',
            hints: [],
            timeMinutes: 5,
          },
        ],
        successCriteria: ['90% accuracy', 'Can teach to others'],
      },
    ],
    resourcesUsed: [],
    successRate: 0.91,
    avgTimeMinutes: 25,
    studentSatisfactionScore: 4.4,
  },
};

// ============================================
// WOW FACTOR ELEMENTS
// ============================================

export const wowElements: WowElement[] = [
  {
    id: 'first_try_correct',
    type: 'achievement_unlock',
    trigger: 'first_try_correct',
    content: {
      title: '🎯 First Try Ace!',
      message: 'You solved it perfectly on your first attempt!',
      animation: '/animations/confetti-burst.json',
      sound: '/sounds/achievement.mp3',
      confetti: true,
      badge: {
        name: 'Sharp Mind',
        icon: '🎯',
        rarity: 'rare',
      },
      xpReward: 50,
      shareMessage: 'I just aced a problem on my first try! 🎯',
    },
    celebrationLevel: 'exciting',
  },
  {
    id: 'streak_7',
    type: 'streak_celebration',
    trigger: 'streak_reached',
    content: {
      title: '🔥 7-Day Streak!',
      message: 'You\'ve been learning consistently for a week!',
      animation: '/animations/fire-streak.json',
      confetti: true,
      badge: {
        name: 'Week Warrior',
        icon: '🔥',
        rarity: 'epic',
      },
      xpReward: 200,
      shareMessage: 'I just hit a 7-day learning streak! 🔥',
    },
    celebrationLevel: 'epic',
  },
  {
    id: 'topic_mastery',
    type: 'mastery_breakthrough',
    trigger: 'concept_mastered',
    content: {
      title: '🏆 Topic Mastered!',
      message: 'You\'ve achieved mastery in this topic!',
      animation: '/animations/trophy-spin.json',
      sound: '/sounds/level-up.mp3',
      confetti: true,
      badge: {
        name: 'Master',
        icon: '🏆',
        rarity: 'legendary',
      },
      xpReward: 500,
      shareMessage: 'I just mastered a new topic! 🏆',
    },
    celebrationLevel: 'epic',
  },
  {
    id: 'speed_demon',
    type: 'speed_record',
    trigger: 'time_record',
    content: {
      title: '⚡ Speed Demon!',
      message: 'You solved that faster than 95% of students!',
      animation: '/animations/lightning.json',
      badge: {
        name: 'Speed Demon',
        icon: '⚡',
        rarity: 'rare',
      },
      xpReward: 75,
    },
    celebrationLevel: 'moderate',
  },
  {
    id: 'no_hints',
    type: 'challenge_complete',
    trigger: 'hint_unused',
    content: {
      title: '💪 No Hints Needed!',
      message: 'You solved a hard problem without any hints!',
      animation: '/animations/muscle-flex.json',
      badge: {
        name: 'Independent Thinker',
        icon: '💪',
        rarity: 'epic',
      },
      xpReward: 100,
    },
    celebrationLevel: 'exciting',
  },
  {
    id: 'pattern_discovery',
    type: 'pattern_discovery',
    trigger: 'exploration_complete',
    content: {
      title: '🔍 Pattern Discovered!',
      message: 'You found the hidden pattern! This is how mathematicians think.',
      animation: '/animations/lightbulb.json',
      xpReward: 60,
    },
    celebrationLevel: 'moderate',
  },
];

// ============================================
// ENHANCED CONTENT GENERATOR
// ============================================

export function generateEnhancedContent(
  problem: PracticeProblem,
  availableResources: InteractiveResource[]
): EnhancedContent {
  // Find relevant interactive resources
  const relevantResources = availableResources.filter((r) =>
    r.topics.some((t) => t.toLowerCase().includes(problem.topic.toLowerCase())) ||
    r.concepts.some((c) => problem.relatedConcepts.some((pc) => pc.toLowerCase().includes(c.toLowerCase())))
  );

  // Rank resources by relevance
  const rankedResources: ResourceRecommendation[] = relevantResources
    .map((resource) => ({
      resourceId: resource.id,
      resource,
      relevanceScore: calculateResourceRelevance(problem, resource),
      useCase: generateUseCase(problem, resource),
      timestamp: determineOptimalTiming(problem, resource),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);

  // Generate visualized steps
  const visualizedSteps = generateVisualizedSteps(problem, rankedResources);

  // Find real-world examples
  const realWorldExamples = generateRealWorldExamples(problem);

  // Find concept connections
  const conceptConnections = generateConceptConnections(problem);

  return {
    problemId: problem.id,
    interactiveResources: rankedResources,
    diagrams: [],
    animations: [],
    visualizedSteps,
    realWorldExamples,
    conceptConnections,
  };
}

function calculateResourceRelevance(problem: PracticeProblem, resource: InteractiveResource): number {
  let score = 0;

  // Topic match
  if (resource.topics.some((t) => t.toLowerCase() === problem.topic.toLowerCase())) {
    score += 40;
  } else if (resource.topics.some((t) => t.toLowerCase().includes(problem.topic.toLowerCase()))) {
    score += 20;
  }

  // Subject match
  if (resource.subjects.includes(problem.subject)) {
    score += 20;
  }

  // Difficulty match
  const diffOrder = { easy: 1, medium: 2, hard: 3, olympiad: 4 };
  const problemDiff = diffOrder[problem.difficulty];
  const resourceMinDiff = diffOrder[resource.difficultyRange.min];
  const resourceMaxDiff = diffOrder[resource.difficultyRange.max];
  if (problemDiff >= resourceMinDiff && problemDiff <= resourceMaxDiff) {
    score += 20;
  }

  // Concept overlap
  const conceptOverlap = problem.relatedConcepts.filter((c) =>
    resource.concepts.some((rc) => rc.toLowerCase().includes(c.toLowerCase()))
  ).length;
  score += conceptOverlap * 5;

  // Effectiveness bonus
  score += resource.effectivenessScore / 10;

  return Math.min(score, 100);
}

function generateUseCase(problem: PracticeProblem, resource: InteractiveResource): string {
  const useCases: Record<string, string> = {
    simulation: `Use this simulation to visualize how ${problem.topic} works in action`,
    applet: `Interact with this applet to explore the relationship between variables`,
    calculator: `Use this calculator to verify your calculations and explore edge cases`,
    visualization: `This visualization will help you see the concept behind the problem`,
    manipulative: `Manipulate this tool to build intuition for the concept`,
    model_3d: `Rotate and explore this 3D model to understand the spatial relationships`,
  };
  return useCases[resource.type] || 'Use this resource to deepen your understanding';
}

function determineOptimalTiming(problem: PracticeProblem, resource: InteractiveResource): string {
  if (resource.type === 'simulation' || resource.type === 'visualization') {
    return 'before_solving'; // Show first to build intuition
  }
  if (resource.type === 'calculator') {
    return 'during_solving'; // Use while working
  }
  return 'after_solving'; // For deeper exploration
}

function generateVisualizedSteps(
  problem: PracticeProblem,
  resources: ResourceRecommendation[]
): VisualizedStep[] {
  // This would be AI-generated in production
  return [
    {
      stepNumber: 1,
      textExplanation: 'First, let\'s understand what the problem is asking...',
      visualType: 'diagram',
      visualContent: 'problem-visualization',
      interactiveResourceId: resources[0]?.resourceId,
    },
    {
      stepNumber: 2,
      textExplanation: 'Identify the key variables and relationships...',
      visualType: 'diagram',
      visualContent: 'variable-map',
    },
    {
      stepNumber: 3,
      textExplanation: 'Apply the appropriate formula or concept...',
      latexFormula: problem.questionLatex,
      visualType: 'animation',
      visualContent: 'formula-animation',
    },
    {
      stepNumber: 4,
      textExplanation: 'Solve step by step...',
      visualType: 'graph',
      visualContent: 'solution-graph',
    },
    {
      stepNumber: 5,
      textExplanation: 'Verify your answer makes sense...',
      visualType: 'diagram',
      visualContent: 'verification',
      interactiveResourceId: resources[0]?.resourceId,
    },
  ];
}

function generateRealWorldExamples(problem: PracticeProblem) {
  // Mock implementation - would be AI-generated
  const examples: Record<string, Array<{ title: string; description: string; industry: string }>> = {
    'Projectile Motion': [
      { title: 'Sports Analytics', description: 'How basketball players optimize their shot arc', industry: 'sports' },
      { title: 'Artillery Calculation', description: 'Historical military applications', industry: 'defense' },
    ],
    'Quadratic Equations': [
      { title: 'Bridge Design', description: 'Parabolic arches in architecture', industry: 'engineering' },
      { title: 'Profit Optimization', description: 'Business pricing models', industry: 'finance' },
    ],
  };
  return (examples[problem.topic] || []).map((e, i) => ({ ...e, id: `${problem.id}-rw-${i}` }));
}

function generateConceptConnections(problem: PracticeProblem) {
  // Mock implementation
  return problem.relatedConcepts.slice(0, 3).map((concept, i) => ({
    fromConcept: problem.topic,
    toConcept: concept,
    relationshipType: 'builds_on' as const,
    explanation: `Understanding ${problem.topic} helps with ${concept}`,
  }));
}

// ============================================
// STRATEGY SELECTOR
// ============================================

export function selectOptimalStrategy(
  problem: PracticeProblem,
  learnerProfile: {
    preferredStyle: 'visual' | 'logical' | 'practical' | 'sequential';
    currentMood: 'curious' | 'struggling' | 'confident' | 'rushed';
    timeAvailable: 'short' | 'medium' | 'long';
  }
): TeachingStrategy {
  // Score each strategy based on fit
  const scores = Object.values(teachingStrategies).map((strategy) => {
    let score = 0;

    // Match learner style
    if (strategy.bestFor.learnerTypes.includes(learnerProfile.preferredStyle)) {
      score += 30;
    }

    // Match time availability
    if (strategy.bestFor.timeAvailable === learnerProfile.timeAvailable) {
      score += 20;
    }

    // Match difficulty
    if (strategy.bestFor.difficultyLevels.includes(problem.difficulty)) {
      score += 20;
    }

    // Mood-based adjustments
    if (learnerProfile.currentMood === 'struggling' && strategy.approach === 'scaffolded') {
      score += 20;
    }
    if (learnerProfile.currentMood === 'curious' && strategy.approach === 'discovery') {
      score += 20;
    }
    if (learnerProfile.currentMood === 'confident' && strategy.approach === 'problem_based') {
      score += 15;
    }

    // Historical success rate
    score += strategy.successRate * 10;

    return { strategy, score };
  });

  // Return highest scoring strategy
  scores.sort((a, b) => b.score - a.score);
  return scores[0].strategy;
}

// ============================================
// EXPORT
// ============================================

export const TeachingStrategyService = {
  strategies: teachingStrategies,
  wowElements,
  selectOptimalStrategy,
  generateEnhancedContent,
};

export default TeachingStrategyService;
