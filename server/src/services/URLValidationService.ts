/**
 * URLValidationService provides comprehensive URL validation, sanitization,
 * and metadata extraction for shared links in Builder Spaces.
 * 
 * Features:
 * - URL format validation and sanitization
 * - Malicious URL detection and filtering
 * - URL metadata extraction (title, description)
 * 
 * Requirements: 6.4
 */

export interface URLValidationResult {
  isValid: boolean;
  sanitizedURL?: string;
  error?: string;
}

export interface URLMetadata {
  title?: string;
  description?: string;
  hostname: string;
  protocol: string;
}

export interface URLSecurityCheck {
  isSafe: boolean;
  threats: string[];
}

/**
 * URLValidationService handles URL validation, sanitization, and security checks
 */
export class URLValidationService {
  // List of suspicious patterns that might indicate malicious URLs
  private static readonly SUSPICIOUS_PATTERNS = [
    // IP address obfuscation
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    // Excessive subdomains (potential phishing)
    /^https?:\/\/([^\/]+\.){5,}/,
    // URL shorteners (can hide malicious destinations)
    /bit\.ly|tinyurl\.com|goo\.gl|ow\.ly|short\.link|t\.co/i,
    // Suspicious TLDs commonly used for phishing
    /\.(tk|ml|ga|cf|gq)$/i,
    // Unicode/homograph attacks
    /[^\x00-\x7F]/,
    // Double encoding
    /%25[0-9a-f]{2}/i,
    // Suspicious keywords
    /login|signin|verify|account|secure|update|confirm/i,
  ];

  // List of blocked protocols
  private static readonly BLOCKED_PROTOCOLS = [
    'javascript:',
    'data:',
    'file:',
    'ftp:',
    'ftps:',
    'telnet:',
    'ssh:',
    'vbscript:',
  ];

  // List of allowed protocols
  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:'];

  // Maximum URL length to prevent DoS attacks
  private static readonly MAX_URL_LENGTH = 2048;

  /**
   * Validate and sanitize a URL
   * 
   * @param url - The URL to validate
   * @returns Validation result with sanitized URL or error message
   */
  validateURL(url: string): URLValidationResult {
    try {
      // Check for empty URL
      if (!url || typeof url !== 'string') {
        return {
          isValid: false,
          error: 'URL cannot be empty',
        };
      }

      // Trim whitespace
      const trimmed = url.trim();

      if (!trimmed) {
        return {
          isValid: false,
          error: 'URL cannot be empty',
        };
      }

      // Check URL length
      if (trimmed.length > URLValidationService.MAX_URL_LENGTH) {
        return {
          isValid: false,
          error: `URL cannot exceed ${URLValidationService.MAX_URL_LENGTH} characters`,
        };
      }

      // Parse URL
      let urlObj: URL;
      try {
        urlObj = new URL(trimmed);
      } catch (error) {
        return {
          isValid: false,
          error: 'Invalid URL format',
        };
      }

      // Check protocol
      if (!URLValidationService.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
        if (URLValidationService.BLOCKED_PROTOCOLS.includes(urlObj.protocol)) {
          return {
            isValid: false,
            error: `Protocol ${urlObj.protocol} is not allowed for security reasons`,
          };
        }
        return {
          isValid: false,
          error: 'URL must use http or https protocol',
        };
      }

      // Check hostname exists
      if (!urlObj.hostname) {
        return {
          isValid: false,
          error: 'URL must have a valid hostname',
        };
      }

      // Check for localhost/private IPs (security risk)
      if (this.isLocalOrPrivateURL(urlObj)) {
        return {
          isValid: false,
          error: 'URLs pointing to local or private networks are not allowed',
        };
      }

      // Perform security checks
      const securityCheck = this.checkURLSecurity(trimmed, urlObj);
      if (!securityCheck.isSafe) {
        return {
          isValid: false,
          error: `URL failed security check: ${securityCheck.threats.join(', ')}`,
        };
      }

      // Return sanitized URL
      return {
        isValid: true,
        sanitizedURL: trimmed,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }

  /**
   * Check if URL points to localhost or private network
   * 
   * @param urlObj - Parsed URL object
   * @returns True if URL is local or private
   */
  private isLocalOrPrivateURL(urlObj: URL): boolean {
    const hostname = urlObj.hostname.toLowerCase();

    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Check for IPv6 localhost (::1 or [::1])
    if (hostname === '::1' || hostname === '[::1]') {
      return true;
    }

    // Check for private IP ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    
    if (match) {
      const [, a, b, c, d] = match.map(Number);
      
      // Check private IP ranges
      // 10.0.0.0/8
      if (a === 10) return true;
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.0.0/16
      if (a === 192 && b === 168) return true;
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return true;
    }

    return false;
  }

  /**
   * Perform security checks on URL
   * 
   * @param url - Original URL string
   * @param urlObj - Parsed URL object
   * @returns Security check result with threats
   */
  private checkURLSecurity(url: string, urlObj: URL): URLSecurityCheck {
    const threats: string[] = [];

    // Check for suspicious patterns
    for (const pattern of URLValidationService.SUSPICIOUS_PATTERNS) {
      if (pattern.test(url)) {
        // Determine threat type based on pattern
        if (pattern.source.includes('\\d{1,3}')) {
          threats.push('IP address detected (potential obfuscation)');
        } else if (pattern.source.includes('{5,}')) {
          threats.push('Excessive subdomains (potential phishing)');
        } else if (pattern.source.includes('bit\\.ly')) {
          threats.push('URL shortener detected');
        } else if (pattern.source.includes('tk|ml')) {
          threats.push('Suspicious TLD');
        } else if (pattern.source.includes('[^\\x00-\\x7F]')) {
          threats.push('Non-ASCII characters (potential homograph attack)');
        } else if (pattern.source.includes('%25')) {
          threats.push('Double encoding detected');
        } else if (pattern.source.includes('login|signin')) {
          threats.push('Suspicious keywords detected');
        }
      }
    }

    // Check for mismatched protocols in path (potential phishing)
    if (urlObj.pathname.includes('http://') || urlObj.pathname.includes('https://')) {
      threats.push('URL contains protocol in path (potential phishing)');
    }

    // Check for @ symbol used for domain hiding
    // URLs like https://trusted.com@evil.com will have username set
    if (urlObj.username) {
      threats.push('@ symbol detected (potential domain hiding)');
    }

    return {
      isSafe: threats.length === 0,
      threats,
    };
  }

  /**
   * Extract metadata from URL
   * Note: This is a basic implementation that extracts metadata from the URL structure.
   * In a production environment, you might want to fetch the actual page and parse HTML meta tags.
   * 
   * @param url - The URL to extract metadata from
   * @returns URL metadata including hostname and protocol
   */
  extractMetadata(url: string): URLMetadata | null {
    try {
      const urlObj = new URL(url);

      // Extract basic metadata from URL structure
      const metadata: URLMetadata = {
        hostname: urlObj.hostname,
        protocol: urlObj.protocol,
      };

      // Try to extract a title from the URL path
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length > 0) {
        // Use the last path segment as a potential title
        const lastSegment = pathParts[pathParts.length - 1];
        // Remove file extensions and convert to readable format
        const titleCandidate = lastSegment
          .replace(/\.[^.]+$/, '') // Remove extension
          .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
          .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize words

        if (titleCandidate.length > 0 && titleCandidate.length < 100) {
          metadata.title = titleCandidate;
        }
      }

      // If no title from path, use hostname
      if (!metadata.title) {
        metadata.title = urlObj.hostname;
      }

      // Generate a basic description
      metadata.description = `Link to ${urlObj.hostname}`;

      return metadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sanitize URL by removing potentially dangerous components
   * 
   * @param url - The URL to sanitize
   * @returns Sanitized URL or null if invalid
   */
  sanitizeURL(url: string): string | null {
    try {
      // Trim whitespace
      const trimmed = url.trim();

      if (!trimmed) {
        return null;
      }

      // Check URL length
      if (trimmed.length > URLValidationService.MAX_URL_LENGTH) {
        return null;
      }

      // Parse URL
      let urlObj: URL;
      try {
        urlObj = new URL(trimmed);
      } catch (error) {
        return null;
      }

      // Check protocol
      if (!URLValidationService.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
        return null;
      }

      // Check hostname exists
      if (!urlObj.hostname) {
        return null;
      }

      // Check for localhost/private IPs
      if (this.isLocalOrPrivateURL(urlObj)) {
        return null;
      }

      // Remove username and password if present (security risk)
      urlObj.username = '';
      urlObj.password = '';

      // Perform security checks on the sanitized URL
      const securityCheck = this.checkURLSecurity(urlObj.toString(), urlObj);
      if (!securityCheck.isSafe) {
        return null;
      }

      return urlObj.toString();
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a URL is safe to share
   * This is a convenience method that combines validation and security checks
   * 
   * @param url - The URL to check
   * @returns True if URL is safe to share
   */
  isSafeURL(url: string): boolean {
    const validation = this.validateURL(url);
    return validation.isValid;
  }

  /**
   * Get detailed security information about a URL
   * 
   * @param url - The URL to analyze
   * @returns Security check result with detailed threat information
   */
  getSecurityInfo(url: string): URLSecurityCheck {
    try {
      const trimmed = url.trim();
      const urlObj = new URL(trimmed);
      return this.checkURLSecurity(trimmed, urlObj);
    } catch (error) {
      return {
        isSafe: false,
        threats: ['Invalid URL format'],
      };
    }
  }
}

export const urlValidationService = new URLValidationService();
