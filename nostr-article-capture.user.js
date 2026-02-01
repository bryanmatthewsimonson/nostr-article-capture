// ==UserScript==
// @name         NOSTR Article Capture
// @namespace    https://github.com/nostr-article-capture
// @version      1.12.0
// @updateURL    https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js
// @downloadURL  https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js
// @description  Capture articles in readability format, convert to markdown, and publish to NOSTR
// @author       Decentralized News Network
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        unsafeWindow
// @connect      localhost
// @connect      relay.damus.io
// @connect      nos.lol
// @connect      relay.nostr.band
// @connect      relay.snort.social
// @connect      nostr.wine
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  // ============================================
  // SECTION 1: CONFIGURATION
  // ============================================
  
  const CONFIG = {
    version: '1.12.0',
    debug: true,
    
    // NSecBunker settings
    nsecbunker: {
      defaultUrl: 'ws://localhost:5454',
      timeout: 30000
    },
    
    // Default NOSTR relays
    relays: [
      { url: 'wss://relay.damus.io', read: true, write: true, enabled: true },
      { url: 'wss://nos.lol', read: true, write: true, enabled: true },
      { url: 'wss://relay.nostr.band', read: true, write: true, enabled: true },
      { url: 'wss://relay.snort.social', read: true, write: true, enabled: false },
      { url: 'wss://nostr.wine', read: true, write: true, enabled: false }
    ],
    
    // UI settings
    ui: {
      fabPosition: { bottom: '20px', right: '20px' },
      panelWidth: '600px',
      panelMaxHeight: '90vh',
      theme: 'dark'
    },
    
    // Content extraction settings
    extraction: {
      minContentLength: 200,
      maxTitleLength: 200,
      maxSummaryLength: 500
    }
  };

  // ============================================
  // SECTION 2: UTILITY FUNCTIONS
  // ============================================
  
  const Utils = {
    // Generate a unique ID
    generateId: () => {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Create URL-safe slug from string
    slugify: (text) => {
      return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    },
    
    // SHA-256 hash function
    sha256: async (message) => {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    // Normalize URL for consistent hashing
    normalizeUrl: (url) => {
      try {
        const parsed = new URL(url);
        // Remove tracking parameters - comprehensive list
        const trackingParams = [
          // UTM parameters
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
          // Facebook/Meta
          'fbclid',
          // Google
          'gclid', '_ga', '_gl',
          // General referrer/source
          'ref', 'source', 'src',
          // Mailchimp
          'mc_cid', 'mc_eid',
          // Yandex
          'yclid',
          // Microsoft/Bing
          'msclkid',
          // Twitter
          'twclid',
          // Instagram
          'igshid',
          // Various share trackers
          's', 'share',
          // Ad platforms
          'campaign_id', 'ad_id', 'adset_id'
        ];
        trackingParams.forEach(param => parsed.searchParams.delete(param));
        // Remove fragment
        parsed.hash = '';
        // Lowercase hostname
        parsed.hostname = parsed.hostname.toLowerCase();
        // Remove default ports
        if ((parsed.protocol === 'https:' && parsed.port === '443') ||
            (parsed.protocol === 'http:' && parsed.port === '80')) {
          parsed.port = '';
        }
        // Remove trailing slash except for root
        let normalized = parsed.toString();
        if (normalized.endsWith('/') && parsed.pathname !== '/') {
          normalized = normalized.slice(0, -1);
        }
        return normalized;
      } catch (e) {
        return url;
      }
    },
    
    // Get canonical URL from page metadata
    getCanonicalUrl: () => {
      // Priority 1: <link rel="canonical">
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink && canonicalLink.href) {
        return canonicalLink.href;
      }
      
      // Priority 2: og:url meta tag
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl && ogUrl.content) {
        return ogUrl.content;
      }
      
      // Priority 3: twitter:url meta tag
      const twitterUrl = document.querySelector('meta[name="twitter:url"]');
      if (twitterUrl && twitterUrl.content) {
        return twitterUrl.content;
      }
      
      // Fallback: browser URL
      return window.location.href;
    },
    
    // Extract domain from URL
    getDomain: (url) => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch (e) {
        return '';
      }
    },
    
    // Format date for display
    formatDate: (timestamp) => {
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    },
    
    // Escape HTML
    escapeHtml: (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    
    // Debounce function
    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },
    
    // Log with prefix
    log: (...args) => {
      if (CONFIG.debug) {
        console.log('[NOSTR Article Capture]', ...args);
      }
    },
    
    // Error log
    error: (...args) => {
      console.error('[NOSTR Article Capture]', ...args);
    }
  };

  // ============================================
  // SECTION 3: STORAGE MANAGEMENT
  // ============================================
  
  const Storage = {
    // Get value with default
    get: async (key, defaultValue = null) => {
      try {
        const value = await GM_getValue(key, null);
        if (value === null) return defaultValue;
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch (e) {
        Utils.error('Storage get error:', e);
        return defaultValue;
      }
    },
    
    // Set value
    set: async (key, value) => {
      try {
        await GM_setValue(key, JSON.stringify(value));
        return true;
      } catch (e) {
        Utils.error('Storage set error:', e);
        return false;
      }
    },
    
    // Delete value
    delete: async (key) => {
      try {
        await GM_deleteValue(key);
        return true;
      } catch (e) {
        Utils.error('Storage delete error:', e);
        return false;
      }
    },
    
    // Get all keys
    keys: async () => {
      try {
        return await GM_listValues();
      } catch (e) {
        Utils.error('Storage keys error:', e);
        return [];
      }
    },
    
    // Initialize default storage structure
    initialize: async () => {
      const defaults = {
        publications: {},
        people: {},
        organizations: {},
        keypair_registry: {},  // New: persistent keypair storage
        preferences: {
          default_relays: CONFIG.relays.filter(r => r.enabled).map(r => r.url),
          media_handling: 'embed',  // Changed: default to embed images as base64
          theme: 'dark',
          nsecbunker_url: CONFIG.nsecbunker.defaultUrl
        },
        recent_publications: []
      };
      
      for (const [key, value] of Object.entries(defaults)) {
        const existing = await Storage.get(key);
        if (existing === null) {
          await Storage.set(key, value);
        }
      }
      
      Utils.log('Storage initialized');
    },
    
    // Publications management
    publications: {
      getAll: async () => await Storage.get('publications', {}),
      get: async (id) => {
        const pubs = await Storage.get('publications', {});
        return pubs[id] || null;
      },
      save: async (id, data) => {
        const pubs = await Storage.get('publications', {});
        pubs[id] = { ...data, updated: Math.floor(Date.now() / 1000) };
        await Storage.set('publications', pubs);
        return pubs[id];
      },
      delete: async (id) => {
        const pubs = await Storage.get('publications', {});
        delete pubs[id];
        await Storage.set('publications', pubs);
      }
    },
    
    // People management
    people: {
      getAll: async () => await Storage.get('people', {}),
      get: async (id) => {
        const people = await Storage.get('people', {});
        return people[id] || null;
      },
      save: async (id, data) => {
        const people = await Storage.get('people', {});
        people[id] = { ...data, updated: Math.floor(Date.now() / 1000) };
        await Storage.set('people', people);
        return people[id];
      },
      delete: async (id) => {
        const people = await Storage.get('people', {});
        delete people[id];
        await Storage.set('people', people);
      }
    },
    
    // Organizations management
    organizations: {
      getAll: async () => await Storage.get('organizations', {}),
      get: async (id) => {
        const orgs = await Storage.get('organizations', {});
        return orgs[id] || null;
      },
      save: async (id, data) => {
        const orgs = await Storage.get('organizations', {});
        orgs[id] = { ...data, updated: Math.floor(Date.now() / 1000) };
        await Storage.set('organizations', orgs);
        return orgs[id];
      },
      delete: async (id) => {
        const orgs = await Storage.get('organizations', {});
        delete orgs[id];
        await Storage.set('organizations', orgs);
      }
    },
    
    // Preferences management
    preferences: {
      get: async () => await Storage.get('preferences', {}),
      set: async (prefs) => await Storage.set('preferences', prefs),
      update: async (updates) => {
        const current = await Storage.get('preferences', {});
        await Storage.set('preferences', { ...current, ...updates });
      }
    },
    
    // Keypair registry management - persistent storage for all created keypairs
    keypairs: {
      getAll: async () => await Storage.get('keypair_registry', {}),
      get: async (id) => {
        const registry = await Storage.get('keypair_registry', {});
        return registry[id] || null;
      },
      save: async (id, data) => {
        const registry = await Storage.get('keypair_registry', {});
        registry[id] = {
          ...data,
          updated: Math.floor(Date.now() / 1000)
        };
        await Storage.set('keypair_registry', registry);
        Utils.log('Saved keypair to registry:', id);
        return registry[id];
      },
      delete: async (id) => {
        const registry = await Storage.get('keypair_registry', {});
        delete registry[id];
        await Storage.set('keypair_registry', registry);
      },
      // Export all keypairs as JSON for backup
      exportAll: async () => {
        const registry = await Storage.get('keypair_registry', {});
        return JSON.stringify(registry, null, 2);
      },
      // Import keypairs from JSON backup
      importAll: async (jsonStr) => {
        try {
          const imported = JSON.parse(jsonStr);
          const registry = await Storage.get('keypair_registry', {});
          const merged = { ...registry, ...imported };
          await Storage.set('keypair_registry', merged);
          Utils.log('Imported keypairs:', Object.keys(imported).length);
          return true;
        } catch (e) {
          Utils.error('Failed to import keypairs:', e);
          return false;
        }
      }
    },
    
    // Capturing user management - the person who submitted/captured the article
    capturingUser: {
      get: () => {
        return GM_getValue('nac_capturing_user', null);
      },
      set: (pubkey, npub, name) => {
        GM_setValue('nac_capturing_user', { pubkey, npub, name, enabled: true });
      },
      setEnabled: (enabled) => {
        const current = GM_getValue('nac_capturing_user', null);
        if (current) {
          GM_setValue('nac_capturing_user', { ...current, enabled });
        }
      },
      clear: () => {
        GM_deleteValue('nac_capturing_user');
      }
    }
  };

  // ============================================
  // SECTION 4: READABILITY LIBRARY (Embedded)
  // ============================================
  
  // Mozilla Readability - Simplified version
  // Full library: https://github.com/mozilla/readability
  
  class Readability {
    constructor(doc, options = {}) {
      this._doc = doc;
      this._articleTitle = null;
      this._articleByline = null;
      this._articleDir = null;
      this._articleSiteName = null;
      this._attempts = [];
      
      this._options = {
        debug: false,
        maxElemsToParse: 0,
        nbTopCandidates: 5,
        charThreshold: 500,
        classesToPreserve: [],
        keepClasses: false,
        serializer: el => el.innerHTML,
        disableJSONLD: false,
        ...options
      };
      
      this._flags = {
        FLAG_STRIP_UNLIKELYS: 0x1,
        FLAG_WEIGHT_CLASSES: 0x2,
        FLAG_CLEAN_CONDITIONALLY: 0x4
      };
      
      this._defaultFlags = this._flags.FLAG_STRIP_UNLIKELYS |
                           this._flags.FLAG_WEIGHT_CLASSES |
                           this._flags.FLAG_CLEAN_CONDITIONALLY;
    }
    
    parse() {
      // Remove script and style elements
      this._removeScripts(this._doc);
      
      // Get metadata
      const metadata = this._getArticleMetadata();
      this._articleTitle = metadata.title;
      
      // Get article content
      const articleContent = this._grabArticle();
      if (!articleContent) {
        return null;
      }
      
      // Post-process content
      this._postProcessContent(articleContent);
      
      // Get text content
      const textContent = articleContent.textContent;
      const length = textContent.length;
      
      return {
        title: this._articleTitle,
        byline: metadata.byline,
        dir: this._articleDir,
        content: articleContent.innerHTML,
        textContent: textContent,
        length: length,
        excerpt: metadata.excerpt,
        siteName: metadata.siteName
      };
    }
    
    _removeScripts(doc) {
      this._removeNodes(doc.getElementsByTagName('script'));
      this._removeNodes(doc.getElementsByTagName('noscript'));
      this._removeNodes(doc.getElementsByTagName('style'));
    }
    
    _removeNodes(nodeList) {
      for (let i = nodeList.length - 1; i >= 0; i--) {
        const node = nodeList[i];
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    }
    
    _getArticleMetadata() {
      const metadata = {
        title: '',
        byline: '',
        excerpt: '',
        siteName: ''
      };
      
      // Try to get title from various sources
      const titleElement = this._doc.querySelector('title');
      if (titleElement) {
        metadata.title = titleElement.textContent.trim();
      }
      
      // Try og:title
      const ogTitle = this._doc.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        metadata.title = ogTitle.getAttribute('content') || metadata.title;
      }
      
      // Try h1
      const h1 = this._doc.querySelector('h1');
      if (h1 && !metadata.title) {
        metadata.title = h1.textContent.trim();
      }
      
      // Get author/byline
      const authorMeta = this._doc.querySelector('meta[name="author"]') ||
                         this._doc.querySelector('meta[property="article:author"]');
      if (authorMeta) {
        metadata.byline = authorMeta.getAttribute('content');
      }
      
      // Try byline class
      const bylineElement = this._doc.querySelector('.byline, .author, [rel="author"]');
      if (bylineElement && !metadata.byline) {
        metadata.byline = bylineElement.textContent.trim();
      }
      
      // Get description/excerpt
      const descMeta = this._doc.querySelector('meta[name="description"]') ||
                       this._doc.querySelector('meta[property="og:description"]');
      if (descMeta) {
        metadata.excerpt = descMeta.getAttribute('content');
      }
      
      // Get site name
      const siteNameMeta = this._doc.querySelector('meta[property="og:site_name"]');
      if (siteNameMeta) {
        metadata.siteName = siteNameMeta.getAttribute('content');
      }
      
      return metadata;
    }
    
    _grabArticle() {
      // Clone the document to work with
      const doc = this._doc;
      
      // Try to find article element
      let articleElement = doc.querySelector('article') ||
                          doc.querySelector('[role="main"]') ||
                          doc.querySelector('.post-content') ||
                          doc.querySelector('.article-content') ||
                          doc.querySelector('.entry-content') ||
                          doc.querySelector('.content') ||
                          doc.querySelector('main');
      
      if (!articleElement) {
        // Fallback: find the element with the most paragraph text
        const paragraphs = doc.querySelectorAll('p');
        let maxLength = 0;
        let bestParent = null;
        
        paragraphs.forEach(p => {
          const parent = p.parentElement;
          if (parent) {
            const text = parent.textContent || '';
            if (text.length > maxLength) {
              maxLength = text.length;
              bestParent = parent;
            }
          }
        });
        
        articleElement = bestParent || doc.body;
      }
      
      // Clone the element
      const clone = articleElement.cloneNode(true);
      
      // Create container
      const container = doc.createElement('div');
      container.appendChild(clone);
      
      return container;
    }
    
    _postProcessContent(articleContent) {
      // Clean up the content
      this._cleanStyles(articleContent);
      
      // Remove empty elements
      const allElements = articleContent.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.tagName !== 'IMG' && el.tagName !== 'BR' && 
            el.tagName !== 'HR' && !el.textContent.trim() && 
            !el.querySelector('img')) {
          el.remove();
        }
      });
      
      // Remove unwanted elements
      const unwanted = ['nav', 'aside', 'footer', 'header', '.sidebar', '.comments', '.advertisement', '.ad', '.social-share'];
      unwanted.forEach(selector => {
        try {
          const elements = articleContent.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        } catch (e) {
          // Invalid selector, skip
        }
      });
    }
    
    _cleanStyles(element) {
      element.removeAttribute('style');
      element.removeAttribute('class');
      element.removeAttribute('id');
      
      Array.from(element.children).forEach(child => {
        this._cleanStyles(child);
      });
    }
  }

  // ============================================
  // SECTION 5: TURNDOWN LIBRARY (Embedded)
  // ============================================
  
  // Turndown - HTML to Markdown converter
  // Simplified version based on: https://github.com/mixmark-io/turndown
  
  class TurndownService {
    constructor(options = {}) {
      this.options = {
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full',
        ...options
      };
      
      this.rules = this._defaultRules();
      this.customRules = [];
    }
    
    _defaultRules() {
      return {
        paragraph: {
          filter: 'p',
          replacement: (content) => '\n\n' + content + '\n\n'
        },
        lineBreak: {
          filter: 'br',
          replacement: () => '\n'
        },
        heading: {
          filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
          replacement: (content, node) => {
            const level = parseInt(node.tagName.charAt(1));
            const prefix = '#'.repeat(level);
            return '\n\n' + prefix + ' ' + content + '\n\n';
          }
        },
        blockquote: {
          filter: 'blockquote',
          replacement: (content) => {
            const lines = content.trim().split('\n');
            return '\n\n' + lines.map(line => '> ' + line).join('\n') + '\n\n';
          }
        },
        list: {
          filter: ['ul', 'ol'],
          replacement: (content, node) => {
            const isOrdered = node.tagName === 'OL';
            const items = Array.from(node.children);
            let result = '\n\n';
            
            items.forEach((item, index) => {
              const prefix = isOrdered ? `${index + 1}. ` : `${this.options.bulletListMarker} `;
              const itemContent = this._processNode(item).trim();
              result += prefix + itemContent + '\n';
            });
            
            return result + '\n';
          }
        },
        listItem: {
          filter: 'li',
          replacement: (content) => content
        },
        horizontalRule: {
          filter: 'hr',
          replacement: () => '\n\n' + this.options.hr + '\n\n'
        },
        emphasis: {
          filter: ['em', 'i'],
          replacement: (content) => this.options.emDelimiter + content + this.options.emDelimiter
        },
        strong: {
          filter: ['strong', 'b'],
          replacement: (content) => this.options.strongDelimiter + content + this.options.strongDelimiter
        },
        code: {
          filter: 'code',
          replacement: (content, node) => {
            if (node.parentNode && node.parentNode.tagName === 'PRE') {
              return content;
            }
            return '`' + content + '`';
          }
        },
        pre: {
          filter: 'pre',
          replacement: (content) => {
            return '\n\n' + this.options.fence + '\n' + content + '\n' + this.options.fence + '\n\n';
          }
        },
        link: {
          filter: 'a',
          replacement: (content, node) => {
            const href = node.getAttribute('href');
            const title = node.getAttribute('title');
            if (!href) return content;
            
            let titlePart = title ? ` "${title}"` : '';
            return `[${content}](${href}${titlePart})`;
          }
        },
        image: {
          filter: 'img',
          replacement: (content, node) => {
            const alt = node.getAttribute('alt') || '';
            const src = node.getAttribute('src') || '';
            const title = node.getAttribute('title');
            if (!src) return '';
            
            let titlePart = title ? ` "${title}"` : '';
            return `![${alt}](${src}${titlePart})`;
          }
        }
      };
    }
    
    addRule(name, rule) {
      this.customRules.push({ name, ...rule });
    }
    
    turndown(html) {
      // Parse HTML
      const doc = new DOMParser().parseFromString(html, 'text/html');
      
      // Process the body
      let markdown = this._processNode(doc.body);
      
      // Clean up
      markdown = markdown
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/g, '')
        .trim();
      
      return markdown;
    }
    
    _processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.replace(/\s+/g, ' ');
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      
      // Get content of children first
      let content = Array.from(node.childNodes)
        .map(child => this._processNode(child))
        .join('');
      
      // Check custom rules first
      for (const rule of this.customRules) {
        if (this._matchesFilter(node, rule.filter)) {
          return rule.replacement(content, node);
        }
      }
      
      // Check default rules
      for (const [name, rule] of Object.entries(this.rules)) {
        if (this._matchesFilter(node, rule.filter)) {
          return rule.replacement(content, node);
        }
      }
      
      // Default: return content
      return content;
    }
    
    _matchesFilter(node, filter) {
      if (typeof filter === 'string') {
        return node.tagName.toLowerCase() === filter.toLowerCase();
      }
      if (Array.isArray(filter)) {
        return filter.some(f => node.tagName.toLowerCase() === f.toLowerCase());
      }
      if (typeof filter === 'function') {
        return filter(node);
      }
      return false;
    }
  }

  // ============================================
  // SECTION 6: CONTENT PROCESSOR
  // ============================================
  
  const ContentProcessor = {
    // Extract article using Readability
    extractArticle: () => {
      const documentClone = document.cloneNode(true);
      const reader = new Readability(documentClone);
      const article = reader.parse();
      
      if (!article || article.length < CONFIG.extraction.minContentLength) {
        Utils.log('Readability extraction failed or content too short');
        return null;
      }
      
      // Add additional metadata - use canonical URL when available
      const canonicalUrl = Utils.getCanonicalUrl();
      article.url = Utils.normalizeUrl(canonicalUrl);
      article.sourceUrl = window.location.href; // Keep original browser URL for reference
      article.urlSource = canonicalUrl !== window.location.href ? 'canonical' : 'browser';
      article.domain = Utils.getDomain(article.url);
      article.extractedAt = Math.floor(Date.now() / 1000);
      
      // Try to get publication date
      article.publishedAt = ContentProcessor.extractPublishedDate();
      
      // Try to get featured image
      article.featuredImage = ContentProcessor.extractFeaturedImage();
      
      Utils.log('Article extracted:', article.title);
      return article;
    },
    
    // Extract published date from meta tags
    extractPublishedDate: () => {
      const selectors = [
        'meta[property="article:published_time"]',
        'meta[name="publication_date"]',
        'meta[name="date"]',
        'time[datetime]',
        '.published-date',
        '.post-date'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const date = element.getAttribute('content') || 
                       element.getAttribute('datetime') ||
                       element.textContent;
          if (date) {
            try {
              return Math.floor(new Date(date).getTime() / 1000);
            } catch (e) {
              continue;
            }
          }
        }
      }
      
      return null;
    },
    
    // Extract featured image
    extractFeaturedImage: () => {
      const selectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'article img',
        '.featured-image img',
        '.post-thumbnail img'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const src = element.getAttribute('content') || element.getAttribute('src');
          if (src) {
            // Convert relative URL to absolute
            try {
              return new URL(src, window.location.href).href;
            } catch (e) {
              continue;
            }
          }
        }
      }
      
      return null;
    },
    
    // Convert HTML to Markdown
    htmlToMarkdown: (html) => {
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        emDelimiter: '*'
      });
      
      // Add custom rule for figures
      turndownService.addRule('figure', {
        filter: 'figure',
        replacement: (content, node) => {
          const img = node.querySelector('img');
          const figcaption = node.querySelector('figcaption');
          
          if (img) {
            const alt = img.getAttribute('alt') || '';
            const src = img.getAttribute('src') || '';
            const caption = figcaption ? figcaption.textContent.trim() : '';
            
            let result = `![${alt}](${src})`;
            if (caption) {
              result += `\n*${caption}*`;
            }
            return '\n\n' + result + '\n\n';
          }
          
          return content;
        }
      });
      
      return turndownService.turndown(html);
    },
    
    // Extract all media from content
    extractMedia: (html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const images = Array.from(doc.querySelectorAll('img')).map(img => ({
        type: 'image',
        src: img.src,
        alt: img.alt || '',
        title: img.title || ''
      }));
      
      const videos = Array.from(doc.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]')).map(v => ({
        type: 'video',
        src: v.src || (v.querySelector('source') ? v.querySelector('source').src : ''),
        platform: v.src && v.src.includes('youtube') ? 'youtube' : 
                  v.src && v.src.includes('vimeo') ? 'vimeo' : 'native'
      }));
      
      return { images, videos };
    },
    
    // Convert image URL to base64 data URL
    imageToBase64: async (imageUrl) => {
      return new Promise((resolve, reject) => {
        try {
          // Make absolute URL if relative
          const absoluteUrl = new URL(imageUrl, window.location.href).href;
          Utils.log('Converting image to base64:', absoluteUrl);
          
          // Use GM_xmlhttpRequest for cross-origin images
          GM_xmlhttpRequest({
            method: 'GET',
            url: absoluteUrl,
            responseType: 'blob',
            timeout: 30000,
            onload: (response) => {
              if (response.status >= 200 && response.status < 300) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = reader.result;
                  Utils.log('Image converted to base64, length:', base64.length);
                  resolve(base64);
                };
                reader.onerror = () => {
                  Utils.error('FileReader error for image:', absoluteUrl);
                  resolve(absoluteUrl); // Fallback to original URL
                };
                reader.readAsDataURL(response.response);
              } else {
                Utils.error('Failed to fetch image:', response.status, absoluteUrl);
                resolve(absoluteUrl); // Fallback to original URL
              }
            },
            onerror: (error) => {
              Utils.error('GM_xmlhttpRequest error for image:', absoluteUrl, error);
              resolve(absoluteUrl); // Fallback to original URL
            },
            ontimeout: () => {
              Utils.error('Timeout fetching image:', absoluteUrl);
              resolve(absoluteUrl); // Fallback to original URL
            }
          });
        } catch (e) {
          Utils.error('Error converting image to base64:', e);
          resolve(imageUrl); // Fallback to original URL
        }
      });
    },
    
    // Embed all images in markdown as base64
    embedImagesInMarkdown: async (markdown, progressCallback) => {
      // Find all markdown image references
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const matches = [...markdown.matchAll(imageRegex)];
      
      if (matches.length === 0) {
        return markdown;
      }
      
      Utils.log('Found', matches.length, 'images to embed');
      let result = markdown;
      
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const [fullMatch, alt, url] = match;
        
        if (progressCallback) {
          progressCallback(i + 1, matches.length);
        }
        
        // Skip if already a data URL
        if (url.startsWith('data:')) {
          continue;
        }
        
        // Skip very large images or external CDNs that might fail
        // Convert to base64
        const base64 = await ContentProcessor.imageToBase64(url);
        
        // Only replace if we got a base64 result
        if (base64 && base64.startsWith('data:')) {
          result = result.replace(fullMatch, `![${alt}](${base64})`);
          Utils.log('Embedded image', i + 1, '/', matches.length);
        }
      }
      
      return result;
    },
    
    // Extract people quoted and organizations referenced from article content
    extractEntities: (content, textContent) => {
      const entities = {
        people: [],
        organizations: []
      };
      
      // Helper function to validate person names
      const isValidPersonName = (name) => {
        if (!name || name.length < 3) return false;
        // Must have at least two parts (first and last name)
        const parts = name.trim().split(/\s+/);
        if (parts.length < 2) return false;
        // Each part should start with capital letter
        const validParts = parts.every(part => /^[A-Z][a-zA-Z'-]+$/.test(part));
        if (!validParts) return false;
        // Filter common false positives
        const skipWords = ['The', 'This', 'That', 'These', 'Those', 'When', 'Where', 'What', 'Which', 'While', 'After', 'Before', 'During', 'According', 'However', 'Meanwhile', 'Furthermore', 'Therefore', 'Nevertheless'];
        if (skipWords.some(word => parts[0] === word)) return false;
        return true;
      };
      
      // Pattern 1: Attribution patterns like "said John Smith" or "John Smith said"
      const quotePatterns = [
        // "said John Smith", "told reporters Jane Doe"
        /(?:said|told|explained|stated|noted|added|confirmed|denied|claimed|argued|suggested|announced|revealed|warned|emphasized|insisted|acknowledged|admitted|declared|mentioned|reported|described|commented|responded|replied|asked|questioned|wondered|believed|thought|felt|expressed)\s+(?:that\s+)?([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/gi,
        // "John Smith said", "Jane Doe told reporters"
        /([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)\s+(?:said|told|explained|stated|noted|added|confirmed|denied|claimed|argued|suggested|announced|revealed|warned|emphasized|insisted|acknowledged|admitted|declared|mentioned|reported|described|commented|responded|replied|asked|questioned|wondered|believed|thought|felt|expressed)/gi,
        // "according to John Smith"
        /according\s+to\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/gi,
        // "Dr. John Smith" or "Prof. Jane Doe" (with titles)
        /(?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.|Sen\.|Rep\.|Gov\.|Pres\.|Gen\.|Col\.|Capt\.)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)*)/gi
      ];
      
      // Extract quoted people
      const foundPeople = new Set();
      for (const pattern of quotePatterns) {
        let match;
        const text = textContent || content.replace(/<[^>]+>/g, ' ');
        while ((match = pattern.exec(text)) !== null) {
          const name = match[1].trim();
          if (isValidPersonName(name) && !foundPeople.has(name.toLowerCase())) {
            foundPeople.add(name.toLowerCase());
            entities.people.push({
              name: name,
              context: 'quoted'
            });
          }
        }
      }
      
      // Pattern 2: Organization patterns
      const orgPatterns = [
        // Organizations with indicators like Inc., Corp., LLC, etc.
        /([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)\s+(?:Inc\.|Corp\.|Corporation|LLC|Ltd\.|Company|Co\.|Group|Foundation|Institute|Association|Organization|Agency|Department|Ministry|Commission|Committee|Council|Board|Authority|Bureau|Office|Center|Centre|University|College|School|Hospital|Bank|Fund|Trust)/gi,
        // "the FBI", "the CIA", "the Department of X"
        /(?:the\s+)?([A-Z]{2,})\b/g,
        // "Department of X", "Ministry of Y"
        /(?:Department|Ministry|Office|Bureau|Agency)\s+of\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)/gi,
        // "University of X", "X University"
        /(?:([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)\s+University|University\s+of\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*))/gi
      ];
      
      // Extract organizations
      const foundOrgs = new Set();
      const skipOrgs = ['The', 'This', 'That', 'And', 'But', 'For', 'Not', 'You', 'All', 'Can', 'Had', 'Her', 'Was', 'One', 'Our', 'Out'];
      
      for (const pattern of orgPatterns) {
        let match;
        const text = textContent || content.replace(/<[^>]+>/g, ' ');
        while ((match = pattern.exec(text)) !== null) {
          const org = (match[1] || match[2] || '').trim();
          if (org && org.length >= 2 && !foundOrgs.has(org.toLowerCase()) && !skipOrgs.includes(org)) {
            // Skip if it looks like a person name (2-3 words with common name patterns)
            if (isValidPersonName(org)) continue;
            foundOrgs.add(org.toLowerCase());
            entities.organizations.push({
              name: org
            });
          }
        }
      }
      
      Utils.log('Extracted entities:', entities);
      return entities;
    }
  };

  // ============================================
  // SECTION 7: STYLES
  // ============================================
  
  const STYLES = `
    /* CSS Variables */
    :root {
      --nac-primary: #6366f1;
      --nac-primary-hover: #4f46e5;
      --nac-secondary: #8b5cf6;
      --nac-success: #22c55e;
      --nac-warning: #f59e0b;
      --nac-error: #ef4444;
      --nac-background: #1e1e2e;
      --nac-surface: #2a2a3e;
      --nac-surface-hover: #353550;
      --nac-border: #3f3f5a;
      --nac-text: #e2e8f0;
      --nac-text-muted: #94a3b8;
      --nac-text-dim: #64748b;
      --nac-shadow: rgba(0, 0, 0, 0.3);
    }
    
    /* Reset for our elements */
    .nac-reset * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    /* Floating Action Button */
    .nac-fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--nac-primary);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px var(--nac-shadow);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      transition: all 0.3s ease;
    }
    
    .nac-fab:hover {
      background: var(--nac-primary-hover);
      transform: scale(1.05);
      box-shadow: 0 6px 16px var(--nac-shadow);
    }
    
    .nac-fab:active {
      transform: scale(0.95);
    }
    
    .nac-fab.active {
      background: var(--nac-success);
    }
    
    .nac-fab svg {
      width: 24px;
      height: 24px;
      fill: white;
    }
    
    /* Main Panel */
    .nac-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 700px;
      max-height: 90vh;
      background: var(--nac-background);
      border-radius: 12px;
      box-shadow: 0 20px 60px var(--nac-shadow);
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
      color: var(--nac-text);
    }
    
    .nac-panel.visible {
      display: flex;
    }
    
    /* Panel Header */
    .nac-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--nac-surface);
      border-bottom: 1px solid var(--nac-border);
    }
    
    .nac-panel-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--nac-text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .nac-panel-title svg {
      width: 20px;
      height: 20px;
      fill: var(--nac-primary);
    }
    
    .nac-panel-controls {
      display: flex;
      gap: 8px;
    }
    
    .nac-btn-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--nac-text-muted);
      transition: all 0.2s ease;
    }
    
    .nac-btn-icon:hover {
      background: var(--nac-surface-hover);
      color: var(--nac-text);
    }
    
    .nac-btn-icon svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    
    /* Tab Bar */
    .nac-tabs {
      display: flex;
      padding: 12px 20px;
      gap: 8px;
      background: var(--nac-surface);
      border-bottom: 1px solid var(--nac-border);
    }
    
    .nac-tab {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--nac-text-muted);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .nac-tab:hover {
      background: var(--nac-surface-hover);
      color: var(--nac-text);
    }
    
    .nac-tab.active {
      background: var(--nac-primary);
      color: white;
    }
    
    .nac-tab-spacer {
      flex: 1;
    }
    
    .nac-btn-copy {
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-surface);
      color: var(--nac-text-muted);
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    
    .nac-btn-copy:hover {
      background: var(--nac-surface-hover);
      color: var(--nac-text);
      border-color: var(--nac-primary);
    }
    
    .nac-btn-copy svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
    
    /* Content Area */
    .nac-content {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 20px;
      min-height: 150px;
      max-height: 50vh;
    }
    
    .nac-content-readable {
      font-size: 16px;
      line-height: 1.7;
      color: var(--nac-text);
    }
    
    .nac-content-readable h1,
    .nac-content-readable h2,
    .nac-content-readable h3 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
    }
    
    .nac-content-readable h1 { font-size: 1.8em; }
    .nac-content-readable h2 { font-size: 1.4em; }
    .nac-content-readable h3 { font-size: 1.2em; }
    
    .nac-content-readable p {
      margin-bottom: 1em;
    }
    
    .nac-content-readable img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1em 0;
    }
    
    .nac-content-readable blockquote {
      border-left: 3px solid var(--nac-primary);
      padding-left: 1em;
      margin: 1em 0;
      color: var(--nac-text-muted);
    }
    
    .nac-content-readable a {
      color: var(--nac-primary);
      text-decoration: none;
    }
    
    .nac-content-readable a:hover {
      text-decoration: underline;
    }
    
    .nac-content-markdown {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: var(--nac-text-muted);
      background: var(--nac-surface);
      padding: 16px;
      border-radius: 8px;
    }
    
    .nac-article-meta {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--nac-border);
    }
    
    .nac-article-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--nac-text);
    }
    
    .nac-article-info {
      font-size: 14px;
      color: var(--nac-text-muted);
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    
    .nac-article-info span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    /* URL Source Info - shown when canonical differs from browser URL */
    .nac-url-source-info {
      margin-top: 12px;
      padding: 10px;
      background: var(--nac-surface);
      border-radius: 6px;
      font-size: 12px;
    }
    
    .nac-url-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
    }
    
    .nac-url-item:last-child {
      margin-bottom: 0;
    }
    
    .nac-url-label {
      color: var(--nac-text-muted);
      white-space: nowrap;
      font-weight: 500;
    }
    
    .nac-url-value {
      color: var(--nac-text);
      word-break: break-all;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 11px;
    }
    
    .nac-url-canonical .nac-url-label {
      color: var(--nac-success);
    }
    
    .nac-url-browser .nac-url-value {
      color: var(--nac-text-dim);
      text-decoration: line-through;
      opacity: 0.7;
    }
    
    /* Publish Section */
    .nac-publish {
      padding: 20px;
      background: var(--nac-surface);
      border-top: 1px solid var(--nac-border);
    }
    
    .nac-publish-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--nac-text-muted);
      margin-bottom: 16px;
      text-align: center;
    }
    
    .nac-form-group {
      margin-bottom: 16px;
    }
    
    .nac-form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--nac-text);
      margin-bottom: 6px;
    }
    
    .nac-form-input,
    .nac-form-select {
      width: 100%;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-background);
      color: var(--nac-text);
      font-size: 14px;
      transition: all 0.2s ease;
    }
    
    .nac-form-input:focus,
    .nac-form-select:focus {
      outline: none;
      border-color: var(--nac-primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    
    .nac-form-select {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 36px;
    }
    
    .nac-form-row {
      display: flex;
      gap: 12px;
    }
    
    .nac-form-row .nac-form-group {
      flex: 1;
    }
    
    /* Tags Input */
    .nac-tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--nac-border);
      border-radius: 6px;
      background: var(--nac-background);
      min-height: 42px;
    }
    
    .nac-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--nac-primary);
      color: white;
      border-radius: 4px;
      font-size: 12px;
    }
    
    .nac-tag-remove {
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    
    .nac-tag-remove:hover {
      opacity: 1;
    }
    
    .nac-tag-input {
      flex: 1;
      min-width: 80px;
      border: none;
      background: transparent;
      color: var(--nac-text);
      font-size: 14px;
      outline: none;
    }
    
    /* Checkbox/Radio */
    .nac-checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .nac-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 13px;
      color: var(--nac-text);
    }
    
    .nac-checkbox input {
      appearance: none;
      width: 18px;
      height: 18px;
      border: 2px solid var(--nac-border);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .nac-checkbox input:checked {
      background: var(--nac-primary);
      border-color: var(--nac-primary);
    }
    
    .nac-checkbox input:checked::after {
      content: '✓';
      display: block;
      text-align: center;
      color: white;
      font-size: 12px;
      line-height: 14px;
    }
    
    .nac-radio-group {
      display: flex;
      gap: 16px;
    }
    
    .nac-radio {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 13px;
      color: var(--nac-text);
    }
    
    .nac-radio input {
      appearance: none;
      width: 18px;
      height: 18px;
      border: 2px solid var(--nac-border);
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .nac-radio input:checked {
      border-color: var(--nac-primary);
      background: radial-gradient(circle, var(--nac-primary) 40%, transparent 40%);
    }
    
    /* Buttons */
    .nac-btn {
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .nac-btn-primary {
      background: var(--nac-primary);
      color: white;
      width: 100%;
    }
    
    .nac-btn-primary:hover {
      background: var(--nac-primary-hover);
    }
    
    .nac-btn-primary:disabled {
      background: var(--nac-border);
      cursor: not-allowed;
    }
    
    .nac-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
    
    /* Collapsible Section */
    .nac-collapsible {
      border: 1px solid var(--nac-border);
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    
    .nac-collapsible-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: var(--nac-surface-hover);
      cursor: pointer;
      user-select: none;
    }
    
    .nac-collapsible-header:hover {
      background: var(--nac-border);
    }
    
    .nac-collapsible-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--nac-text);
    }
    
    .nac-collapsible-icon {
      transition: transform 0.2s ease;
    }
    
    .nac-collapsible.open .nac-collapsible-icon {
      transform: rotate(180deg);
    }
    
    .nac-collapsible-content {
      padding: 12px;
      display: none;
    }
    
    .nac-collapsible.open .nac-collapsible-content {
      display: block;
    }
    
    /* Overlay */
    .nac-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 2147483645;
      display: none;
    }
    
    .nac-overlay.visible {
      display: block;
    }
    
    /* Toast notifications */
    .nac-toast {
      position: fixed;
      bottom: 100px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      background: var(--nac-surface);
      color: var(--nac-text);
      font-size: 14px;
      box-shadow: 0 4px 12px var(--nac-shadow);
      z-index: 2147483648;
      display: flex;
      align-items: center;
      gap: 10px;
      transform: translateX(120%);
      transition: transform 0.3s ease;
    }
    
    .nac-toast.visible {
      transform: translateX(0);
    }
    
    .nac-toast.success {
      border-left: 4px solid var(--nac-success);
    }
    
    .nac-toast.error {
      border-left: 4px solid var(--nac-error);
    }
    
    .nac-toast.warning {
      border-left: 4px solid var(--nac-warning);
    }
    
    /* Loading spinner */
    .nac-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--nac-border);
      border-top-color: var(--nac-primary);
      border-radius: 50%;
      animation: nac-spin 0.8s linear infinite;
    }
    
    @keyframes nac-spin {
      to { transform: rotate(360deg); }
    }
    
    /* Empty state */
    .nac-empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--nac-text-muted);
    }
    
    .nac-empty svg {
      width: 48px;
      height: 48px;
      fill: var(--nac-border);
      margin-bottom: 16px;
    }
    
    .nac-empty-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--nac-text);
    }
    
    .nac-empty-text {
      font-size: 14px;
    }
    
    /* NSecBunker status indicator */
    .nac-bunker-status {
      display: inline-flex;
      align-items: center;
      margin-left: 8px;
    }
    
    .nac-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    
    .nac-status-dot.connected {
      background: var(--nac-success);
      box-shadow: 0 0 6px var(--nac-success);
    }
    
    .nac-status-dot.disconnected {
      background: var(--nac-text-dim);
    }
    
    .nac-status-dot.connecting {
      background: var(--nac-warning);
      animation: nac-pulse 1s infinite;
    }
    
    @keyframes nac-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    /* Metadata Posting UI Styles */
    .nac-metadata-type-selector {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    
    .nac-type-btn {
      flex: 1;
      padding: 12px 8px;
      border: 2px solid var(--nac-border);
      border-radius: 8px;
      background: var(--nac-surface);
      color: var(--nac-text-muted);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      text-align: center;
    }
    
    .nac-type-btn:hover {
      background: var(--nac-surface-hover);
      color: var(--nac-text);
      border-color: var(--nac-text-muted);
    }
    
    .nac-type-btn.active {
      border-color: var(--nac-primary);
      background: rgba(99, 102, 241, 0.1);
      color: var(--nac-primary);
    }
    
    .nac-type-btn-icon {
      font-size: 20px;
    }
    
    .nac-type-btn-label {
      font-size: 11px;
    }
    
    .nac-url-info {
      padding: 12px;
      background: var(--nac-surface);
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    
    .nac-url-info-label {
      font-size: 11px;
      color: var(--nac-text-muted);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .nac-url-info-value {
      color: var(--nac-text);
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
    }
    
    .nac-url-info-hash {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--nac-border);
      color: var(--nac-text-muted);
      font-size: 11px;
    }
    
    .nac-confidence-slider {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .nac-confidence-slider input[type="range"] {
      flex: 1;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--nac-border);
      border-radius: 3px;
      outline: none;
    }
    
    .nac-confidence-slider input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--nac-primary);
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .nac-confidence-slider input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }
    
    .nac-confidence-value {
      min-width: 45px;
      text-align: right;
      font-weight: 600;
      color: var(--nac-primary);
    }
    
    .nac-evidence-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .nac-evidence-item {
      padding: 12px;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 8px;
    }
    
    .nac-evidence-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .nac-evidence-item-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--nac-text-muted);
    }
    
    .nac-evidence-remove {
      padding: 4px 8px;
      font-size: 11px;
      color: var(--nac-error);
      background: transparent;
      border: 1px solid var(--nac-error);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .nac-evidence-remove:hover {
      background: var(--nac-error);
      color: white;
    }
    
    .nac-evidence-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .nac-evidence-row:last-child {
      margin-bottom: 0;
    }
    
    .nac-evidence-row .nac-form-input {
      flex: 2;
    }
    
    .nac-evidence-row .nac-form-select {
      flex: 1;
    }
    
    .nac-add-evidence {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px;
      border: 2px dashed var(--nac-border);
      border-radius: 8px;
      background: transparent;
      color: var(--nac-text-muted);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
    }
    
    .nac-add-evidence:hover {
      border-color: var(--nac-primary);
      color: var(--nac-primary);
      background: rgba(99, 102, 241, 0.05);
    }
    
    .nac-verdict-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .nac-verdict-option {
      flex: 1;
      min-width: 100px;
    }
    
    .nac-verdict-option input {
      display: none;
    }
    
    .nac-verdict-option label {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 8px;
      border: 2px solid var(--nac-border);
      border-radius: 8px;
      background: var(--nac-surface);
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }
    
    .nac-verdict-option label:hover {
      background: var(--nac-surface-hover);
    }
    
    .nac-verdict-option input:checked + label {
      border-color: var(--nac-primary);
      background: rgba(99, 102, 241, 0.1);
    }
    
    .nac-verdict-option.verdict-true input:checked + label {
      border-color: var(--nac-success);
      background: rgba(34, 197, 94, 0.1);
    }
    
    .nac-verdict-option.verdict-partially-true input:checked + label {
      border-color: var(--nac-warning);
      background: rgba(245, 158, 11, 0.1);
    }
    
    .nac-verdict-option.verdict-false input:checked + label {
      border-color: var(--nac-error);
      background: rgba(239, 68, 68, 0.1);
    }
    
    .nac-verdict-option.verdict-unverifiable input:checked + label {
      border-color: var(--nac-text-muted);
      background: rgba(148, 163, 184, 0.1);
    }
    
    .nac-verdict-icon {
      font-size: 20px;
    }
    
    .nac-verdict-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--nac-text);
    }
    
    /* Emoji Picker Styles */
    .nac-emoji-picker {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px;
      background: var(--nac-surface);
      border-radius: 8px;
    }

    .nac-emoji-btn {
      width: 44px;
      height: 44px;
      font-size: 24px;
      background: var(--nac-background);
      border: 2px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .nac-emoji-btn:hover {
      background: var(--nac-surface-hover);
      transform: scale(1.1);
    }

    .nac-emoji-btn.active {
      border-color: var(--nac-primary);
      background: rgba(111, 66, 193, 0.15);
    }

    /* Input with Button Styles */
    .nac-input-with-btn {
      display: flex;
      gap: 8px;
    }

    .nac-input-with-btn .nac-form-input {
      flex: 1;
    }

    .nac-fetch-btn {
      padding: 8px 12px;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      transition: background 0.15s ease;
    }

    .nac-fetch-btn:hover {
      background: var(--nac-surface-hover);
    }

    .nac-fetch-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Relevance Slider Styles */
    .nac-relevance-slider {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .nac-form-range {
      flex: 1;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--nac-surface);
      border-radius: 3px;
      outline: none;
    }

    .nac-form-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      background: var(--nac-primary);
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.15s ease;
    }

    .nac-form-range::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }

    .nac-form-range::-moz-range-thumb {
      width: 18px;
      height: 18px;
      background: var(--nac-primary);
      border: none;
      border-radius: 50%;
      cursor: pointer;
    }

    .nac-relevance-value {
      min-width: 45px;
      font-size: 14px;
      font-weight: 600;
      color: var(--nac-primary);
      text-align: right;
    }

    /* Rating Grid Styles */
    .nac-rating-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 16px;
    }

    @media (max-width: 600px) {
      .nac-rating-grid {
        grid-template-columns: 1fr;
      }
    }

    .nac-rating-dimension {
      background: var(--nac-surface);
      padding: 12px;
      border-radius: 8px;
    }

    .nac-rating-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--nac-text);
      margin-bottom: 6px;
    }

    .nac-rating-slider {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .nac-rating-value {
      min-width: 25px;
      font-size: 16px;
      font-weight: 700;
      color: var(--nac-primary);
      text-align: center;
    }

    .nac-rating-help {
      font-size: 11px;
      color: var(--nac-text-secondary);
      margin-top: 4px;
    }

    .nac-confidence-slider {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .nac-confidence-value {
      min-width: 45px;
      font-size: 14px;
      font-weight: 600;
      color: var(--nac-primary);
      text-align: right;
    }

    /* Required field indicator */
    .nac-required {
      color: var(--nac-error);
    }

    .nac-event-preview {
      margin-top: 16px;
      padding: 16px;
      background: var(--nac-surface);
      border-radius: 8px;
      border: 1px solid var(--nac-border);
    }
    
    .nac-event-preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .nac-event-preview-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--nac-text-muted);
    }
    
    .nac-event-preview-toggle {
      padding: 4px 10px;
      font-size: 11px;
      color: var(--nac-text-muted);
      background: transparent;
      border: 1px solid var(--nac-border);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .nac-event-preview-toggle:hover {
      background: var(--nac-surface-hover);
      color: var(--nac-text);
    }
    
    .nac-event-preview-json {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 11px;
      line-height: 1.5;
      color: var(--nac-text-muted);
      background: var(--nac-background);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .nac-headline-original {
      padding: 12px;
      background: var(--nac-surface);
      border-radius: 8px;
      border: 1px solid var(--nac-border);
      margin-bottom: 8px;
    }
    
    .nac-headline-original-text {
      font-size: 14px;
      color: var(--nac-text);
      line-height: 1.4;
    }
    
    .nac-headline-edit-btn {
      margin-top: 8px;
      padding: 4px 10px;
      font-size: 11px;
      color: var(--nac-text-muted);
      background: transparent;
      border: 1px solid var(--nac-border);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .nac-headline-edit-btn:hover {
      background: var(--nac-surface-hover);
      color: var(--nac-text);
    }
    
    .nac-form-textarea {
      width: 100%;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-background);
      color: var(--nac-text);
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
      transition: all 0.2s ease;
    }
    
    .nac-form-textarea:focus {
      outline: none;
      border-color: var(--nac-primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    
    .nac-char-count {
      font-size: 11px;
      color: var(--nac-text-muted);
      text-align: right;
      margin-top: 4px;
    }
    
    .nac-char-count.warning {
      color: var(--nac-warning);
    }
    
    .nac-char-count.error {
      color: var(--nac-error);
    }
    
    .nac-metadata-form {
      display: none;
    }
    
    .nac-metadata-form.active {
      display: block;
    }
    
    .nac-metadata-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }
    
    .nac-btn-secondary {
      padding: 12px 24px;
      border-radius: 8px;
      border: 1px solid var(--nac-border);
      background: transparent;
      color: var(--nac-text-muted);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .nac-btn-secondary:hover {
      background: var(--nac-surface-hover);
      color: var(--nac-text);
    }
    
    .nac-metadata-tab-content {
      padding: 20px;
    }
    
    .nac-form-hint {
      font-size: 11px;
      color: var(--nac-text-dim);
      margin-top: 4px;
    }
    
    /* Publishing Options Section */
    .nac-publishing-options {
      margin: 15px 0;
      border: 1px solid var(--nac-border);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .nac-options-header {
      padding: 10px 15px;
      background: var(--nac-surface);
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--nac-text);
      user-select: none;
    }
    
    .nac-options-header:hover {
      background: var(--nac-surface-hover);
    }
    
    .nac-toggle-icon {
      transition: transform 0.2s ease;
      font-size: 10px;
    }
    
    .nac-publishing-options.expanded .nac-toggle-icon {
      transform: rotate(180deg);
    }
    
    .nac-options-content {
      padding: 15px;
      display: none;
      background: var(--nac-background);
      border-top: 1px solid var(--nac-border);
    }
    
    .nac-publishing-options.expanded .nac-options-content {
      display: block;
    }
    
    .nac-option-row {
      margin: 12px 0;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .nac-option-row:first-child {
      margin-top: 0;
    }
    
    .nac-option-row:last-child {
      margin-bottom: 0;
    }
    
    .nac-option-row label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--nac-text);
      cursor: pointer;
    }
    
    .nac-option-row label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    
    .nac-option-row label input[type="checkbox"]:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    
    .nac-option-row input[type="text"] {
      flex: 1;
      min-width: 200px;
      padding: 6px 10px;
      border: 1px solid var(--nac-border);
      border-radius: 4px;
      background: var(--nac-surface);
      color: var(--nac-text);
      font-size: 13px;
    }
    
    .nac-option-row input[type="text"]:focus {
      outline: none;
      border-color: var(--nac-primary);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }
    
    .nac-option-row button {
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      border: 1px solid var(--nac-border);
      background: var(--nac-surface);
      color: var(--nac-text);
      transition: all 0.2s ease;
    }
    
    .nac-option-row button:hover {
      background: var(--nac-surface-hover);
      border-color: var(--nac-primary);
    }
    
    .nac-option-row .nac-pubkey-display {
      font-size: 12px;
      color: var(--nac-text-muted);
      font-family: monospace;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .nac-option-row .nac-name-display {
      font-size: 13px;
      color: var(--nac-text);
      font-weight: 500;
    }
    
    .nac-option-row .nac-not-set {
      font-size: 12px;
      color: var(--nac-text-dim);
      font-style: italic;
    }
    
    .nac-option-description {
      font-size: 11px;
      color: var(--nac-text-dim);
      margin-top: 4px;
      margin-left: 24px;
    }
    
    /* Entity Extraction Styles */
    .nac-entities-section {
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
    }
    
    .nac-entities-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
    }
    
    .nac-entities-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--nac-text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .nac-entities-title svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
    
    .nac-entities-toggle {
      transition: transform 0.2s ease;
    }
    
    .nac-entities-section.collapsed .nac-entities-toggle {
      transform: rotate(-90deg);
    }
    
    .nac-entities-content {
      margin-top: 12px;
      display: grid;
      gap: 12px;
    }
    
    .nac-entities-section.collapsed .nac-entities-content {
      display: none;
    }
    
    .nac-entity-group {
      background: var(--nac-background);
      border-radius: 6px;
      padding: 10px;
    }
    
    .nac-entity-group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .nac-entity-group-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--nac-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .nac-entity-group-title svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
    
    .nac-entity-count {
      font-size: 11px;
      background: var(--nac-primary);
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 500;
    }
    
    .nac-entity-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .nac-entity-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 16px;
      padding: 4px 8px 4px 10px;
      font-size: 12px;
      color: var(--nac-text);
      transition: all 0.15s ease;
    }
    
    .nac-entity-tag:hover {
      border-color: var(--nac-primary);
      background: var(--nac-surface-hover);
    }
    
    .nac-entity-tag.person {
      border-color: #4ade80;
      background: rgba(74, 222, 128, 0.1);
    }
    
    .nac-entity-tag.organization {
      border-color: #60a5fa;
      background: rgba(96, 165, 250, 0.1);
    }
    
    .nac-entity-tag-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border: none;
      background: transparent;
      color: var(--nac-text-muted);
      cursor: pointer;
      border-radius: 50%;
      padding: 0;
      font-size: 14px;
      line-height: 1;
      transition: all 0.15s ease;
    }
    
    .nac-entity-tag-remove:hover {
      background: var(--nac-error);
      color: white;
    }
    
    .nac-entity-add {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    
    .nac-entity-add-input {
      flex: 1;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      color: var(--nac-text);
      outline: none;
    }
    
    .nac-entity-add-input:focus {
      border-color: var(--nac-primary);
    }
    
    .nac-entity-add-input::placeholder {
      color: var(--nac-text-dim);
    }
    
    .nac-entity-add-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: var(--nac-primary);
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    
    .nac-entity-add-btn:hover {
      background: var(--nac-primary-hover);
    }
    
    .nac-entity-add-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
    
    .nac-entity-empty {
      font-size: 12px;
      color: var(--nac-text-dim);
      font-style: italic;
      padding: 4px 0;
    }
    
    /* Edit Mode Styles */
    .nac-article-header {
      margin-bottom: 15px;
    }
    .nac-article-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    .nac-field-group {
      margin-bottom: 15px;
    }
    .nac-field-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 5px;
      color: var(--nac-text);
    }
    .nac-field-preview {
      padding: 10px;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 6px;
      min-height: 20px;
      color: var(--nac-text);
    }
    .nac-content-preview {
      max-height: 300px;
      overflow-y: auto;
      font-size: 13px;
      line-height: 1.5;
    }
    .nac-field-edit {
      width: 100%;
      padding: 10px;
      border: 2px solid var(--nac-primary);
      border-radius: 6px;
      font-family: inherit;
      font-size: 14px;
      box-sizing: border-box;
      background: var(--nac-background);
      color: var(--nac-text);
    }
    .nac-field-edit:focus {
      outline: none;
      border-color: var(--nac-secondary);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    }
    .nac-content-edit {
      min-height: 250px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      line-height: 1.4;
      resize: vertical;
    }
    .nac-edit-tools {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 10px;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 6px;
      margin-bottom: 10px;
      align-items: center;
    }
    .nac-tools-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--nac-text-muted);
    }
    .nac-edit-tools button {
      padding: 4px 8px;
      font-size: 11px;
      border: 1px solid var(--nac-border);
      border-radius: 4px;
      background: var(--nac-background);
      color: var(--nac-text);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .nac-edit-tools button:hover {
      background: var(--nac-surface-hover);
      border-color: var(--nac-primary);
    }
    .nac-btn-danger {
      background: var(--nac-error) !important;
      color: white !important;
      border-color: var(--nac-error) !important;
    }
    .nac-btn-danger:hover {
      background: #d32f2f !important;
      border-color: #d32f2f !important;
    }
    .nac-edit-char-count {
      font-weight: normal;
      font-size: 11px;
      color: var(--nac-text-muted);
    }
    .nac-excerpt-preview {
      font-style: italic;
      color: var(--nac-text-muted);
    }
  `;

  // ============================================
  // SECTION 8: UI COMPONENTS
  // ============================================
  
  const UI = {
    elements: {},
    state: {
      isOpen: false,
      activeTab: 'readable',
      article: null,
      markdown: '',
      entities: {
        people: [],
        organizations: []
      },
      editMode: false,
      originalArticle: null
    },
    
    // SVG Icons
    icons: {
      book: '<svg viewBox="0 0 24 24"><path d="M21 4H3a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM3 19V6h8v13H3zm18 0h-8V6h8v13z"/></svg>',
      close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
      download: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
      send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
      chevronDown: '<svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
      add: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
      person: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
      business: '<svg viewBox="0 0 24 24"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>',
      article: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
    },
    
    // Initialize UI
    init: () => {
      Utils.log('Initializing UI...');
      
      // Inject styles
      GM_addStyle(STYLES);
      
      // Create UI elements
      UI.createFAB();
      UI.createOverlay();
      UI.createPanel();
      
      // Register menu commands
      GM_registerMenuCommand('📖 Open Article Capture', () => UI.toggle());
      GM_registerMenuCommand('🔑 Export Keypair Registry', () => UI.exportKeypairs());
      GM_registerMenuCommand('📋 View Keypair Registry', () => UI.viewKeypairs());
      
      Utils.log('UI initialized');
    },
    
    // Create Floating Action Button
    createFAB: () => {
      const fab = document.createElement('button');
      fab.className = 'nac-fab nac-reset';
      fab.innerHTML = UI.icons.book;
      fab.title = 'NOSTR Article Capture';
      fab.addEventListener('click', () => UI.toggle());
      
      document.body.appendChild(fab);
      UI.elements.fab = fab;
    },
    
    // Create overlay
    createOverlay: () => {
      const overlay = document.createElement('div');
      overlay.className = 'nac-overlay nac-reset';
      overlay.addEventListener('click', () => UI.close());
      
      document.body.appendChild(overlay);
      UI.elements.overlay = overlay;
    },
    
    // Create main panel
    createPanel: () => {
      const panel = document.createElement('div');
      panel.className = 'nac-panel nac-reset';
      
      panel.innerHTML = `
        <!-- Header -->
        <div class="nac-panel-header">
          <div class="nac-panel-title">
            ${UI.icons.book}
            <span>NOSTR Article Capture</span>
            <span class="nac-signing-status" id="nac-signing-status" title="Signing: Checking...">
              <span class="nac-status-dot connecting" id="nac-status-dot"></span>
              <span class="nac-status-text" id="nac-status-text" style="font-size: 11px; margin-left: 4px; color: var(--nac-text-muted);"></span>
            </span>
          </div>
          <div class="nac-panel-controls">
            <button class="nac-btn-icon" id="nac-download" title="Download Markdown">
              ${UI.icons.download}
            </button>
            <button class="nac-btn-icon" id="nac-close" title="Close (Esc)">
              ${UI.icons.close}
            </button>
          </div>
        </div>
        
        <!-- Tabs -->
        <div class="nac-tabs">
          <button class="nac-tab active" data-tab="readable">Readable</button>
          <button class="nac-tab" data-tab="markdown">Markdown</button>
          <button class="nac-tab" data-tab="metadata">Metadata</button>
          <div class="nac-tab-spacer"></div>
          <button class="nac-btn-copy" id="nac-copy">
            ${UI.icons.copy}
            <span>Copy</span>
          </button>
        </div>
        
        <!-- Content Area -->
        <div class="nac-content" id="nac-content">
          <div class="nac-empty">
            ${UI.icons.article}
            <div class="nac-empty-title">Loading article...</div>
            <div class="nac-empty-text">Please wait while we extract the content</div>
          </div>
        </div>
        
        <!-- Publish Section -->
        <div class="nac-publish">
          <div class="nac-publish-title">Publish to NOSTR</div>
          
          <!-- Publication Selector -->
          <div class="nac-form-group">
            <label class="nac-form-label">Publication (signs the event)</label>
            <select class="nac-form-select" id="nac-publication">
              <option value="">Select or create a publication...</option>
              <option value="__new__">+ Create new publication</option>
            </select>
          </div>
          
          <!-- New Publication Form (collapsible) -->
          <div class="nac-collapsible" id="nac-new-publication" style="display: none;">
            <div class="nac-collapsible-header">
              <span class="nac-collapsible-title">New Publication Details</span>
              <span class="nac-collapsible-icon">${UI.icons.chevronDown}</span>
            </div>
            <div class="nac-collapsible-content">
              <div class="nac-form-group">
                <label class="nac-form-label">Publication Name</label>
                <input type="text" class="nac-form-input" id="nac-pub-name" placeholder="e.g., The New York Times">
              </div>
              <div class="nac-form-row">
                <div class="nac-form-group">
                  <label class="nac-form-label">Type</label>
                  <select class="nac-form-select" id="nac-pub-type">
                    <option value="news">News</option>
                    <option value="blog">Blog</option>
                    <option value="social">Social</option>
                    <option value="podcast">Podcast</option>
                    <option value="video">Video Channel</option>
                  </select>
                </div>
                <div class="nac-form-group">
                  <label class="nac-form-label">Domain</label>
                  <input type="text" class="nac-form-input" id="nac-pub-domain" placeholder="e.g., nytimes.com">
                </div>
              </div>
            </div>
          </div>
          
          <!-- Author Selector -->
          <div class="nac-form-group">
            <label class="nac-form-label">Author (referenced in event)</label>
            <select class="nac-form-select" id="nac-author">
              <option value="">Select or create an author...</option>
              <option value="__new__">+ Create new person</option>
            </select>
          </div>
          
          <!-- New Author Form (collapsible) -->
          <div class="nac-collapsible" id="nac-new-author" style="display: none;">
            <div class="nac-collapsible-header">
              <span class="nac-collapsible-title">New Person Details</span>
              <span class="nac-collapsible-icon">${UI.icons.chevronDown}</span>
            </div>
            <div class="nac-collapsible-content">
              <div class="nac-form-group">
                <label class="nac-form-label">Full Name</label>
                <input type="text" class="nac-form-input" id="nac-author-name" placeholder="e.g., Jane Doe">
              </div>
            </div>
          </div>
          
          <!-- Tags -->
          <div class="nac-form-group">
            <label class="nac-form-label">Tags</label>
            <div class="nac-tags-container" id="nac-tags-container">
              <input type="text" class="nac-tag-input" id="nac-tag-input" placeholder="Add tags...">
            </div>
          </div>
          
          <!-- Entities Section (People & Organizations) -->
          <div class="nac-entities-section" id="nac-entities-section">
            <div class="nac-entities-header" id="nac-entities-header">
              <div class="nac-entities-title">
                ${UI.icons.person}
                <span>People & Organizations</span>
              </div>
              <span class="nac-entities-toggle">${UI.icons.chevronDown}</span>
            </div>
            <div class="nac-entities-content">
              <!-- People Quoted -->
              <div class="nac-entity-group">
                <div class="nac-entity-group-header">
                  <div class="nac-entity-group-title">
                    ${UI.icons.person}
                    <span>People Quoted</span>
                  </div>
                  <span class="nac-entity-count" id="nac-people-count">0</span>
                </div>
                <div class="nac-entity-tags" id="nac-people-tags">
                  <span class="nac-entity-empty">No people detected</span>
                </div>
                <div class="nac-entity-add">
                  <input type="text" class="nac-entity-add-input" id="nac-add-person-input" placeholder="Add person name...">
                  <button class="nac-entity-add-btn" id="nac-add-person-btn" title="Add person">
                    ${UI.icons.add}
                  </button>
                </div>
              </div>
              
              <!-- Organizations Referenced -->
              <div class="nac-entity-group">
                <div class="nac-entity-group-header">
                  <div class="nac-entity-group-title">
                    ${UI.icons.business}
                    <span>Organizations Referenced</span>
                  </div>
                  <span class="nac-entity-count" id="nac-orgs-count">0</span>
                </div>
                <div class="nac-entity-tags" id="nac-orgs-tags">
                  <span class="nac-entity-empty">No organizations detected</span>
                </div>
                <div class="nac-entity-add">
                  <input type="text" class="nac-entity-add-input" id="nac-add-org-input" placeholder="Add organization name...">
                  <button class="nac-entity-add-btn" id="nac-add-org-btn" title="Add organization">
                    ${UI.icons.add}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Media Handling -->
          <div class="nac-form-group">
            <label class="nac-form-label">Media Handling</label>
            <div class="nac-radio-group">
              <label class="nac-radio">
                <input type="radio" name="nac-media" value="reference">
                <span>Keep URLs</span>
              </label>
              <label class="nac-radio">
                <input type="radio" name="nac-media" value="embed" checked>
                <span>Embed Images (Base64)</span>
              </label>
            </div>
          </div>
          
          <!-- Relays -->
          <div class="nac-collapsible">
            <div class="nac-collapsible-header">
              <span class="nac-collapsible-title">Relays</span>
              <span class="nac-collapsible-icon">${UI.icons.chevronDown}</span>
            </div>
            <div class="nac-collapsible-content">
              <div class="nac-checkbox-group" id="nac-relays">
                ${CONFIG.relays.map(relay => `
                  <label class="nac-checkbox">
                    <input type="checkbox" value="${relay.url}" ${relay.enabled ? 'checked' : ''}>
                    <span>${relay.url.replace('wss://', '')}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>
          
          <!-- Publishing Options (Multi-Pubkey) -->
          <div class="nac-publishing-options" id="nac-publishing-options">
            <div class="nac-options-header" id="nac-options-header">
              ⚙️ Publishing Options <span class="nac-toggle-icon">▼</span>
            </div>
            <div class="nac-options-content">
              <!-- Publication pubkey - always shown, this is the signer -->
              <div class="nac-option-row">
                <label>
                  <input type="checkbox" id="nac-include-publication" checked disabled>
                  📰 Publication (signer):
                </label>
                <span id="nac-publication-name" class="nac-name-display">Select above</span>
              </div>
              <div class="nac-option-description">The publication's key signs and publishes the event</div>
              
              <!-- Author pubkey - optional -->
              <div class="nac-option-row">
                <label>
                  <input type="checkbox" id="nac-include-author">
                  ✍️ Author pubkey:
                </label>
                <input type="text" id="nac-author-pubkey" placeholder="npub1... or hex pubkey">
                <button id="nac-lookup-author" title="Lookup author pubkey from NOSTR">🔍</button>
              </div>
              <div class="nac-option-description">Add author's NOSTR pubkey as a p-tag with 'author' marker</div>
              
              <!-- Capturing user pubkey - optional -->
              <div class="nac-option-row">
                <label>
                  <input type="checkbox" id="nac-include-capturer">
                  👤 Capturing user (you):
                </label>
                <button id="nac-set-capturer">Set from NIP-07</button>
                <span id="nac-capturer-display" class="nac-not-set">Not set</span>
              </div>
              <div class="nac-option-description">Credit yourself as the person who captured this article</div>
            </div>
          </div>
          
          <!-- Publish Button -->
          <button class="nac-btn nac-btn-primary" id="nac-publish-btn" disabled>
            ${UI.icons.send}
            <span>Connect NSecBunker to Publish</span>
          </button>
        </div>
      `;
      
      document.body.appendChild(panel);
      UI.elements.panel = panel;
      
      // Attach event listeners
      UI.attachEventListeners();
    },
    
    // Attach event listeners
    attachEventListeners: () => {
      // Close button
      document.getElementById('nac-close').addEventListener('click', () => UI.close());
      
      // Tab switching
      document.querySelectorAll('.nac-tab').forEach(tab => {
        tab.addEventListener('click', () => UI.switchTab(tab.dataset.tab));
      });
      
      // Copy button
      document.getElementById('nac-copy').addEventListener('click', () => UI.copyContent());
      
      // Download button
      document.getElementById('nac-download').addEventListener('click', () => UI.downloadMarkdown());
      
      // Publication selector
      document.getElementById('nac-publication').addEventListener('change', async (e) => {
        const newPubForm = document.getElementById('nac-new-publication');
        if (e.target.value === '__new__') {
          newPubForm.style.display = 'block';
          newPubForm.classList.add('open');
          UI.updatePublicationDisplay(null, null);
        } else if (e.target.value === '__nip07__') {
          newPubForm.style.display = 'none';
          // For NIP-07, show a placeholder until we get the pubkey
          UI.updatePublicationDisplay('NIP-07 Extension', 'Will be retrieved at publish time');
        } else if (e.target.value) {
          newPubForm.style.display = 'none';
          // Load publication and update display
          const pub = await Storage.publications.get(e.target.value);
          if (pub) {
            UI.updatePublicationDisplay(pub.name, pub.pubkey);
          }
        } else {
          newPubForm.style.display = 'none';
          UI.updatePublicationDisplay(null, null);
        }
        UI.updatePublishButton();
      });
      
      // Publication name input - update button state as user types
      document.getElementById('nac-pub-name').addEventListener('input', () => {
        UI.updatePublishButton();
      });
      
      // Author selector
      document.getElementById('nac-author').addEventListener('change', (e) => {
        const newAuthorForm = document.getElementById('nac-new-author');
        if (e.target.value === '__new__') {
          newAuthorForm.style.display = 'block';
          newAuthorForm.classList.add('open');
        } else {
          newAuthorForm.style.display = 'none';
        }
      });
      
      // Collapsible headers
      document.querySelectorAll('.nac-collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
          header.parentElement.classList.toggle('open');
        });
      });
      
      // Tags input
      const tagInput = document.getElementById('nac-tag-input');
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const tag = tagInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (tag) {
            UI.addTag(tag);
            tagInput.value = '';
          }
        }
      });
      
      // Publish button
      document.getElementById('nac-publish-btn').addEventListener('click', () => UI.publish());
      
      // Publishing options toggle
      document.getElementById('nac-options-header').addEventListener('click', () => {
        const optionsEl = document.getElementById('nac-publishing-options');
        optionsEl.classList.toggle('expanded');
      });
      
      // Set capturer from NIP-07 button
      document.getElementById('nac-set-capturer').addEventListener('click', async () => {
        await UI.setCapturerFromNIP07();
      });
      
      // Lookup author pubkey button
      document.getElementById('nac-lookup-author').addEventListener('click', () => {
        UI.lookupAuthorPubkey();
      });
      
      // Author pubkey checkbox
      document.getElementById('nac-include-author').addEventListener('change', (e) => {
        const pubkeyInput = document.getElementById('nac-author-pubkey');
        pubkeyInput.disabled = !e.target.checked;
      });
      
      // Capturer checkbox
      document.getElementById('nac-include-capturer').addEventListener('change', (e) => {
        const capturer = Storage.capturingUser.get();
        if (capturer) {
          Storage.capturingUser.setEnabled(e.target.checked);
        }
      });
      
      // Load saved capturer on panel open
      UI.loadCapturerSettings();
      
      // Entities section toggle
      document.getElementById('nac-entities-header').addEventListener('click', () => {
        document.getElementById('nac-entities-section').classList.toggle('collapsed');
      });
      
      // Add person button
      document.getElementById('nac-add-person-btn').addEventListener('click', () => {
        const input = document.getElementById('nac-add-person-input');
        const name = input.value.trim();
        if (name) {
          UI.addEntity('person', name);
          input.value = '';
        }
      });
      
      // Add person on Enter
      document.getElementById('nac-add-person-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const name = e.target.value.trim();
          if (name) {
            UI.addEntity('person', name);
            e.target.value = '';
          }
        }
      });
      
      // Add organization button
      document.getElementById('nac-add-org-btn').addEventListener('click', () => {
        const input = document.getElementById('nac-add-org-input');
        const name = input.value.trim();
        if (name) {
          UI.addEntity('organization', name);
          input.value = '';
        }
      });
      
      // Add organization on Enter
      document.getElementById('nac-add-org-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const name = e.target.value.trim();
          if (name) {
            UI.addEntity('organization', name);
            e.target.value = '';
          }
        }
      });
      
      // Escape key to close panel
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && UI.state.isOpen) {
          e.preventDefault();
          UI.close();
        }
      });
    },
    
    // Toggle panel
    toggle: () => {
      if (UI.state.isOpen) {
        UI.close();
      } else {
        UI.open();
      }
    },
    
    // Open panel
    open: async () => {
      UI.state.isOpen = true;
      UI.elements.overlay.classList.add('visible');
      UI.elements.panel.classList.add('visible');
      UI.elements.fab.classList.add('active');
      
      // Extract article
      await UI.loadArticle();
      
      // Load existing entities
      await UI.loadEntities();
    },
    
    // Close panel
    close: () => {
      UI.state.isOpen = false;
      UI.elements.overlay.classList.remove('visible');
      UI.elements.panel.classList.remove('visible');
      UI.elements.fab.classList.remove('active');
    },
    
    // Load and display article
    loadArticle: async () => {
      const contentArea = document.getElementById('nac-content');
      
      // Reset edit mode state for new article
      UI.state.editMode = false;
      UI.state.originalArticle = null;
      
      // Show loading
      contentArea.innerHTML = `
        <div class="nac-empty">
          <div class="nac-spinner"></div>
          <div class="nac-empty-title">Extracting article...</div>
          <div class="nac-empty-text">Please wait</div>
        </div>
      `;
      
      // Extract article
      const article = ContentProcessor.extractArticle();
      
      if (!article) {
        contentArea.innerHTML = `
          <div class="nac-empty">
            ${UI.icons.warning}
            <div class="nac-empty-title">Could not extract article</div>
            <div class="nac-empty-text">This page may not contain readable article content</div>
          </div>
        `;
        return;
      }
      
      UI.state.article = article;
      UI.state.markdown = ContentProcessor.htmlToMarkdown(article.content);
      
      // Extract entities from article content
      const entities = ContentProcessor.extractEntities(article.content, article.textContent);
      UI.state.entities = entities;
      UI.renderEntities();
      
      // Pre-fill publication domain
      document.getElementById('nac-pub-domain').value = article.domain;
      
      // Pre-fill author if detected
      if (article.byline) {
        document.getElementById('nac-author-name').value = article.byline;
      }
      
      // Display content
      UI.displayContent();
    },
    
    // Display content based on active tab
    displayContent: () => {
      const contentArea = document.getElementById('nac-content');
      const article = UI.state.article;
      
      if (!article) return;
      
      if (UI.state.activeTab === 'readable') {
        // Build URL info section - show both URLs if they differ
        let urlInfoHtml = '';
        if (article.urlSource === 'canonical' && article.sourceUrl !== article.url) {
          urlInfoHtml = `
            <div class="nac-url-source-info">
              <div class="nac-url-item nac-url-canonical">
                <span class="nac-url-label">📎 Canonical URL:</span>
                <span class="nac-url-value">${Utils.escapeHtml(article.url)}</span>
              </div>
              <div class="nac-url-item nac-url-browser">
                <span class="nac-url-label">🔗 Browser URL:</span>
                <span class="nac-url-value">${Utils.escapeHtml(article.sourceUrl)}</span>
              </div>
            </div>
          `;
        } else {
          urlInfoHtml = `<span>🔗 ${article.domain}</span>`;
        }
        
        // Calculate content preview (truncated for display)
        const contentPreview = UI.state.markdown.replace(/\n/g, '<br>').substring(0, 2000) +
          (UI.state.markdown.length > 2000 ? '...' : '');
        
        contentArea.innerHTML = `
          <div class="nac-content-readable">
            <!-- Edit Mode Header -->
            <div class="nac-article-header">
              <div class="nac-article-actions">
                <button id="nac-edit-toggle" class="nac-btn nac-btn-secondary">
                  ✏️ Edit
                </button>
                <button id="nac-revert-btn" class="nac-btn nac-btn-danger" style="display: none;">
                  ↩️ Revert
                </button>
              </div>
            </div>
            
            <!-- Quick Clean Tools (only visible in edit mode) -->
            <div class="nac-edit-tools" id="nac-edit-tools" style="display: none;">
              <span class="nac-tools-label">Quick Clean:</span>
              <button id="nac-clean-ads" title="Remove common ad patterns">🚫 Remove Ads</button>
              <button id="nac-clean-related" title="Remove 'Related Articles' sections">📰 Remove Related</button>
              <button id="nac-clean-social" title="Remove social share prompts">📱 Remove Social</button>
              <button id="nac-clean-whitespace" title="Clean up extra whitespace">📄 Fix Spacing</button>
            </div>
            
            <!-- Title Section -->
            <div class="nac-field-group">
              <label class="nac-field-label">Title</label>
              <div class="nac-field-preview" id="nac-title-preview">${Utils.escapeHtml(article.title)}</div>
              <input type="text" class="nac-field-edit" id="nac-title-edit" style="display: none;" value="">
            </div>
            
            <!-- Excerpt/Summary Section -->
            <div class="nac-field-group">
              <label class="nac-field-label">Excerpt/Summary</label>
              <div class="nac-field-preview nac-excerpt-preview" id="nac-excerpt-preview">${article.excerpt ? Utils.escapeHtml(article.excerpt) : '<em>No excerpt</em>'}</div>
              <textarea class="nac-field-edit" id="nac-excerpt-edit" rows="3" style="display: none;"></textarea>
            </div>
            
            <!-- Content Body Section -->
            <div class="nac-field-group">
              <label class="nac-field-label">
                Article Content
                <span class="nac-edit-char-count" id="nac-content-chars">(${UI.state.markdown.length} chars)</span>
              </label>
              <div class="nac-field-preview nac-content-preview" id="nac-content-preview">${contentPreview}</div>
              <textarea class="nac-field-edit nac-content-edit" id="nac-content-edit" rows="15" style="display: none;"></textarea>
            </div>
            
            <!-- Article Info -->
            <div class="nac-article-meta">
              <div class="nac-article-info">
                ${article.byline ? `<span>${UI.icons.person} ${Utils.escapeHtml(article.byline)}</span>` : ''}
                ${article.publishedAt ? `<span>📅 ${Utils.formatDate(article.publishedAt)}</span>` : ''}
                ${article.urlSource !== 'canonical' ? `<span>🔗 ${article.domain}</span>` : ''}
              </div>
              ${urlInfoHtml}
            </div>
          </div>
        `;
        
        // Attach edit mode event listeners
        UI.attachEditModeListeners();
        
      } else if (UI.state.activeTab === 'markdown') {
        contentArea.innerHTML = `
          <div class="nac-content-markdown">${Utils.escapeHtml(UI.state.markdown)}</div>
        `;
      } else if (UI.state.activeTab === 'metadata') {
        UI.displayMetadataTab();
      }
    },
    
    // Attach edit mode event listeners
    attachEditModeListeners: () => {
      const editToggle = document.getElementById('nac-edit-toggle');
      const revertBtn = document.getElementById('nac-revert-btn');
      const contentEdit = document.getElementById('nac-content-edit');
      
      if (editToggle) {
        editToggle.addEventListener('click', UI.toggleEditMode);
      }
      if (revertBtn) {
        revertBtn.addEventListener('click', UI.revertChanges);
      }
      if (contentEdit) {
        contentEdit.addEventListener('input', UI.updateCharCount);
      }
      
      // Quick clean buttons
      document.getElementById('nac-clean-ads')?.addEventListener('click', () => UI.cleanContent('ads'));
      document.getElementById('nac-clean-related')?.addEventListener('click', () => UI.cleanContent('related'));
      document.getElementById('nac-clean-social')?.addEventListener('click', () => UI.cleanContent('social'));
      document.getElementById('nac-clean-whitespace')?.addEventListener('click', () => UI.cleanContent('whitespace'));
    },
    
    // Toggle edit mode
    toggleEditMode: () => {
      UI.state.editMode = !UI.state.editMode;
      
      const editBtn = document.getElementById('nac-edit-toggle');
      const revertBtn = document.getElementById('nac-revert-btn');
      const editTools = document.getElementById('nac-edit-tools');
      
      if (UI.state.editMode) {
        // Entering edit mode - save original and show edit fields
        if (!UI.state.originalArticle) {
          UI.state.originalArticle = {
            title: UI.state.article.title,
            excerpt: UI.state.article.excerpt || '',
            content: UI.state.markdown
          };
        }
        
        editBtn.textContent = '👁️ Preview';
        editBtn.classList.add('nac-btn-primary');
        editBtn.classList.remove('nac-btn-secondary');
        revertBtn.style.display = 'inline-block';
        if (editTools) editTools.style.display = 'flex';
        
        // Show edit fields, hide previews
        document.querySelectorAll('.nac-field-preview').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.nac-field-edit').forEach(el => el.style.display = 'block');
        
        // Populate edit fields
        document.getElementById('nac-title-edit').value = UI.state.article.title;
        document.getElementById('nac-excerpt-edit').value = UI.state.article.excerpt || '';
        document.getElementById('nac-content-edit').value = UI.state.markdown;
      } else {
        // Exiting edit mode - update article from fields and show previews
        UI.state.article.title = document.getElementById('nac-title-edit').value;
        UI.state.article.excerpt = document.getElementById('nac-excerpt-edit').value;
        UI.state.markdown = document.getElementById('nac-content-edit').value;
        
        editBtn.textContent = '✏️ Edit';
        editBtn.classList.remove('nac-btn-primary');
        editBtn.classList.add('nac-btn-secondary');
        if (editTools) editTools.style.display = 'none';
        
        // Show previews, hide edit fields
        document.querySelectorAll('.nac-field-preview').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.nac-field-edit').forEach(el => el.style.display = 'none');
        
        // Update previews with new content
        UI.updatePreviews();
      }
    },
    
    // Update preview displays
    updatePreviews: () => {
      const titlePreview = document.getElementById('nac-title-preview');
      const excerptPreview = document.getElementById('nac-excerpt-preview');
      const contentPreview = document.getElementById('nac-content-preview');
      const charCount = document.getElementById('nac-content-chars');
      
      if (titlePreview) {
        titlePreview.textContent = UI.state.article.title;
      }
      if (excerptPreview) {
        excerptPreview.innerHTML = UI.state.article.excerpt ?
          Utils.escapeHtml(UI.state.article.excerpt) : '<em>No excerpt</em>';
      }
      if (contentPreview) {
        // Render markdown content as HTML for preview (basic line breaks)
        contentPreview.innerHTML = UI.state.markdown.replace(/\n/g, '<br>').substring(0, 2000) +
          (UI.state.markdown.length > 2000 ? '...' : '');
      }
      if (charCount) {
        charCount.textContent = `(${UI.state.markdown.length} chars)`;
      }
    },
    
    // Revert changes to original
    revertChanges: () => {
      if (UI.state.originalArticle) {
        UI.state.article.title = UI.state.originalArticle.title;
        UI.state.article.excerpt = UI.state.originalArticle.excerpt;
        UI.state.markdown = UI.state.originalArticle.content;
        UI.state.originalArticle = null;
        UI.state.editMode = false;
        
        // Update UI
        const editBtn = document.getElementById('nac-edit-toggle');
        const revertBtn = document.getElementById('nac-revert-btn');
        const editTools = document.getElementById('nac-edit-tools');
        
        editBtn.textContent = '✏️ Edit';
        editBtn.classList.remove('nac-btn-primary');
        editBtn.classList.add('nac-btn-secondary');
        revertBtn.style.display = 'none';
        if (editTools) editTools.style.display = 'none';
        
        document.querySelectorAll('.nac-field-preview').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.nac-field-edit').forEach(el => el.style.display = 'none');
        
        UI.updatePreviews();
        UI.showToast('Changes reverted', 'info');
      }
    },
    
    // Clean content with various patterns
    cleanContent: (type) => {
      const contentEdit = document.getElementById('nac-content-edit');
      if (!contentEdit) return;
      
      let content = contentEdit.value;
      
      switch(type) {
        case 'ads':
          // Remove common ad patterns
          content = content.replace(/\[?advertisement\]?/gi, '');
          content = content.replace(/sponsored content/gi, '');
          content = content.replace(/\[?promoted\]?/gi, '');
          content = content.replace(/click here to .*/gi, '');
          content = content.replace(/\[ad\]/gi, '');
          content = content.replace(/advertisement/gi, '');
          break;
        case 'related':
          // Remove "Related Articles" type sections
          content = content.replace(/related articles?:?\s*[\s\S]*?(?=\n\n|\n#|$)/gi, '');
          content = content.replace(/you may also like:?\s*[\s\S]*?(?=\n\n|\n#|$)/gi, '');
          content = content.replace(/read more:?\s*[\s\S]*?(?=\n\n|\n#|$)/gi, '');
          content = content.replace(/more from .+:?\s*[\s\S]*?(?=\n\n|\n#|$)/gi, '');
          content = content.replace(/recommended for you:?\s*[\s\S]*?(?=\n\n|\n#|$)/gi, '');
          break;
        case 'social':
          // Remove social share prompts
          content = content.replace(/share this (article|story|post)/gi, '');
          content = content.replace(/follow us on .*/gi, '');
          content = content.replace(/subscribe to our .*/gi, '');
          content = content.replace(/sign up for .*/gi, '');
          content = content.replace(/join our .*/gi, '');
          content = content.replace(/like us on .*/gi, '');
          break;
        case 'whitespace':
          // Clean up whitespace
          content = content.replace(/\n{3,}/g, '\n\n');
          content = content.replace(/[ \t]+\n/g, '\n');
          content = content.replace(/\n[ \t]+/g, '\n');
          content = content.trim();
          break;
      }
      
      contentEdit.value = content;
      UI.updateCharCount();
      UI.showToast('Content cleaned', 'success');
    },
    
    // Update character count display
    updateCharCount: () => {
      const contentEdit = document.getElementById('nac-content-edit');
      const charCount = document.getElementById('nac-content-chars');
      if (contentEdit && charCount) {
        charCount.textContent = `(${contentEdit.value.length} chars)`;
      }
    },
    
    // Display metadata tab content
    displayMetadataTab: async () => {
      const contentArea = document.getElementById('nac-content');
      const article = UI.state.article;
      
      if (!article) return;
      
      // Compute URL info
      const normalizedUrl = Utils.normalizeUrl(article.url);
      const urlHash = await Utils.sha256(normalizedUrl);
      const dTag = urlHash.substring(0, 16);
      
      contentArea.innerHTML = `
        <div class="nac-metadata-tab-content">
          <!-- URL Info Section -->
          <div class="nac-url-info">
            <div class="nac-url-info-label">Target URL</div>
            <div class="nac-url-info-value">${Utils.escapeHtml(normalizedUrl)}</div>
            <div class="nac-url-info-hash">
              <strong>d-tag:</strong> ${dTag}
            </div>
          </div>
          
          <!-- Metadata Type Selector -->
          <div class="nac-metadata-type-selector">
            <button class="nac-type-btn active" data-type="annotation">
              <span class="nac-type-btn-icon">📝</span>
              <span class="nac-type-btn-label">Annotation</span>
            </button>
            <button class="nac-type-btn" data-type="factcheck">
              <span class="nac-type-btn-icon">🔍</span>
              <span class="nac-type-btn-label">Fact-Check</span>
            </button>
            <button class="nac-type-btn" data-type="headline">
              <span class="nac-type-btn-icon">📰</span>
              <span class="nac-type-btn-label">Headline Fix</span>
            </button>
            <button class="nac-type-btn" data-type="reaction">
              <span class="nac-type-btn-icon">👍</span>
              <span class="nac-type-btn-label">Reaction</span>
            </button>
            <button class="nac-type-btn" data-type="related">
              <span class="nac-type-btn-icon">🔗</span>
              <span class="nac-type-btn-label">Related</span>
            </button>
            <button class="nac-type-btn" data-type="rating">
              <span class="nac-type-btn-icon">⭐</span>
              <span class="nac-type-btn-label">Rating</span>
            </button>
            <button class="nac-type-btn" data-type="comment">
              <span class="nac-type-btn-icon">💬</span>
              <span class="nac-type-btn-label">Comment</span>
            </button>
          </div>
          
          <!-- Annotation Form (Kind 32123) -->
          <div class="nac-metadata-form active" id="nac-form-annotation">
            <div class="nac-form-group">
              <label class="nac-form-label">Annotation Type</label>
              <select class="nac-form-select" id="nac-annotation-type">
                <option value="context">Context / Background</option>
                <option value="correction">Correction</option>
                <option value="update">Update / Follow-up</option>
                <option value="opinion">Opinion / Commentary</option>
                <option value="related">Related Information</option>
              </select>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Annotation Content</label>
              <textarea class="nac-form-textarea" id="nac-annotation-content"
                placeholder="Enter your annotation about this article..."
                rows="4" maxlength="2000"></textarea>
              <div class="nac-char-count"><span id="nac-annotation-chars">0</span>/2000</div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Confidence Level</label>
              <div class="nac-confidence-slider">
                <input type="range" id="nac-annotation-confidence" min="0" max="100" value="80">
                <span class="nac-confidence-value" id="nac-annotation-confidence-value">80%</span>
              </div>
              <div class="nac-form-hint">How confident are you in this annotation?</div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Evidence URL (Optional)</label>
              <input type="url" class="nac-form-input" id="nac-annotation-evidence"
                placeholder="https://example.com/source">
            </div>
          </div>
          
          <!-- Fact-Check Form (Kind 32127) -->
          <div class="nac-metadata-form" id="nac-form-factcheck">
            <div class="nac-form-group">
              <label class="nac-form-label">Claim Being Checked</label>
              <textarea class="nac-form-textarea" id="nac-factcheck-claim"
                placeholder="What specific claim are you fact-checking?"
                rows="2" maxlength="200"></textarea>
              <div class="nac-char-count"><span id="nac-factcheck-claim-chars">0</span>/200</div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Verdict</label>
              <div class="nac-verdict-group">
                <div class="nac-verdict-option verdict-true">
                  <input type="radio" name="nac-verdict" id="nac-verdict-true" value="true">
                  <label for="nac-verdict-true">
                    <span class="nac-verdict-icon">✅</span>
                    <span class="nac-verdict-label">True</span>
                  </label>
                </div>
                <div class="nac-verdict-option verdict-partially-true">
                  <input type="radio" name="nac-verdict" id="nac-verdict-partial" value="partially-true">
                  <label for="nac-verdict-partial">
                    <span class="nac-verdict-icon">⚠️</span>
                    <span class="nac-verdict-label">Partial</span>
                  </label>
                </div>
                <div class="nac-verdict-option verdict-false">
                  <input type="radio" name="nac-verdict" id="nac-verdict-false" value="false">
                  <label for="nac-verdict-false">
                    <span class="nac-verdict-icon">❌</span>
                    <span class="nac-verdict-label">False</span>
                  </label>
                </div>
                <div class="nac-verdict-option verdict-unverifiable">
                  <input type="radio" name="nac-verdict" id="nac-verdict-unverifiable" value="unverifiable">
                  <label for="nac-verdict-unverifiable">
                    <span class="nac-verdict-icon">❓</span>
                    <span class="nac-verdict-label">Unknown</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Explanation</label>
              <textarea class="nac-form-textarea" id="nac-factcheck-explanation"
                placeholder="Explain your verdict with evidence..."
                rows="4" maxlength="2000"></textarea>
              <div class="nac-char-count"><span id="nac-factcheck-explanation-chars">0</span>/2000</div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Evidence Sources</label>
              <div class="nac-evidence-list" id="nac-evidence-list">
                <div class="nac-evidence-item" data-index="0">
                  <div class="nac-evidence-row">
                    <input type="url" class="nac-form-input nac-evidence-url"
                      placeholder="https://source.com/evidence">
                    <select class="nac-form-select nac-evidence-type">
                      <option value="primary">Primary</option>
                      <option value="official">Official</option>
                      <option value="news">News</option>
                      <option value="academic">Academic</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <button type="button" class="nac-add-evidence" id="nac-add-evidence">
                ${UI.icons.add} Add Evidence Source
              </button>
            </div>
          </div>
          
          <!-- Headline Correction Form (Kind 32129) -->
          <div class="nac-metadata-form" id="nac-form-headline">
            <div class="nac-form-group">
              <label class="nac-form-label">Original Headline</label>
              <div class="nac-headline-original">
                <div class="nac-headline-original-text" id="nac-original-headline">${Utils.escapeHtml(article.title)}</div>
                <button type="button" class="nac-headline-edit-btn" id="nac-edit-headline">Edit</button>
              </div>
              <input type="text" class="nac-form-input" id="nac-headline-original-input"
                value="${Utils.escapeHtml(article.title)}" style="display: none;">
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Suggested Headline</label>
              <input type="text" class="nac-form-input" id="nac-headline-suggested"
                placeholder="Enter a more accurate headline..." maxlength="200">
              <div class="nac-char-count"><span id="nac-headline-chars">0</span>/200</div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Reason for Correction</label>
              <textarea class="nac-form-textarea" id="nac-headline-reason"
                placeholder="Explain why this headline needs correction (e.g., clickbait, misleading, sensationalized)..."
                rows="3" maxlength="1000"></textarea>
              <div class="nac-char-count"><span id="nac-headline-reason-chars">0</span>/1000</div>
            </div>
          </div>

          <!-- URL Reaction Form (Kind 32132) -->
          <div class="nac-metadata-form" id="nac-form-reaction" style="display: none;">
            <div class="nac-form-group">
              <label class="nac-form-label">Quick Reaction</label>
              <div class="nac-emoji-picker" id="nac-reaction-emoji-picker">
                <button type="button" class="nac-emoji-btn" data-emoji="👍" title="Thumbs Up">👍</button>
                <button type="button" class="nac-emoji-btn" data-emoji="👎" title="Thumbs Down">👎</button>
                <button type="button" class="nac-emoji-btn" data-emoji="❤️" title="Love">❤️</button>
                <button type="button" class="nac-emoji-btn" data-emoji="🔥" title="Fire">🔥</button>
                <button type="button" class="nac-emoji-btn" data-emoji="🤔" title="Thinking">🤔</button>
                <button type="button" class="nac-emoji-btn" data-emoji="😡" title="Angry">😡</button>
                <button type="button" class="nac-emoji-btn" data-emoji="🎯" title="Accurate">🎯</button>
                <button type="button" class="nac-emoji-btn" data-emoji="💯" title="100%">💯</button>
              </div>
              <input type="hidden" id="nac-reaction-emoji" value="">
            </div>
            <div class="nac-form-group">
              <label class="nac-form-label">Aspect (Optional)</label>
              <select class="nac-form-select" id="nac-reaction-aspect">
                <option value="">Overall Article</option>
                <option value="headline">Headline</option>
                <option value="content">Content</option>
                <option value="claims">Claims</option>
                <option value="sources">Sources</option>
                <option value="images">Images</option>
              </select>
            </div>
            <div class="nac-form-group">
              <label class="nac-form-label">Reason (Optional)</label>
              <input type="text" class="nac-form-input" id="nac-reaction-reason"
                placeholder="Brief reason for your reaction..." maxlength="100">
              <div class="nac-char-count"><span id="nac-reaction-reason-chars">0</span>/100</div>
            </div>
            <div class="nac-form-group">
              <label class="nac-form-label">Extended Comment (Optional)</label>
              <textarea class="nac-form-textarea" id="nac-reaction-content"
                placeholder="Add more details about your reaction..."
                rows="3" maxlength="1000"></textarea>
              <div class="nac-char-count"><span id="nac-reaction-content-chars">0</span>/1000</div>
            </div>
          </div>

          <!-- Related Content Links Form (Kind 32131) -->
          <div class="nac-metadata-form" id="nac-form-related" style="display: none;">
            <div class="nac-form-group">
              <label class="nac-form-label">Related URL <span class="nac-required">*</span></label>
              <div class="nac-input-with-btn">
                <input type="url" class="nac-form-input" id="nac-related-url"
                  placeholder="https://example.com/related-article">
                <button type="button" class="nac-fetch-btn" id="nac-fetch-related-title" title="Fetch title from URL">🔄</button>
              </div>
              <div class="nac-form-help">Enter the URL of a related article or source</div>
            </div>
            <div class="nac-form-group">
              <label class="nac-form-label">Relationship Type <span class="nac-required">*</span></label>
              <select class="nac-form-select" id="nac-related-type">
                <option value="">Select relationship...</option>
                <option value="response">Response</option>
                <option value="rebuttal">Rebuttal</option>
                <option value="supporting">Supporting Evidence</option>
                <option value="contradicting">Contradicting Evidence</option>
                <option value="primary-source">Primary Source</option>
                <option value="update">Update</option>
                <option value="correction">Correction</option>
                <option value="similar">Similar</option>
              </select>
            </div>
            <div class="nac-form-group">
              <label class="nac-form-label">Related Article Title</label>
              <input type="text" class="nac-form-input" id="nac-related-title"
                placeholder="Title of the related article..." maxlength="200">
              <div class="nac-char-count"><span id="nac-related-title-chars">0</span>/200</div>
            </div>
            <div class="nac-form-group">
              <label class="nac-form-label">Relevance</label>
              <div class="nac-relevance-slider">
                <input type="range" class="nac-form-range" id="nac-related-relevance"
                  min="0" max="100" value="75">
                <span class="nac-relevance-value" id="nac-related-relevance-value">75%</span>
              </div>
            </div>
            <div class="nac-form-group">
              <label class="nac-form-label">Description</label>
              <textarea class="nac-form-textarea" id="nac-related-description"
                placeholder="Describe how this content relates to the current article..."
                rows="3" maxlength="1000"></textarea>
              <div class="nac-char-count"><span id="nac-related-description-chars">0</span>/1000</div>
            </div>
          </div>

          <!-- Content Rating Form (Kind 32124) -->
          <div class="nac-metadata-form" id="nac-form-rating" style="display: none;">
            <div class="nac-form-group">
              <label class="nac-form-label">Rate This Content</label>
              <div class="nac-form-help">Score each dimension from 0 (worst) to 10 (best)</div>
            </div>
            
            <div class="nac-rating-grid">
              <div class="nac-rating-dimension">
                <label class="nac-rating-label">Accuracy</label>
                <div class="nac-rating-slider">
                  <input type="range" class="nac-form-range" id="nac-rating-accuracy"
                    min="0" max="10" value="5">
                  <span class="nac-rating-value" id="nac-rating-accuracy-value">5</span>
                </div>
                <div class="nac-rating-help">How factually accurate is the content?</div>
              </div>
              
              <div class="nac-rating-dimension">
                <label class="nac-rating-label">Quality</label>
                <div class="nac-rating-slider">
                  <input type="range" class="nac-form-range" id="nac-rating-quality"
                    min="0" max="10" value="5">
                  <span class="nac-rating-value" id="nac-rating-quality-value">5</span>
                </div>
                <div class="nac-rating-help">Overall writing and production quality</div>
              </div>
              
              <div class="nac-rating-dimension">
                <label class="nac-rating-label">Depth</label>
                <div class="nac-rating-slider">
                  <input type="range" class="nac-form-range" id="nac-rating-depth"
                    min="0" max="10" value="5">
                  <span class="nac-rating-value" id="nac-rating-depth-value">5</span>
                </div>
                <div class="nac-rating-help">How thoroughly does it cover the topic?</div>
              </div>
              
              <div class="nac-rating-dimension">
                <label class="nac-rating-label">Clarity</label>
                <div class="nac-rating-slider">
                  <input type="range" class="nac-form-range" id="nac-rating-clarity"
                    min="0" max="10" value="5">
                  <span class="nac-rating-value" id="nac-rating-clarity-value">5</span>
                </div>
                <div class="nac-rating-help">How clear and understandable is it?</div>
              </div>
              
              <div class="nac-rating-dimension">
                <label class="nac-rating-label">Bias</label>
                <div class="nac-rating-slider">
                  <input type="range" class="nac-form-range" id="nac-rating-bias"
                    min="0" max="10" value="5">
                  <span class="nac-rating-value" id="nac-rating-bias-value">5</span>
                </div>
                <div class="nac-rating-help">10 = neutral/balanced, 0 = heavily biased</div>
              </div>
              
              <div class="nac-rating-dimension">
                <label class="nac-rating-label">Sources</label>
                <div class="nac-rating-slider">
                  <input type="range" class="nac-form-range" id="nac-rating-sources"
                    min="0" max="10" value="5">
                  <span class="nac-rating-value" id="nac-rating-sources-value">5</span>
                </div>
                <div class="nac-rating-help">Quality of citations and references</div>
              </div>
              
              <div class="nac-rating-dimension">
                <label class="nac-rating-label">Relevance</label>
                <div class="nac-rating-slider">
                  <input type="range" class="nac-form-range" id="nac-rating-relevance"
                    min="0" max="10" value="5">
                  <span class="nac-rating-value" id="nac-rating-relevance-value">5</span>
                </div>
                <div class="nac-rating-help">How relevant is this content today?</div>
              </div>
              
              <div class="nac-rating-dimension">
                <label class="nac-rating-label">Originality</label>
                <div class="nac-rating-slider">
                  <input type="range" class="nac-form-range" id="nac-rating-originality"
                    min="0" max="10" value="5">
                  <span class="nac-rating-value" id="nac-rating-originality-value">5</span>
                </div>
                <div class="nac-rating-help">Does it offer new insights or perspectives?</div>
              </div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Confidence Level</label>
              <div class="nac-confidence-slider">
                <input type="range" class="nac-form-range" id="nac-rating-confidence"
                  min="0" max="100" value="75">
                <span class="nac-confidence-value" id="nac-rating-confidence-value">75%</span>
              </div>
              <div class="nac-form-help">How confident are you in your ratings?</div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Review (Optional)</label>
              <textarea class="nac-form-textarea" id="nac-rating-review"
                placeholder="Write a detailed review explaining your ratings..."
                rows="4" maxlength="5000"></textarea>
              <div class="nac-char-count"><span id="nac-rating-review-chars">0</span>/5000</div>
            </div>
          </div>

          <!-- Comment Form (Kind 32123 with annotation-type=comment) -->
          <div class="nac-metadata-form" id="nac-form-comment" style="display: none;">
            <div class="nac-form-group">
              <label class="nac-form-label">Your Comment</label>
              <textarea class="nac-form-textarea" id="nac-comment-content"
                placeholder="Share your thoughts on this article..."
                rows="5" maxlength="5000"></textarea>
              <div class="nac-char-count"><span id="nac-comment-chars">0</span>/5000</div>
            </div>
            
            <div class="nac-form-group">
              <label class="nac-form-label">Reply To (Optional)</label>
              <input type="text" class="nac-form-input" id="nac-comment-parent"
                placeholder="Event ID of comment you're replying to...">
              <div class="nac-form-help">Leave empty for top-level comment, or paste event ID to reply</div>
            </div>
          </div>

          <!-- Event Preview -->
          <div class="nac-event-preview" id="nac-event-preview">
            <div class="nac-event-preview-header">
              <span class="nac-event-preview-title">Event Preview</span>
              <button type="button" class="nac-event-preview-toggle" id="nac-preview-toggle">Show JSON</button>
            </div>
            <div class="nac-event-preview-json" id="nac-preview-json" style="display: none;">
              Loading preview...
            </div>
          </div>
          
          <!-- Publication Selector (reusing existing) -->
          <div class="nac-form-group">
            <label class="nac-form-label">Sign As (Publication)</label>
            <select class="nac-form-select" id="nac-metadata-publication">
              <option value="">Select publication...</option>
            </select>
          </div>
          
          <!-- Post Button -->
          <div class="nac-metadata-actions">
            <button type="button" class="nac-btn-secondary" id="nac-metadata-cancel">Cancel</button>
            <button type="button" class="nac-btn nac-btn-primary" id="nac-metadata-post" disabled>
              ${UI.icons.send} Post Metadata
            </button>
          </div>
        </div>
      `;
      
      // Attach metadata tab event listeners
      UI.attachMetadataEventListeners();
      
      // Load publications into selector
      await UI.loadMetadataPublications();
      
      // Update initial preview
      UI.updateMetadataPreview();
    },
    
    // Attach event listeners for metadata tab
    attachMetadataEventListeners: () => {
      // Type selector buttons
      document.querySelectorAll('.nac-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.nac-type-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          const type = btn.dataset.type;
          document.querySelectorAll('.nac-metadata-form').forEach(form => {
            form.classList.remove('active');
          });
          document.getElementById(`nac-form-${type}`).classList.add('active');
          
          UI.state.metadataType = type;
          UI.updateMetadataPreview();
          UI.updateMetadataPostButton();
        });
      });
      
      // Character counters
      const setupCharCounter = (inputId, counterId, maxLen) => {
        const input = document.getElementById(inputId);
        const counter = document.getElementById(counterId);
        if (input && counter) {
          input.addEventListener('input', () => {
            const len = input.value.length;
            counter.textContent = len;
            counter.parentElement.classList.toggle('warning', len > maxLen * 0.8);
            counter.parentElement.classList.toggle('error', len >= maxLen);
            UI.updateMetadataPreview();
            UI.updateMetadataPostButton();
          });
        }
      };
      
      setupCharCounter('nac-annotation-content', 'nac-annotation-chars', 2000);
      setupCharCounter('nac-factcheck-claim', 'nac-factcheck-claim-chars', 200);
      setupCharCounter('nac-factcheck-explanation', 'nac-factcheck-explanation-chars', 2000);
      setupCharCounter('nac-headline-suggested', 'nac-headline-chars', 200);
      setupCharCounter('nac-headline-reason', 'nac-headline-reason-chars', 1000);
      setupCharCounter('nac-reaction-reason', 'nac-reaction-reason-chars', 100);
      setupCharCounter('nac-reaction-content', 'nac-reaction-content-chars', 1000);
      setupCharCounter('nac-related-title', 'nac-related-title-chars', 200);
      setupCharCounter('nac-related-description', 'nac-related-description-chars', 1000);
      
      // Rating form char counter
      setupCharCounter('nac-rating-review', 'nac-rating-review-chars', 5000);
      
      // Comment form char counter
      setupCharCounter('nac-comment-content', 'nac-comment-chars', 5000);
      
      // Rating dimension sliders
      const ratingDimensions = ['accuracy', 'quality', 'depth', 'clarity', 'bias', 'sources', 'relevance', 'originality'];
      ratingDimensions.forEach(dim => {
        const slider = document.getElementById(`nac-rating-${dim}`);
        const valueEl = document.getElementById(`nac-rating-${dim}-value`);
        if (slider && valueEl) {
          slider.addEventListener('input', () => {
            valueEl.textContent = slider.value;
            UI.updateMetadataPreview();
          });
        }
      });
      
      // Rating confidence slider
      const ratingConfidenceSlider = document.getElementById('nac-rating-confidence');
      const ratingConfidenceValue = document.getElementById('nac-rating-confidence-value');
      if (ratingConfidenceSlider && ratingConfidenceValue) {
        ratingConfidenceSlider.addEventListener('input', () => {
          ratingConfidenceValue.textContent = ratingConfidenceSlider.value + '%';
          UI.updateMetadataPreview();
        });
      }
      
      // Comment content
      const commentContent = document.getElementById('nac-comment-content');
      if (commentContent) {
        commentContent.addEventListener('input', () => {
          UI.updateMetadataPreview();
          UI.updateMetadataPostButton();
        });
      }

      // Confidence slider
      const confidenceSlider = document.getElementById('nac-annotation-confidence');
      const confidenceValue = document.getElementById('nac-annotation-confidence-value');
      if (confidenceSlider && confidenceValue) {
        confidenceSlider.addEventListener('input', () => {
          confidenceValue.textContent = confidenceSlider.value + '%';
          UI.updateMetadataPreview();
        });
      }
      
      // Verdict radio buttons
      document.querySelectorAll('input[name="nac-verdict"]').forEach(radio => {
        radio.addEventListener('change', () => {
          UI.updateMetadataPreview();
          UI.updateMetadataPostButton();
        });
      });
      
      // Add evidence button
      const addEvidenceBtn = document.getElementById('nac-add-evidence');
      if (addEvidenceBtn) {
        addEvidenceBtn.addEventListener('click', () => {
          UI.addEvidenceSource();
        });
      }
      
      // Edit headline button
      const editHeadlineBtn = document.getElementById('nac-edit-headline');
      if (editHeadlineBtn) {
        editHeadlineBtn.addEventListener('click', () => {
          const display = document.querySelector('.nac-headline-original');
          const input = document.getElementById('nac-headline-original-input');
          if (display && input) {
            display.style.display = 'none';
            input.style.display = 'block';
            input.focus();
          }
        });
      }
      
      // Emoji picker event listeners
      const emojiPicker = document.getElementById('nac-reaction-emoji-picker');
      if (emojiPicker) {
        emojiPicker.addEventListener('click', (e) => {
          const btn = e.target.closest('.nac-emoji-btn');
          if (btn) {
            // Remove active class from all emoji buttons
            emojiPicker.querySelectorAll('.nac-emoji-btn').forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            // Set the hidden input value
            const emojiInput = document.getElementById('nac-reaction-emoji');
            if (emojiInput) {
              emojiInput.value = btn.dataset.emoji;
            }
            updateMetadataPreview();
          }
        });
      }

      // Relevance slider event listener
      const relevanceSlider = document.getElementById('nac-related-relevance');
      const relevanceValue = document.getElementById('nac-related-relevance-value');
      if (relevanceSlider && relevanceValue) {
        relevanceSlider.addEventListener('input', () => {
          relevanceValue.textContent = `${relevanceSlider.value}%`;
          updateMetadataPreview();
        });
      }

      // Fetch related title button
      const fetchRelatedBtn = document.getElementById('nac-fetch-related-title');
      if (fetchRelatedBtn) {
        fetchRelatedBtn.addEventListener('click', async () => {
          const urlInput = document.getElementById('nac-related-url');
          const titleInput = document.getElementById('nac-related-title');
          if (!urlInput || !titleInput) return;
          
          const url = urlInput.value.trim();
          if (!url) {
            showToast('Please enter a URL first', 'warning');
            return;
          }

          fetchRelatedBtn.disabled = true;
          fetchRelatedBtn.textContent = '⏳';
          
          try {
            // Use GM.xmlHttpRequest to bypass CORS
            const response = await new Promise((resolve, reject) => {
              GM.xmlHttpRequest({
                method: 'GET',
                url: url,
                timeout: 10000,
                onload: resolve,
                onerror: reject,
                ontimeout: reject
              });
            });
            
            // Parse the HTML to extract title
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, 'text/html');
            const title = doc.querySelector('title')?.textContent?.trim() ||
                          doc.querySelector('meta[property="og:title"]')?.content ||
                          doc.querySelector('meta[name="twitter:title"]')?.content ||
                          '';
            
            if (title) {
              titleInput.value = title;
              // Trigger char counter update
              const event = new Event('input', { bubbles: true });
              titleInput.dispatchEvent(event);
              showToast('Title fetched successfully', 'success');
            } else {
              showToast('Could not extract title from URL', 'warning');
            }
          } catch (error) {
            console.error('Error fetching URL:', error);
            showToast('Failed to fetch URL', 'error');
          } finally {
            fetchRelatedBtn.disabled = false;
            fetchRelatedBtn.textContent = '🔄';
          }
        });
      }

      // Related URL and type change listeners
      const relatedUrl = document.getElementById('nac-related-url');
      const relatedType = document.getElementById('nac-related-type');
      if (relatedUrl) {
        relatedUrl.addEventListener('input', updateMetadataPreview);
      }
      if (relatedType) {
        relatedType.addEventListener('change', updateMetadataPreview);
      }

      // Preview toggle
      const previewToggle = document.getElementById('nac-preview-toggle');
      if (previewToggle) {
        previewToggle.addEventListener('click', () => {
          const previewJson = document.getElementById('nac-preview-json');
          if (previewJson) {
            const isVisible = previewJson.style.display !== 'none';
            previewJson.style.display = isVisible ? 'none' : 'block';
            previewToggle.textContent = isVisible ? 'Show JSON' : 'Hide JSON';
          }
        });
      }
      
      // Publication selector
      const pubSelect = document.getElementById('nac-metadata-publication');
      if (pubSelect) {
        pubSelect.addEventListener('change', () => {
          UI.updateMetadataPostButton();
        });
      }
      
      // Cancel button
      const cancelBtn = document.getElementById('nac-metadata-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          UI.switchTab('readable');
        });
      }
      
      // Post button
      const postBtn = document.getElementById('nac-metadata-post');
      if (postBtn) {
        postBtn.addEventListener('click', () => {
          UI.publishMetadata();
        });
      }
      
      // Initialize state
      UI.state.metadataType = 'annotation';
    },
    
    // Add new evidence source field
    addEvidenceSource: () => {
      const list = document.getElementById('nac-evidence-list');
      if (!list) return;
      
      const index = list.children.length;
      const item = document.createElement('div');
      item.className = 'nac-evidence-item';
      item.dataset.index = index;
      item.innerHTML = `
        <div class="nac-evidence-item-header">
          <span class="nac-evidence-item-title">Source ${index + 1}</span>
          <button type="button" class="nac-evidence-remove">Remove</button>
        </div>
        <div class="nac-evidence-row">
          <input type="url" class="nac-form-input nac-evidence-url"
            placeholder="https://source.com/evidence">
          <select class="nac-form-select nac-evidence-type">
            <option value="primary">Primary</option>
            <option value="official">Official</option>
            <option value="news">News</option>
            <option value="academic">Academic</option>
            <option value="other">Other</option>
          </select>
        </div>
      `;
      
      // Remove button handler
      item.querySelector('.nac-evidence-remove').addEventListener('click', () => {
        item.remove();
        UI.updateMetadataPreview();
      });
      
      list.appendChild(item);
    },
    
    // Load publications into metadata selector
    loadMetadataPublications: async () => {
      const select = document.getElementById('nac-metadata-publication');
      if (!select) return;
      
      const publications = await Storage.publications.getAll();
      
      // Clear existing options except first
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      // Add publications
      Object.entries(publications).forEach(([id, pub]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = pub.name;
        select.add(option);
      });
      
      UI.updateMetadataPostButton();
    },
    
    // Update metadata post button state
    updateMetadataPostButton: () => {
      const btn = document.getElementById('nac-metadata-post');
      if (!btn) return;
      
      const pubSelect = document.getElementById('nac-metadata-publication');
      const hasPub = pubSelect && pubSelect.value;
      
      // Check if NIP-07 is available
      const nip07Available = NIP07Client.checkAvailability();
      const hasSigningMethod = nip07Available || NSecBunkerClient.connected;
      
      // Check form validity based on type
      let isValid = false;
      const type = UI.state.metadataType || 'annotation';
      
      if (type === 'annotation') {
        const content = document.getElementById('nac-annotation-content');
        isValid = content && content.value.trim().length >= 10;
      } else if (type === 'factcheck') {
        const claim = document.getElementById('nac-factcheck-claim');
        const verdict = document.querySelector('input[name="nac-verdict"]:checked');
        const explanation = document.getElementById('nac-factcheck-explanation');
        isValid = claim && claim.value.trim().length >= 10 &&
                  verdict &&
                  explanation && explanation.value.trim().length >= 20;
      } else if (type === 'headline') {
        const suggested = document.getElementById('nac-headline-suggested');
        const reason = document.getElementById('nac-headline-reason');
        isValid = suggested && suggested.value.trim().length >= 5 &&
                  reason && reason.value.trim().length >= 10;
      } else if (type === 'reaction') {
        const emoji = document.getElementById('nac-reaction-emoji');
        // Reaction only requires an emoji to be selected
        isValid = emoji && emoji.value.trim().length > 0;
      } else if (type === 'related') {
        const url = document.getElementById('nac-related-url');
        const relationType = document.getElementById('nac-related-type');
        // Related content requires URL and relationship type
        isValid = url && url.value.trim().length > 0 &&
                  relationType && relationType.value.trim().length > 0;
      } else if (type === 'rating') {
        // Rating is always valid - dimensions have default values
        isValid = true;
      } else if (type === 'comment') {
        const comment = document.getElementById('nac-comment-content');
        // Comment requires content
        isValid = comment && comment.value.trim().length > 0;
      }
      
      if (!hasSigningMethod) {
        btn.disabled = true;
        btn.innerHTML = `${UI.icons.send} Install Signer Extension`;
      } else if (!hasPub) {
        btn.disabled = true;
        btn.innerHTML = `${UI.icons.send} Select Publication`;
      } else if (!isValid) {
        btn.disabled = true;
        btn.innerHTML = `${UI.icons.send} Complete Form`;
      } else {
        btn.disabled = false;
        btn.innerHTML = `${UI.icons.send} Post Metadata`;
      }
    },
    
    // Update event preview
    updateMetadataPreview: async () => {
      const previewEl = document.getElementById('nac-preview-json');
      if (!previewEl) return;
      
      const article = UI.state.article;
      if (!article) return;
      
      const type = UI.state.metadataType || 'annotation';
      let eventPreview = {};
      
      try {
        const normalizedUrl = Utils.normalizeUrl(article.url);
        const urlHash = await Utils.sha256(normalizedUrl);
        const dTag = urlHash.substring(0, 16);
        
        if (type === 'annotation') {
          const annotationType = document.getElementById('nac-annotation-type')?.value || 'context';
          const content = document.getElementById('nac-annotation-content')?.value || '';
          const confidence = document.getElementById('nac-annotation-confidence')?.value || 80;
          const evidenceUrl = document.getElementById('nac-annotation-evidence')?.value || '';
          
          eventPreview = {
            kind: 32123,
            tags: [
              ['d', dTag],
              ['r', normalizedUrl],
              ['annotation-type', annotationType],
              ['confidence', String(confidence / 100)],
              ['client', 'nostr-article-capture'],
              ...(evidenceUrl ? [['evidence', evidenceUrl]] : [])
            ],
            content: content
          };
        } else if (type === 'factcheck') {
          const claim = document.getElementById('nac-factcheck-claim')?.value || '';
          const verdict = document.querySelector('input[name="nac-verdict"]:checked')?.value || '';
          const explanation = document.getElementById('nac-factcheck-explanation')?.value || '';
          
          // Collect evidence sources
          const evidenceSources = [];
          document.querySelectorAll('#nac-evidence-list .nac-evidence-item').forEach(item => {
            const url = item.querySelector('.nac-evidence-url')?.value;
            const sourceType = item.querySelector('.nac-evidence-type')?.value;
            if (url && url.trim()) {
              evidenceSources.push({ url: url.trim(), type: sourceType });
            }
          });
          
          eventPreview = {
            kind: 32127,
            tags: [
              ['d', dTag],
              ['r', normalizedUrl],
              ['claim', claim.substring(0, 200)],
              ['verdict', verdict],
              ['client', 'nostr-article-capture'],
              ...evidenceSources.map(s => ['evidence', s.url, s.type])
            ],
            content: explanation
          };
        } else if (type === 'headline') {
          const original = document.getElementById('nac-headline-original-input')?.value || article.title;
          const suggested = document.getElementById('nac-headline-suggested')?.value || '';
          const reason = document.getElementById('nac-headline-reason')?.value || '';
          
          eventPreview = {
            kind: 32129,
            tags: [
              ['d', dTag],
              ['r', normalizedUrl],
              ['original-headline', original],
              ['suggested-headline', suggested],
              ['client', 'nostr-article-capture']
            ],
            content: reason
          };
        } else if (type === 'reaction') {
          const emoji = document.getElementById('nac-reaction-emoji')?.value || '';
          const aspect = document.getElementById('nac-reaction-aspect')?.value || '';
          const reason = document.getElementById('nac-reaction-reason')?.value || '';
          const content = document.getElementById('nac-reaction-content')?.value || '';

          const tags = [
            ['d', dTag],
            ['r', url],
            ['reaction', emoji]
          ];
          if (aspect) tags.push(['aspect', aspect]);
          if (reason) tags.push(['reason', reason]);

          eventPreview = {
            kind: 32132,
            tags: tags,
            content: content
          };
        } else if (type === 'related') {
          const relatedUrl = document.getElementById('nac-related-url')?.value || '';
          const relationType = document.getElementById('nac-related-type')?.value || '';
          const title = document.getElementById('nac-related-title')?.value || '';
          const relevance = document.getElementById('nac-related-relevance')?.value || '75';
          const description = document.getElementById('nac-related-description')?.value || '';

          const tags = [
            ['d', dTag],
            ['r', url],
            ['related-url', relatedUrl],
            ['relation-type', relationType]
          ];
          if (title) tags.push(['related-title', title]);
          tags.push(['relevance', relevance]);

          eventPreview = {
            kind: 32131,
            tags: tags,
            content: description
          };
        } else if (type === 'rating') {
          const dimensions = ['accuracy', 'quality', 'depth', 'clarity', 'bias', 'sources', 'relevance', 'originality'];
          const tags = [
            ['d', dTag],
            ['r', url],
            ['url-hash', urlHash]
          ];
          
          let totalScore = 0;
          let ratedDimensions = 0;
          dimensions.forEach(dim => {
            const value = document.getElementById(`nac-rating-${dim}`)?.value || '5';
            tags.push(['rating', dim, value, '10']);
            totalScore += parseInt(value, 10);
            ratedDimensions++;
          });
          
          const overallScore = (totalScore / ratedDimensions).toFixed(1);
          tags.push(['overall', overallScore, '10']);
          tags.push(['methodology', 'manual-review']);
          
          const confidence = document.getElementById('nac-rating-confidence')?.value || '75';
          tags.push(['confidence', confidence]);
          
          const review = document.getElementById('nac-rating-review')?.value || '';
          
          eventPreview = {
            kind: 32124,
            tags: tags,
            content: review
          };
        } else if (type === 'comment') {
          const comment = document.getElementById('nac-comment-content')?.value || '';
          const parentId = document.getElementById('nac-comment-parent')?.value || '';
          
          const tags = [
            ['d', dTag],
            ['r', url],
            ['url-hash', urlHash],
            ['annotation-type', 'comment']
          ];
          
          if (parentId.trim()) {
            tags.push(['e', parentId, '', 'reply']);
          }
          
          eventPreview = {
            kind: 32123,
            tags: tags,
            content: comment
          };
        }
        
        previewEl.textContent = JSON.stringify(eventPreview, null, 2);
      } catch (e) {
        previewEl.textContent = 'Error generating preview: ' + e.message;
      }
    },
    
    // Publish metadata event
    publishMetadata: async () => {
      const btn = document.getElementById('nac-metadata-post');
      if (!btn) return;
      
      const originalContent = btn.innerHTML;
      
      try {
        btn.disabled = true;
        btn.innerHTML = `<div class="nac-spinner"></div><span>Preparing...</span>`;
        
        const article = UI.state.article;
        const type = UI.state.metadataType || 'annotation';
        const pubSelect = document.getElementById('nac-metadata-publication');
        const publicationId = pubSelect?.value;
        
        if (!publicationId) {
          throw new Error('Please select a publication');
        }
        
        // Get signing method
        const nip07Available = NIP07Client.checkAvailability();
        let pubkey;
        let signedEvent;
        
        if (nip07Available) {
          btn.innerHTML = `<div class="nac-spinner"></div><span>Getting key...</span>`;
          pubkey = await NIP07Client.getPublicKey();
        } else if (NSecBunkerClient.connected) {
          const publication = await Storage.publications.get(publicationId);
          pubkey = publication?.pubkey;
          if (!pubkey) {
            throw new Error('Publication key not found');
          }
        } else {
          throw new Error('No signing method available');
        }
        
        // Build event based on type
        btn.innerHTML = `<div class="nac-spinner"></div><span>Building event...</span>`;
        let event;
        
        if (type === 'annotation') {
          const annotationType = document.getElementById('nac-annotation-type')?.value || 'context';
          const content = document.getElementById('nac-annotation-content')?.value || '';
          const confidence = parseInt(document.getElementById('nac-annotation-confidence')?.value) || 80;
          const evidenceUrl = document.getElementById('nac-annotation-evidence')?.value || '';
          
          event = await EventBuilder.buildAnnotationEvent(article.url, {
            type: annotationType,
            content: content,
            confidence: confidence,
            evidenceUrl: evidenceUrl
          }, pubkey);
          
        } else if (type === 'factcheck') {
          const claim = document.getElementById('nac-factcheck-claim')?.value || '';
          const verdict = document.querySelector('input[name="nac-verdict"]:checked')?.value || '';
          const explanation = document.getElementById('nac-factcheck-explanation')?.value || '';
          
          // Collect evidence sources
          const evidenceSources = [];
          document.querySelectorAll('#nac-evidence-list .nac-evidence-item').forEach(item => {
            const url = item.querySelector('.nac-evidence-url')?.value;
            const sourceType = item.querySelector('.nac-evidence-type')?.value;
            if (url && url.trim()) {
              evidenceSources.push({ url: url.trim(), type: sourceType });
            }
          });
          
          event = await EventBuilder.buildFactCheckEvent(article.url, {
            claim: claim,
            verdict: verdict,
            explanation: explanation,
            evidenceSources: evidenceSources
          }, pubkey);
          
        } else if (type === 'headline') {
          const original = document.getElementById('nac-headline-original-input')?.value || article.title;
          const suggested = document.getElementById('nac-headline-suggested')?.value || '';
          const reason = document.getElementById('nac-headline-reason')?.value || '';
          
          event = await EventBuilder.buildHeadlineCorrectionEvent(article.url, {
            original: original,
            suggested: suggested,
            reason: reason
          }, pubkey);
        } else if (type === 'reaction') {
          const emoji = document.getElementById('nac-reaction-emoji')?.value || '';
          const aspect = document.getElementById('nac-reaction-aspect')?.value || '';
          const reason = document.getElementById('nac-reaction-reason')?.value || '';
          const content = document.getElementById('nac-reaction-content')?.value || '';

          event = await EventBuilder.buildReactionEvent(article.url, {
            emoji: emoji,
            aspect: aspect,
            reason: reason,
            content: content
          }, pubkey);
        } else if (type === 'related') {
          const relatedUrl = document.getElementById('nac-related-url')?.value || '';
          const relationType = document.getElementById('nac-related-type')?.value || '';
          const title = document.getElementById('nac-related-title')?.value || '';
          const relevance = document.getElementById('nac-related-relevance')?.value || '75';
          const description = document.getElementById('nac-related-description')?.value || '';

          event = await EventBuilder.buildRelatedContentEvent(article.url, {
            relatedUrl: relatedUrl,
            relationType: relationType,
            title: title,
            relevance: parseInt(relevance, 10),
            description: description
          }, pubkey);
        } else if (type === 'rating') {
          const dimensions = ['accuracy', 'quality', 'depth', 'clarity', 'bias', 'sources', 'relevance', 'originality'];
          const ratings = {};
          dimensions.forEach(dim => {
            ratings[dim] = parseInt(document.getElementById(`nac-rating-${dim}`)?.value || '5', 10);
          });
          
          const confidence = parseInt(document.getElementById('nac-rating-confidence')?.value || '75', 10);
          const review = document.getElementById('nac-rating-review')?.value || '';

          event = await EventBuilder.buildRatingEvent(article.url, {
            ratings: ratings,
            confidence: confidence,
            methodology: 'manual-review',
            review: review
          }, pubkey);
        } else if (type === 'comment') {
          const comment = document.getElementById('nac-comment-content')?.value || '';
          const parentId = document.getElementById('nac-comment-parent')?.value?.trim() || '';

          event = await EventBuilder.buildCommentEvent(article.url, {
            comment: comment,
            parentId: parentId || null,
            rootId: null,
            mentions: []
          }, pubkey);
        }
        
        // Sign event
        btn.innerHTML = `<div class="nac-spinner"></div><span>Sign in extension...</span>`;
        
        if (nip07Available) {
          UI.showToast('Please approve signature in extension...', 'warning');
          signedEvent = await NIP07Client.signEvent(event);
        } else {
          signedEvent = await NSecBunkerClient.signEvent(event, publicationId);
        }
        
        // Validate signed event
        if (!signedEvent || !signedEvent.id || !signedEvent.sig) {
          throw new Error('Invalid signed event');
        }
        
        // Publish to relays
        btn.innerHTML = `<div class="nac-spinner"></div><span>Publishing...</span>`;
        
        const selectedRelays = CONFIG.relays.filter(r => r.enabled).map(r => r.url);
        const results = await NostrClient.publishToRelays(selectedRelays, signedEvent);
        
        Utils.log('Metadata publish results:', results);
        
        if (results.successful > 0) {
          UI.showToast(`Published ${type} to ${results.successful}/${results.total} relays!`, 'success');
          
          // Clear form and switch to readable tab
          setTimeout(() => {
            UI.switchTab('readable');
          }, 1500);
        } else {
          throw new Error('Failed to publish to any relay');
        }
        
      } catch (error) {
        Utils.error('Metadata publish error:', error);
        UI.showToast(error.message || 'Failed to publish', 'error');
      } finally {
        btn.innerHTML = originalContent;
        UI.updateMetadataPostButton();
      }
    },
    
    // Switch tab
    switchTab: (tab) => {
      UI.state.activeTab = tab;
      
      // Update tab buttons
      document.querySelectorAll('.nac-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
      });
      
      // Update content
      UI.displayContent();
    },
    
    // Load existing entities
    loadEntities: async () => {
      // Load publications
      const publications = await Storage.publications.getAll();
      const pubSelect = document.getElementById('nac-publication');
      
      // Clear existing options except first two
      while (pubSelect.options.length > 2) {
        pubSelect.remove(2);
      }
      
      // Add existing publications
      Object.entries(publications).forEach(([id, pub]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = pub.name;
        pubSelect.add(option);
      });
      
      // Load people
      const people = await Storage.people.getAll();
      const authorSelect = document.getElementById('nac-author');
      
      // Clear existing options except first two
      while (authorSelect.options.length > 2) {
        authorSelect.remove(2);
      }
      
      // Add existing people
      Object.entries(people).forEach(([id, person]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = person.name;
        authorSelect.add(option);
      });
      
      UI.updatePublishButton();
    },
    
    // Render entities in the UI
    renderEntities: () => {
      const { people, organizations } = UI.state.entities;
      
      // Render people
      const peopleContainer = document.getElementById('nac-people-tags');
      const peopleCount = document.getElementById('nac-people-count');
      
      if (people.length === 0) {
        peopleContainer.innerHTML = '<span class="nac-entity-empty">No people detected</span>';
      } else {
        peopleContainer.innerHTML = people.map((person, index) => `
          <span class="nac-entity-tag person" data-index="${index}" data-type="person">
            <span class="nac-entity-name">${Utils.escapeHtml(person.name)}</span>
            ${person.context ? `<span class="nac-entity-context">(${person.context})</span>` : ''}
            <button class="nac-entity-tag-remove" data-index="${index}" data-type="person" title="Remove">×</button>
          </span>
        `).join('');
        
        // Add click handlers for remove buttons
        peopleContainer.querySelectorAll('.nac-entity-tag-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.removeEntity('person', parseInt(btn.dataset.index));
          });
        });
      }
      peopleCount.textContent = people.length;
      
      // Render organizations
      const orgsContainer = document.getElementById('nac-orgs-tags');
      const orgsCount = document.getElementById('nac-orgs-count');
      
      if (organizations.length === 0) {
        orgsContainer.innerHTML = '<span class="nac-entity-empty">No organizations detected</span>';
      } else {
        orgsContainer.innerHTML = organizations.map((org, index) => `
          <span class="nac-entity-tag organization" data-index="${index}" data-type="organization">
            <span class="nac-entity-name">${Utils.escapeHtml(org.name)}</span>
            <button class="nac-entity-tag-remove" data-index="${index}" data-type="organization" title="Remove">×</button>
          </span>
        `).join('');
        
        // Add click handlers for remove buttons
        orgsContainer.querySelectorAll('.nac-entity-tag-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.removeEntity('organization', parseInt(btn.dataset.index));
          });
        });
      }
      orgsCount.textContent = organizations.length;
    },
    
    // Add a new entity
    addEntity: (type, name) => {
      if (!name || name.trim() === '') return;
      
      const trimmedName = name.trim();
      
      if (type === 'person') {
        // Check for duplicates
        const exists = UI.state.entities.people.some(
          p => p.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (!exists) {
          UI.state.entities.people.push({ name: trimmedName, context: 'manual' });
          UI.renderEntities();
          Utils.log('Added person:', trimmedName);
        } else {
          UI.showToast('Person already added', 'warning');
        }
      } else if (type === 'organization') {
        // Check for duplicates
        const exists = UI.state.entities.organizations.some(
          o => o.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (!exists) {
          UI.state.entities.organizations.push({ name: trimmedName });
          UI.renderEntities();
          Utils.log('Added organization:', trimmedName);
        } else {
          UI.showToast('Organization already added', 'warning');
        }
      }
    },
    
    // Remove an entity
    removeEntity: (type, index) => {
      if (type === 'person') {
        const removed = UI.state.entities.people.splice(index, 1);
        Utils.log('Removed person:', removed[0]?.name);
      } else if (type === 'organization') {
        const removed = UI.state.entities.organizations.splice(index, 1);
        Utils.log('Removed organization:', removed[0]?.name);
      }
      UI.renderEntities();
    },
    
    // Set capturing user from NIP-07 extension
    setCapturerFromNIP07: async () => {
      const btn = document.getElementById('nac-set-capturer');
      const displayEl = document.getElementById('nac-capturer-display');
      const checkbox = document.getElementById('nac-include-capturer');
      
      if (!NIP07Client.checkAvailability()) {
        UI.showToast('No NIP-07 extension detected (install nos2x, Alby, etc.)', 'error');
        return;
      }
      
      btn.disabled = true;
      btn.textContent = 'Loading...';
      
      try {
        const pubkey = await window.nostr.getPublicKey();
        const npub = NostrCrypto.hexToNpub(pubkey);
        
        // Try to get profile name from extension or use shortened npub
        let name = npub.substring(0, 12) + '...';
        
        // Store the capturer
        Storage.capturingUser.set(pubkey, npub, name);
        
        // Update UI
        displayEl.textContent = name;
        displayEl.title = npub;
        displayEl.className = 'nac-name-display';
        checkbox.checked = true;
        checkbox.disabled = false;
        
        UI.showToast('Capturing user set from NIP-07!', 'success');
      } catch (error) {
        Utils.error('Failed to get pubkey from NIP-07:', error);
        UI.showToast('Failed to get pubkey from extension', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Set from NIP-07';
      }
    },
    
    // Lookup and validate author pubkey
    lookupAuthorPubkey: () => {
      const input = document.getElementById('nac-author-pubkey');
      const checkbox = document.getElementById('nac-include-author');
      const value = input.value.trim();
      
      if (!value) {
        UI.showToast('Enter an npub or hex pubkey first', 'error');
        return;
      }
      
      try {
        let hexPubkey;
        
        if (value.startsWith('npub1')) {
          // Convert npub to hex
          hexPubkey = NostrCrypto.npubToHex(value);
        } else if (/^[0-9a-fA-F]{64}$/.test(value)) {
          // Already hex
          hexPubkey = value.toLowerCase();
        } else {
          throw new Error('Invalid pubkey format');
        }
        
        // Validate by converting back to npub
        const npub = NostrCrypto.hexToNpub(hexPubkey);
        
        // Store the validated hex pubkey
        input.dataset.hexPubkey = hexPubkey;
        input.value = npub;
        checkbox.checked = true;
        
        UI.showToast('Author pubkey validated!', 'success');
      } catch (error) {
        Utils.error('Invalid pubkey:', error);
        UI.showToast('Invalid pubkey format. Use npub1... or 64-char hex', 'error');
        input.dataset.hexPubkey = '';
      }
    },
    
    // Load saved capturer settings on panel open
    loadCapturerSettings: () => {
      const capturer = Storage.capturingUser.get();
      const displayEl = document.getElementById('nac-capturer-display');
      const checkbox = document.getElementById('nac-include-capturer');
      
      if (capturer && capturer.pubkey) {
        displayEl.textContent = capturer.name || capturer.npub.substring(0, 12) + '...';
        displayEl.title = capturer.npub;
        displayEl.className = 'nac-name-display';
        checkbox.checked = capturer.enabled !== false;
        checkbox.disabled = false;
      } else {
        displayEl.textContent = 'Not set';
        displayEl.className = 'nac-not-set';
        checkbox.checked = false;
        checkbox.disabled = true;
      }
    },
    
    // Update publication name display in Publishing Options
    updatePublicationDisplay: (name, pubkey) => {
      const displayEl = document.getElementById('nac-publication-name');
      if (displayEl) {
        if (name && pubkey) {
          displayEl.textContent = name;
          displayEl.title = pubkey;
          displayEl.className = 'nac-name-display';
        } else {
          displayEl.textContent = 'Select above';
          displayEl.className = 'nac-not-set';
        }
      }
    },
    
    // Add tag
    addTag: (tag) => {
      const container = document.getElementById('nac-tags-container');
      const input = document.getElementById('nac-tag-input');
      
      // Check if tag already exists
      if (container.querySelector(`[data-tag="${tag}"]`)) return;
      
      const tagEl = document.createElement('span');
      tagEl.className = 'nac-tag';
      tagEl.dataset.tag = tag;
      tagEl.innerHTML = `${tag}<span class="nac-tag-remove">×</span>`;
      
      tagEl.querySelector('.nac-tag-remove').addEventListener('click', () => {
        tagEl.remove();
      });
      
      container.insertBefore(tagEl, input);
    },
    
    // Get all tags
    getTags: () => {
      const container = document.getElementById('nac-tags-container');
      return Array.from(container.querySelectorAll('.nac-tag')).map(el => el.dataset.tag);
    },
    
    // Copy content
    copyContent: async () => {
      const content = UI.state.activeTab === 'markdown' ? UI.state.markdown : UI.state.article?.textContent;
      
      if (content) {
        await navigator.clipboard.writeText(content);
        UI.showToast('Copied to clipboard!', 'success');
      }
    },
    
    // Download markdown
    downloadMarkdown: () => {
      if (!UI.state.markdown || !UI.state.article) return;
      
      const blob = new Blob([UI.state.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${Utils.slugify(UI.state.article.title)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      
      UI.showToast('Markdown downloaded!', 'success');
    },
    
    // Update signing status indicator (supports NIP-07 and NSecBunker)
    updateSigningStatus: () => {
      const statusEl = document.getElementById('nac-signing-status');
      const dot = document.getElementById('nac-status-dot');
      const textEl = document.getElementById('nac-status-text');
      if (!statusEl || !dot) return;
      
      // Remove all status classes
      dot.classList.remove('connected', 'disconnected', 'connecting');
      
      // Check NIP-07 first (preferred for ease of use)
      const nip07Available = NIP07Client.checkAvailability();
      
      if (nip07Available) {
        dot.classList.add('connected');
        statusEl.title = 'NIP-07 Extension Available (nos2x, Alby, etc.)';
        if (textEl) textEl.textContent = 'NIP-07';
      } else if (NSecBunkerClient.connected) {
        dot.classList.add('connected');
        statusEl.title = 'NSecBunker Connected';
        if (textEl) textEl.textContent = 'Bunker';
      } else {
        dot.classList.add('disconnected');
        statusEl.title = 'No signing method available. Install a NIP-07 extension or connect NSecBunker.';
        if (textEl) textEl.textContent = 'No Signer';
      }
    },
    
    // Legacy method for compatibility
    updateBunkerStatus: (status) => {
      UI.updateSigningStatus();
    },
    
    // Update publish button state
    updatePublishButton: () => {
      const btn = document.getElementById('nac-publish-btn');
      const pubSelect = document.getElementById('nac-publication');
      const pubValue = pubSelect.value;
      
      // Update signing status indicator
      UI.updateSigningStatus();
      
      // Check signing availability
      const nip07Available = NIP07Client.checkAvailability();
      const hasSigningMethod = nip07Available || NSecBunkerClient.connected;
      
      // Check if we have an article
      if (!UI.state.article) {
        btn.disabled = true;
        btn.innerHTML = `${UI.icons.send}<span>No Article Loaded</span>`;
        return;
      }
      
      // Publication selection is required for ALL signing methods (v1.5.0 change)
      // This ensures entities are always persisted
      if (!pubValue || pubValue === '') {
        btn.disabled = true;
        btn.innerHTML = `${UI.icons.send}<span>Select Publication</span>`;
        return;
      }
      
      // If creating new publication, check name is provided
      if (pubValue === '__new__') {
        const pubName = document.getElementById('nac-pub-name').value.trim();
        if (!pubName) {
          btn.disabled = true;
          btn.innerHTML = `${UI.icons.send}<span>Enter Publication Name</span>`;
          return;
        }
      }
      
      // Check for signing method
      if (!hasSigningMethod) {
        btn.disabled = true;
        btn.innerHTML = `${UI.icons.send}<span>Install Signer Extension</span>`;
        return;
      }
      
      // Ready to publish - show which method will be used
      btn.disabled = false;
      if (nip07Available) {
        btn.innerHTML = `${UI.icons.send}<span>Publish with Extension</span>`;
      } else {
        btn.innerHTML = `${UI.icons.send}<span>Publish to NOSTR</span>`;
      }
    },
    
    // Publish to NOSTR
    publish: async () => {
      const btn = document.getElementById('nac-publish-btn');
      const originalContent = btn.innerHTML;
      
      try {
        // Show loading state
        btn.disabled = true;
        btn.innerHTML = `<div class="nac-spinner"></div><span>Preparing...</span>`;
        
        // Get form values
        const pubSelect = document.getElementById('nac-publication');
        const authorSelect = document.getElementById('nac-author');
        const tags = UI.getTags();
        const mediaHandling = document.querySelector('input[name="nac-media"]:checked')?.value || 'reference';
        const selectedRelays = Array.from(document.querySelectorAll('#nac-relays input:checked')).map(cb => cb.value);
        
        Utils.log('Publish started with relays:', selectedRelays);
        
        if (selectedRelays.length === 0) {
          throw new Error('Please select at least one relay');
        }
        
        // Get publication selection (now required for ALL paths)
        let publicationId = pubSelect.value;
        let authorId = authorSelect.value;
        
        if (!publicationId || publicationId === '') {
          throw new Error('Please select or create a publication');
        }
        
        // Check for NIP-07 extension first (easiest for users)
        const nip07Available = NIP07Client.checkAvailability();
        Utils.log('NIP-07 available:', nip07Available);
        
        let signedEvent;
        
        if (nip07Available) {
          // ========== NIP-07 SIGNING PATH ==========
          Utils.log('Using NIP-07 extension for signing');
          btn.innerHTML = `<div class="nac-spinner"></div><span>Getting key...</span>`;
          
          // Get public key from extension
          let pubkey;
          try {
            pubkey = await NIP07Client.getPublicKey();
            Utils.log('Got pubkey from NIP-07:', pubkey);
          } catch (e) {
            Utils.error('Failed to get pubkey from NIP-07:', e);
            throw new Error('Failed to get public key from extension. Please unlock your extension and try again.');
          }
          
          // Handle new publication creation (v1.5.0: now works with NIP-07)
          if (publicationId === '__new__') {
            const pubName = document.getElementById('nac-pub-name').value.trim();
            const pubType = document.getElementById('nac-pub-type').value;
            const pubDomain = document.getElementById('nac-pub-domain').value.trim();
            
            if (!pubName) {
              throw new Error('Publication name is required');
            }
            
            // Generate publication ID
            publicationId = 'pub_' + Utils.slugify(pubName) + '_' + Utils.generateId();
            
            // Save publication to storage with extension's pubkey
            await Storage.publications.save(publicationId, {
              name: pubName,
              type: pubType,
              domain: pubDomain,
              pubkey: pubkey,  // Use extension's pubkey
              signingMethod: 'nip07',
              created: Math.floor(Date.now() / 1000)
            });
            
            // Also save to keypair registry for reference
            await Storage.keypairs.save(publicationId, {
              type: 'publication',
              name: pubName,
              pubkey: pubkey,
              domain: pubDomain,
              pubType: pubType,
              signingMethod: 'nip07',
              created: Math.floor(Date.now() / 1000)
            });
            
            Utils.log('Created new publication with NIP-07:', publicationId);
          } else {
            // Existing publication selected - verify/update pubkey
            const publication = await Storage.publications.get(publicationId);
            if (publication) {
              // Update pubkey if it's different or missing (user may have switched extensions)
              if (!publication.pubkey || publication.pubkey !== pubkey) {
                Utils.log('Updating publication pubkey from NIP-07');
                await Storage.publications.save(publicationId, {
                  ...publication,
                  pubkey: pubkey,
                  signingMethod: 'nip07'
                });
                
                // Also update keypair registry
                await Storage.keypairs.save(publicationId, {
                  type: 'publication',
                  name: publication.name,
                  pubkey: pubkey,
                  domain: publication.domain,
                  pubType: publication.type,
                  signingMethod: 'nip07',
                  created: publication.created || Math.floor(Date.now() / 1000)
                });
              }
            }
          }
          
          // Handle new author creation (v1.5.0: now works with NIP-07)
          let authorPubkey = null;
          if (authorId === '__new__') {
            const authorName = document.getElementById('nac-author-name').value.trim();
            
            if (!authorName) {
              throw new Error('Author name is required');
            }
            
            // Generate author ID
            authorId = 'person_' + Utils.slugify(authorName) + '_' + Utils.generateId();
            
            // For NIP-07, we don't have a separate key for the author
            // The author is referenced by name in tags, not signed
            await Storage.people.save(authorId, {
              name: authorName,
              pubkey: null,  // Author doesn't sign, just referenced
              created: Math.floor(Date.now() / 1000)
            });
            
            Utils.log('Created new author:', authorId);
          } else if (authorId && authorId !== '') {
            // Get existing author's info (pubkey if they have one)
            const author = await Storage.people.get(authorId);
            authorPubkey = author?.pubkey;
          }
          
          // Build the article event with extension's pubkey
          const article = {
            ...UI.state.article,
            markdown: UI.state.markdown
          };
          
          // Get publishing options
          const includeAuthorOpt = document.getElementById('nac-include-author')?.checked;
          const authorPubkeyInput = document.getElementById('nac-author-pubkey');
          const authorPubkeyFromInput = authorPubkeyInput?.dataset?.hexPubkey || null;
          const includeCapturerOpt = document.getElementById('nac-include-capturer')?.checked;
          const capturer = Storage.capturingUser.get();
          const capturerPubkeyVal = (includeCapturerOpt && capturer?.enabled) ? capturer.pubkey : null;
          
          Utils.log('Building article event...');
          const event = await EventBuilder.buildArticleEvent(article, {
            pubkey: pubkey,
            authorPubkey: authorPubkeyFromInput || authorPubkey,
            includeAuthor: includeAuthorOpt && !!(authorPubkeyFromInput || authorPubkey),
            capturerPubkey: capturerPubkeyVal,
            includeCapturer: includeCapturerOpt && !!capturerPubkeyVal,
            tags: tags,
            mediaHandling: mediaHandling,
            entities: UI.state.entities
          });
          Utils.log('Built unsigned event:', event);
          
          // Sign with NIP-07 extension
          btn.innerHTML = `<div class="nac-spinner"></div><span>Sign in extension...</span>`;
          UI.showToast('Please approve the signature in your NOSTR extension...', 'warning');
          
          try {
            signedEvent = await NIP07Client.signEvent(event);
            Utils.log('Got signed event from NIP-07:', signedEvent);
          } catch (e) {
            Utils.error('NIP-07 signing failed:', e);
            throw new Error('Signing was rejected or failed. Please try again.');
          }
          
          // Validate signed event
          if (!signedEvent || !signedEvent.id || !signedEvent.sig) {
            Utils.error('Invalid signed event:', signedEvent);
            throw new Error('Extension returned invalid signed event');
          }
          
          // Reload entities in UI to show the newly created ones
          await UI.loadEntities();
          
        } else {
          // ========== NSECBUNKER SIGNING PATH ==========
          // Note: publicationId and authorId already extracted above
          
          // Connect to NSecBunker if not connected
          if (!NSecBunkerClient.connected) {
            btn.innerHTML = `<div class="nac-spinner"></div><span>Connecting...</span>`;
            UI.showToast('Connecting to NSecBunker...', 'warning');
            try {
              await NSecBunkerClient.connect();
            } catch (e) {
              Utils.log('NSecBunker not available:', e);
              throw new Error('No signing method available. Please install a NIP-07 browser extension (nos2x, Alby, etc.) or run NSecBunker.');
            }
          }
          
          // Handle new publication creation
          if (publicationId === '__new__') {
            const pubName = document.getElementById('nac-pub-name').value.trim();
            const pubType = document.getElementById('nac-pub-type').value;
            const pubDomain = document.getElementById('nac-pub-domain').value.trim();
            
            if (!pubName) {
              throw new Error('Publication name is required');
            }
            
            // Generate publication ID
            publicationId = 'pub_' + Utils.slugify(pubName) + '_' + Utils.generateId();
            
            // Create key in NSecBunker
            let pubkey = null;
            if (NSecBunkerClient.connected) {
              const keyResult = await NSecBunkerClient.createKey(publicationId, {
                type: 'publication',
                name: pubName,
                pubType: pubType,
                domain: pubDomain
              });
              pubkey = keyResult.pubkey;
            } else {
              throw new Error('NSecBunker required to create new publications');
            }
            
            // Save publication to storage
            await Storage.publications.save(publicationId, {
              name: pubName,
              type: pubType,
              domain: pubDomain,
              pubkey: pubkey,
              created: Math.floor(Date.now() / 1000)
            });
            
            // Also save keypair to the registry for persistent backup
            await Storage.keypairs.save(publicationId, {
              type: 'publication',
              name: pubName,
              pubkey: pubkey,
              domain: pubDomain,
              pubType: pubType,
              created: Math.floor(Date.now() / 1000)
            });
            
            Utils.log('Created new publication:', publicationId);
          }
          
          // Handle new author creation
          let authorPubkey = null;
          if (authorId === '__new__') {
            const authorName = document.getElementById('nac-author-name').value.trim();
            
            if (!authorName) {
              throw new Error('Author name is required');
            }
            
            // Generate author ID
            authorId = 'person_' + Utils.slugify(authorName) + '_' + Utils.generateId();
            
            // Create key in NSecBunker
            if (NSecBunkerClient.connected) {
              const keyResult = await NSecBunkerClient.createKey(authorId, {
                type: 'person',
                name: authorName
              });
              authorPubkey = keyResult.pubkey;
            }
            
            // Save person to storage
            await Storage.people.save(authorId, {
              name: authorName,
              pubkey: authorPubkey,
              created: Math.floor(Date.now() / 1000)
            });
            
            // Also save keypair to the registry for persistent backup
            if (authorPubkey) {
              await Storage.keypairs.save(authorId, {
                type: 'person',
                name: authorName,
                pubkey: authorPubkey,
                created: Math.floor(Date.now() / 1000)
              });
            }
            
            Utils.log('Created new author:', authorId);
          } else if (authorId && authorId !== '') {
            // Get existing author's pubkey
            const author = await Storage.people.get(authorId);
            authorPubkey = author?.pubkey;
          }
          
          // Get publication details
          const publication = await Storage.publications.get(publicationId);
          if (!publication) {
            throw new Error('Publication not found. Please select or create a publication.');
          }
          
          // Build the article event
          const article = {
            ...UI.state.article,
            markdown: UI.state.markdown
          };
          
          // Get publishing options
          const includeAuthorOpt = document.getElementById('nac-include-author')?.checked;
          const authorPubkeyInput = document.getElementById('nac-author-pubkey');
          const authorPubkeyFromInput = authorPubkeyInput?.dataset?.hexPubkey || null;
          const includeCapturerOpt = document.getElementById('nac-include-capturer')?.checked;
          const capturer = Storage.capturingUser.get();
          const capturerPubkeyVal = (includeCapturerOpt && capturer?.enabled) ? capturer.pubkey : null;
          
          const event = await EventBuilder.buildArticleEvent(article, {
            pubkey: publication.pubkey,
            authorPubkey: authorPubkeyFromInput || authorPubkey,
            includeAuthor: includeAuthorOpt && !!(authorPubkeyFromInput || authorPubkey),
            capturerPubkey: capturerPubkeyVal,
            includeCapturer: includeCapturerOpt && !!capturerPubkeyVal,
            tags: tags,
            mediaHandling: mediaHandling,
            entities: UI.state.entities
          });
          
          // Sign the event with NSecBunker
          if (!publication.pubkey) {
            throw new Error('Publication key not available. Please reconnect to NSecBunker.');
          }
          
          btn.innerHTML = `<div class="nac-spinner"></div><span>Signing...</span>`;
          signedEvent = await NSecBunkerClient.signEvent(event, publicationId);
        }
        
        // ========== PUBLISH TO RELAYS ==========
        btn.innerHTML = `<div class="nac-spinner"></div><span>Publishing...</span>`;
        Utils.log('Publishing signed event to relays...');
        Utils.log('Event ID:', signedEvent.id);
        Utils.log('Event pubkey:', signedEvent.pubkey);
        Utils.log('Event sig:', signedEvent.sig ? signedEvent.sig.substring(0, 20) + '...' : 'MISSING');
        
        const results = await NostrClient.publishToRelays(selectedRelays, signedEvent);
        
        Utils.log('Publish results:', results);
        
        if (results.successful > 0) {
          const confirmedCount = results.results.filter(r => r.success && !r.assumed).length;
          const assumedCount = results.results.filter(r => r.success && r.assumed).length;
          
          let message = `Published to ${results.successful}/${results.total} relays`;
          if (confirmedCount > 0 && assumedCount > 0) {
            message += ` (${confirmedCount} confirmed, ${assumedCount} likely)`;
          }
          
          UI.showToast(message + '!', 'success');
          
          // Close panel after success
          setTimeout(() => UI.close(), 2000);
        } else {
          // Log detailed failures
          results.results.forEach(r => {
            if (!r.success) {
              Utils.error('Relay failure:', r.url, r.error);
            }
          });
          throw new Error('Failed to publish to any relay. Check browser console for details.');
        }
        
      } catch (error) {
        Utils.error('Publish error:', error);
        UI.showToast(error.message || 'Failed to publish', 'error');
      } finally {
        btn.innerHTML = originalContent;
        UI.updatePublishButton();
      }
    },
    
    // Show toast notification
    showToast: (message, type = 'success') => {
      // Remove existing toast
      const existingToast = document.querySelector('.nac-toast');
      if (existingToast) existingToast.remove();
      
      const toast = document.createElement('div');
      toast.className = `nac-toast nac-reset ${type}`;
      toast.innerHTML = `
        ${type === 'success' ? UI.icons.check : type === 'error' ? UI.icons.close : UI.icons.warning}
        <span>${message}</span>
      `;
      
      document.body.appendChild(toast);
      
      // Show toast
      setTimeout(() => toast.classList.add('visible'), 10);
      
      // Hide and remove toast
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },
    
    // Export keypairs to a downloadable JSON file
    exportKeypairs: async () => {
      try {
        const registry = await Storage.keypairs.getAll();
        const count = Object.keys(registry).length;
        
        if (count === 0) {
          UI.showToast('No keypairs to export', 'warning');
          return;
        }
        
        const exportData = {
          exported_at: new Date().toISOString(),
          version: CONFIG.version,
          keypairs: registry
        };
        
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nostr-keypair-registry-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        UI.showToast(`Exported ${count} keypairs to file`, 'success');
        Utils.log('Exported keypair registry:', count, 'entries');
      } catch (e) {
        Utils.error('Failed to export keypairs:', e);
        UI.showToast('Failed to export keypairs', 'error');
      }
    },
    
    // View keypairs in console and show summary
    viewKeypairs: async () => {
      try {
        const registry = await Storage.keypairs.getAll();
        const count = Object.keys(registry).length;
        
        console.log('=== NOSTR Keypair Registry ===');
        console.log('Total entries:', count);
        console.log(JSON.stringify(registry, null, 2));
        
        // Build summary
        const publications = Object.entries(registry).filter(([k, v]) => v.type === 'publication');
        const people = Object.entries(registry).filter(([k, v]) => v.type === 'person');
        
        let summary = `Keypair Registry: ${count} total\n`;
        summary += `📰 Publications: ${publications.length}\n`;
        publications.forEach(([id, data]) => {
          summary += `   • ${data.name} (${data.domain || 'no domain'})\n`;
          summary += `     pubkey: ${data.pubkey ? data.pubkey.substring(0, 16) + '...' : 'pending'}\n`;
        });
        
        summary += `👤 People: ${people.length}\n`;
        people.forEach(([id, data]) => {
          summary += `   • ${data.name}\n`;
          summary += `     pubkey: ${data.pubkey ? data.pubkey.substring(0, 16) + '...' : 'pending'}\n`;
        });
        
        alert(summary + '\n\nFull details logged to browser console.');
        UI.showToast(`Found ${count} keypairs - see console`, 'success');
      } catch (e) {
        Utils.error('Failed to view keypairs:', e);
        UI.showToast('Failed to view keypairs', 'error');
      }
    }
  };

  // ============================================
  // SECTION 9: NOSTR CRYPTO UTILITIES
  // ============================================
  
  const NostrCrypto = {
    // Generate a random 32-byte private key as hex string
    generatePrivateKey: () => {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    // Get public key from private key (placeholder - requires secp256k1)
    // In production, use nostr-tools or similar library
    getPublicKey: async (privateKey) => {
      // This is a placeholder - real implementation requires secp256k1
      // For now, we'll use NSecBunker which handles this server-side
      Utils.log('getPublicKey requires secp256k1 library or NSecBunker');
      return null;
    },
    
    // Calculate event ID (SHA-256 of serialized event)
    getEventHash: async (event) => {
      const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
      ]);
      return await Utils.sha256(serialized);
    },
    
    // Serialize event for signing
    serializeEvent: (event) => {
      return JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
      ]);
    },
    
    // Verify event signature (placeholder)
    verifySignature: async (event) => {
      // Requires secp256k1 library
      Utils.log('Signature verification requires secp256k1 library');
      return true;
    },
    
    // Convert hex to bech32 npub
    hexToNpub: (hex) => {
      // Simplified bech32 encoding - in production use bech32 library
      // This is a placeholder that returns the hex prefixed
      return 'npub1' + hex.substring(0, 59);
    },
    
    // Convert bech32 npub to hex
    npubToHex: (npub) => {
      // Simplified bech32 decoding - in production use bech32 library
      if (npub.startsWith('npub1')) {
        return npub.substring(5);
      }
      return npub;
    }
  };

  // ============================================
  // SECTION 10: NOSTR RELAY CLIENT
  // ============================================
  
  const NostrClient = {
    connections: new Map(),
    subscriptions: new Map(),
    messageQueue: [],
    pendingPublishes: new Map(),
    
    // Connect to a relay
    connectToRelay: (url) => {
      return new Promise((resolve, reject) => {
        if (NostrClient.connections.has(url)) {
          const existing = NostrClient.connections.get(url);
          if (existing.readyState === WebSocket.OPEN) {
            Utils.log('Reusing existing connection to:', url);
            resolve(existing);
            return;
          }
          // Close stale connection
          Utils.log('Closing stale connection to:', url);
          existing.close();
          NostrClient.connections.delete(url);
        }
        
        Utils.log('Connecting to relay:', url);
        
        let ws;
        try {
          ws = new WebSocket(url);
        } catch (e) {
          Utils.error('Failed to create WebSocket:', url, e);
          reject(new Error('Failed to create WebSocket: ' + e.message));
          return;
        }
        
        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            Utils.log('Connection timeout for:', url);
            ws.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);
        
        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          Utils.log('Connected to relay:', url);
          NostrClient.connections.set(url, ws);
          resolve(ws);
        };
        
        ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          Utils.error('Relay connection error:', url, error);
          NostrClient.connections.delete(url);
          reject(new Error('Connection error'));
        };
        
        ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          Utils.log('Relay connection closed:', url, 'code:', event.code);
          NostrClient.connections.delete(url);
        };
        
        ws.onmessage = (msg) => {
          NostrClient.handleMessage(url, msg);
        };
      });
    },
    
    // Handle incoming message from relay
    handleMessage: (url, msg) => {
      try {
        Utils.log('Received message from relay:', url, msg.data);
        const data = JSON.parse(msg.data);
        const [type, ...rest] = data;
        
        switch (type) {
          case 'OK':
            const [eventId, success, message] = rest;
            Utils.log('Event publish result:', { url, eventId, success, message });
            // Resolve any pending publish promises for this event
            NostrClient.resolvePendingPublish(url, eventId, success, message);
            break;
            
          case 'EVENT':
            const [subId, event] = rest;
            Utils.log('Received event:', { url, subId, event });
            break;
            
          case 'EOSE':
            Utils.log('End of stored events:', { url, subId: rest[0] });
            break;
            
          case 'NOTICE':
            Utils.log('Relay notice:', { url, message: rest[0] });
            break;
            
          case 'AUTH':
            Utils.log('Relay requires auth:', { url });
            break;
            
          default:
            Utils.log('Unknown message type:', type, rest);
        }
      } catch (e) {
        Utils.error('Error parsing relay message:', e, 'raw:', msg.data);
      }
    },
    
    // Resolve pending publish - now tracks per relay+event combo
    resolvePendingPublish: (url, eventId, success, message) => {
      const key = `${url}:${eventId}`;
      const pending = NostrClient.pendingPublishes.get(key);
      if (pending) {
        Utils.log('Resolving pending publish:', key, 'success:', success);
        clearTimeout(pending.timeout);
        if (success) {
          pending.resolve({ success: true, eventId, url });
        } else {
          pending.reject(new Error(message || 'Relay rejected event'));
        }
        NostrClient.pendingPublishes.delete(key);
      } else {
        Utils.log('No pending publish found for:', key);
      }
    },
    
    // Publish event to a single relay with robust error handling
    publishToRelay: (url, event) => {
      return new Promise(async (resolve, reject) => {
        const key = `${url}:${event.id}`;
        Utils.log('Publishing to relay:', url, 'event id:', event.id);
        
        try {
          const ws = await NostrClient.connectToRelay(url);
          
          // Set up timeout (8 seconds for individual relay)
          const timeout = setTimeout(() => {
            if (NostrClient.pendingPublishes.has(key)) {
              Utils.log('Publish timeout for:', key);
              NostrClient.pendingPublishes.delete(key);
              // On timeout, assume success (many relays don't send OK)
              resolve({ success: true, eventId: event.id, url, assumed: true });
            }
          }, 8000);
          
          // Store pending promise with timeout reference
          NostrClient.pendingPublishes.set(key, { resolve, reject, timeout });
          
          // Send event
          const message = JSON.stringify(['EVENT', event]);
          Utils.log('Sending event to relay:', url);
          ws.send(message);
          
          Utils.log('Event sent to relay:', url, event.id);
          
        } catch (e) {
          Utils.error('Failed to publish to relay:', url, e);
          reject(e);
        }
      });
    },
    
    // Publish event to multiple relays with progress tracking
    publishToRelays: async (relayUrls, event) => {
      Utils.log('Publishing to relays:', relayUrls, 'event:', event.id);
      
      // Validate event has required fields
      if (!event.id || !event.pubkey || !event.sig) {
        throw new Error('Event missing required fields (id, pubkey, or sig)');
      }
      
      const results = await Promise.allSettled(
        relayUrls.map(url => NostrClient.publishToRelay(url, event))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      Utils.log(`Published to ${successful}/${relayUrls.length} relays (${failed} failed)`);
      
      // Log individual results
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          Utils.log(`  ✓ ${relayUrls[i]}`, r.value.assumed ? '(assumed)' : '(confirmed)');
        } else {
          Utils.log(`  ✗ ${relayUrls[i]}:`, r.reason?.message);
        }
      });
      
      return {
        successful,
        failed,
        total: relayUrls.length,
        results: results.map((r, i) => ({
          url: relayUrls[i],
          success: r.status === 'fulfilled',
          assumed: r.status === 'fulfilled' ? r.value?.assumed : false,
          error: r.status === 'rejected' ? r.reason?.message : null
        }))
      };
    },
    
    // Close all connections
    closeAll: () => {
      for (const [url, ws] of NostrClient.connections) {
        try {
          ws.close();
        } catch (e) {
          Utils.log('Error closing connection:', url, e);
        }
      }
      NostrClient.connections.clear();
      NostrClient.pendingPublishes.clear();
    }
  };

  // ============================================
  // SECTION 11: NSECBUNKER CLIENT
  // ============================================
  
  const NSecBunkerClient = {
    ws: null,
    connected: false,
    url: null,
    pendingRequests: new Map(),
    requestId: 0,
    keys: new Map(),
    
    // Connect to NSecBunker
    connect: async (url) => {
      return new Promise((resolve, reject) => {
        if (NSecBunkerClient.connected && NSecBunkerClient.ws?.readyState === WebSocket.OPEN) {
          resolve(true);
          return;
        }
        
        NSecBunkerClient.url = url || CONFIG.nsecbunker.defaultUrl;
        Utils.log('Connecting to NSecBunker:', NSecBunkerClient.url);
        
        try {
          const ws = new WebSocket(NSecBunkerClient.url);
          
          ws.onopen = () => {
            Utils.log('Connected to NSecBunker');
            NSecBunkerClient.ws = ws;
            NSecBunkerClient.connected = true;
            resolve(true);
          };
          
          ws.onerror = (error) => {
            Utils.error('NSecBunker connection error:', error);
            NSecBunkerClient.connected = false;
            reject(error);
          };
          
          ws.onclose = () => {
            Utils.log('NSecBunker connection closed');
            NSecBunkerClient.connected = false;
            NSecBunkerClient.ws = null;
          };
          
          ws.onmessage = (msg) => {
            NSecBunkerClient.handleMessage(msg);
          };
          
          // Timeout
          setTimeout(() => {
            if (!NSecBunkerClient.connected) {
              ws.close();
              reject(new Error('NSecBunker connection timeout'));
            }
          }, CONFIG.nsecbunker.timeout);
        } catch (e) {
          reject(e);
        }
      });
    },
    
    // Handle message from NSecBunker
    handleMessage: (msg) => {
      try {
        const data = JSON.parse(msg.data);
        Utils.log('NSecBunker message:', data);
        
        if (data.id && NSecBunkerClient.pendingRequests.has(data.id)) {
          const { resolve, reject } = NSecBunkerClient.pendingRequests.get(data.id);
          NSecBunkerClient.pendingRequests.delete(data.id);
          
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.result);
          }
        }
      } catch (e) {
        Utils.error('Error parsing NSecBunker message:', e);
      }
    },
    
    // Send request to NSecBunker
    sendRequest: (method, params) => {
      return new Promise((resolve, reject) => {
        if (!NSecBunkerClient.connected || !NSecBunkerClient.ws) {
          reject(new Error('Not connected to NSecBunker'));
          return;
        }
        
        const id = ++NSecBunkerClient.requestId;
        const request = {
          id,
          method,
          params
        };
        
        NSecBunkerClient.pendingRequests.set(id, { resolve, reject });
        NSecBunkerClient.ws.send(JSON.stringify(request));
        
        // Timeout
        setTimeout(() => {
          if (NSecBunkerClient.pendingRequests.has(id)) {
            NSecBunkerClient.pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, CONFIG.nsecbunker.timeout);
      });
    },
    
    // Create a new key
    createKey: async (name, metadata = {}) => {
      Utils.log('Creating key:', name);
      const result = await NSecBunkerClient.sendRequest('create_key', {
        name,
        metadata
      });
      
      // Cache the key
      NSecBunkerClient.keys.set(name, result);
      return result;
    },
    
    // Get key by name
    getKey: async (name) => {
      if (NSecBunkerClient.keys.has(name)) {
        return NSecBunkerClient.keys.get(name);
      }
      
      const result = await NSecBunkerClient.sendRequest('get_key', { name });
      if (result) {
        NSecBunkerClient.keys.set(name, result);
      }
      return result;
    },
    
    // List all keys
    listKeys: async () => {
      const result = await NSecBunkerClient.sendRequest('list_keys', {});
      return result || [];
    },
    
    // Sign an event
    signEvent: async (event, keyName) => {
      Utils.log('Signing event with key:', keyName);
      const result = await NSecBunkerClient.sendRequest('sign_event', {
        key_name: keyName,
        event
      });
      return result;
    },
    
    // Get public key for a key name
    getPublicKey: async (keyName) => {
      const key = await NSecBunkerClient.getKey(keyName);
      return key?.pubkey;
    },
    
    // Disconnect
    disconnect: () => {
      if (NSecBunkerClient.ws) {
        NSecBunkerClient.ws.close();
        NSecBunkerClient.ws = null;
      }
      NSecBunkerClient.connected = false;
      NSecBunkerClient.keys.clear();
    }
  };

  // ============================================
  // SECTION 11.5: NIP-07 BROWSER EXTENSION CLIENT
  // ============================================
  
  const NIP07Client = {
    available: false,
    publicKey: null,
    
    // Check if NIP-07 extension is available
    checkAvailability: () => {
      // Check both window and unsafeWindow for the nostr object
      const nostrObj = (typeof unsafeWindow !== 'undefined' && unsafeWindow.nostr) || window.nostr;
      NIP07Client.available = !!(nostrObj && typeof nostrObj.getPublicKey === 'function');
      Utils.log('NIP-07 extension available:', NIP07Client.available);
      return NIP07Client.available;
    },
    
    // Get the nostr object (handles TamperMonkey sandbox)
    getNostrObject: () => {
      return (typeof unsafeWindow !== 'undefined' && unsafeWindow.nostr) || window.nostr;
    },
    
    // Get public key from extension
    getPublicKey: async () => {
      if (!NIP07Client.checkAvailability()) {
        throw new Error('NIP-07 extension not available. Please install nos2x, Alby, or similar.');
      }
      
      try {
        const nostr = NIP07Client.getNostrObject();
        NIP07Client.publicKey = await nostr.getPublicKey();
        Utils.log('Got public key from NIP-07:', NIP07Client.publicKey);
        return NIP07Client.publicKey;
      } catch (e) {
        Utils.error('Failed to get public key from NIP-07:', e);
        throw new Error('Failed to get public key: ' + e.message);
      }
    },
    
    // Sign an event using the browser extension
    signEvent: async (event) => {
      if (!NIP07Client.checkAvailability()) {
        throw new Error('NIP-07 extension not available');
      }
      
      try {
        const nostr = NIP07Client.getNostrObject();
        
        // NIP-07 expects an unsigned event and returns a signed event
        const unsignedEvent = {
          kind: event.kind,
          created_at: event.created_at,
          tags: event.tags,
          content: event.content,
          pubkey: event.pubkey
        };
        
        Utils.log('Requesting NIP-07 signature for event:', unsignedEvent);
        const signedEvent = await nostr.signEvent(unsignedEvent);
        Utils.log('Got signed event from NIP-07:', signedEvent);
        
        return signedEvent;
      } catch (e) {
        Utils.error('NIP-07 signing failed:', e);
        throw new Error('Signing failed: ' + e.message);
      }
    },
    
    // Get relays from extension (optional NIP-07 feature)
    getRelays: async () => {
      if (!NIP07Client.checkAvailability()) {
        return null;
      }
      
      try {
        const nostr = NIP07Client.getNostrObject();
        if (typeof nostr.getRelays === 'function') {
          return await nostr.getRelays();
        }
      } catch (e) {
        Utils.log('Could not get relays from NIP-07:', e);
      }
      return null;
    }
  };

  // ============================================
  // SECTION 12: LOCAL KEY MANAGER (Fallback)
  // ============================================
  
  const LocalKeyManager = {
    // Store keys locally (encrypted with user password in future)
    // This is a fallback when NSecBunker is not available
    
    keys: new Map(),
    
    // Initialize from storage
    init: async () => {
      const storedKeys = await Storage.get('local_keys', {});
      for (const [name, keyData] of Object.entries(storedKeys)) {
        LocalKeyManager.keys.set(name, keyData);
      }
      Utils.log('LocalKeyManager initialized with', LocalKeyManager.keys.size, 'keys');
    },
    
    // Create a new key
    createKey: async (name, metadata = {}) => {
      if (LocalKeyManager.keys.has(name)) {
        throw new Error('Key already exists: ' + name);
      }
      
      const privateKey = NostrCrypto.generatePrivateKey();
      // Note: In a real implementation, we'd derive pubkey using secp256k1
      // For now, store a placeholder and require NSecBunker for actual signing
      const keyData = {
        name,
        privateKey,
        pubkey: null, // Would be derived from privateKey
        metadata,
        created: Math.floor(Date.now() / 1000)
      };
      
      LocalKeyManager.keys.set(name, keyData);
      await LocalKeyManager.save();
      
      Utils.log('Created local key:', name);
      return keyData;
    },
    
    // Get key by name
    getKey: (name) => {
      return LocalKeyManager.keys.get(name) || null;
    },
    
    // List all keys
    listKeys: () => {
      return Array.from(LocalKeyManager.keys.values());
    },
    
    // Delete a key
    deleteKey: async (name) => {
      LocalKeyManager.keys.delete(name);
      await LocalKeyManager.save();
    },
    
    // Save to storage
    save: async () => {
      const data = {};
      for (const [name, keyData] of LocalKeyManager.keys) {
        data[name] = keyData;
      }
      await Storage.set('local_keys', data);
    },
    
    // Sign event (requires secp256k1 - placeholder)
    signEvent: async (event, keyName) => {
      const key = LocalKeyManager.getKey(keyName);
      if (!key) {
        throw new Error('Key not found: ' + keyName);
      }
      
      // This is a placeholder - real signing requires secp256k1 library
      Utils.error('Local signing not implemented - use NSecBunker');
      throw new Error('Local signing requires secp256k1 library. Please use NSecBunker.');
    }
  };

  // ============================================
  // SECTION 13: EVENT BUILDER
  // ============================================
  
  const EventBuilder = {
    // Build a NIP-23 long-form content event (kind 30023)
    buildArticleEvent: async (article, options = {}) => {
      const {
        pubkey,
        authorPubkey,
        includeAuthor = false,
        capturerPubkey,
        includeCapturer = false,
        tags: additionalTags = [],
        mediaHandling = 'reference',
        entities = { people: [], organizations: [] }
      } = options;
      
      if (!pubkey) {
        throw new Error('Publication pubkey is required');
      }
      
      // Generate d-tag (unique identifier for replaceable event)
      const urlHash = await Utils.sha256(article.url);
      const dTag = urlHash.substring(0, 16);
      
      // Prepare content (markdown)
      let content = article.markdown || ContentProcessor.htmlToMarkdown(article.content);
      
      // Handle media based on preference
      if (mediaHandling === 'reference') {
        // Keep URLs as-is (already in markdown)
        Utils.log('Using reference URLs for images');
      } else if (mediaHandling === 'embed') {
        // Convert images to base64 embedded data URLs
        Utils.log('Embedding images as base64...');
        content = await ContentProcessor.embedImagesInMarkdown(content, (current, total) => {
          Utils.log(`Embedding image ${current}/${total}...`);
        });
        Utils.log('Image embedding complete');
      }
      
      // Build tags array
      const tags = [
        ['d', dTag],
        ['title', article.title],
        ['published_at', String(article.publishedAt || article.extractedAt)],
        ['client', 'nostr-article-capture']
      ];
      
      // Add summary/excerpt
      if (article.excerpt) {
        tags.push(['summary', article.excerpt.substring(0, 500)]);
      }
      
      // Add image
      if (article.featuredImage) {
        tags.push(['image', article.featuredImage]);
      }
      
      // Add original URL as 'r' tag
      tags.push(['r', article.url]);
      
      // Add author reference if provided and enabled
      if (includeAuthor && authorPubkey) {
        tags.push(['p', authorPubkey, '', 'author']);
      }
      
      // Add capturer reference if provided and enabled
      if (includeCapturer && capturerPubkey) {
        tags.push(['p', capturerPubkey, '', 'capturer']);
      }
      
      // Add author name as 'author' tag
      if (article.byline) {
        tags.push(['author', article.byline]);
      }
      
      // Add content type tags
      tags.push(['t', 'article']);
      tags.push(['t', article.domain.replace(/\./g, '-')]);
      
      // Add additional user-provided tags
      for (const tag of additionalTags) {
        if (typeof tag === 'string') {
          tags.push(['t', tag.toLowerCase()]);
        } else if (Array.isArray(tag)) {
          tags.push(tag);
        }
      }
      
      // Add entity tags (people and organizations)
      if (entities.people && entities.people.length > 0) {
        for (const person of entities.people) {
          tags.push(['person', person.name, person.context || 'referenced']);
        }
      }
      
      if (entities.organizations && entities.organizations.length > 0) {
        for (const org of entities.organizations) {
          tags.push(['org', org.name]);
        }
      }
      
      // Create unsigned event
      const event = {
        kind: 30023,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: content
      };
      
      // Calculate event ID
      event.id = await NostrCrypto.getEventHash(event);
      
      return event;
    },
    
    // Build a kind 0 profile/metadata event
    buildProfileEvent: async (pubkey, profile) => {
      const content = JSON.stringify({
        name: profile.name,
        display_name: profile.displayName || profile.name,
        about: profile.about || '',
        picture: profile.picture || '',
        banner: profile.banner || '',
        website: profile.website || '',
        nip05: profile.nip05 || '',
        lud16: profile.lud16 || ''
      });
      
      const event = {
        kind: 0,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: content
      };
      
      event.id = await NostrCrypto.getEventHash(event);
      return event;
    },
    
    // Build a kind 1 short text note
    buildNoteEvent: async (pubkey, text, options = {}) => {
      const { replyTo, mentions = [], tags: additionalTags = [] } = options;
      
      const tags = [];
      
      // Add reply tags
      if (replyTo) {
        tags.push(['e', replyTo.id, '', 'reply']);
        if (replyTo.pubkey) {
          tags.push(['p', replyTo.pubkey]);
        }
      }
      
      // Add mentions
      for (const mention of mentions) {
        tags.push(['p', mention]);
      }
      
      // Add additional tags
      for (const tag of additionalTags) {
        tags.push(tag);
      }
      
      const event = {
        kind: 1,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: text
      };
      
      event.id = await NostrCrypto.getEventHash(event);
      return event;
    },
    
    // Build URL Annotation event (Kind 32123)
    buildAnnotationEvent: async (url, data, pubkey) => {
      const normalizedUrl = Utils.normalizeUrl(url);
      const urlHash = await Utils.sha256(normalizedUrl);
      const dTag = urlHash.substring(0, 16);
      
      const tags = [
        ['d', dTag],
        ['r', normalizedUrl],
        ['annotation-type', data.type],
        ['confidence', String(Math.round(data.confidence) / 100).substring(0, 4)],
        ['client', 'nostr-article-capture']
      ];
      
      // Add evidence URL if provided
      if (data.evidenceUrl && data.evidenceUrl.trim()) {
        tags.push(['evidence', data.evidenceUrl.trim()]);
      }
      
      const event = {
        kind: 32123,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: data.content
      };
      
      event.id = await NostrCrypto.getEventHash(event);
      return event;
    },
    
    // Build Fact-Check event (Kind 32127)
    buildFactCheckEvent: async (url, data, pubkey) => {
      const normalizedUrl = Utils.normalizeUrl(url);
      const urlHash = await Utils.sha256(normalizedUrl);
      const dTag = urlHash.substring(0, 16);
      
      const tags = [
        ['d', dTag],
        ['r', normalizedUrl],
        ['claim', data.claim.substring(0, 200)],
        ['verdict', data.verdict],
        ['client', 'nostr-article-capture']
      ];
      
      // Add evidence sources as tags
      if (data.evidenceSources && data.evidenceSources.length > 0) {
        data.evidenceSources.forEach(source => {
          if (source.url && source.url.trim()) {
            tags.push(['evidence', source.url.trim(), source.type || 'other']);
          }
        });
      }
      
      const event = {
        kind: 32127,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: data.explanation
      };
      
      event.id = await NostrCrypto.getEventHash(event);
      return event;
    },
    
    // Build Headline Correction event (Kind 32129)
    buildHeadlineCorrectionEvent: async (url, data, pubkey) => {
      const normalizedUrl = Utils.normalizeUrl(url);
      const urlHash = await Utils.sha256(normalizedUrl);
      const dTag = urlHash.substring(0, 16);
      
      const tags = [
        ['d', dTag],
        ['r', normalizedUrl],
        ['original-headline', data.original],
        ['suggested-headline', data.suggested],
        ['client', 'nostr-article-capture']
      ];
      
      const event = {
        kind: 32129,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: data.reason
      };
      
      event.id = await NostrCrypto.getEventHash(event);
      return event;
    },

    // Build URL Reaction event (Kind 32132)
    buildReactionEvent: async (url, data, pubkey) => {
      const normalizedUrl = Utils.normalizeUrl(url);
      const urlHash = await Utils.sha256(normalizedUrl);
      const dTag = urlHash.substring(0, 16);

      const tags = [
        ['d', dTag],
        ['r', normalizedUrl],
        ['reaction', data.emoji],
        ['client', 'nostr-article-capture']
      ];

      if (data.aspect) tags.push(['aspect', data.aspect]);
      if (data.reason) tags.push(['reason', data.reason]);

      const event = {
        kind: 32132,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: data.content || ''
      };

      event.id = await NostrCrypto.getEventHash(event);
      return event;
    },

    // Build Related Content event (Kind 32131)
    buildRelatedContentEvent: async (url, data, pubkey) => {
      const normalizedUrl = Utils.normalizeUrl(url);
      const urlHash = await Utils.sha256(normalizedUrl);
      const dTag = urlHash.substring(0, 16);

      const tags = [
        ['d', dTag],
        ['r', normalizedUrl],
        ['related-url', data.relatedUrl],
        ['relation-type', data.relationType],
        ['client', 'nostr-article-capture']
      ];

      if (data.title) tags.push(['related-title', data.title]);
      tags.push(['relevance', data.relevance.toString()]);

      const event = {
        kind: 32131,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: data.description || ''
      };

      event.id = await NostrCrypto.getEventHash(event);
      return event;
    },

    // Build Content Rating event (Kind 32124)
    // Supports 8 rating dimensions: accuracy, quality, depth, clarity, bias, sources, relevance, originality
    buildRatingEvent: async (url, data, pubkey) => {
      const normalizedUrl = Utils.normalizeUrl(url);
      const urlHash = await Utils.sha256(normalizedUrl);
      const dTag = urlHash.substring(0, 16);

      const tags = [
        ['d', dTag],
        ['r', normalizedUrl],
        ['url-hash', urlHash],
        ['client', 'nostr-article-capture']
      ];

      // Add individual dimension ratings (0-10 scale)
      const dimensions = ['accuracy', 'quality', 'depth', 'clarity', 'bias', 'sources', 'relevance', 'originality'];
      let totalScore = 0;
      let ratedDimensions = 0;

      dimensions.forEach(dim => {
        if (data.ratings && data.ratings[dim] !== undefined && data.ratings[dim] !== null) {
          const score = Math.min(10, Math.max(0, parseInt(data.ratings[dim], 10)));
          tags.push(['rating', dim, score.toString(), '10']);
          totalScore += score;
          ratedDimensions++;
        }
      });

      // Calculate and add overall weighted score
      if (ratedDimensions > 0) {
        const overallScore = (totalScore / ratedDimensions).toFixed(1);
        tags.push(['overall', overallScore, '10']);
      }

      // Add methodology identifier
      tags.push(['methodology', data.methodology || 'manual-review']);

      // Add confidence level (0-100)
      if (data.confidence !== undefined) {
        const confidence = Math.min(100, Math.max(0, parseInt(data.confidence, 10)));
        tags.push(['confidence', confidence.toString()]);
      }

      const event = {
        kind: 32124,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: data.review || ''
      };

      event.id = await NostrCrypto.getEventHash(event);
      return event;
    },

    // Build Comment event (Kind 32123 with annotation-type=comment)
    // Used for threaded comments on URLs
    buildCommentEvent: async (url, data, pubkey) => {
      const normalizedUrl = Utils.normalizeUrl(url);
      const urlHash = await Utils.sha256(normalizedUrl);
      const dTag = urlHash.substring(0, 16);

      const tags = [
        ['d', dTag],
        ['r', normalizedUrl],
        ['url-hash', urlHash],
        ['annotation-type', 'comment'],
        ['client', 'nostr-article-capture']
      ];

      // Add threading support - reply to parent comment
      if (data.parentId) {
        tags.push(['e', data.parentId, '', 'reply']);
      }

      // Add root reference for threading
      if (data.rootId) {
        tags.push(['e', data.rootId, '', 'root']);
      }

      // Add mentioned pubkeys
      if (data.mentions && Array.isArray(data.mentions)) {
        data.mentions.forEach(mention => {
          tags.push(['p', mention]);
        });
      }

      const event = {
        kind: 32123,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: data.comment || ''
      };

      event.id = await NostrCrypto.getEventHash(event);
      return event;
    }
  };

  // ============================================
  // SECTION 13.5: URL METADATA SERVICE
  // ============================================
  
  /**
   * Service for looking up and caching metadata about URLs from NOSTR relays.
   * Queries for various event kinds (32123-32132, 32140-32144) related to URLs.
   */
  const URLMetadataService = {
    cache: new Map(),
    subscriptions: new Map(),
    activeQueries: new Map(),
    
    // Event kinds for URL metadata
    EVENT_KINDS: {
      ANNOTATION: 32123,
      CONTENT_RATING: 32124,
      ENTITY_REFERENCE: 32125,
      RATING_AGGREGATE: 32126,
      FACT_CHECK: 32127,
      PROFILE_URL_MAPPING: 32128,
      HEADLINE_CORRECTION: 32129,
      DISPUTE_REBUTTAL: 32130,
      RELATED_CONTENT: 32131,
      URL_REACTION: 32132,
      // Extended kinds
      TRUST_ATTESTATION: 32140,
      VERIFICATION_RESULT: 32141,
      SOURCE_CITATION: 32142,
      CONTENT_ARCHIVE: 32143,
      METADATA_AGGREGATE: 32144
    },
    
    /**
     * Normalize a URL for consistent querying
     * @param {string} url - The URL to normalize
     * @returns {string} Normalized URL
     */
    normalizeUrl: (url) => {
      return Utils.normalizeUrl(url);
    },
    
    /**
     * Compute SHA-256 hash of a URL for relay queries
     * @param {string} url - The URL to hash
     * @returns {Promise<string>} Hex-encoded hash
     */
    computeUrlHash: async (url) => {
      const normalized = URLMetadataService.normalizeUrl(url);
      return await Utils.sha256(normalized);
    },
    
    /**
     * Build query filters for URL metadata events
     * @param {string} normalizedUrl - The normalized URL to query
     * @returns {Array} Array of filter objects for relay queries
     */
    buildQueryFilters: (normalizedUrl) => {
      const coreKinds = [
        URLMetadataService.EVENT_KINDS.ANNOTATION,
        URLMetadataService.EVENT_KINDS.CONTENT_RATING,
        URLMetadataService.EVENT_KINDS.ENTITY_REFERENCE,
        URLMetadataService.EVENT_KINDS.RATING_AGGREGATE,
        URLMetadataService.EVENT_KINDS.FACT_CHECK,
        URLMetadataService.EVENT_KINDS.PROFILE_URL_MAPPING,
        URLMetadataService.EVENT_KINDS.HEADLINE_CORRECTION,
        URLMetadataService.EVENT_KINDS.DISPUTE_REBUTTAL,
        URLMetadataService.EVENT_KINDS.RELATED_CONTENT,
        URLMetadataService.EVENT_KINDS.URL_REACTION
      ];
      
      const extendedKinds = [
        URLMetadataService.EVENT_KINDS.TRUST_ATTESTATION,
        URLMetadataService.EVENT_KINDS.VERIFICATION_RESULT,
        URLMetadataService.EVENT_KINDS.SOURCE_CITATION,
        URLMetadataService.EVENT_KINDS.CONTENT_ARCHIVE,
        URLMetadataService.EVENT_KINDS.METADATA_AGGREGATE
      ];
      
      return [
        { kinds: coreKinds, "#r": [normalizedUrl] },
        { kinds: extendedKinds, "#r": [normalizedUrl] }
      ];
    },
    
    /**
     * Query relays for metadata about a URL
     * @param {string} url - The URL to query metadata for
     * @param {Array<string>} relayUrls - List of relay URLs to query
     * @returns {Promise<Object>} Aggregated metadata
     */
    queryMetadata: async (url, relayUrls = null) => {
      const normalizedUrl = URLMetadataService.normalizeUrl(url);
      const urlHash = await URLMetadataService.computeUrlHash(url);
      
      // Check cache first
      const cached = await URLMetadataService.getCachedMetadata(urlHash);
      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 min cache
        Utils.log('Using cached metadata for:', normalizedUrl);
        return cached.data;
      }
      
      // Use configured relays if not specified
      if (!relayUrls) {
        relayUrls = CONFIG.relays.filter(r => r.enabled && r.read).map(r => r.url);
      }
      
      Utils.log('Querying metadata for:', normalizedUrl, 'from', relayUrls.length, 'relays');
      
      const filters = URLMetadataService.buildQueryFilters(normalizedUrl);
      const events = [];
      
      // Query each relay
      const queryPromises = relayUrls.map(async (relayUrl) => {
        try {
          const relayEvents = await URLMetadataService.queryRelay(relayUrl, filters);
          events.push(...relayEvents);
        } catch (e) {
          Utils.log('Failed to query relay:', relayUrl, e.message);
        }
      });
      
      await Promise.allSettled(queryPromises);
      
      // Deduplicate events by ID
      const uniqueEvents = URLMetadataService.deduplicateEvents(events);
      
      // Aggregate and structure the metadata
      const metadata = URLMetadataService.aggregateMetadata(uniqueEvents, normalizedUrl);
      
      // Cache the results
      await URLMetadataService.cacheMetadata(urlHash, metadata);
      
      return metadata;
    },
    
    /**
     * Query a single relay for events matching filters
     * @param {string} relayUrl - Relay URL to query
     * @param {Array} filters - Query filters
     * @returns {Promise<Array>} Array of events
     */
    queryRelay: (relayUrl, filters) => {
      return new Promise(async (resolve, reject) => {
        const events = [];
        const subId = 'nmd_' + Utils.generateId();
        
        try {
          const ws = await NostrClient.connectToRelay(relayUrl);
          
          // Set up timeout
          const timeout = setTimeout(() => {
            resolve(events);
          }, 5000);
          
          // Listen for events
          const originalHandler = ws.onmessage;
          ws.onmessage = (msg) => {
            try {
              const data = JSON.parse(msg.data);
              const [type, ...rest] = data;
              
              if (type === 'EVENT' && rest[0] === subId) {
                events.push(rest[1]);
              } else if (type === 'EOSE' && rest[0] === subId) {
                clearTimeout(timeout);
                ws.onmessage = originalHandler;
                // Close subscription
                ws.send(JSON.stringify(['CLOSE', subId]));
                resolve(events);
              }
            } catch (e) {
              // Pass to original handler
              if (originalHandler) originalHandler(msg);
            }
          };
          
          // Send subscription request
          const reqMessage = ['REQ', subId, ...filters];
          ws.send(JSON.stringify(reqMessage));
          
        } catch (e) {
          reject(e);
        }
      });
    },
    
    /**
     * Deduplicate events by ID
     * @param {Array} events - Array of events
     * @returns {Array} Deduplicated events
     */
    deduplicateEvents: (events) => {
      const seen = new Map();
      for (const event of events) {
        if (!seen.has(event.id) || event.created_at > seen.get(event.id).created_at) {
          seen.set(event.id, event);
        }
      }
      return Array.from(seen.values());
    },
    
    /**
     * Aggregate events into structured metadata
     * @param {Array} events - Array of NOSTR events
     * @param {string} normalizedUrl - The URL these events relate to
     * @returns {Object} Structured metadata
     */
    aggregateMetadata: (events, normalizedUrl) => {
      const metadata = {
        url: normalizedUrl,
        queryTime: Date.now(),
        eventCount: events.length,
        annotations: [],
        comments: [],
        ratings: [],
        factChecks: [],
        headlineCorrections: [],
        disputes: [],
        relatedContent: [],
        reactions: [],
        entityReferences: [],
        aggregates: {
          trustScore: null,
          ratingCounts: { total: 0 },
          verdictSummary: null
        }
      };
      
      for (const event of events) {
        try {
          const parsed = URLMetadataService.parseEvent(event);
          if (!parsed) continue;
          
          switch (event.kind) {
            case URLMetadataService.EVENT_KINDS.ANNOTATION:
              // Check if this is a comment (annotation-type=comment) or regular annotation
              const annotationType = event.tags.find(t => t[0] === 'annotation-type');
              if (annotationType && annotationType[1] === 'comment') {
                metadata.comments.push(parsed);
              } else {
                metadata.annotations.push(parsed);
              }
              break;
            case URLMetadataService.EVENT_KINDS.CONTENT_RATING:
              metadata.ratings.push(parsed);
              break;
            case URLMetadataService.EVENT_KINDS.FACT_CHECK:
              metadata.factChecks.push(parsed);
              break;
            case URLMetadataService.EVENT_KINDS.HEADLINE_CORRECTION:
              metadata.headlineCorrections.push(parsed);
              break;
            case URLMetadataService.EVENT_KINDS.DISPUTE_REBUTTAL:
              metadata.disputes.push(parsed);
              break;
            case URLMetadataService.EVENT_KINDS.RELATED_CONTENT:
              metadata.relatedContent.push(parsed);
              break;
            case URLMetadataService.EVENT_KINDS.URL_REACTION:
              metadata.reactions.push(parsed);
              break;
            case URLMetadataService.EVENT_KINDS.ENTITY_REFERENCE:
              metadata.entityReferences.push(parsed);
              break;
            case URLMetadataService.EVENT_KINDS.RATING_AGGREGATE:
            case URLMetadataService.EVENT_KINDS.METADATA_AGGREGATE:
              // Merge aggregate data
              if (parsed.trustScore !== undefined) {
                metadata.aggregates.trustScore = parsed.trustScore;
              }
              break;
          }
        } catch (e) {
          Utils.log('Failed to parse event:', event.id, e);
        }
      }
      
      // Compute aggregates if not provided
      metadata.aggregates.ratingCounts.total = metadata.ratings.length;
      metadata.aggregates.annotationCount = metadata.annotations.length;
      metadata.aggregates.factCheckCount = metadata.factChecks.length;
      
      // Compute trust score from ratings if not provided
      if (metadata.aggregates.trustScore === null && metadata.ratings.length > 0) {
        metadata.aggregates.trustScore = URLMetadataService.computeTrustScore(metadata.ratings);
      }
      
      // Determine verdict summary from fact checks
      if (metadata.factChecks.length > 0) {
        metadata.aggregates.verdictSummary = URLMetadataService.computeVerdictSummary(metadata.factChecks);
      }
      
      return metadata;
    },
    
    /**
     * Parse a single event into structured data
     * @param {Object} event - NOSTR event
     * @returns {Object} Parsed event data
     */
    parseEvent: (event) => {
      const tags = new Map();
      for (const tag of event.tags) {
        const [key, ...values] = tag;
        if (!tags.has(key)) tags.set(key, []);
        tags.get(key).push(values);
      }
      
      let content = {};
      try {
        content = JSON.parse(event.content);
      } catch (e) {
        content = { text: event.content };
      }
      
      return {
        id: event.id,
        pubkey: event.pubkey,
        createdAt: event.created_at,
        kind: event.kind,
        tags: Object.fromEntries(tags),
        content: content,
        raw: event
      };
    },
    
    /**
     * Compute trust score from ratings
     * @param {Array} ratings - Array of rating events
     * @returns {number} Trust score between 0 and 1
     */
    computeTrustScore: (ratings) => {
      if (ratings.length === 0) return null;
      
      // Weight factors for different rating dimensions
      const weights = {
        accuracy: 0.30,
        quality: 0.15,
        depth: 0.10,
        clarity: 0.10,
        bias: 0.20,
        sources: 0.15
      };
      
      let totalScore = 0;
      let totalWeight = 0;
      
      for (const rating of ratings) {
        const content = rating.content;
        if (!content.ratings) continue;
        
        for (const [dimension, score] of Object.entries(content.ratings)) {
          const weight = weights[dimension] || 0.1;
          if (typeof score === 'number' && score >= 0 && score <= 5) {
            totalScore += (score / 5) * weight;
            totalWeight += weight;
          }
        }
      }
      
      return totalWeight > 0 ? totalScore / totalWeight : null;
    },
    
    /**
     * Compute verdict summary from fact checks
     * @param {Array} factChecks - Array of fact check events
     * @returns {Object} Verdict summary
     */
    computeVerdictSummary: (factChecks) => {
      const verdicts = {
        true: 0,
        false: 0,
        misleading: 0,
        unverifiable: 0,
        satire: 0,
        opinion: 0
      };
      
      for (const fc of factChecks) {
        const verdict = fc.content.verdict?.toLowerCase() || 'unverifiable';
        if (verdicts.hasOwnProperty(verdict)) {
          verdicts[verdict]++;
        }
      }
      
      // Determine primary verdict
      let primary = 'none';
      let maxCount = 0;
      for (const [verdict, count] of Object.entries(verdicts)) {
        if (count > maxCount) {
          maxCount = count;
          primary = verdict;
        }
      }
      
      // Flag high-alert verdicts
      const hasDebunking = verdicts.false > 0 || verdicts.misleading > 0;
      
      return {
        primary,
        counts: verdicts,
        total: factChecks.length,
        hasDebunking,
        severity: hasDebunking ? (verdicts.false > verdicts.misleading ? 'high' : 'medium') : 'low'
      };
    },
    
    /**
     * Cache metadata in storage
     * @param {string} urlHash - Hash of the URL
     * @param {Object} metadata - Metadata to cache
     */
    cacheMetadata: async (urlHash, metadata) => {
      const cacheKey = 'nmd_cache_' + urlHash;
      await Storage.set(cacheKey, {
        timestamp: Date.now(),
        data: metadata
      });
      URLMetadataService.cache.set(urlHash, { timestamp: Date.now(), data: metadata });
    },
    
    /**
     * Get cached metadata
     * @param {string} urlHash - Hash of the URL
     * @returns {Promise<Object|null>} Cached metadata or null
     */
    getCachedMetadata: async (urlHash) => {
      // Check memory cache first
      if (URLMetadataService.cache.has(urlHash)) {
        return URLMetadataService.cache.get(urlHash);
      }
      
      // Check persistent cache
      const cacheKey = 'nmd_cache_' + urlHash;
      const cached = await Storage.get(cacheKey, null);
      if (cached) {
        URLMetadataService.cache.set(urlHash, cached);
      }
      return cached;
    },
    
    /**
     * Subscribe to real-time updates for a URL
     * @param {string} url - URL to subscribe to
     * @param {Function} callback - Callback for new events
     * @returns {string} Subscription ID
     */
    subscribeToUpdates: async (url, callback) => {
      const normalizedUrl = URLMetadataService.normalizeUrl(url);
      const subId = 'nmd_sub_' + Utils.generateId();
      
      const relayUrls = CONFIG.relays.filter(r => r.enabled && r.read).map(r => r.url);
      const filters = URLMetadataService.buildQueryFilters(normalizedUrl);
      
      // Add since filter for real-time only
      const since = Math.floor(Date.now() / 1000);
      const realtimeFilters = filters.map(f => ({ ...f, since }));
      
      URLMetadataService.subscriptions.set(subId, {
        url: normalizedUrl,
        callback,
        relays: new Map()
      });
      
      // Subscribe on each relay
      for (const relayUrl of relayUrls) {
        try {
          const ws = await NostrClient.connectToRelay(relayUrl);
          ws.send(JSON.stringify(['REQ', subId, ...realtimeFilters]));
          URLMetadataService.subscriptions.get(subId).relays.set(relayUrl, ws);
        } catch (e) {
          Utils.log('Failed to subscribe to relay:', relayUrl, e.message);
        }
      }
      
      return subId;
    },
    
    /**
     * Unsubscribe from updates
     * @param {string} subId - Subscription ID
     */
    unsubscribe: (subId) => {
      const sub = URLMetadataService.subscriptions.get(subId);
      if (!sub) return;
      
      for (const [relayUrl, ws] of sub.relays) {
        try {
          ws.send(JSON.stringify(['CLOSE', subId]));
        } catch (e) {
          // Ignore close errors
        }
      }
      
      URLMetadataService.subscriptions.delete(subId);
    },
    
    /**
     * Clear all cached metadata
     */
    clearCache: async () => {
      URLMetadataService.cache.clear();
      const keys = await Storage.keys();
      for (const key of keys) {
        if (key.startsWith('nmd_cache_')) {
          await Storage.delete(key);
        }
      }
    }
  };

  // ============================================
  // SECTION 13.6: METADATA UI STYLES
  // ============================================
  
  const METADATA_STYLES = `
    /* URL Metadata Display Styles */
    /* Using --nmd- prefix for namespace isolation */
    
    :root {
      --nmd-primary: #6366f1;
      --nmd-primary-hover: #4f46e5;
      --nmd-success: #22c55e;
      --nmd-warning: #f59e0b;
      --nmd-error: #ef4444;
      --nmd-info: #3b82f6;
      --nmd-background: #1e1e2e;
      --nmd-surface: #2a2a3e;
      --nmd-surface-hover: #353550;
      --nmd-border: #3f3f5a;
      --nmd-text: #e2e8f0;
      --nmd-text-muted: #94a3b8;
      --nmd-shadow: rgba(0, 0, 0, 0.4);
      
      /* Verdict colors */
      --nmd-verdict-true: #22c55e;
      --nmd-verdict-false: #ef4444;
      --nmd-verdict-misleading: #f59e0b;
      --nmd-verdict-unverifiable: #94a3b8;
      
      /* Trust score colors */
      --nmd-trust-high: #22c55e;
      --nmd-trust-medium: #f59e0b;
      --nmd-trust-low: #ef4444;
      --nmd-trust-unknown: #64748b;
    }
    
    /* Page Metadata Badge - Floating Widget */
    .nmd-badge {
      position: fixed;
      bottom: 90px;
      right: 20px;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .nmd-badge__container {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--nmd-surface);
      border: 1px solid var(--nmd-border);
      border-radius: 24px;
      box-shadow: 0 4px 12px var(--nmd-shadow);
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 44px;
      min-height: 44px;
    }
    
    .nmd-badge__container:hover {
      background: var(--nmd-surface-hover);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px var(--nmd-shadow);
    }
    
    .nmd-badge__score {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 14px;
      font-weight: 700;
      color: white;
    }
    
    .nmd-badge__score--high { background: var(--nmd-trust-high); }
    .nmd-badge__score--medium { background: var(--nmd-trust-medium); }
    .nmd-badge__score--low { background: var(--nmd-trust-low); }
    .nmd-badge__score--unknown { background: var(--nmd-trust-unknown); }
    
    .nmd-badge__stats {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .nmd-badge__stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--nmd-text-muted);
    }
    
    .nmd-badge__stat-icon {
      font-size: 12px;
    }
    
    .nmd-badge__minimize {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--nmd-surface);
      border: 1px solid var(--nmd-border);
      color: var(--nmd-text-muted);
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .nmd-badge__container:hover .nmd-badge__minimize {
      opacity: 1;
    }
    
    .nmd-badge--minimized .nmd-badge__container {
      padding: 8px;
      border-radius: 50%;
    }
    
    .nmd-badge--minimized .nmd-badge__stats {
      display: none;
    }
    
    .nmd-badge--alert .nmd-badge__container {
      border-color: var(--nmd-error);
      animation: nmd-pulse-alert 2s infinite;
    }
    
    @keyframes nmd-pulse-alert {
      0%, 100% { box-shadow: 0 4px 12px var(--nmd-shadow); }
      50% { box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4); }
    }
    
    /* Debunking Banner */
    .nmd-debunk-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .nmd-debunk-banner__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: linear-gradient(135deg, var(--nmd-error) 0%, #dc2626 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }
    
    .nmd-debunk-banner--misleading .nmd-debunk-banner__content {
      background: linear-gradient(135deg, var(--nmd-warning) 0%, #d97706 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }
    
    .nmd-debunk-banner__icon {
      font-size: 24px;
      margin-right: 12px;
    }
    
    .nmd-debunk-banner__text {
      flex: 1;
    }
    
    .nmd-debunk-banner__title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    
    .nmd-debunk-banner__detail {
      font-size: 13px;
      opacity: 0.9;
    }
    
    .nmd-debunk-banner__source {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(255,255,255,0.15);
      border-radius: 16px;
      font-size: 12px;
      margin-left: 16px;
    }
    
    .nmd-debunk-banner__dismiss {
      padding: 8px 16px;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px;
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      margin-left: 16px;
      transition: all 0.2s;
      min-width: 44px;
      min-height: 44px;
    }
    
    .nmd-debunk-banner__dismiss:hover {
      background: rgba(255,255,255,0.3);
    }
    
    /* Headline Correction Indicator */
    .nmd-headline-correction {
      display: inline-flex;
      align-items: center;
      margin-left: 8px;
      cursor: pointer;
    }
    
    .nmd-headline-correction__icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--nmd-warning);
      color: white;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    
    .nmd-headline-correction:hover .nmd-headline-correction__icon {
      transform: scale(1.1);
    }
    
    .nmd-headline-correction__popup {
      position: absolute;
      top: 100%;
      left: 0;
      width: 320px;
      padding: 16px;
      background: var(--nmd-surface);
      border: 1px solid var(--nmd-border);
      border-radius: 8px;
      box-shadow: 0 8px 24px var(--nmd-shadow);
      z-index: 2147483647;
      display: none;
    }
    
    .nmd-headline-correction:hover .nmd-headline-correction__popup,
    .nmd-headline-correction__popup:hover {
      display: block;
    }
    
    .nmd-headline-correction__label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--nmd-warning);
      margin-bottom: 8px;
    }
    
    .nmd-headline-correction__original {
      font-size: 13px;
      color: var(--nmd-text-muted);
      text-decoration: line-through;
      margin-bottom: 8px;
    }
    
    .nmd-headline-correction__suggested {
      font-size: 14px;
      color: var(--nmd-text);
      font-weight: 500;
      margin-bottom: 12px;
      padding: 8px;
      background: var(--nmd-background);
      border-radius: 4px;
    }
    
    .nmd-headline-correction__meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--nmd-text-muted);
    }
    
    /* Inline Annotation Highlighter */
    .nmd-annotation-highlight {
      background: rgba(99, 102, 241, 0.2);
      border-bottom: 2px solid var(--nmd-primary);
      cursor: pointer;
      position: relative;
      transition: background 0.2s;
    }
    
    .nmd-annotation-highlight:hover {
      background: rgba(99, 102, 241, 0.3);
    }
    
    .nmd-annotation-highlight--disputed {
      background: rgba(245, 158, 11, 0.2);
      border-bottom-color: var(--nmd-warning);
    }
    
    .nmd-annotation-highlight--fact-checked {
      background: rgba(239, 68, 68, 0.2);
      border-bottom-color: var(--nmd-error);
    }
    
    .nmd-annotation-popup {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 300px;
      padding: 12px;
      background: var(--nmd-surface);
      border: 1px solid var(--nmd-border);
      border-radius: 8px;
      box-shadow: 0 8px 24px var(--nmd-shadow);
      z-index: 2147483647;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .nmd-annotation-highlight:hover .nmd-annotation-popup {
      display: block;
    }
    
    .nmd-annotation-popup__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .nmd-annotation-popup__avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--nmd-primary);
      color: white;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .nmd-annotation-popup__author {
      font-size: 13px;
      font-weight: 500;
      color: var(--nmd-text);
    }
    
    .nmd-annotation-popup__trust {
      margin-left: auto;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--nmd-trust-high);
      color: white;
    }
    
    .nmd-annotation-popup__content {
      font-size: 13px;
      line-height: 1.5;
      color: var(--nmd-text);
      margin-bottom: 8px;
    }
    
    .nmd-annotation-popup__actions {
      display: flex;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--nmd-border);
    }
    
    .nmd-annotation-popup__action {
      padding: 4px 10px;
      font-size: 12px;
      border-radius: 4px;
      border: 1px solid var(--nmd-border);
      background: transparent;
      color: var(--nmd-text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .nmd-annotation-popup__action:hover {
      background: var(--nmd-surface-hover);
      color: var(--nmd-text);
    }
    
    /* Link Metadata Badges */
    .nmd-link-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      font-size: 9px;
      font-weight: 700;
      margin-left: 4px;
      vertical-align: middle;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .nmd-link-badge:hover {
      transform: scale(1.2);
    }
    
    .nmd-link-badge--verified {
      background: var(--nmd-success);
      color: white;
    }
    
    .nmd-link-badge--disputed {
      background: var(--nmd-warning);
      color: white;
    }
    
    .nmd-link-badge--false {
      background: var(--nmd-error);
      color: white;
    }
    
    .nmd-link-badge--unknown {
      background: var(--nmd-trust-unknown);
      color: white;
    }
    
    .nmd-link-badge__tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 10px;
      background: var(--nmd-surface);
      border: 1px solid var(--nmd-border);
      border-radius: 4px;
      font-size: 11px;
      color: var(--nmd-text);
      white-space: nowrap;
      box-shadow: 0 4px 12px var(--nmd-shadow);
      display: none;
      z-index: 2147483647;
    }
    
    .nmd-link-badge:hover .nmd-link-badge__tooltip {
      display: block;
    }
    
    /* Expanded Metadata Panel */
    .nmd-panel {
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      width: 400px;
      max-height: 80vh;
      background: var(--nmd-background);
      border: 1px solid var(--nmd-border);
      border-radius: 12px;
      box-shadow: 0 20px 60px var(--nmd-shadow);
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    
    .nmd-panel--visible {
      display: flex;
    }
    
    .nmd-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: var(--nmd-surface);
      border-bottom: 1px solid var(--nmd-border);
    }
    
    .nmd-panel__title {
      font-size: 15px;
      font-weight: 600;
      color: var(--nmd-text);
    }
    
    .nmd-panel__close {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--nmd-text-muted);
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    
    .nmd-panel__close:hover {
      background: var(--nmd-surface-hover);
      color: var(--nmd-text);
    }
    
    .nmd-panel__tabs {
      display: flex;
      padding: 0 16px;
      background: var(--nmd-surface);
      border-bottom: 1px solid var(--nmd-border);
    }
    
    .nmd-panel__tab {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 500;
      color: var(--nmd-text-muted);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .nmd-panel__tab:hover {
      color: var(--nmd-text);
    }
    
    .nmd-panel__tab--active {
      color: var(--nmd-primary);
      border-bottom-color: var(--nmd-primary);
    }
    
    .nmd-panel__content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    
    .nmd-panel__section {
      margin-bottom: 20px;
    }
    
    .nmd-panel__section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--nmd-text-muted);
      margin-bottom: 12px;
    }
    
    /* Trust Score Display */
    .nmd-trust-display {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: var(--nmd-surface);
      border-radius: 8px;
      margin-bottom: 16px;
    }
    
    .nmd-trust-display__score {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
      color: white;
    }
    
    .nmd-trust-display__details {
      flex: 1;
    }
    
    .nmd-trust-display__label {
      font-size: 14px;
      font-weight: 500;
      color: var(--nmd-text);
      margin-bottom: 4px;
    }
    
    .nmd-trust-display__meta {
      font-size: 12px;
      color: var(--nmd-text-muted);
    }
    
    /* Rating Item */
    .nmd-rating-item {
      padding: 12px;
      background: var(--nmd-surface);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    
    .nmd-rating-item__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .nmd-rating-item__author {
      font-size: 13px;
      font-weight: 500;
      color: var(--nmd-text);
    }
    
    .nmd-rating-item__date {
      margin-left: auto;
      font-size: 11px;
      color: var(--nmd-text-muted);
    }
    
    .nmd-rating-item__scores {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .nmd-rating-item__score {
      font-size: 11px;
      padding: 2px 8px;
      background: var(--nmd-background);
      border-radius: 4px;
      color: var(--nmd-text-muted);
    }

    .nmd-rating-item__overall {
      font-size: 12px;
      font-weight: 600;
      color: var(--nmd-primary);
    }

    .nmd-rating-item__confidence {
      font-size: 11px;
      color: var(--nmd-text-muted);
      margin-top: 8px;
    }

    .nmd-rating-item__review {
      font-size: 13px;
      color: var(--nmd-text);
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--nmd-border);
      white-space: pre-wrap;
    }

    /* Rating Dimension Bars */
    .nmd-rating-dimension {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .nmd-rating-dimension__label {
      font-size: 11px;
      color: var(--nmd-text-muted);
      min-width: 70px;
      text-transform: capitalize;
    }

    .nmd-rating-dimension__bar {
      flex: 1;
      height: 8px;
      background: var(--nmd-background);
      border-radius: 4px;
      overflow: hidden;
    }

    .nmd-rating-dimension__fill {
      height: 100%;
      background: linear-gradient(90deg, var(--nmd-warning), var(--nmd-success));
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .nmd-rating-dimension__value {
      font-size: 11px;
      color: var(--nmd-text);
      min-width: 35px;
      text-align: right;
    }

    /* Comment Items */
    .nmd-comment-item {
      padding: 12px;
      background: var(--nmd-surface);
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .nmd-comment-item--reply {
      margin-left: 24px;
      border-left: 2px solid var(--nmd-border);
    }

    .nmd-comment-item__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .nmd-comment-item__author {
      font-size: 12px;
      font-weight: 500;
      color: var(--nmd-primary);
    }

    .nmd-comment-item__date {
      font-size: 11px;
      color: var(--nmd-text-muted);
    }

    .nmd-comment-item__content {
      font-size: 13px;
      color: var(--nmd-text);
      line-height: 1.5;
      white-space: pre-wrap;
    }
    
    /* Fact Check Item */
    .nmd-fact-check-item {
      padding: 12px;
      background: var(--nmd-surface);
      border-radius: 8px;
      margin-bottom: 8px;
      border-left: 3px solid var(--nmd-border);
    }
    
    .nmd-fact-check-item--false {
      border-left-color: var(--nmd-error);
    }
    
    .nmd-fact-check-item--misleading {
      border-left-color: var(--nmd-warning);
    }
    
    .nmd-fact-check-item--true {
      border-left-color: var(--nmd-success);
    }
    
    .nmd-fact-check-item__verdict {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    
    .nmd-fact-check-item__verdict--false {
      background: var(--nmd-error);
      color: white;
    }
    
    .nmd-fact-check-item__verdict--misleading {
      background: var(--nmd-warning);
      color: white;
    }
    
    .nmd-fact-check-item__verdict--true {
      background: var(--nmd-success);
      color: white;
    }
    
    .nmd-fact-check-item__claim {
      font-size: 13px;
      color: var(--nmd-text);
      margin-bottom: 8px;
    }
    
    .nmd-fact-check-item__evidence {
      font-size: 12px;
      color: var(--nmd-text-muted);
    }
    
    /* Empty State */
    .nmd-empty {
      text-align: center;
      padding: 32px;
      color: var(--nmd-text-muted);
    }
    
    .nmd-empty__icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    
    .nmd-empty__text {
      font-size: 13px;
    }
    
    /* Loading State */
    .nmd-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }
    
    .nmd-loading__spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--nmd-border);
      border-top-color: var(--nmd-primary);
      border-radius: 50%;
      animation: nmd-spin 0.8s linear infinite;
    }
    
    @keyframes nmd-spin {
      to { transform: rotate(360deg); }
    }
  `;

  // ============================================
  // SECTION 13.7: METADATA UI COMPONENTS
  // ============================================
  
  /**
   * UI components for displaying URL metadata
   */
  const MetadataUI = {
    elements: {},
    state: {
      metadata: null,
      isLoading: false,
      isPanelOpen: false,
      isBadgeMinimized: false,
      activeTab: 'overview',
      bannerDismissed: false
    },
    
    /**
     * Initialize the metadata display UI
     */
    init: () => {
      Utils.log('Initializing Metadata UI...');
      
      // Inject styles
      GM_addStyle(METADATA_STYLES);
      
      // Create UI components
      MetadataUI.createBadge();
      MetadataUI.createPanel();
      MetadataUI.createDebunkBanner();
      
      Utils.log('Metadata UI initialized');
    },
    
    /**
     * Create the floating metadata badge
     */
    createBadge: () => {
      const badge = document.createElement('div');
      badge.className = 'nmd-badge';
      badge.innerHTML = `
        <div class="nmd-badge__container" title="Click for URL metadata">
          <div class="nmd-badge__score nmd-badge__score--unknown">?</div>
          <div class="nmd-badge__stats">
            <div class="nmd-badge__stat">
              <span class="nmd-badge__stat-icon">📝</span>
              <span class="nmd-badge__stat-value" data-stat="annotations">0</span>
            </div>
            <div class="nmd-badge__stat">
              <span class="nmd-badge__stat-icon">⭐</span>
              <span class="nmd-badge__stat-value" data-stat="ratings">0</span>
            </div>
          </div>
          <button class="nmd-badge__minimize" title="Minimize">−</button>
        </div>
      `;
      
      document.body.appendChild(badge);
      MetadataUI.elements.badge = badge;
      
      // Event listeners
      badge.querySelector('.nmd-badge__container').addEventListener('click', (e) => {
        if (!e.target.classList.contains('nmd-badge__minimize')) {
          MetadataUI.togglePanel();
        }
      });
      
      badge.querySelector('.nmd-badge__minimize').addEventListener('click', (e) => {
        e.stopPropagation();
        MetadataUI.toggleBadgeMinimize();
      });
    },
    
    /**
     * Create the expanded metadata panel
     */
    createPanel: () => {
      const panel = document.createElement('div');
      panel.className = 'nmd-panel';
      panel.innerHTML = `
        <div class="nmd-panel__header">
          <span class="nmd-panel__title">URL Metadata</span>
          <button class="nmd-panel__close" title="Close">×</button>
        </div>
        <div class="nmd-panel__tabs">
          <button class="nmd-panel__tab nmd-panel__tab--active" data-tab="overview">Overview</button>
          <button class="nmd-panel__tab" data-tab="ratings">Ratings</button>
          <button class="nmd-panel__tab" data-tab="comments">Comments</button>
          <button class="nmd-panel__tab" data-tab="annotations">Notes</button>
          <button class="nmd-panel__tab" data-tab="factchecks">Fact-Checks</button>
        </div>
        <div class="nmd-panel__content" id="nmd-panel-content">
          <div class="nmd-loading">
            <div class="nmd-loading__spinner"></div>
          </div>
        </div>
      `;
      
      document.body.appendChild(panel);
      MetadataUI.elements.panel = panel;
      
      // Event listeners
      panel.querySelector('.nmd-panel__close').addEventListener('click', () => {
        MetadataUI.closePanel();
      });
      
      panel.querySelectorAll('.nmd-panel__tab').forEach(tab => {
        tab.addEventListener('click', () => {
          MetadataUI.switchTab(tab.dataset.tab);
        });
      });
    },
    
    /**
     * Create the debunking banner (hidden by default)
     */
    createDebunkBanner: () => {
      const banner = document.createElement('div');
      banner.className = 'nmd-debunk-banner';
      banner.style.display = 'none';
      banner.innerHTML = `
        <div class="nmd-debunk-banner__content">
          <span class="nmd-debunk-banner__icon">⚠️</span>
          <div class="nmd-debunk-banner__text">
            <div class="nmd-debunk-banner__title">This content has been fact-checked</div>
            <div class="nmd-debunk-banner__detail">Loading details...</div>
          </div>
          <div class="nmd-debunk-banner__source">
            <span>by </span>
            <span class="nmd-debunk-banner__author">Checking...</span>
          </div>
          <button class="nmd-debunk-banner__dismiss">I Understand</button>
        </div>
      `;
      
      document.body.appendChild(banner);
      MetadataUI.elements.debunkBanner = banner;
      
      // Dismiss handler
      banner.querySelector('.nmd-debunk-banner__dismiss').addEventListener('click', () => {
        MetadataUI.dismissDebunkBanner();
      });
    },
    
    /**
     * Update the badge with metadata
     * @param {Object} metadata - Aggregated metadata
     */
    updateBadge: (metadata) => {
      const badge = MetadataUI.elements.badge;
      if (!badge) return;
      
      const scoreEl = badge.querySelector('.nmd-badge__score');
      const annotationsEl = badge.querySelector('[data-stat="annotations"]');
      const ratingsEl = badge.querySelector('[data-stat="ratings"]');
      
      // Update stats
      annotationsEl.textContent = metadata.aggregates.annotationCount || 0;
      ratingsEl.textContent = metadata.aggregates.ratingCounts.total || 0;
      
      // Update trust score
      const trustScore = metadata.aggregates.trustScore;
      scoreEl.classList.remove('nmd-badge__score--high', 'nmd-badge__score--medium',
                               'nmd-badge__score--low', 'nmd-badge__score--unknown');
      
      if (trustScore !== null && trustScore !== undefined) {
        const scorePercent = Math.round(trustScore * 100);
        scoreEl.textContent = scorePercent;
        
        if (trustScore >= 0.7) {
          scoreEl.classList.add('nmd-badge__score--high');
        } else if (trustScore >= 0.4) {
          scoreEl.classList.add('nmd-badge__score--medium');
        } else {
          scoreEl.classList.add('nmd-badge__score--low');
        }
      } else {
        scoreEl.textContent = '?';
        scoreEl.classList.add('nmd-badge__score--unknown');
      }
      
      // Check for alerts
      if (metadata.aggregates.verdictSummary?.hasDebunking) {
        badge.classList.add('nmd-badge--alert');
      } else {
        badge.classList.remove('nmd-badge--alert');
      }
    },
    
    /**
     * Show debunking banner if needed
     * @param {Object} metadata - Aggregated metadata
     */
    showDebunkBannerIfNeeded: (metadata) => {
      if (MetadataUI.state.bannerDismissed) return;
      
      const verdict = metadata.aggregates.verdictSummary;
      if (!verdict || !verdict.hasDebunking) return;
      
      const banner = MetadataUI.elements.debunkBanner;
      if (!banner) return;
      
      // Find the most authoritative fact check
      const factChecks = metadata.factChecks.filter(fc =>
        fc.content.verdict === 'false' || fc.content.verdict === 'misleading'
      );
      
      if (factChecks.length === 0) return;
      
      const topFactCheck = factChecks[0];
      
      // Update banner content
      const isFalse = topFactCheck.content.verdict === 'false';
      banner.classList.toggle('nmd-debunk-banner--misleading', !isFalse);
      
      const titleEl = banner.querySelector('.nmd-debunk-banner__title');
      const detailEl = banner.querySelector('.nmd-debunk-banner__detail');
      const authorEl = banner.querySelector('.nmd-debunk-banner__author');
      
      titleEl.textContent = isFalse
        ? '⚠️ This content has been rated FALSE'
        : '⚠️ This content may be MISLEADING';
      
      detailEl.textContent = topFactCheck.content.claim || 'Claims in this content have been disputed.';
      authorEl.textContent = topFactCheck.pubkey.substring(0, 8) + '...';
      
      banner.style.display = 'block';
    },
    
    /**
     * Dismiss the debunking banner
     */
    dismissDebunkBanner: () => {
      MetadataUI.state.bannerDismissed = true;
      const banner = MetadataUI.elements.debunkBanner;
      if (banner) {
        banner.style.display = 'none';
      }
    },
    
    /**
     * Toggle badge minimized state
     */
    toggleBadgeMinimize: () => {
      MetadataUI.state.isBadgeMinimized = !MetadataUI.state.isBadgeMinimized;
      const badge = MetadataUI.elements.badge;
      if (badge) {
        badge.classList.toggle('nmd-badge--minimized', MetadataUI.state.isBadgeMinimized);
      }
    },
    
    /**
     * Toggle the expanded panel
     */
    togglePanel: () => {
      if (MetadataUI.state.isPanelOpen) {
        MetadataUI.closePanel();
      } else {
        MetadataUI.openPanel();
      }
    },
    
    /**
     * Open the expanded panel
     */
    openPanel: () => {
      MetadataUI.state.isPanelOpen = true;
      const panel = MetadataUI.elements.panel;
      if (panel) {
        panel.classList.add('nmd-panel--visible');
        MetadataUI.renderPanelContent();
      }
    },
    
    /**
     * Close the expanded panel
     */
    closePanel: () => {
      MetadataUI.state.isPanelOpen = false;
      const panel = MetadataUI.elements.panel;
      if (panel) {
        panel.classList.remove('nmd-panel--visible');
      }
    },
    
    /**
     * Switch panel tab
     * @param {string} tab - Tab name
     */
    switchTab: (tab) => {
      MetadataUI.state.activeTab = tab;
      
      // Update tab buttons
      const panel = MetadataUI.elements.panel;
      panel.querySelectorAll('.nmd-panel__tab').forEach(t => {
        t.classList.toggle('nmd-panel__tab--active', t.dataset.tab === tab);
      });
      
      MetadataUI.renderPanelContent();
    },
    
    /**
     * Render panel content based on active tab
     */
    renderPanelContent: () => {
      const contentEl = document.getElementById('nmd-panel-content');
      if (!contentEl) return;
      
      const metadata = MetadataUI.state.metadata;
      
      if (MetadataUI.state.isLoading) {
        contentEl.innerHTML = `
          <div class="nmd-loading">
            <div class="nmd-loading__spinner"></div>
          </div>
        `;
        return;
      }
      
      if (!metadata) {
        contentEl.innerHTML = `
          <div class="nmd-empty">
            <div class="nmd-empty__icon">📭</div>
            <div class="nmd-empty__text">No metadata found for this URL</div>
          </div>
        `;
        return;
      }
      
      switch (MetadataUI.state.activeTab) {
        case 'overview':
          contentEl.innerHTML = MetadataUI.renderOverviewTab(metadata);
          break;
        case 'ratings':
          contentEl.innerHTML = MetadataUI.renderRatingsTab(metadata);
          break;
        case 'annotations':
          contentEl.innerHTML = MetadataUI.renderAnnotationsTab(metadata);
          break;
        case 'factchecks':
          contentEl.innerHTML = MetadataUI.renderFactChecksTab(metadata);
          break;
        case 'comments':
          contentEl.innerHTML = MetadataUI.renderCommentsTab(metadata);
          break;
      }
    },
    
    /**
     * Render overview tab content
     */
    renderOverviewTab: (metadata) => {
      const trustScore = metadata.aggregates.trustScore;
      const trustClass = trustScore >= 0.7 ? 'high' : trustScore >= 0.4 ? 'medium' : 'low';
      const trustLabel = trustScore >= 0.7 ? 'Highly Trusted' : trustScore >= 0.4 ? 'Mixed Reviews' : 'Low Trust';
      
      return `
        <div class="nmd-trust-display">
          <div class="nmd-trust-display__score" style="background: var(--nmd-trust-${trustClass})">
            ${trustScore !== null ? Math.round(trustScore * 100) : '?'}
          </div>
          <div class="nmd-trust-display__details">
            <div class="nmd-trust-display__label">${trustLabel}</div>
            <div class="nmd-trust-display__meta">
              Based on ${metadata.ratings.length} ratings, ${metadata.factChecks.length} fact-checks
            </div>
          </div>
        </div>
        
        <div class="nmd-panel__section">
          <div class="nmd-panel__section-title">Summary</div>
          <div style="font-size: 13px; color: var(--nmd-text);">
            <p>📝 ${metadata.annotations.length} annotations</p>
            <p>⭐ ${metadata.ratings.length} ratings</p>
            <p>🔍 ${metadata.factChecks.length} fact-checks</p>
            <p>📰 ${metadata.headlineCorrections.length} headline corrections</p>
          </div>
        </div>
        
        ${metadata.aggregates.verdictSummary?.hasDebunking ? `
          <div class="nmd-panel__section">
            <div class="nmd-panel__section-title">⚠️ Alerts</div>
            <div class="nmd-fact-check-item nmd-fact-check-item--${metadata.aggregates.verdictSummary.primary}">
              <span class="nmd-fact-check-item__verdict nmd-fact-check-item__verdict--${metadata.aggregates.verdictSummary.primary}">
                ${metadata.aggregates.verdictSummary.primary.toUpperCase()}
              </span>
              <div class="nmd-fact-check-item__claim">
                This content has been flagged by ${metadata.factChecks.length} fact-checker(s).
              </div>
            </div>
          </div>
        ` : ''}
      `;
    },
    
    /**
     * Render ratings tab content
     */
    renderRatingsTab: (metadata) => {
      if (metadata.ratings.length === 0) {
        return `
          <div class="nmd-empty">
            <div class="nmd-empty__icon">⭐</div>
            <div class="nmd-empty__text">No ratings yet</div>
          </div>
        `;
      }
      
      return metadata.ratings.map(rating => {
        // Extract rating dimensions from tags
        const ratingTags = rating.tags?.filter(t => t[0] === 'rating') || [];
        const overallTag = rating.tags?.find(t => t[0] === 'overall');
        const confidenceTag = rating.tags?.find(t => t[0] === 'confidence');
        
        const dimensionScores = ratingTags.map(t => ({
          dimension: t[1],
          score: parseInt(t[2], 10),
          maxScore: parseInt(t[3], 10) || 10
        }));
        
        const overallScore = overallTag ? parseFloat(overallTag[1]) : null;
        const confidence = confidenceTag ? parseInt(confidenceTag[1], 10) : null;
        
        return `
          <div class="nmd-rating-item">
            <div class="nmd-rating-item__header">
              <span class="nmd-rating-item__author">${rating.pubkey.substring(0, 8)}...</span>
              <span class="nmd-rating-item__date">${Utils.formatDate(rating.createdAt)}</span>
              ${overallScore !== null ? `<span class="nmd-rating-item__overall">Overall: ${overallScore}/10</span>` : ''}
            </div>
            <div class="nmd-rating-item__scores">
              ${dimensionScores.map(({dimension, score, maxScore}) => `
                <div class="nmd-rating-dimension">
                  <span class="nmd-rating-dimension__label">${dimension}</span>
                  <div class="nmd-rating-dimension__bar">
                    <div class="nmd-rating-dimension__fill" style="width: ${(score/maxScore)*100}%"></div>
                  </div>
                  <span class="nmd-rating-dimension__value">${score}/${maxScore}</span>
                </div>
              `).join('')}
            </div>
            ${confidence !== null ? `<div class="nmd-rating-item__confidence">Confidence: ${confidence}%</div>` : ''}
            ${rating.content ? `<div class="nmd-rating-item__review">${Utils.escapeHtml(rating.content)}</div>` : ''}
          </div>
        `;
      }).join('');
    },
    
    /**
     * Render comments tab content
     */
    renderCommentsTab: (metadata) => {
      if (!metadata.comments || metadata.comments.length === 0) {
        return `
          <div class="nmd-empty">
            <div class="nmd-empty__icon">💬</div>
            <div class="nmd-empty__text">No comments yet</div>
          </div>
        `;
      }
      
      // Sort by createdAt descending (newest first)
      const sortedComments = [...metadata.comments].sort((a, b) => b.createdAt - a.createdAt);
      
      return sortedComments.map(comment => {
        // Check for reply threading
        const replyTag = comment.tags?.find(t => t[0] === 'e' && t[3] === 'reply');
        const isReply = !!replyTag;
        
        return `
          <div class="nmd-comment-item ${isReply ? 'nmd-comment-item--reply' : ''}">
            <div class="nmd-comment-item__header">
              <span class="nmd-comment-item__author">${comment.pubkey.substring(0, 8)}...</span>
              <span class="nmd-comment-item__date">${Utils.formatDate(comment.createdAt)}</span>
            </div>
            <div class="nmd-comment-item__content">
              ${Utils.escapeHtml(comment.content || '')}
            </div>
          </div>
        `;
      }).join('');
    },
    
    /**
     * Render annotations tab content
     */
    renderAnnotationsTab: (metadata) => {
      if (metadata.annotations.length === 0) {
        return `
          <div class="nmd-empty">
            <div class="nmd-empty__icon">📝</div>
            <div class="nmd-empty__text">No annotations yet</div>
          </div>
        `;
      }
      
      return metadata.annotations.map(ann => `
        <div class="nmd-rating-item">
          <div class="nmd-rating-item__header">
            <span class="nmd-rating-item__author">${ann.pubkey.substring(0, 8)}...</span>
            <span class="nmd-rating-item__date">${Utils.formatDate(ann.createdAt)}</span>
          </div>
          <div style="font-size: 13px; color: var(--nmd-text); margin-top: 8px;">
            ${Utils.escapeHtml(ann.content.text || ann.content.comment || JSON.stringify(ann.content))}
          </div>
        </div>
      `).join('');
    },
    
    /**
     * Render fact-checks tab content
     */
    renderFactChecksTab: (metadata) => {
      if (metadata.factChecks.length === 0) {
        return `
          <div class="nmd-empty">
            <div class="nmd-empty__icon">🔍</div>
            <div class="nmd-empty__text">No fact-checks yet</div>
          </div>
        `;
      }
      
      return metadata.factChecks.map(fc => {
        const verdict = fc.content.verdict || 'unverifiable';
        return `
          <div class="nmd-fact-check-item nmd-fact-check-item--${verdict}">
            <span class="nmd-fact-check-item__verdict nmd-fact-check-item__verdict--${verdict}">
              ${verdict.toUpperCase()}
            </span>
            <div class="nmd-fact-check-item__claim">
              ${Utils.escapeHtml(fc.content.claim || 'Claim not specified')}
            </div>
            <div class="nmd-fact-check-item__evidence">
              ${Utils.escapeHtml(fc.content.evidence || fc.content.summary || '')}
            </div>
          </div>
        `;
      }).join('');
    },
    
    /**
     * Add headline correction indicator to page
     * @param {Object} metadata - Aggregated metadata
     */
    addHeadlineCorrectionIndicators: (metadata) => {
      if (metadata.headlineCorrections.length === 0) return;
      
      // Find h1 elements
      const headings = document.querySelectorAll('h1');
      
      headings.forEach(heading => {
        // Check if already processed
        if (heading.querySelector('.nmd-headline-correction')) return;
        
        const correction = metadata.headlineCorrections[0];
        const indicator = document.createElement('span');
        indicator.className = 'nmd-headline-correction';
        indicator.innerHTML = `
          <span class="nmd-headline-correction__icon">!</span>
          <div class="nmd-headline-correction__popup">
            <div class="nmd-headline-correction__label">Suggested Correction</div>
            <div class="nmd-headline-correction__original">${Utils.escapeHtml(heading.textContent)}</div>
            <div class="nmd-headline-correction__suggested">${Utils.escapeHtml(correction.content.suggested || correction.content.correction || 'N/A')}</div>
            <div class="nmd-headline-correction__meta">
              <span>Problem: ${correction.content.problemType || 'clickbait'}</span>
              <span>by ${correction.pubkey.substring(0, 8)}...</span>
            </div>
          </div>
        `;
        
        heading.style.position = 'relative';
        heading.appendChild(indicator);
      });
    },
    
    /**
     * Add inline annotation highlights to page content
     * @param {Object} metadata - Aggregated metadata
     */
    addInlineAnnotationHighlights: (metadata) => {
      if (metadata.annotations.length === 0) return;
      
      for (const annotation of metadata.annotations) {
        if (!annotation.content.selector) continue;
        
        const selector = annotation.content.selector;
        
        // Handle text quote selectors
        if (selector.type === 'TextQuoteSelector' && selector.exact) {
          MetadataUI.highlightText(selector.exact, annotation);
        }
      }
    },
    
    /**
     * Highlight specific text in the page
     * @param {string} text - Text to highlight
     * @param {Object} annotation - Annotation data
     */
    highlightText: (text, annotation) => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const nodesToProcess = [];
      let node;
      
      while (node = walker.nextNode()) {
        if (node.textContent.includes(text)) {
          nodesToProcess.push(node);
        }
      }
      
      for (const textNode of nodesToProcess) {
        const parent = textNode.parentNode;
        if (parent.classList?.contains('nmd-annotation-highlight')) continue;
        
        const index = textNode.textContent.indexOf(text);
        if (index === -1) continue;
        
        const before = textNode.textContent.substring(0, index);
        const match = textNode.textContent.substring(index, index + text.length);
        const after = textNode.textContent.substring(index + text.length);
        
        const fragment = document.createDocumentFragment();
        
        if (before) {
          fragment.appendChild(document.createTextNode(before));
        }
        
        const highlight = document.createElement('span');
        highlight.className = 'nmd-annotation-highlight';
        highlight.textContent = match;
        highlight.innerHTML += `
          <div class="nmd-annotation-popup">
            <div class="nmd-annotation-popup__header">
              <div class="nmd-annotation-popup__avatar">📝</div>
              <span class="nmd-annotation-popup__author">${annotation.pubkey.substring(0, 8)}...</span>
              <span class="nmd-annotation-popup__trust">Verified</span>
            </div>
            <div class="nmd-annotation-popup__content">
              ${Utils.escapeHtml(annotation.content.text || annotation.content.comment || '')}
            </div>
            <div class="nmd-annotation-popup__actions">
              <button class="nmd-annotation-popup__action">👍 Agree</button>
              <button class="nmd-annotation-popup__action">👎 Disagree</button>
            </div>
          </div>
        `;
        fragment.appendChild(highlight);
        
        if (after) {
          fragment.appendChild(document.createTextNode(after));
        }
        
        parent.replaceChild(fragment, textNode);
        
        // Only highlight first occurrence
        break;
      }
    },
    
    /**
     * Add metadata badges to links in the page
     * @param {Object} linkMetadataMap - Map of link URLs to their metadata
     */
    addLinkMetadataBadges: async (linkMetadataMap) => {
      const links = document.querySelectorAll('article a, .content a, main a, .post a');
      
      for (const link of links) {
        if (link.querySelector('.nmd-link-badge')) continue;
        
        const href = link.href;
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) continue;
        
        const normalizedUrl = Utils.normalizeUrl(href);
        const metadata = linkMetadataMap.get(normalizedUrl);
        
        if (metadata) {
          const badge = document.createElement('span');
          badge.className = 'nmd-link-badge';
          
          // Determine badge type based on metadata
          if (metadata.aggregates.verdictSummary?.hasDebunking) {
            badge.classList.add('nmd-link-badge--false');
            badge.textContent = '!';
            badge.title = 'This link has been fact-checked as false or misleading';
          } else if (metadata.aggregates.trustScore >= 0.7) {
            badge.classList.add('nmd-link-badge--verified');
            badge.textContent = '✓';
            badge.title = 'Highly trusted source';
          } else if (metadata.aggregates.trustScore >= 0.4) {
            badge.classList.add('nmd-link-badge--disputed');
            badge.textContent = '?';
            badge.title = 'Mixed reviews';
          } else {
            badge.classList.add('nmd-link-badge--unknown');
            badge.textContent = '?';
            badge.title = 'Limited metadata available';
          }
          
          link.style.position = 'relative';
          link.appendChild(badge);
        }
      }
    },
    
    /**
     * Load and display metadata for the current page
     */
    loadCurrentPageMetadata: async () => {
      MetadataUI.state.isLoading = true;
      MetadataUI.renderPanelContent();
      
      try {
        const url = window.location.href;
        const metadata = await URLMetadataService.queryMetadata(url);
        
        MetadataUI.state.metadata = metadata;
        MetadataUI.state.isLoading = false;
        
        // Update UI components
        MetadataUI.updateBadge(metadata);
        MetadataUI.showDebunkBannerIfNeeded(metadata);
        MetadataUI.addHeadlineCorrectionIndicators(metadata);
        MetadataUI.addInlineAnnotationHighlights(metadata);
        
        // Render panel if open
        if (MetadataUI.state.isPanelOpen) {
          MetadataUI.renderPanelContent();
        }
        
        Utils.log('Metadata loaded:', metadata.eventCount, 'events');
        
        // Queue link metadata lookup (async, lower priority)
        MetadataUI.queueLinkMetadataLookup();
        
      } catch (e) {
        Utils.error('Failed to load metadata:', e);
        MetadataUI.state.isLoading = false;
        MetadataUI.renderPanelContent();
      }
    },
    
    /**
     * Queue link metadata lookup (batched, lower priority)
     */
    queueLinkMetadataLookup: async () => {
      // Get all links in main content
      const links = document.querySelectorAll('article a, .content a, main a');
      const uniqueUrls = new Set();
      
      for (const link of links) {
        const href = link.href;
        if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
          uniqueUrls.add(Utils.normalizeUrl(href));
        }
      }
      
      Utils.log('Found', uniqueUrls.size, 'unique links to check');
      
      // Limit to first 20 links for performance
      const urlsToCheck = Array.from(uniqueUrls).slice(0, 20);
      const linkMetadataMap = new Map();
      
      // Query in small batches
      for (let i = 0; i < urlsToCheck.length; i += 5) {
        const batch = urlsToCheck.slice(i, i + 5);
        
        await Promise.all(batch.map(async (url) => {
          try {
            const metadata = await URLMetadataService.queryMetadata(url);
            if (metadata.eventCount > 0) {
              linkMetadataMap.set(url, metadata);
            }
          } catch (e) {
            // Ignore individual link failures
          }
        }));
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Add badges to links with metadata
      MetadataUI.addLinkMetadataBadges(linkMetadataMap);
    }
  };

  // ============================================
  // SECTION 14: INITIALIZATION
  // ============================================
  
  async function init() {
    Utils.log('Starting NOSTR Article Capture v' + CONFIG.version);
    
    // Initialize storage
    await Storage.initialize();
    
    // Initialize local key manager
    await LocalKeyManager.init();
    
    // Initialize Article Capture UI (FAB and panel)
    UI.init();
    
    // Initialize URL Metadata Display UI (badge, panel, banner)
    MetadataUI.init();
    
    // Check for NIP-07 extension availability
    const nip07Available = NIP07Client.checkAvailability();
    if (nip07Available) {
      Utils.log('NIP-07 extension detected');
      UI.updateSigningStatus();
      UI.showToast('NIP-07 extension detected - Ready to publish!', 'success');
    } else {
      // Try to connect to NSecBunker in background as fallback
      Utils.log('No NIP-07 extension, trying NSecBunker...');
      NSecBunkerClient.connect().then(() => {
        Utils.log('NSecBunker connected');
        UI.updateSigningStatus();
        UI.updatePublishButton();
        UI.showToast('Connected to NSecBunker', 'success');
      }).catch((e) => {
        Utils.log('NSecBunker not available:', e.message);
        UI.updateSigningStatus();
        // Show helpful message about signing options
        Utils.log('No signing method available. Install a NIP-07 extension (nos2x, Alby) or run NSecBunker.');
      });
    }
    
    // Load URL metadata for the current page (async, non-blocking)
    // This queries NOSTR relays for existing metadata about this URL
    setTimeout(() => {
      MetadataUI.loadCurrentPageMetadata().catch(e => {
        Utils.log('Failed to load URL metadata:', e.message);
      });
    }, 1000); // Delay 1s to let page settle
    
    Utils.log('Initialization complete');
  }
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();