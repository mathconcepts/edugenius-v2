/**
 * Public Website - Blog Page
 * Content from Atlas agent, SEO-optimized
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readTime: number;
  image: string;
  featured?: boolean;
}

const categories = ['All', 'JEE', 'NEET', 'CBSE', 'Study Tips', 'Success Stories'];

const posts: BlogPost[] = [
  {
    id: '1',
    slug: 'jee-main-2026-complete-strategy',
    title: 'JEE Main 2026: Complete Strategy Guide for 250+ Score',
    excerpt: 'Master the art of JEE preparation with our comprehensive guide covering time management, subject-wise tips, and last-minute strategies.',
    category: 'JEE',
    author: 'Atlas AI',
    date: '2026-02-15',
    readTime: 12,
    image: '📚',
    featured: true,
  },
  {
    id: '2',
    slug: 'physics-electromagnetic-induction-concepts',
    title: 'Electromagnetic Induction: Concepts Made Simple',
    excerpt: 'Struggling with electromagnetic induction? Our AI-powered guide breaks down Faraday\'s laws, Lenz\'s law, and practical applications.',
    category: 'JEE',
    author: 'Atlas AI',
    date: '2026-02-14',
    readTime: 8,
    image: '⚡',
  },
  {
    id: '3',
    slug: 'neet-biology-human-physiology-tips',
    title: 'NEET Biology: Human Physiology High-Yield Topics',
    excerpt: 'Focus on what matters most. Our analysis of 10 years of NEET papers reveals the most frequently asked Human Physiology topics.',
    category: 'NEET',
    author: 'Atlas AI',
    date: '2026-02-13',
    readTime: 10,
    image: '🧬',
  },
  {
    id: '4',
    slug: 'organic-chemistry-reaction-mechanisms',
    title: 'Organic Chemistry: Master Reaction Mechanisms in 7 Days',
    excerpt: 'Stop memorizing, start understanding. Learn the logic behind organic reactions and predict products like a pro.',
    category: 'JEE',
    author: 'Atlas AI',
    date: '2026-02-12',
    readTime: 15,
    image: '🧪',
  },
  {
    id: '5',
    slug: 'cbse-board-exam-last-minute-tips',
    title: 'CBSE Board Exams: Last 30 Days Game Plan',
    excerpt: 'With boards around the corner, here\'s your day-by-day plan to maximize marks and reduce exam anxiety.',
    category: 'CBSE',
    author: 'Atlas AI',
    date: '2026-02-11',
    readTime: 6,
    image: '📝',
  },
  {
    id: '6',
    slug: 'student-success-story-rahul-jee-air-1247',
    title: 'How Rahul Cracked JEE with AIR 1247 Using AI Tutoring',
    excerpt: 'From struggling with Physics to securing a top rank. Rahul shares his journey and how EduGenius helped him succeed.',
    category: 'Success Stories',
    author: 'Editorial Team',
    date: '2026-02-10',
    readTime: 5,
    image: '🏆',
    featured: true,
  },
];

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredPosts = posts.filter(p => p.featured);

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
            <Link to="/website/signup" className="btn btn-sm bg-gradient-to-r from-primary-600 to-accent-600">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-4">Blog</h1>
          <p className="text-xl text-surface-400">Study tips, strategies, and insights from our AI content engine</p>
        </div>
      </section>

      {/* Featured Posts */}
      {featuredPosts.length > 0 && (
        <section className="pb-12 px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Featured</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {featuredPosts.map(post => (
                <Link
                  key={post.id}
                  to={`/website/blog/${post.slug}`}
                  className="group p-6 bg-gradient-to-br from-primary-900/30 to-surface-800 rounded-2xl border border-primary-500/30 hover:border-primary-500 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-5xl">{post.image}</span>
                    <div>
                      <span className="text-xs text-primary-400 font-medium">{post.category}</span>
                      <h3 className="text-xl font-semibold text-white mt-1 group-hover:text-primary-400 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-surface-400 mt-2 line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center gap-4 mt-4 text-sm text-surface-500">
                        <span>{post.author}</span>
                        <span>•</span>
                        <span>{post.date}</span>
                        <span>•</span>
                        <span>{post.readTime} min read</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    selectedCategory === cat
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="px-4 py-2 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 w-full md:w-64"
            />
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {filteredPosts.map(post => (
              <Link
                key={post.id}
                to={`/website/blog/${post.slug}`}
                className="group p-6 bg-surface-800 rounded-2xl border border-surface-700 hover:border-primary-500/50 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{post.image}</span>
                  <span className="text-xs text-primary-400 font-medium bg-primary-500/10 px-2 py-1 rounded">
                    {post.category}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-surface-400 mt-2 text-sm line-clamp-3">{post.excerpt}</p>
                <div className="flex items-center justify-between mt-4 text-xs text-surface-500">
                  <span>{post.author}</span>
                  <span>{post.readTime} min read</span>
                </div>
              </Link>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <span className="text-4xl">🔍</span>
              <p className="text-surface-400 mt-4">No articles found. Try a different search or category.</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 px-6 bg-gradient-to-r from-primary-900/30 to-accent-900/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Get Study Tips in Your Inbox</h2>
          <p className="text-surface-400 mb-6">Weekly insights, strategies, and updates from our AI content team.</p>
          <div className="flex gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
            />
            <button className="btn px-6 bg-gradient-to-r from-primary-600 to-accent-600">
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
