/**
 * Students Page - Teacher view for managing students
 * AI-powered student insights from Mentor agent
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

interface Student {
  id: string;
  name: string;
  avatar: string;
  exam: string;
  progress: number;
  lastActive: string;
  riskLevel: 'low' | 'medium' | 'high';
  streak: number;
  subjects: { name: string; progress: number }[];
  engagement: number;
}

const mockStudents: Student[] = [
  { 
    id: '1', name: 'Rahul Sharma', avatar: '👦', exam: 'JEE Main', progress: 78, 
    lastActive: '2 hours ago', riskLevel: 'low', streak: 15,
    subjects: [{ name: 'Physics', progress: 85 }, { name: 'Chemistry', progress: 72 }, { name: 'Math', progress: 80 }],
    engagement: 92
  },
  { 
    id: '2', name: 'Priya Patel', avatar: '👧', exam: 'NEET', progress: 65, 
    lastActive: '1 day ago', riskLevel: 'medium', streak: 3,
    subjects: [{ name: 'Physics', progress: 60 }, { name: 'Chemistry', progress: 68 }, { name: 'Biology', progress: 70 }],
    engagement: 68
  },
  { 
    id: '3', name: 'Arjun Kumar', avatar: '👦', exam: 'JEE Main', progress: 45, 
    lastActive: '5 days ago', riskLevel: 'high', streak: 0,
    subjects: [{ name: 'Physics', progress: 40 }, { name: 'Chemistry', progress: 48 }, { name: 'Math', progress: 50 }],
    engagement: 35
  },
  { 
    id: '4', name: 'Ananya Singh', avatar: '👧', exam: 'CBSE 12', progress: 82, 
    lastActive: '3 hours ago', riskLevel: 'low', streak: 22,
    subjects: [{ name: 'Physics', progress: 88 }, { name: 'Chemistry', progress: 78 }, { name: 'Math', progress: 85 }],
    engagement: 95
  },
  { 
    id: '5', name: 'Vikram Reddy', avatar: '👦', exam: 'JEE Main', progress: 58, 
    lastActive: '12 hours ago', riskLevel: 'medium', streak: 7,
    subjects: [{ name: 'Physics', progress: 62 }, { name: 'Chemistry', progress: 55 }, { name: 'Math', progress: 58 }],
    engagement: 72
  },
];

const classStats = {
  totalStudents: 45,
  activeToday: 32,
  avgProgress: 67,
  atRisk: 5,
};

export default function Students() {
  const [filter, setFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const filteredStudents = filter === 'all' 
    ? mockStudents 
    : mockStudents.filter(s => s.riskLevel === filter);

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'high': return 'bg-red-500/20 text-red-400';
      default: return 'bg-surface-600 text-surface-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-surface-400 text-sm">Total Students</p>
          <p className="text-2xl font-bold text-white">{classStats.totalStudents}</p>
        </div>
        <div className="card">
          <p className="text-surface-400 text-sm">Active Today</p>
          <p className="text-2xl font-bold text-green-400">{classStats.activeToday}</p>
        </div>
        <div className="card">
          <p className="text-surface-400 text-sm">Avg Progress</p>
          <p className="text-2xl font-bold text-primary-400">{classStats.avgProgress}%</p>
        </div>
        <div className="card">
          <p className="text-surface-400 text-sm">At Risk</p>
          <p className="text-2xl font-bold text-red-400">{classStats.atRisk}</p>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="card bg-gradient-to-r from-accent-600/10 to-primary-600/10 border-accent-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-500/20 rounded-xl">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-2">Mentor AI Recommendations</h3>
            <ul className="space-y-2 text-sm text-surface-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400">🚨</span>
                <span><strong>Arjun Kumar</strong> hasn't logged in for 5 days. Consider sending a personalized nudge.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">⚠️</span>
                <span><strong>Priya Patel's</strong> Physics progress dropped 15% this week. She might need help with Electrostatics.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">🎉</span>
                <span><strong>Ananya Singh</strong> has maintained a 22-day streak! Consider sending a congratulatory message.</span>
              </li>
            </ul>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-sm bg-primary-600 hover:bg-primary-700">
                📤 Send Bulk Nudge
              </button>
              <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">
                📊 Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Student List */}
        <div className="flex-1 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Students</h3>
            <div className="flex gap-2">
              {(['all', 'high', 'medium', 'low'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`btn btn-sm ${filter === f ? 'bg-primary-600' : 'bg-surface-700'}`}
                >
                  {f === 'all' ? 'All' : f === 'high' ? '🔴 At Risk' : f === 'medium' ? '🟡 Watch' : '🟢 Good'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredStudents.map(student => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full p-4 bg-surface-800/50 rounded-xl border transition-all text-left ${
                  selectedStudent?.id === student.id 
                    ? 'border-primary-500' 
                    : 'border-surface-700 hover:border-surface-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{student.avatar}</span>
                    <div>
                      <p className="text-white font-medium">{student.name}</p>
                      <p className="text-sm text-surface-400">{student.exam} • Last active {student.lastActive}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {student.streak > 0 && (
                      <span className="flex items-center gap-1 text-orange-400">
                        <span>🔥</span>
                        <span className="text-sm">{student.streak}</span>
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs ${riskColor(student.riskLevel)}`}>
                      {student.riskLevel === 'high' ? 'At Risk' : student.riskLevel === 'medium' ? 'Watch' : 'Good'}
                    </span>
                    <div className="w-20">
                      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            student.progress >= 70 ? 'bg-green-500' :
                            student.progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${student.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-surface-400 text-right mt-1">{student.progress}%</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Student Detail Panel */}
        {selectedStudent && (
          <div className="w-80 card">
            <div className="text-center mb-4">
              <span className="text-5xl">{selectedStudent.avatar}</span>
              <h3 className="text-lg font-semibold text-white mt-2">{selectedStudent.name}</h3>
              <p className="text-surface-400">{selectedStudent.exam}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${riskColor(selectedStudent.riskLevel)}`}>
                {selectedStudent.riskLevel === 'high' ? '🔴 At Risk' : 
                 selectedStudent.riskLevel === 'medium' ? '🟡 Needs Attention' : '🟢 On Track'}
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-800/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-primary-400">{selectedStudent.progress}%</p>
                  <p className="text-xs text-surface-400">Progress</p>
                </div>
                <div className="p-3 bg-surface-800/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-400">{selectedStudent.streak}</p>
                  <p className="text-xs text-surface-400">Day Streak</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-surface-300 mb-2">Subject Progress</h4>
                {selectedStudent.subjects.map(subject => (
                  <div key={subject.name} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-400">{subject.name}</span>
                      <span className="text-white">{subject.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${subject.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 space-y-2">
                <button className="btn btn-sm w-full bg-primary-600 hover:bg-primary-700">
                  💬 Send Message
                </button>
                <button className="btn btn-sm w-full bg-surface-700 hover:bg-surface-600">
                  📧 Email Parent
                </button>
                <button className="btn btn-sm w-full bg-surface-700 hover:bg-surface-600">
                  📊 View Full Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
