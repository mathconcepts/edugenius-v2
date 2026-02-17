import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Plus,
  Calendar,
  Award,
} from 'lucide-react';
import { clsx } from 'clsx';

const myStudents = [
  { id: '1', name: 'Arjun Sharma', avatar: null, progress: 85, lastActive: '2 hours ago', status: 'active' },
  { id: '2', name: 'Priya Patel', avatar: null, progress: 72, lastActive: '1 day ago', status: 'needs-attention' },
  { id: '3', name: 'Rahul Kumar', avatar: null, progress: 91, lastActive: '30 min ago', status: 'active' },
  { id: '4', name: 'Sneha Gupta', avatar: null, progress: 45, lastActive: '3 days ago', status: 'struggling' },
  { id: '5', name: 'Vikram Singh', avatar: null, progress: 68, lastActive: '5 hours ago', status: 'active' },
];

const recentSubmissions = [
  { id: '1', student: 'Arjun Sharma', topic: 'Quadratic Equations', score: 92, date: 'Today' },
  { id: '2', student: 'Rahul Kumar', topic: 'Newton\'s Laws', score: 88, date: 'Today' },
  { id: '3', student: 'Priya Patel', topic: 'Chemical Bonding', score: 65, date: 'Yesterday' },
];

const upcomingClasses = [
  { id: '1', title: 'Math - Class 10A', time: '10:00 AM', students: 32, topic: 'Trigonometry' },
  { id: '2', title: 'Physics - Class 11B', time: '2:00 PM', students: 28, topic: 'Mechanics' },
];

type StudentStatus = 'active' | 'needs-attention' | 'struggling';

const statusLabels: Record<StudentStatus, string> = {
  active: 'On Track',
  'needs-attention': 'Needs Attention',
  struggling: 'Struggling',
};

export function TeacherDashboard() {
  const totalStudents = myStudents.length;
  const avgProgress = Math.round(myStudents.reduce((sum, s) => sum + s.progress, 0) / totalStudents);
  const needsAttention = myStudents.filter(s => s.status !== 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
          <p className="text-surface-400">Monitor your students and manage lessons</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Get AI Help
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Lesson
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary-500/20">
              <Users className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalStudents}</p>
              <p className="text-sm text-surface-400">My Students</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/20">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgProgress}%</p>
              <p className="text-sm text-surface-400">Avg Progress</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/20">
              <AlertCircle className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{needsAttention}</p>
              <p className="text-sm text-surface-400">Need Attention</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-accent-500/20">
              <Award className="w-6 h-6 text-accent-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">12</p>
              <p className="text-sm text-surface-400">Lessons Created</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">My Students</h2>
            <Link to="/students" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {myStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-surface-800/50 hover:bg-surface-800 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white font-medium">
                  {student.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{student.name}</h3>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        student.status === 'active' && 'bg-green-500/20 text-green-400',
                        student.status === 'needs-attention' && 'bg-yellow-500/20 text-yellow-400',
                        student.status === 'struggling' && 'bg-red-500/20 text-red-400'
                      )}
                    >
                      {statusLabels[student.status as StudentStatus]}
                    </span>
                  </div>
                  <p className="text-sm text-surface-400">Last active: {student.lastActive}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{student.progress}%</p>
                  <div className="w-20 h-1.5 bg-surface-700 rounded-full mt-1">
                    <div
                      className={clsx(
                        'h-full rounded-full',
                        student.progress >= 80 && 'bg-green-500',
                        student.progress >= 60 && student.progress < 80 && 'bg-yellow-500',
                        student.progress < 60 && 'bg-red-500'
                      )}
                      style={{ width: `${student.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Classes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Today's Classes</h2>
              <Calendar className="w-5 h-5 text-surface-400" />
            </div>
            <div className="space-y-3">
              {upcomingClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-sm">{cls.title}</h3>
                    <span className="text-xs text-primary-400">{cls.time}</span>
                  </div>
                  <p className="text-xs text-surface-400">
                    {cls.topic} • {cls.students} students
                  </p>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 btn-secondary text-sm">
              View Schedule
            </button>
          </motion.div>

          {/* Recent Submissions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <h2 className="font-semibold mb-4">Recent Submissions</h2>
            <div className="space-y-3">
              {recentSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50"
                >
                  <div>
                    <p className="font-medium text-sm">{sub.student}</p>
                    <p className="text-xs text-surface-400">{sub.topic}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={clsx(
                        'font-bold',
                        sub.score >= 80 && 'text-green-400',
                        sub.score >= 60 && sub.score < 80 && 'text-yellow-400',
                        sub.score < 60 && 'text-red-400'
                      )}
                    >
                      {sub.score}%
                    </p>
                    <p className="text-xs text-surface-500">{sub.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* AI Assistant */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card bg-gradient-to-br from-accent-500/10 to-primary-500/10"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🎓</span>
              <h2 className="font-semibold">Sage AI Assistant</h2>
            </div>
            <p className="text-sm text-surface-400 mb-4">
              Get help creating lessons, analyzing student performance, or generating practice problems.
            </p>
            <Link to="/chat" className="btn-primary w-full text-center block">
              Chat with Sage
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
