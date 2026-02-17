/**
 * Smart Notebook - AI-powered equation writing and solving
 * Integrates with Sage agent for explanations
 */

import { useState, useRef, useEffect } from 'react';

interface NotebookEntry {
  id: string;
  type: 'equation' | 'text' | 'drawing' | 'ai-response';
  content: string;
  latex?: string;
  timestamp: number;
  aiProcessed?: boolean;
}

interface AIExplanation {
  steps: string[];
  hints: string[];
  relatedTopics: string[];
}

export default function Notebook() {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'equation' | 'draw'>('equation');
  const [aiThinking, setAiThinking] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<AIExplanation | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleSubmit = async () => {
    if (!currentInput.trim()) return;

    const newEntry: NotebookEntry = {
      id: Date.now().toString(),
      type: inputMode === 'equation' ? 'equation' : 'text',
      content: currentInput,
      timestamp: Date.now(),
    };

    setEntries([...entries, newEntry]);
    setCurrentInput('');

    // Simulate AI processing
    if (inputMode === 'equation') {
      setAiThinking(true);
      setTimeout(() => {
        const aiResponse: NotebookEntry = {
          id: (Date.now() + 1).toString(),
          type: 'ai-response',
          content: generateAIResponse(currentInput),
          timestamp: Date.now(),
          aiProcessed: true,
        };
        setEntries(prev => [...prev, aiResponse]);
        setAiExplanation({
          steps: [
            'Step 1: Identify the type of equation',
            'Step 2: Apply the appropriate formula',
            'Step 3: Simplify and solve',
          ],
          hints: [
            'Remember to check for domain restrictions',
            'This is a common JEE pattern',
          ],
          relatedTopics: ['Quadratic Equations', 'Polynomial Functions'],
        });
        setAiThinking(false);
      }, 1500);
    }
  };

  const generateAIResponse = (input: string): string => {
    // Mock AI response
    if (input.includes('x^2') || input.includes('x²')) {
      return `**Solution:**\n\nThis is a quadratic equation. Using the quadratic formula:\n\nx = (-b ± √(b²-4ac)) / 2a\n\nThe solutions are x = 2 and x = -3`;
    }
    if (input.includes('integrate') || input.includes('∫')) {
      return `**Integration:**\n\nUsing integration by parts:\n\n∫u dv = uv - ∫v du\n\nResult: x²/2 + C`;
    }
    return `**Analysis:**\n\nI'll help you solve this step by step. This expression involves:\n- Mathematical operations\n- Variable manipulation\n\nLet me break it down...`;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const recognizeDrawing = async () => {
    setAiThinking(true);
    // Simulate handwriting recognition
    setTimeout(() => {
      const recognized: NotebookEntry = {
        id: Date.now().toString(),
        type: 'equation',
        content: '∫ x² dx = x³/3 + C',
        latex: '\\int x^2 dx = \\frac{x^3}{3} + C',
        timestamp: Date.now(),
        aiProcessed: true,
      };
      setEntries(prev => [...prev, recognized]);
      clearCanvas();
      setAiThinking(false);
    }, 2000);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Main Notebook Area */}
      <div className="flex-1 flex flex-col">
        <div className="card flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-surface-700">
            <div className="flex gap-2">
              <button
                onClick={() => setInputMode('equation')}
                className={`btn btn-sm ${inputMode === 'equation' ? 'bg-primary-600' : 'bg-surface-700'}`}
              >
                📐 Equation
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`btn btn-sm ${inputMode === 'text' ? 'bg-primary-600' : 'bg-surface-700'}`}
              >
                📝 Text
              </button>
              <button
                onClick={() => setInputMode('draw')}
                className={`btn btn-sm ${inputMode === 'draw' ? 'bg-primary-600' : 'bg-surface-700'}`}
              >
                ✏️ Draw
              </button>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">
                📥 Export PDF
              </button>
              <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">
                🔗 Share
              </button>
            </div>
          </div>

          {/* Notebook Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-900/50">
            {entries.length === 0 && (
              <div className="text-center py-12 text-surface-400">
                <span className="text-4xl mb-4 block">📓</span>
                <p>Start writing equations or notes.</p>
                <p className="text-sm mt-2">Sage AI will help you solve and understand.</p>
              </div>
            )}

            {entries.map(entry => (
              <div
                key={entry.id}
                className={`p-4 rounded-xl ${
                  entry.type === 'ai-response'
                    ? 'bg-primary-900/30 border border-primary-500/30'
                    : 'bg-surface-800'
                }`}
              >
                {entry.type === 'ai-response' && (
                  <div className="flex items-center gap-2 mb-2 text-primary-400 text-sm">
                    <span>🤖</span>
                    <span>Sage AI</span>
                  </div>
                )}
                {entry.type === 'equation' && !entry.aiProcessed && (
                  <div className="font-mono text-lg text-white">{entry.content}</div>
                )}
                {entry.type === 'text' && (
                  <div className="text-surface-200">{entry.content}</div>
                )}
                {(entry.type === 'ai-response' || entry.aiProcessed) && (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans">{entry.content}</pre>
                  </div>
                )}
              </div>
            ))}

            {aiThinking && (
              <div className="p-4 rounded-xl bg-primary-900/30 border border-primary-500/30">
                <div className="flex items-center gap-2 text-primary-400">
                  <span className="animate-spin">⚡</span>
                  <span>Sage AI is thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-surface-700">
            {inputMode === 'draw' ? (
              <div className="space-y-3">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={150}
                  className="w-full bg-surface-900 rounded-xl border border-surface-700 cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
                <div className="flex justify-between">
                  <button onClick={clearCanvas} className="btn btn-sm bg-surface-700">
                    🗑️ Clear
                  </button>
                  <button onClick={recognizeDrawing} className="btn btn-sm btn-primary">
                    🔍 Recognize & Solve
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={inputMode === 'equation' ? 'Type equation: x^2 + 5x + 6 = 0' : 'Type your notes...'}
                  className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 text-white placeholder-surface-400 focus:outline-none focus:border-primary-500"
                />
                <button onClick={handleSubmit} className="btn btn-primary px-6">
                  {inputMode === 'equation' ? '🧮 Solve' : '💾 Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Assistant Panel */}
      <div className="w-80 card flex flex-col">
        <div className="p-4 border-b border-surface-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span>🤖</span> Sage Assistant
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {aiExplanation ? (
            <>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-primary-400">Step-by-Step</h4>
                {aiExplanation.steps.map((step, i) => (
                  <div key={i} className="flex gap-2 text-sm text-surface-300">
                    <span className="text-primary-400">{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-yellow-400">💡 Hints</h4>
                {aiExplanation.hints.map((hint, i) => (
                  <div key={i} className="text-sm text-surface-300 bg-yellow-900/20 p-2 rounded-lg">
                    {hint}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-green-400">📚 Related Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {aiExplanation.relatedTopics.map((topic, i) => (
                    <span key={i} className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-surface-400">
              <span className="text-3xl mb-3 block">✨</span>
              <p className="text-sm">Write an equation and I'll help you solve it step by step.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-surface-700 space-y-2">
          <button className="btn btn-sm w-full bg-surface-700 hover:bg-surface-600">
            📖 Show Similar Problems
          </button>
          <button className="btn btn-sm w-full bg-surface-700 hover:bg-surface-600">
            🎥 Watch Video Explanation
          </button>
        </div>
      </div>
    </div>
  );
}
