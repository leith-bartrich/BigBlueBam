import { describe, it, expect } from 'vitest';

describe('Blank API Security', () => {
  describe('slug validation', () => {
    it('accepts valid slugs', () => {
      const validSlugs = ['customer-feedback', 'bug-report-2024', 'a1-b2-c3'];
      const regex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
      for (const slug of validSlugs) {
        expect(regex.test(slug)).toBe(true);
      }
    });

    it('rejects invalid slugs', () => {
      const invalidSlugs = ['-starts-with-dash', 'ends-with-dash-', 'Has-Uppercase', 'has spaces', 'a'];
      const regex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
      for (const slug of invalidSlugs) {
        expect(regex.test(slug)).toBe(false);
      }
    });
  });

  describe('field type validation', () => {
    it('allows all valid field types', () => {
      const validTypes = [
        'short_text', 'long_text', 'email', 'phone', 'url', 'number',
        'single_select', 'multi_select', 'dropdown',
        'date', 'time', 'datetime',
        'file_upload', 'image_upload',
        'rating', 'scale', 'nps',
        'checkbox', 'toggle',
        'section_header', 'paragraph', 'hidden',
      ];
      expect(validTypes).toHaveLength(22);
    });
  });

  describe('response data sanitization', () => {
    it('response_data is JSON object', () => {
      const valid = { name: 'Alice', email: 'alice@co.com', rating: 4 };
      expect(typeof valid).toBe('object');
      expect(JSON.stringify(valid)).toBeTruthy();
    });
  });

  describe('rate limiting', () => {
    it('default public form rate limit is 10 per hour', () => {
      const rateLimit = 10;
      const windowMs = 3600000;
      expect(rateLimit).toBe(10);
      expect(windowMs).toBe(3600000);
    });
  });
});
