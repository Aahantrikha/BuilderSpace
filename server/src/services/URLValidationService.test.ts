import { describe, it, expect, beforeEach } from 'vitest';
import { URLValidationService } from './URLValidationService.js';

describe('URLValidationService', () => {
  let urlValidationService: URLValidationService;

  beforeEach(() => {
    urlValidationService = new URLValidationService();
  });

  describe('validateURL', () => {
    describe('valid URLs', () => {
      it('should accept valid https URL', () => {
        const result = urlValidationService.validateURL('https://example.com');
        expect(result.isValid).toBe(true);
        expect(result.sanitizedURL).toBe('https://example.com');
        expect(result.error).toBeUndefined();
      });

      it('should accept valid http URL', () => {
        const result = urlValidationService.validateURL('http://example.com');
        expect(result.isValid).toBe(true);
        expect(result.sanitizedURL).toBe('http://example.com');
      });

      it('should accept URL with path', () => {
        const result = urlValidationService.validateURL('https://example.com/path/to/resource');
        expect(result.isValid).toBe(true);
        expect(result.sanitizedURL).toBe('https://example.com/path/to/resource');
      });

      it('should accept URL with query parameters', () => {
        const result = urlValidationService.validateURL('https://example.com?param=value&other=test');
        expect(result.isValid).toBe(true);
      });

      it('should accept URL with fragment', () => {
        const result = urlValidationService.validateURL('https://example.com#section');
        expect(result.isValid).toBe(true);
      });

      it('should accept URL with port', () => {
        const result = urlValidationService.validateURL('https://example.com:8080');
        expect(result.isValid).toBe(true);
      });

      it('should accept URL with subdomain', () => {
        const result = urlValidationService.validateURL('https://subdomain.example.com');
        expect(result.isValid).toBe(true);
      });

      it('should trim whitespace from URL', () => {
        const result = urlValidationService.validateURL('  https://example.com  ');
        expect(result.isValid).toBe(true);
        expect(result.sanitizedURL).toBe('https://example.com');
      });

      it('should accept GitHub URLs', () => {
        const result = urlValidationService.validateURL('https://github.com/user/repo');
        expect(result.isValid).toBe(true);
      });

      it('should accept Figma URLs', () => {
        const result = urlValidationService.validateURL('https://www.figma.com/file/abc123');
        expect(result.isValid).toBe(true);
      });

      it('should accept Google Docs URLs', () => {
        const result = urlValidationService.validateURL('https://docs.google.com/document/d/abc123');
        expect(result.isValid).toBe(true);
      });
    });

    describe('invalid URLs', () => {
      it('should reject empty URL', () => {
        const result = urlValidationService.validateURL('');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URL cannot be empty');
      });

      it('should reject whitespace-only URL', () => {
        const result = urlValidationService.validateURL('   ');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URL cannot be empty');
      });

      it('should reject null URL', () => {
        const result = urlValidationService.validateURL(null as any);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URL cannot be empty');
      });

      it('should reject undefined URL', () => {
        const result = urlValidationService.validateURL(undefined as any);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URL cannot be empty');
      });

      it('should reject URL without protocol', () => {
        const result = urlValidationService.validateURL('example.com');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should reject invalid URL format', () => {
        const result = urlValidationService.validateURL('not-a-valid-url');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should reject URL that is too long', () => {
        const longURL = 'https://example.com/' + 'a'.repeat(2100);
        const result = urlValidationService.validateURL(longURL);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('cannot exceed');
      });
    });

    describe('blocked protocols', () => {
      it('should reject javascript protocol', () => {
        const result = urlValidationService.validateURL('javascript:alert("xss")');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not allowed for security reasons');
      });

      it('should reject data protocol', () => {
        const result = urlValidationService.validateURL('data:text/html,<script>alert("xss")</script>');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not allowed for security reasons');
      });

      it('should reject file protocol', () => {
        const result = urlValidationService.validateURL('file:///etc/passwd');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not allowed for security reasons');
      });

      it('should reject ftp protocol', () => {
        const result = urlValidationService.validateURL('ftp://example.com');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not allowed for security reasons');
      });

      it('should reject ssh protocol', () => {
        const result = urlValidationService.validateURL('ssh://example.com');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not allowed for security reasons');
      });
    });

    describe('local and private network URLs', () => {
      it('should reject localhost', () => {
        const result = urlValidationService.validateURL('http://localhost:3000');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('local or private networks');
      });

      it('should reject 127.0.0.1', () => {
        const result = urlValidationService.validateURL('http://127.0.0.1:3000');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('local or private networks');
      });

      it('should reject IPv6 localhost', () => {
        const result = urlValidationService.validateURL('http://[::1]:3000');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('local or private networks');
      });

      it('should reject private IP 10.x.x.x', () => {
        const result = urlValidationService.validateURL('http://10.0.0.1');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('local or private networks');
      });

      it('should reject private IP 192.168.x.x', () => {
        const result = urlValidationService.validateURL('http://192.168.1.1');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('local or private networks');
      });

      it('should reject private IP 172.16-31.x.x', () => {
        const result = urlValidationService.validateURL('http://172.16.0.1');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('local or private networks');
      });

      it('should reject link-local IP 169.254.x.x', () => {
        const result = urlValidationService.validateURL('http://169.254.1.1');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('local or private networks');
      });
    });

    describe('security checks', () => {
      it('should reject URL with @ symbol (domain hiding)', () => {
        const result = urlValidationService.validateURL('https://user@evil.com@example.com');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('security check');
      });

      it('should reject URL with protocol in path', () => {
        const result = urlValidationService.validateURL('https://example.com/http://evil.com');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('security check');
      });

      it('should warn about URL shorteners', () => {
        const result = urlValidationService.validateURL('https://bit.ly/abc123');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('security check');
      });

      it('should warn about suspicious TLDs', () => {
        const result = urlValidationService.validateURL('https://example.tk');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('security check');
      });

      it('should detect IP addresses in URL', () => {
        const result = urlValidationService.validateURL('https://192.0.2.1');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('security check');
      });

      it('should detect excessive subdomains', () => {
        const result = urlValidationService.validateURL('https://a.b.c.d.e.f.example.com');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('security check');
      });
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata from valid URL', () => {
      const metadata = urlValidationService.extractMetadata('https://example.com/path/to/resource');
      expect(metadata).toBeDefined();
      expect(metadata?.hostname).toBe('example.com');
      expect(metadata?.protocol).toBe('https:');
      expect(metadata?.title).toBeDefined();
      expect(metadata?.description).toBeDefined();
    });

    it('should extract title from URL path', () => {
      const metadata = urlValidationService.extractMetadata('https://github.com/user/my-awesome-project');
      expect(metadata?.title).toBe('My Awesome Project');
    });

    it('should handle URLs without path', () => {
      const metadata = urlValidationService.extractMetadata('https://example.com');
      expect(metadata?.title).toBe('example.com');
      expect(metadata?.description).toBe('Link to example.com');
    });

    it('should remove file extensions from title', () => {
      const metadata = urlValidationService.extractMetadata('https://example.com/document.pdf');
      expect(metadata?.title).toBe('Document');
    });

    it('should convert dashes and underscores to spaces', () => {
      const metadata = urlValidationService.extractMetadata('https://example.com/my-cool_project');
      expect(metadata?.title).toBe('My Cool Project');
    });

    it('should return null for invalid URL', () => {
      const metadata = urlValidationService.extractMetadata('not-a-url');
      expect(metadata).toBeNull();
    });

    it('should handle URLs with query parameters', () => {
      const metadata = urlValidationService.extractMetadata('https://example.com/page?id=123');
      expect(metadata).toBeDefined();
      expect(metadata?.hostname).toBe('example.com');
    });

    it('should handle URLs with fragments', () => {
      const metadata = urlValidationService.extractMetadata('https://example.com/page#section');
      expect(metadata).toBeDefined();
      expect(metadata?.hostname).toBe('example.com');
    });
  });

  describe('sanitizeURL', () => {
    it('should sanitize valid URL', () => {
      const sanitized = urlValidationService.sanitizeURL('https://example.com');
      expect(sanitized).toBe('https://example.com/');
    });

    it('should remove username and password', () => {
      const sanitized = urlValidationService.sanitizeURL('https://user:pass@example.com');
      expect(sanitized).toBe('https://example.com/');
      expect(sanitized).not.toContain('user');
      expect(sanitized).not.toContain('pass');
    });

    it('should return null for invalid URL', () => {
      const sanitized = urlValidationService.sanitizeURL('not-a-url');
      expect(sanitized).toBeNull();
    });

    it('should trim whitespace', () => {
      const sanitized = urlValidationService.sanitizeURL('  https://example.com  ');
      expect(sanitized).toBe('https://example.com/');
    });

    it('should preserve path and query parameters', () => {
      const sanitized = urlValidationService.sanitizeURL('https://example.com/path?param=value');
      expect(sanitized).toContain('/path');
      expect(sanitized).toContain('param=value');
    });
  });

  describe('isSafeURL', () => {
    it('should return true for safe URL', () => {
      expect(urlValidationService.isSafeURL('https://example.com')).toBe(true);
    });

    it('should return false for unsafe URL', () => {
      expect(urlValidationService.isSafeURL('javascript:alert("xss")')).toBe(false);
    });

    it('should return false for invalid URL', () => {
      expect(urlValidationService.isSafeURL('not-a-url')).toBe(false);
    });

    it('should return false for localhost', () => {
      expect(urlValidationService.isSafeURL('http://localhost:3000')).toBe(false);
    });

    it('should return false for private IP', () => {
      expect(urlValidationService.isSafeURL('http://192.168.1.1')).toBe(false);
    });

    it('should return true for GitHub URL', () => {
      expect(urlValidationService.isSafeURL('https://github.com/user/repo')).toBe(true);
    });

    it('should return true for Figma URL', () => {
      expect(urlValidationService.isSafeURL('https://www.figma.com/file/abc')).toBe(true);
    });
  });

  describe('getSecurityInfo', () => {
    it('should return safe for valid URL', () => {
      const info = urlValidationService.getSecurityInfo('https://example.com');
      expect(info.isSafe).toBe(true);
      expect(info.threats).toHaveLength(0);
    });

    it('should detect IP address threat', () => {
      const info = urlValidationService.getSecurityInfo('https://192.0.2.1');
      expect(info.isSafe).toBe(false);
      expect(info.threats).toContain('IP address detected (potential obfuscation)');
    });

    it('should detect URL shortener', () => {
      const info = urlValidationService.getSecurityInfo('https://bit.ly/abc');
      expect(info.isSafe).toBe(false);
      expect(info.threats.some(t => t.includes('shortener'))).toBe(true);
    });

    it('should detect suspicious TLD', () => {
      const info = urlValidationService.getSecurityInfo('https://example.tk');
      expect(info.isSafe).toBe(false);
      expect(info.threats.some(t => t.includes('TLD'))).toBe(true);
    });

    it('should detect @ symbol in domain hiding attack', () => {
      const info = urlValidationService.getSecurityInfo('https://trusted.com@evil.com/path');
      expect(info.isSafe).toBe(false);
      expect(info.threats.some(t => t.includes('@ symbol'))).toBe(true);
    });

    it('should detect protocol in path', () => {
      const info = urlValidationService.getSecurityInfo('https://example.com/http://evil.com');
      expect(info.isSafe).toBe(false);
      expect(info.threats.some(t => t.includes('protocol in path'))).toBe(true);
    });

    it('should detect excessive subdomains', () => {
      const info = urlValidationService.getSecurityInfo('https://a.b.c.d.e.f.example.com');
      expect(info.isSafe).toBe(false);
      expect(info.threats.some(t => t.includes('subdomain'))).toBe(true);
    });

    it('should return invalid format for malformed URL', () => {
      const info = urlValidationService.getSecurityInfo('not-a-url');
      expect(info.isSafe).toBe(false);
      expect(info.threats).toContain('Invalid URL format');
    });

    it('should detect multiple threats', () => {
      const info = urlValidationService.getSecurityInfo('https://user@192.0.2.1/http://evil.com');
      expect(info.isSafe).toBe(false);
      expect(info.threats.length).toBeGreaterThan(1);
    });
  });

  describe('edge cases', () => {
    it('should handle URL with multiple query parameters', () => {
      const result = urlValidationService.validateURL('https://example.com?a=1&b=2&c=3');
      expect(result.isValid).toBe(true);
    });

    it('should handle URL with encoded characters', () => {
      const result = urlValidationService.validateURL('https://example.com/path%20with%20spaces');
      expect(result.isValid).toBe(true);
    });

    it('should handle URL with port number', () => {
      const result = urlValidationService.validateURL('https://example.com:8443/path');
      expect(result.isValid).toBe(true);
    });

    it('should handle URL with fragment identifier', () => {
      const result = urlValidationService.validateURL('https://example.com/page#section-1');
      expect(result.isValid).toBe(true);
    });

    it('should handle URL with international domain', () => {
      const result = urlValidationService.validateURL('https://example.co.uk');
      expect(result.isValid).toBe(true);
    });

    it('should handle very long but valid URL', () => {
      const longPath = 'a'.repeat(1000);
      const result = urlValidationService.validateURL(`https://example.com/${longPath}`);
      expect(result.isValid).toBe(true);
    });

    it('should handle URL with trailing slash', () => {
      const result = urlValidationService.validateURL('https://example.com/');
      expect(result.isValid).toBe(true);
    });

    it('should handle URL without trailing slash', () => {
      const result = urlValidationService.validateURL('https://example.com');
      expect(result.isValid).toBe(true);
    });
  });
});
