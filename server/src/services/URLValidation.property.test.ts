import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { URLValidationService } from './URLValidationService.js';

// Feature: team-collaboration-workspace, Property 8: URL Validation
// **Validates: Requirements 6.4**

describe('URL Validation - Property Tests', () => {
  let urlValidationService: URLValidationService;

  beforeEach(() => {
    urlValidationService = new URLValidationService();
  });

  // Custom arbitraries for generating test data

  // Generate valid URLs with http/https protocols
  const validURLArbitrary = fc.record({
    protocol: fc.constantFrom('http', 'https'),
    hostname: fc.domain(),
    path: fc.option(
      fc.array(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9_-]+$/i.test(s)),
        { minLength: 0, maxLength: 5 }
      ).map(parts => '/' + parts.join('/')),
      { nil: '' }
    ),
    query: fc.option(
      fc.array(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z]+$/i.test(s)),
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z0-9]+$/i.test(s))
        ),
        { minLength: 0, maxLength: 3 }
      ).map(pairs => pairs.length > 0 ? '?' + pairs.map(([k, v]) => `${k}=${v}`).join('&') : ''),
      { nil: '' }
    ),
    fragment: fc.option(
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9_-]+$/i.test(s))
        .map(frag => '#' + frag),
      { nil: '' }
    ),
  }).map(({ protocol, hostname, path, query, fragment }) => 
    `${protocol}://${hostname}${path}${query}${fragment}`
  );

  // Generate invalid URLs with blocked protocols
  const blockedProtocolURLArbitrary = fc.record({
    protocol: fc.constantFrom('javascript', 'data', 'file', 'ftp', 'ftps', 'telnet', 'ssh', 'vbscript'),
    content: fc.string({ minLength: 1, maxLength: 50 }),
  }).map(({ protocol, content }) => `${protocol}:${content}`);

  // Generate URLs with localhost/private IPs
  const localPrivateURLArbitrary = fc.oneof(
    fc.constant('http://localhost:3000'),
    fc.constant('http://127.0.0.1'),
    fc.constant('http://[::1]'),
    fc.integer({ min: 0, max: 255 }).map(x => `http://10.0.0.${x}`),
    fc.integer({ min: 0, max: 255 }).chain(x => 
      fc.integer({ min: 0, max: 255 }).map(y => `http://192.168.${x}.${y}`)
    ),
    fc.integer({ min: 16, max: 31 }).chain(x => 
      fc.integer({ min: 0, max: 255 }).chain(y =>
        fc.integer({ min: 0, max: 255 }).map(z => `http://172.${x}.${y}.${z}`)
      )
    ),
    fc.integer({ min: 0, max: 255 }).map(x => `http://169.254.0.${x}`),
  );

  // Generate URLs with security threats
  const threatURLArbitrary = fc.oneof(
    // URL with @ symbol (domain hiding)
    fc.domain().chain(trusted => 
      fc.domain().map(evil => `https://user@${evil}`)
    ),
    // URL with protocol in path
    fc.domain().chain(domain =>
      fc.domain().map(evil => `https://${domain}/http://${evil}`)
    ),
    // URL shortener
    fc.constantFrom('https://bit.ly/abc123', 'https://tinyurl.com/xyz', 'https://goo.gl/test'),
    // Suspicious TLD
    fc.constantFrom('https://example.tk', 'https://example.ml', 'https://example.ga'),
    // IP address
    fc.tuple(
      fc.integer({ min: 1, max: 223 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 1, max: 255 })
    ).map(([a, b, c, d]) => `https://${a}.${b}.${c}.${d}`),
    // Excessive subdomains
    fc.array(fc.string({ minLength: 1, maxLength: 5 }).filter(s => /^[a-z]+$/i.test(s)), { minLength: 6, maxLength: 8 })
      .map(parts => `https://${parts.join('.')}.example.com`),
  );

  // Generate invalid URL formats
  const invalidFormatURLArbitrary = fc.oneof(
    fc.constant(''),
    fc.constant('   '),
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('://')),
    fc.constant('not-a-valid-url'),
    fc.constant('example.com'), // Missing protocol
    fc.constant('://example.com'), // Missing protocol name
  );

  // Generate URLs that are too long
  const tooLongURLArbitrary = fc.constant('https://example.com/' + 'a'.repeat(2100));

  describe('Property 8: URL Validation', () => {
    it('should accept all properly formatted http/https URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          validURLArbitrary,
          async (url) => {
            const result = urlValidationService.validateURL(url);
            
            // Valid URLs should be accepted
            expect(result.isValid).toBe(true);
            expect(result.sanitizedURL).toBeDefined();
            expect(result.error).toBeUndefined();
            
            // Sanitized URL should be a valid URL
            if (result.sanitizedURL) {
              expect(() => new URL(result.sanitizedURL)).not.toThrow();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all URLs with blocked protocols', async () => {
      await fc.assert(
        fc.asyncProperty(
          blockedProtocolURLArbitrary,
          async (url) => {
            const result = urlValidationService.validateURL(url);
            
            // Blocked protocol URLs should be rejected
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            // Error message can be either about blocked protocol or invalid format
            // depending on whether the URL can be parsed
            expect(
              result.error!.includes('not allowed for security reasons') ||
              result.error!.includes('Invalid URL format')
            ).toBe(true);
            expect(result.sanitizedURL).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all localhost and private network URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          localPrivateURLArbitrary,
          async (url) => {
            const result = urlValidationService.validateURL(url);
            
            // Local/private URLs should be rejected
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('local or private networks');
            expect(result.sanitizedURL).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all URLs with security threats', async () => {
      await fc.assert(
        fc.asyncProperty(
          threatURLArbitrary,
          async (url) => {
            const result = urlValidationService.validateURL(url);
            
            // URLs with security threats should be rejected
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('security check');
            expect(result.sanitizedURL).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all invalid URL formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidFormatURLArbitrary,
          async (url) => {
            const result = urlValidationService.validateURL(url);
            
            // Invalid format URLs should be rejected
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.sanitizedURL).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject URLs that exceed maximum length', async () => {
      await fc.assert(
        fc.asyncProperty(
          tooLongURLArbitrary,
          async (url) => {
            const result = urlValidationService.validateURL(url);
            
            // Too long URLs should be rejected
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('cannot exceed');
            expect(result.sanitizedURL).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trim whitespace from valid URLs before validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          validURLArbitrary,
          fc.string({ minLength: 1, maxLength: 5 }).filter(s => /^[ \t]+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 5 }).filter(s => /^[ \t]+$/.test(s)),
          async (url, leadingWhitespace, trailingWhitespace) => {
            const paddedURL = leadingWhitespace + url + trailingWhitespace;
            const result = urlValidationService.validateURL(paddedURL);
            
            // Should accept URL after trimming whitespace
            expect(result.isValid).toBe(true);
            expect(result.sanitizedURL).toBeDefined();
            expect(result.sanitizedURL).toBe(url);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide appropriate error messages for different rejection reasons', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            invalidFormatURLArbitrary,
            blockedProtocolURLArbitrary,
            localPrivateURLArbitrary,
            threatURLArbitrary,
            tooLongURLArbitrary
          ),
          async (url) => {
            const result = urlValidationService.validateURL(url);
            
            // All invalid URLs should have error messages
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
            expect(result.error!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should consistently validate the same URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(validURLArbitrary, invalidFormatURLArbitrary, blockedProtocolURLArbitrary),
          async (url) => {
            // Validate the same URL multiple times
            const result1 = urlValidationService.validateURL(url);
            const result2 = urlValidationService.validateURL(url);
            const result3 = urlValidationService.validateURL(url);
            
            // Results should be consistent
            expect(result1.isValid).toBe(result2.isValid);
            expect(result2.isValid).toBe(result3.isValid);
            expect(result1.error).toBe(result2.error);
            expect(result2.error).toBe(result3.error);
            expect(result1.sanitizedURL).toBe(result2.sanitizedURL);
            expect(result2.sanitizedURL).toBe(result3.sanitizedURL);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only store valid URLs (integration with sanitizeURL)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(validURLArbitrary, invalidFormatURLArbitrary, blockedProtocolURLArbitrary),
          async (url) => {
            const validationResult = urlValidationService.validateURL(url);
            const sanitizedURL = urlValidationService.sanitizeURL(url);
            
            // Core property: validateURL and sanitizeURL should be consistent
            // If validation passes, sanitization should succeed
            if (validationResult.isValid) {
              expect(sanitizedURL).not.toBeNull();
              expect(sanitizedURL).toBeDefined();
            }
            
            // If sanitization fails, validation should also fail
            if (sanitizedURL === null) {
              expect(validationResult.isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate URLs with various valid components', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            hostname: fc.domain(),
            port: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: null }),
            path: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9/_-]+$/i.test(s)), { nil: null }),
            query: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9=&]+$/i.test(s)), { nil: null }),
            fragment: fc.option(fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9_-]+$/i.test(s)), { nil: null }),
          }),
          async ({ protocol, hostname, port, path, query, fragment }) => {
            let url = `${protocol}://${hostname}`;
            if (port) url += `:${port}`;
            if (path) url += `/${path}`;
            if (query) url += `?${query}`;
            if (fragment) url += `#${fragment}`;
            
            const result = urlValidationService.validateURL(url);
            
            // All valid component combinations should be accepted
            expect(result.isValid).toBe(true);
            expect(result.sanitizedURL).toBeDefined();
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject URLs with null or undefined input', async () => {
      const nullResult = urlValidationService.validateURL(null as any);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.error).toBe('URL cannot be empty');

      const undefinedResult = urlValidationService.validateURL(undefined as any);
      expect(undefinedResult.isValid).toBe(false);
      expect(undefinedResult.error).toBe('URL cannot be empty');
    });

    it('should validate common collaboration tool URLs', async () => {
      const collaborationURLs = [
        'https://github.com/user/repo',
        'https://www.figma.com/file/abc123',
        'https://docs.google.com/document/d/abc123',
        'https://trello.com/b/abc123',
        'https://www.notion.so/workspace/page',
        'https://slack.com/workspace',
        'https://discord.com/channels/123',
        'https://zoom.us/j/123456789',
      ];

      for (const url of collaborationURLs) {
        const result = urlValidationService.validateURL(url);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedURL).toBeDefined();
        expect(result.error).toBeUndefined();
      }
    });
  });
});
