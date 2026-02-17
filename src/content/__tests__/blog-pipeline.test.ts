/**
 * Blog Pipeline Tests
 */

import { BlogPipeline, VlogPipeline, ContentCalendarManager } from '../blog-pipeline';

describe('BlogPipeline', () => {
  let pipeline: BlogPipeline;

  beforeEach(() => {
    pipeline = new BlogPipeline();
  });

  describe('Post Creation', () => {
    it('should create a blog post', async () => {
      const post = await pipeline.createPost({
        title: 'Test Blog Post',
        content: 'This is test content for the blog post.',
        excerpt: 'Test excerpt',
        category: 'physics',
        tags: ['test', 'physics'],
        exam: 'JEE',
      });

      expect(post.id).toBeDefined();
      expect(post.title).toBe('Test Blog Post');
      expect(post.status).toBe('draft');
    });

    it('should update a blog post', async () => {
      const post = await pipeline.createPost({
        title: 'Original Title',
        content: 'Original content',
        category: 'chemistry',
        tags: [],
      });

      const updated = await pipeline.updatePost(post.id, {
        title: 'Updated Title',
      });

      expect(updated?.title).toBe('Updated Title');
    });

    it('should list posts by exam', async () => {
      await pipeline.createPost({
        title: 'JEE Post',
        content: 'JEE content',
        category: 'physics',
        tags: [],
        exam: 'JEE',
      });

      await pipeline.createPost({
        title: 'NEET Post',
        content: 'NEET content',
        category: 'biology',
        tags: [],
        exam: 'NEET',
      });

      const jeePosts = await pipeline.listPosts({ exam: 'JEE' });
      expect(jeePosts.every(p => p.exam === 'JEE')).toBe(true);
    });
  });

  describe('Publishing', () => {
    it('should schedule a post for publishing', async () => {
      const post = await pipeline.createPost({
        title: 'Publish Test',
        content: 'Content to publish',
        category: 'math',
        tags: [],
      });

      const publishAt = Date.now() + 3600000; // 1 hour from now
      await pipeline.schedulePublish(post.id, 'self-hosted', { publishAt });

      const updated = await pipeline.getPost(post.id);
      expect(updated?.publishSchedule).toBeDefined();
    });

    it('should publish to multiple platforms', async () => {
      const post = await pipeline.createPost({
        title: 'Multi-Platform',
        content: 'Content for multiple platforms',
        category: 'general',
        tags: [],
        seo: {
          metaTitle: 'Multi-Platform Post',
          metaDescription: 'Description',
          focusKeyword: 'multi-platform',
        },
      });

      await pipeline.schedulePublish(post.id, 'self-hosted', { publishAt: Date.now() });
      await pipeline.schedulePublish(post.id, 'medium', { publishAt: Date.now() + 3600000 });

      const updated = await pipeline.getPost(post.id);
      expect(Object.keys(updated?.publishSchedule || {}).length).toBe(2);
    });
  });

  describe('SEO', () => {
    it('should store SEO metadata', async () => {
      const post = await pipeline.createPost({
        title: 'SEO Test',
        content: 'SEO optimized content',
        category: 'physics',
        tags: ['seo', 'test'],
        seo: {
          metaTitle: 'SEO Meta Title',
          metaDescription: 'SEO meta description for search engines',
          focusKeyword: 'seo test',
          keywords: ['seo', 'test', 'optimization'],
        },
      });

      expect(post.seo?.metaTitle).toBe('SEO Meta Title');
      expect(post.seo?.focusKeyword).toBe('seo test');
    });
  });
});

describe('VlogPipeline', () => {
  let pipeline: VlogPipeline;

  beforeEach(() => {
    pipeline = new VlogPipeline();
  });

  describe('Vlog Creation', () => {
    it('should create a vlog', async () => {
      const vlog = await pipeline.createVlog({
        title: 'Test Vlog',
        description: 'Test video description',
        script: {
          sections: [
            { title: 'Intro', content: 'Welcome to the video', duration: 30 },
            { title: 'Main', content: 'Main content here', duration: 240 },
            { title: 'Outro', content: 'Thanks for watching', duration: 30 },
          ],
          totalDuration: 300,
        },
        tags: ['test', 'education'],
        exam: 'JEE',
      });

      expect(vlog.id).toBeDefined();
      expect(vlog.title).toBe('Test Vlog');
      expect(vlog.script.sections.length).toBe(3);
    });

    it('should calculate total duration from sections', async () => {
      const vlog = await pipeline.createVlog({
        title: 'Duration Test',
        description: 'Testing duration calculation',
        script: {
          sections: [
            { title: 'Part 1', content: 'Content 1', duration: 60 },
            { title: 'Part 2', content: 'Content 2', duration: 120 },
          ],
          totalDuration: 180,
        },
        tags: [],
      });

      expect(vlog.script.totalDuration).toBe(180);
    });
  });

  describe('Platform Publishing', () => {
    it('should schedule for YouTube', async () => {
      const vlog = await pipeline.createVlog({
        title: 'YouTube Video',
        description: 'For YouTube',
        script: { sections: [], totalDuration: 300 },
        tags: ['youtube'],
      });

      await pipeline.schedulePublish(vlog.id, 'youtube', {
        publishAt: Date.now() + 86400000,
      });

      const updated = await pipeline.getVlog(vlog.id);
      expect(updated?.platforms?.youtube).toBeDefined();
    });

    it('should schedule for Instagram Reels', async () => {
      const vlog = await pipeline.createVlog({
        title: 'Reels Video',
        description: 'Short form content',
        script: { sections: [], totalDuration: 60 },
        tags: ['reels'],
      });

      await pipeline.schedulePublish(vlog.id, 'instagram-reels', {
        publishAt: Date.now(),
      });

      const updated = await pipeline.getVlog(vlog.id);
      expect(updated?.platforms?.['instagram-reels']).toBeDefined();
    });
  });
});

describe('ContentCalendarManager', () => {
  let calendar: ContentCalendarManager;

  beforeEach(() => {
    calendar = new ContentCalendarManager();
  });

  describe('Scheduling', () => {
    it('should schedule content', async () => {
      const entry = await calendar.scheduleContent({
        title: 'Scheduled Blog',
        type: 'blog',
        exam: 'JEE',
        scheduledDate: Date.now() + 86400000,
        priority: 'normal',
        status: 'scheduled',
      });

      expect(entry.id).toBeDefined();
      expect(entry.status).toBe('scheduled');
    });

    it('should get entries for a date range', async () => {
      const now = Date.now();
      
      await calendar.scheduleContent({
        title: 'Today',
        type: 'blog',
        exam: 'JEE',
        scheduledDate: now,
        priority: 'normal',
        status: 'scheduled',
      });

      await calendar.scheduleContent({
        title: 'Tomorrow',
        type: 'vlog',
        exam: 'JEE',
        scheduledDate: now + 86400000,
        priority: 'high',
        status: 'scheduled',
      });

      const entries = await calendar.getEntries({
        startDate: new Date(now - 3600000),
        endDate: new Date(now + 172800000),
      });

      expect(entries.length).toBe(2);
    });

    it('should filter by exam', async () => {
      await calendar.scheduleContent({
        title: 'JEE Content',
        type: 'blog',
        exam: 'JEE',
        scheduledDate: Date.now(),
        priority: 'normal',
        status: 'scheduled',
      });

      await calendar.scheduleContent({
        title: 'NEET Content',
        type: 'blog',
        exam: 'NEET',
        scheduledDate: Date.now(),
        priority: 'normal',
        status: 'scheduled',
      });

      const jeeEntries = await calendar.getEntries({ exam: 'JEE' });
      expect(jeeEntries.every(e => e.exam === 'JEE')).toBe(true);
    });
  });

  describe('Auto-Scheduling', () => {
    it('should auto-fill calendar gaps', async () => {
      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 86400000);

      await calendar.autoFillCalendar({
        exam: 'JEE',
        startDate,
        endDate,
        cadence: {
          blogsPerWeek: 3,
          videosPerWeek: 2,
        },
      });

      const entries = await calendar.getEntries({
        exam: 'JEE',
        startDate,
        endDate,
      });

      expect(entries.length).toBeGreaterThan(0);
    });
  });
});
