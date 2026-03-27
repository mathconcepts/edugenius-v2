/**
 * AdminPage — Dashboard for teachers/admins.
 * Shows stats, content management, and social media queue.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, Zap, Globe, CheckCircle, XCircle, Clock, Twitter, Instagram, Linkedin } from 'lucide-react';
import { apiFetch } from '@/hooks/useApi';

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  status: string;
  topic?: string;
  question_text?: string;
  created_at: string;
}

interface Stats {
  total_problems: number;
  total_sessions: number;
  total_verifications: number;
  total_streaks: number;
}

const PLATFORM_ICONS: Record<string, any> = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'text-sky-400',
  instagram: 'text-pink-400',
  linkedin: 'text-blue-400',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  published: 'bg-sky-500/20 text-sky-400',
};

export default function AdminPage() {
  const [tab, setTab] = useState<'overview' | 'social'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  useEffect(() => {
    // Load basic stats
    apiFetch<any>('/api/topics')
      .then(data => {
        const total = (data.topics || []).reduce((acc: number, t: any) => acc + (t.problem_count || 0), 0);
        setStats({
          total_problems: total,
          total_sessions: 0,
          total_verifications: 0,
          total_streaks: 0,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'social') {
      setSocialLoading(true);
      apiFetch<any>('/api/admin/social')
        .then(data => setSocialPosts(data.content || []))
        .catch(() => setSocialPosts([]))
        .finally(() => setSocialLoading(false));
    }
  }, [tab]);

  const updatePostStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/admin/social/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setSocialPosts(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch (err) {
      console.error('Failed to update:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-surface-400 text-sm mt-1">Manage content and monitor performance</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['overview', 'social'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-sky-600 text-white'
                : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            {t === 'overview' ? 'Overview' : 'Social Media'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 gap-3"
        >
          {[
            { label: 'Problems', value: stats?.total_problems || 0, icon: Zap, color: 'from-emerald-500 to-green-600' },
            { label: 'Active Sessions', value: stats?.total_sessions || '-', icon: Users, color: 'from-sky-500 to-blue-600' },
            { label: 'Verifications', value: stats?.total_verifications || '-', icon: BarChart3, color: 'from-purple-500 to-violet-600' },
            { label: 'SEO Pages', value: '-', icon: Globe, color: 'from-amber-500 to-orange-600' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl bg-surface-900 border border-surface-800 p-4"
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <stat.icon size={16} className="text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-surface-500 mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === 'social' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {socialLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500" />
            </div>
          ) : socialPosts.length === 0 ? (
            <div className="text-center py-12">
              <Globe size={32} className="mx-auto text-surface-600 mb-3" />
              <p className="text-surface-400 text-sm">No social content yet.</p>
              <p className="text-surface-600 text-xs mt-1">Content is auto-generated when the flywheel runs.</p>
            </div>
          ) : (
            socialPosts.map((post, i) => {
              const PlatformIcon = PLATFORM_ICONS[post.platform] || Globe;
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-xl bg-surface-900 border border-surface-800 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlatformIcon size={16} className={PLATFORM_COLORS[post.platform] || 'text-surface-400'} />
                      <span className="text-xs font-medium text-surface-400 capitalize">{post.platform}</span>
                      {post.topic && (
                        <span className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">{post.topic}</span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status] || 'bg-surface-800 text-surface-400'}`}>
                      {post.status}
                    </span>
                  </div>

                  <p className="text-sm text-surface-300 whitespace-pre-wrap line-clamp-4">
                    {post.content}
                  </p>

                  {post.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updatePostStatus(post.id, 'approved')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-colors"
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button
                        onClick={() => updatePostStatus(post.id, 'rejected')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 text-xs font-medium hover:bg-red-600/30 transition-colors"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={() => updatePostStatus(post.id, 'scheduled')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 text-sky-400 text-xs font-medium hover:bg-sky-600/30 transition-colors"
                      >
                        <Clock size={14} /> Schedule
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}
    </div>
  );
}
