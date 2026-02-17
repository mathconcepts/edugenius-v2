/**
 * Prompt Repository Tests
 */

import { PromptRepository } from '../repository';

describe('PromptRepository', () => {
  let repo: PromptRepository;

  beforeEach(() => {
    repo = new PromptRepository();
  });

  describe('Prompt Management', () => {
    it('should create a prompt', async () => {
      const prompt = await repo.createPrompt({
        id: 'test-prompt',
        name: 'Test Prompt',
        template: 'Hello {{name}}',
        category: 'content',
        variables: [{ name: 'name', required: true }],
      });

      expect(prompt.id).toBe('test-prompt');
      expect(prompt.name).toBe('Test Prompt');
    });

    it('should get a prompt by id', async () => {
      await repo.createPrompt({
        id: 'get-test',
        name: 'Get Test',
        template: 'Test template',
        category: 'content',
        variables: [],
      });

      const prompt = await repo.getPrompt('get-test');
      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('Get Test');
    });

    it('should list prompts by category', async () => {
      await repo.createPrompt({
        id: 'cat-1',
        name: 'Category 1',
        template: 'Template 1',
        category: 'content',
        variables: [],
      });

      await repo.createPrompt({
        id: 'cat-2',
        name: 'Category 2',
        template: 'Template 2',
        category: 'marketing',
        variables: [],
      });

      const contentPrompts = await repo.listPrompts('content');
      expect(contentPrompts.some(p => p.id === 'cat-1')).toBe(true);
      expect(contentPrompts.some(p => p.id === 'cat-2')).toBe(false);
    });
  });

  describe('Template Compilation', () => {
    it('should compile template with variables', async () => {
      await repo.createPrompt({
        id: 'compile-test',
        name: 'Compile Test',
        template: 'Hello {{name}}, welcome to {{place}}!',
        category: 'content',
        variables: [
          { name: 'name', required: true },
          { name: 'place', required: true },
        ],
      });

      const compiled = await repo.compileTemplate('compile-test', {
        name: 'Giri',
        place: 'EduGenius',
      });

      expect(compiled).toBe('Hello Giri, welcome to EduGenius!');
    });

    it('should use default values for missing optional variables', async () => {
      await repo.createPrompt({
        id: 'default-test',
        name: 'Default Test',
        template: 'Hello {{name}}, your level is {{level}}',
        category: 'content',
        variables: [
          { name: 'name', required: true },
          { name: 'level', required: false, defaultValue: 'beginner' },
        ],
      });

      const compiled = await repo.compileTemplate('default-test', {
        name: 'Student',
      });

      expect(compiled).toBe('Hello Student, your level is beginner');
    });
  });

  describe('Modifiers', () => {
    it('should list available modifiers', () => {
      const modifiers = repo.listModifiers();
      
      expect(modifiers.tone).toBeDefined();
      expect(modifiers.language).toBeDefined();
      expect(modifiers.format).toBeDefined();
    });

    it('should apply modifiers to prompt', async () => {
      await repo.createPrompt({
        id: 'modifier-test',
        name: 'Modifier Test',
        template: 'Explain {{topic}}',
        category: 'content',
        variables: [{ name: 'topic', required: true }],
      });

      const result = await repo.execute('modifier-test', { topic: 'algebra' }, ['tone:casual', 'lang:hinglish']);

      expect(result.modifiersApplied).toContain('tone:casual');
      expect(result.modifiersApplied).toContain('lang:hinglish');
    });
  });

  describe('A/B Testing', () => {
    it('should create variants for a prompt', async () => {
      await repo.createPrompt({
        id: 'ab-test',
        name: 'AB Test',
        template: 'Original template',
        category: 'content',
        variables: [],
      });

      await repo.createVariant('ab-test', {
        id: 'variant-a',
        name: 'Variant A',
        template: 'Variant A template',
        weight: 50,
      });

      await repo.createVariant('ab-test', {
        id: 'variant-b',
        name: 'Variant B',
        template: 'Variant B template',
        weight: 50,
      });

      const variants = await repo.getVariants('ab-test');
      expect(variants.length).toBe(2);
    });

    it('should select variant based on weights', async () => {
      await repo.createPrompt({
        id: 'weight-test',
        name: 'Weight Test',
        template: 'Control',
        category: 'content',
        variables: [],
      });

      await repo.createVariant('weight-test', {
        id: 'high-weight',
        name: 'High Weight',
        template: 'High weight variant',
        weight: 100,
      });

      await repo.createVariant('weight-test', {
        id: 'zero-weight',
        name: 'Zero Weight',
        template: 'Zero weight variant',
        weight: 0,
      });

      // With 100 vs 0 weight, should always select high-weight
      const selected = await repo.selectVariant('weight-test');
      expect(selected?.id).toBe('high-weight');
    });
  });

  describe('Execution Tracking', () => {
    it('should track prompt executions', async () => {
      await repo.createPrompt({
        id: 'track-test',
        name: 'Track Test',
        template: 'Tracking template',
        category: 'content',
        variables: [],
      });

      await repo.execute('track-test', {});
      await repo.execute('track-test', {});
      await repo.execute('track-test', {});

      const stats = await repo.getExecutionStats('track-test');
      expect(stats.totalExecutions).toBe(3);
    });
  });
});
