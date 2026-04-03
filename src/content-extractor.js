import { CONFIG } from './config.js';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export const ContentExtractor = {
  // Extract article using Readability (bundled via npm)
  extractArticle: () => {
    try {
      // Pre-process lazy-loaded images before cloning
      document.querySelectorAll('img[data-src], img[data-lazy-src], img[data-original], img[data-lazy]').forEach(img => {
          const lazySrc = img.dataset.src || img.dataset.lazySrc || img.dataset.original || img.dataset.lazy;
          if (lazySrc && (!img.src || img.src.includes('data:') || img.src.includes('placeholder') || img.src.includes('blank'))) {
              img.src = lazySrc;
          }
      });

      // Handle srcset fallback for images without proper src
      document.querySelectorAll('img[srcset]:not([src]), img[data-srcset]').forEach(img => {
          const srcset = img.srcset || img.dataset.srcset;
          if (srcset) {
              const firstUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
              if (firstUrl && (!img.src || img.src.includes('data:') || img.src.includes('placeholder'))) {
                  img.src = firstUrl;
              }
          }
      });

      // Handle noscript image fallbacks (many sites put real images in noscript tags)
      document.querySelectorAll('noscript').forEach(noscript => {
          const temp = document.createElement('div');
          temp.innerHTML = noscript.textContent || noscript.innerHTML;
          const noscriptImgs = temp.querySelectorAll('img[src]');
          noscriptImgs.forEach(nImg => {
              const parent = noscript.parentElement;
              if (parent) {
                  const existingImg = parent.querySelector('img');
                  if (existingImg && (!existingImg.src || existingImg.src.includes('data:') || existingImg.src.includes('placeholder'))) {
                      existingImg.src = nImg.src;
                      if (nImg.alt) existingImg.alt = nImg.alt;
                  }
              }
          });
      });

      // Fix A: Preserve original image dimensions before cloning
      // Small images (avatars, icons, emoji) get enlarged by max-width:100% in reader view
      document.querySelectorAll('img').forEach(img => {
          const naturalWidth = img.naturalWidth || parseInt(img.getAttribute('width')) || img.offsetWidth;
          const naturalHeight = img.naturalHeight || parseInt(img.getAttribute('height')) || img.offsetHeight;
          // Only tag small images (< 100px) to prevent enlargement in reader view
          if (naturalWidth > 0 && naturalWidth < 100) {
              img.classList.add('nac-inline-img');
              img.setAttribute('width', naturalWidth);
              img.setAttribute('height', naturalHeight || naturalWidth);
          }
      });

      // Pre-process embedded tweets before cloning (expanded selectors for NYT, etc.)
      document.querySelectorAll([
          'blockquote.twitter-tweet',
          'blockquote[cite*="twitter.com"]',
          'blockquote[cite*="x.com"]',
          '[data-tweet-id]',
          '[data-component="tweet-embed"]',
          '.tweet-embed',
          '.twitter-tweet',
          'div[class*="tweet-embed"]',
          'div[class*="twitter-tweet"]'
      ].join(', ')).forEach(tweet => {
          // Extract tweet text, author, and URL from the blockquote
          const tweetText = tweet.querySelector('p')?.textContent?.trim() || tweet.textContent?.trim() || '';
          const tweetLink = tweet.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
          const tweetUrl = tweetLink?.href || '';
          const authorEl = tweet.querySelector('a:not([href*="/status/"])') || tweet.querySelector('a');
          const authorName = authorEl?.textContent?.trim() || '';

          // Replace complex tweet HTML with clean blockquote
          const cleanTweet = document.createElement('blockquote');
          cleanTweet.className = 'nac-tweet-embed';
          cleanTweet.setAttribute('data-tweet-url', tweetUrl);
          cleanTweet.innerHTML = `<p>${tweetText}</p>` +
              (authorName ? `<footer>— ${authorName}</footer>` : '') +
              (tweetUrl ? `<cite><a href="${tweetUrl}">${tweetUrl}</a></cite>` : '');

          tweet.parentNode?.replaceChild(cleanTweet, tweet);
      });

      // Also handle Twitter avatar/profile images - constrain their size
      document.querySelectorAll('img[src*="pbs.twimg.com/profile_images"], img[src*="twimg.com/profile"]').forEach(img => {
          img.classList.add('nac-inline-img');
          img.style.width = '48px';
          img.style.height = '48px';
          img.style.borderRadius = '50%';
          img.setAttribute('width', '48');
          img.setAttribute('height', '48');
      });

      // Clone document for Readability
      const documentClone = document.cloneNode(true);
      
      // Readability is now bundled via npm import
      {
        const reader = new Readability(documentClone);
        const article = reader.parse();
        
        if (!article || article.textContent.length < CONFIG.extraction.min_content_length) {
          console.log('[NAC] Readability extraction failed or content too short');
          return null;
        }
        
        // Post-process extracted content to fix image URLs
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = article.content;

        tempDiv.querySelectorAll('img').forEach(img => {
            let src = img.getAttribute('src') || '';
            
            // Fix relative URLs
            if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('//')) {
                try { src = new URL(src, window.location.href).href; } catch(e) {}
                img.src = src;
            }
            
            // Fix protocol-relative URLs
            if (src.startsWith('//')) {
                img.src = window.location.protocol + src;
            }
            
            // Fix lazy-loaded images that Readability missed
            if (!src || src.includes('data:') || src.includes('placeholder') || src.includes('blank')) {
                const lazySrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') ||
                               img.getAttribute('data-original') || img.getAttribute('data-lazy');
                if (lazySrc) {
                    try { img.src = new URL(lazySrc, window.location.href).href; } catch(e) { img.src = lazySrc; }
                }
                
                // Try srcset
                if (!img.src || img.src.includes('data:')) {
                    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
                    if (srcset) {
                        const firstUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
                        if (firstUrl) {
                            try { img.src = new URL(firstUrl, window.location.href).href; } catch(e) { img.src = firstUrl; }
                        }
                    }
                }
            }
            
            // Remove images that still have no valid src
            if (!img.src || img.src === window.location.href || img.src === 'about:blank') {
                img.remove();
            }
        });

        article.content = tempDiv.innerHTML;
        
        // Add metadata
        article.url = ContentExtractor.getCanonicalUrl();
        article.domain = ContentExtractor.getDomain(article.url);
        article.extractedAt = Math.floor(Date.now() / 1000);
        
        // Extract publication date
        const dateResult = ContentExtractor.extractPublishedDate();
        if (dateResult) {
          article.publishedAt = dateResult.timestamp;
          article.publishedAtSource = dateResult.source;
        }
        
        // Extract featured image
        article.featuredImage = ContentExtractor.extractFeaturedImage();
        
        // Extract publication icon (favicon)
        article.publicationIcon = ContentExtractor.extractPublicationIcon();

        // --- Phase 1: Enhanced article metadata ---

        // Structured data (JSON-LD / Schema.org + meta tag fallbacks)
        article.structuredData = ContentExtractor.extractStructuredData();

        // Word count
        article.wordCount = (article.textContent || '').split(/\s+/).filter(w => w.length > 0).length;

        // Reading time estimate (225 wpm average)
        article.readingTimeMinutes = Math.ceil(article.wordCount / 225);

        // Date modified
        article.dateModified = ContentExtractor.extractDateModified();

        // Section / category
        article.section = article.structuredData.section || null;

        // Keywords / tags
        article.keywords = article.structuredData.keywords || [];

        // Content language
        article.language = article.structuredData.language || null;

        // Paywall detection
        article.isPaywalled = article.structuredData.isAccessibleForFree === false ||
                              !!document.querySelector('[class*="paywall"], [class*="subscriber"], [data-paywall]');

        return article;
      }
    } catch (e) {
      console.error('[NAC] Article extraction failed:', e);
      return ContentExtractor.extractSimple();
    }
  },

  // Simple fallback extraction
  extractSimple: () => {
    const title = document.querySelector('h1')?.textContent?.trim() ||
                  document.querySelector('meta[property="og:title"]')?.content ||
                  document.title;
    
    const byline = document.querySelector('meta[name="author"]')?.content ||
                   document.querySelector('.author')?.textContent?.trim() || '';
    
    const content = document.querySelector('article')?.innerHTML ||
                   document.querySelector('.post-content')?.innerHTML ||
                   document.querySelector('.entry-content')?.innerHTML ||
                   document.body.innerHTML;
    
    return {
      title,
      byline,
      content,
      textContent: content.replace(/<[^>]+>/g, ''),
      url: ContentExtractor.getCanonicalUrl(),
      domain: ContentExtractor.getDomain(window.location.href),
      extractedAt: Math.floor(Date.now() / 1000)
    };
  },

  // Get canonical URL with validation and cleaning
  getCanonicalUrl: () => {
    // 1. Canonical URL — most authoritative
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href) {
      try {
        const url = new URL(canonical.href);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return ContentExtractor.normalizeUrl(canonical.href);
        }
      } catch (e) { /* invalid URL, skip */ }
    }

    // 2. Open Graph URL — second most reliable
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl && ogUrl.content) {
      try {
        const url = new URL(ogUrl.content);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return ContentExtractor.normalizeUrl(ogUrl.content);
        }
      } catch (e) { /* invalid URL, skip */ }
    }

    // 3. Current page URL — fallback, clean tracking params
    return ContentExtractor.normalizeUrl(window.location.href);
  },

  // Extract domain from URL
  getDomain: (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  },

  // Normalize URL (remove tracking params, clean hash fragments)
  normalizeUrl: (url) => {
    try {
      const parsed = new URL(url);
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
        'fbclid', 'gclid', '_ga', '_gid', 'ref', 'source',
        'mc_cid', 'mc_eid', 'mkt_tok',
        'oly_anon_id', 'oly_enc_id',
        'vero_id', 'wickedid',
        '__twitter_impression', 'twclid',
        'igshid', 'spm', 'share_source', 'from'
      ];
      trackingParams.forEach(param => parsed.searchParams.delete(param));
      // Strip hash fragments that look like tracking (short random strings, dots, slashes)
      // Keep meaningful anchors like #section-name (6+ chars, word-like)
      if (parsed.hash) {
        const frag = parsed.hash.slice(1);
        const isTrackingHash = /^[.\/]/.test(frag) || /^[A-Za-z0-9]{1,5}$/.test(frag) || frag === '';
        if (isTrackingHash) {
          parsed.hash = '';
        }
      }
      return parsed.toString();
    } catch (e) {
      return url;
    }
  },

  // Extract published date
  extractPublishedDate: () => {
    // Try JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const articles = Array.isArray(data) ? data : [data];
        for (const item of articles) {
          if (item['@type'] === 'Article' || item['@type'] === 'NewsArticle' || item['@type'] === 'BlogPosting') {
            if (item.datePublished) {
              const date = new Date(item.datePublished);
              if (!isNaN(date.getTime())) {
                return { timestamp: Math.floor(date.getTime() / 1000), source: 'json-ld' };
              }
            }
          }
        }
      } catch (e) {
        // Continue to next
      }
    }
    
    // Try meta tags
    const metaSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="publication_date"]',
      'meta[name="date"]'
    ];
    
    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector);
      if (meta && meta.content) {
        const date = new Date(meta.content);
        if (!isNaN(date.getTime())) {
          return { timestamp: Math.floor(date.getTime() / 1000), source: 'meta-tag' };
        }
      }
    }
    
    // Try time elements
    const timeEl = document.querySelector('article time[datetime], .post time[datetime]');
    if (timeEl) {
      const datetime = timeEl.getAttribute('datetime');
      const date = new Date(datetime);
      if (!isNaN(date.getTime())) {
        return { timestamp: Math.floor(date.getTime() / 1000), source: 'time-element' };
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
      '.featured-image img'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const src = element.getAttribute('content') || element.getAttribute('src');
        if (src) {
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

  // Convert HTML to Markdown (Turndown bundled via npm)
  htmlToMarkdown: (html) => {
    try {
      const turndown = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*'
      });

      // Use GFM plugin for tables, strikethrough, task lists
      turndown.use(gfm);

        // Preserve images with alt text and src (with lazy-load fallback)
        turndown.addRule('images', {
          filter: 'img',
          replacement: (content, node) => {
            let src = node.getAttribute('src') || '';
            
            // Fallback to data-src, data-lazy-src, srcset
            if (!src || src.includes('data:') || src.includes('placeholder') || src.includes('blank')) {
              const dataSrc = node.getAttribute('data-src') || node.getAttribute('data-lazy-src') || node.getAttribute('data-original') || '';
              const srcset = node.getAttribute('srcset') || node.getAttribute('data-srcset') || '';
              
              if (dataSrc) {
                src = dataSrc;
              } else if (srcset) {
                src = srcset.split(',')[0].trim().split(/\s+/)[0];
              }
            }
            
            if (!src) return '';
            
            // Resolve relative URL
            try { src = new URL(src, window.location.href).href; } catch(e) {}
            
            const alt = node.getAttribute('alt') || '';
            const title = node.getAttribute('title');
            const width = parseInt(node.getAttribute('width')) || 0;
            const height = parseInt(node.getAttribute('height')) || width;

            // Fix D: Keep small images as inline HTML to preserve dimensions
            if (width > 0 && width < 100) {
              const radius = width < 60 ? '50%' : '4px';
              return `<img src="${src}" alt="${alt}" width="${width}" height="${height}" style="display:inline-block;vertical-align:middle;border-radius:${radius}">`;
            }

            if (title) {
              return `![${alt}](${src} "${title}")`;
            }
            return `![${alt}](${src})`;
          }
        });

        // Preserve figure/figcaption as image + italic caption (with lazy-load fallback)
        turndown.addRule('figure', {
          filter: 'figure',
          replacement: (content, node) => {
            const img = node.querySelector('img');
            const caption = node.querySelector('figcaption');
            let result = '';
            if (img) {
              const alt = img.getAttribute('alt') || caption?.textContent?.trim() || '';
              let src = img.getAttribute('src') || '';
              
              // Fallback to data-src, data-lazy-src, srcset
              if (!src || src.includes('data:') || src.includes('placeholder') || src.includes('blank')) {
                const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';
                const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
                
                if (dataSrc) {
                  src = dataSrc;
                } else if (srcset) {
                  src = srcset.split(',')[0].trim().split(/\s+/)[0];
                }
              }
              
              try { src = new URL(src, window.location.href).href; } catch (e) { /* keep original */ }
              if (src) result += `![${alt}](${src})`;
            }
            if (caption) {
              result += '\n*' + caption.textContent.trim() + '*';
            }
            return '\n\n' + result + '\n\n';
          }
        });

        // Preserve video/iframe embeds as links
        turndown.addRule('iframeEmbed', {
          filter: ['iframe', 'video'],
          replacement: (content, node) => {
            const src = node.getAttribute('src') || '';
            if (!src) return '';
            let absoluteSrc = src;
            try { absoluteSrc = new URL(src, window.location.href).href; } catch (e) { /* keep original */ }
            return `\n\n[Embedded media](${absoluteSrc})\n\n`;
          }
        });

        // Keep line breaks within paragraphs
        turndown.addRule('lineBreak', {
          filter: 'br',
          replacement: () => '  \n'
        });

        // Handle embedded tweet blockquotes
        turndown.addRule('tweetEmbed', {
          filter: function(node) {
            return (node.nodeName === 'BLOCKQUOTE' &&
                    (node.classList.contains('twitter-tweet') ||
                     node.classList.contains('nac-tweet-embed') ||
                     node.getAttribute('data-tweet-url')));
          },
          replacement: function(content, node) {
            const tweetUrl = node.getAttribute('data-tweet-url') || '';
            const paragraphs = node.querySelectorAll('p');
            const tweetText = Array.from(paragraphs).map(p => p.textContent.trim()).filter(t => t).join('\n');
            const footer = node.querySelector('footer');
            const authorName = footer?.textContent?.replace(/^—\s*/, '').trim() || '';

            let md = '> 🐦 **Tweet';
            if (authorName) md += ` by ${authorName}`;
            md += '**\n';
            md += '> \n';

            // Add tweet text as blockquote lines
            if (tweetText) {
              tweetText.split('\n').forEach(line => {
                md += `> ${line}\n`;
              });
            }

            if (tweetUrl) {
              md += '> \n';
              md += `> [View on Twitter/X](${tweetUrl})\n`;
            }

            return '\n' + md + '\n';
          }
        });

        // Handle Facebook post blocks
        turndown.addRule('facebookPost', {
          filter: function(node) {
            return node.nodeName === 'DIV' && node.classList.contains('nac-facebook-post');
          },
          replacement: function(content, node) {
            const authorName = node.querySelector('.nac-fb-author-name')?.textContent?.trim() || '';
            const timestamp = node.querySelector('.nac-fb-timestamp')?.textContent?.trim() || '';
            const postText = node.querySelector('.nac-fb-text')?.textContent?.trim() || '';

            let md = '> 📘 **Facebook Post';
            if (authorName) md += ` by ${authorName}`;
            md += '**\n> \n';

            if (postText) {
              postText.split('\n').forEach(line => {
                md += `> ${line}\n`;
              });
            }

            if (timestamp) {
              md += '> \n';
              md += `> *${timestamp}*\n`;
            }

            // Include images
            const images = node.querySelectorAll('.nac-fb-image');
            images.forEach(img => {
              const src = img.getAttribute('src') || '';
              if (src) md += `> \n> ![Post image](${src})\n`;
            });

            // Include shared links
            const links = node.querySelectorAll('.nac-fb-link');
            links.forEach(link => {
              const href = link.getAttribute('href') || '';
              const text = link.textContent?.trim() || href;
              if (href) md += `> \n> [${text}](${href})\n`;
            });

            return '\n' + md + '\n';
          }
        });

        // Handle Instagram post blocks
        turndown.addRule('instagramPost', {
          filter: function(node) {
            return node.nodeName === 'DIV' && node.classList.contains('nac-instagram-post');
          },
          replacement: function(content, node) {
            const authorName = node.querySelector('.nac-ig-author-name')?.textContent?.trim() || '';
            const timestamp = node.querySelector('.nac-ig-timestamp')?.textContent?.trim() || '';
            const captionEl = node.querySelector('.nac-ig-caption');
            let caption = captionEl?.textContent?.trim() || '';

            let md = '> 📷 **Instagram Post';
            if (authorName) md += ` by ${authorName}`;
            md += '**\n> \n';

            // Include images
            const images = node.querySelectorAll('.nac-ig-image');
            images.forEach(img => {
              const src = img.getAttribute('src') || '';
              if (src) md += `> ![Instagram media](${src})\n> \n`;
            });

            if (caption) {
              // Remove the author name prefix if present (it's in a separate span)
              if (authorName && caption.startsWith(authorName)) {
                caption = caption.substring(authorName.length).trim();
              }
              caption.split('\n').forEach(line => {
                md += `> ${line}\n`;
              });
            }

            if (timestamp) {
              md += '> \n';
              md += `> *${timestamp}*\n`;
            }

            return '\n' + md + '\n';
          }
        });

      return turndown.turndown(html);
    } catch (e) {
      console.error('[NAC] Markdown conversion failed:', e);
      return ContentExtractor._fallbackHtmlToMarkdown(html);
    }
  },

  // Fallback HTML-to-Markdown when Turndown is not loaded
  // Preserves headings, paragraphs, images, links, lists, blockquotes, emphasis
  _fallbackHtmlToMarkdown: (html) => {
    let md = html;

    // Normalize line breaks
    md = md.replace(/\r\n?/g, '\n');

    // Headings
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
    md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
    md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

    // Images — extract alt and src, resolve to absolute URL
    md = md.replace(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*\balt=["']([^"']*)["'][^>]*\/?>/gi, (m, src, alt) => {
      try { src = new URL(src, window.location.href).href; } catch (e) {}
      return `\n\n![${alt}](${src})\n\n`;
    });
    md = md.replace(/<img[^>]*\balt=["']([^"']*)["'][^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi, (m, alt, src) => {
      try { src = new URL(src, window.location.href).href; } catch (e) {}
      return `\n\n![${alt}](${src})\n\n`;
    });
    // img with src only (no alt)
    md = md.replace(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi, (m, src) => {
      try { src = new URL(src, window.location.href).href; } catch (e) {}
      return `\n\n![](${src})\n\n`;
    });

    // Links
    md = md.replace(/<a[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // Bold / Strong
    md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');

    // Italic / Emphasis
    md = md.replace(/<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, '*$2*');

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, inner) => {
      const lines = inner.replace(/<[^>]+>/g, '').trim().split('\n');
      return '\n\n' + lines.map(l => '> ' + l.trim()).join('\n') + '\n\n';
    });

    // Unordered list items
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, inner) => {
      return '- ' + inner.replace(/<[^>]+>/g, '').trim() + '\n';
    });
    md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');

    // Horizontal rules
    md = md.replace(/<hr[^>]*\/?>/gi, '\n\n---\n\n');

    // Paragraphs and divs → double newline
    md = md.replace(/<\/p>/gi, '\n\n');
    md = md.replace(/<p[^>]*>/gi, '');
    md = md.replace(/<br\s*\/?>/gi, '  \n');

    // Code blocks
    md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n\n```\n$1\n```\n\n');
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#039;/g, "'");
    md = md.replace(/&nbsp;/g, ' ');

    // Clean up excessive whitespace (but preserve double newlines for paragraphs)
    md = md.replace(/\n{3,}/g, '\n\n');
    md = md.trim();

    return md;
  },

  // Convert Markdown to HTML (lightweight renderer)
  // Handles the subset of markdown that htmlToMarkdown() produces
  markdownToHtml: (markdown) => {
    if (!markdown) return '';
    let html = markdown;

    // Escape HTML entities in the source (but preserve existing HTML-like structures minimally)
    html = html.replace(/&/g, '&amp;');
    html = html.replace(/</g, '&lt;');
    html = html.replace(/>/g, '&gt;');

    // Code blocks (fenced) — must be done before other block-level processing
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
      return `\n<pre><code>${code.trimEnd()}</code></pre>\n`;
    });

    // Code blocks (indented, 4 spaces) — collect consecutive indented lines
    html = html.replace(/(?:^|\n)((?:    .+\n?)+)/g, (m, block) => {
      const code = block.replace(/^    /gm, '');
      return `\n<pre><code>${code.trimEnd()}</code></pre>\n`;
    });

    // Inline code (must be before other inline processing)
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr>');

    // Headings (atx style)
    html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Images (must be before links)
    html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, alt, src, title) => {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<img src="${src}" alt="${alt}"${titleAttr}>`;
    });

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Bold and italic (bold first to handle ***)
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

    // Blockquotes — collect consecutive > lines into one blockquote
    html = html.replace(/(?:^&gt; .+$\n?)+/gm, (block) => {
      const inner = block.replace(/^&gt; ?/gm, '').trim();
      return `<blockquote><p>${inner}</p></blockquote>\n`;
    });

    // Unordered lists — collect consecutive - or * list items
    html = html.replace(/(?:^[\-\*] .+$\n?)+/gm, (block) => {
      const items = block.trim().split('\n').map(line => {
        const text = line.replace(/^[\-\*] /, '');
        return `<li>${text}</li>`;
      }).join('\n');
      return `<ul>\n${items}\n</ul>\n`;
    });

    // Ordered lists — collect consecutive numbered items
    html = html.replace(/(?:^\d+\. .+$\n?)+/gm, (block) => {
      const items = block.trim().split('\n').map(line => {
        const text = line.replace(/^\d+\. /, '');
        return `<li>${text}</li>`;
      }).join('\n');
      return `<ol>\n${items}\n</ol>\n`;
    });

    // Line breaks (two trailing spaces)
    html = html.replace(/ {2}\n/g, '<br>\n');

    // Paragraphs — split by double newlines, wrap non-block content in <p>
    const blocks = html.split(/\n{2,}/);
    html = blocks.map(block => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap block-level elements
      if (/^<(?:h[1-6]|p|ul|ol|li|blockquote|pre|hr|img|div)/i.test(block)) {
        return block;
      }
      return `<p>${block}</p>`;
    }).filter(Boolean).join('\n\n');

    return html;
  },

  // Extract publication favicon/icon
  extractPublicationIcon: () => {
    const selectors = [
      'link[rel="apple-touch-icon"][sizes="180x180"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"][sizes="192x192"]',
      'link[rel="icon"][sizes="128x128"]',
      'link[rel="icon"][type="image/png"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el?.href) {
        try { return new URL(el.href, window.location.href).href; } catch(e) {}
      }
    }
    // Fallback to /favicon.ico
    try { return new URL('/favicon.ico', window.location.href).href; } catch(e) {}
    return null;
  },

  // Extract structured data from JSON-LD and meta tags
  extractStructuredData: () => {
    const data = {};

    // Try JSON-LD first
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const json = JSON.parse(script.textContent);
        // Handle @graph arrays and top-level objects
        const candidates = json['@graph'] ? json['@graph'] : (Array.isArray(json) ? json : [json]);
        const article = candidates.find(item =>
          ['NewsArticle', 'Article', 'BlogPosting', 'OpinionPiece', 'Report', 'ScholarlyArticle', 'TechArticle', 'AnalysisNewsArticle', 'ReportageNewsArticle'].includes(item['@type'])
        );
        if (article) {
          data.type = article['@type'];
          data.dateModified = article.dateModified || null;
          data.section = article.articleSection || null;
          data.keywords = article.keywords || [];
          if (typeof data.keywords === 'string') {
            data.keywords = data.keywords.split(',').map(k => k.trim()).filter(k => k);
          }
          data.wordCount = article.wordCount || null;
          data.language = article.inLanguage || null;
          data.isAccessibleForFree = article.isAccessibleForFree != null ? article.isAccessibleForFree : null;
          data.isPartOf = article.isPartOf?.name || null;
          if (article.publisher) {
            data.publisher = {
              name: article.publisher.name || null,
              logo: article.publisher.logo?.url || article.publisher.logo || null,
              url: article.publisher.url || null
            };
          }
        }
      } catch (e) { /* malformed JSON-LD, skip */ }
    });

    // Fallback to meta tags for missing fields
    if (!data.section) {
      data.section = document.querySelector('meta[property="article:section"]')?.content ||
                     document.querySelector('meta[name="article:section"]')?.content || null;
    }
    if (!data.keywords?.length) {
      const kw = document.querySelector('meta[name="keywords"]')?.content ||
                 document.querySelector('meta[property="article:tag"]')?.content;
      if (kw) data.keywords = kw.split(',').map(k => k.trim()).filter(k => k);
    }
    if (!data.keywords) data.keywords = [];
    if (!data.language) {
      data.language = document.documentElement.lang ||
                      document.querySelector('meta[http-equiv="content-language"]')?.content || null;
    }

    return data;
  },

  // Extract date modified from JSON-LD, meta tags, or time elements
  extractDateModified: () => {
    // Try JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const json = JSON.parse(script.textContent);
        const candidates = json['@graph'] ? json['@graph'] : (Array.isArray(json) ? json : [json]);
        for (const item of candidates) {
          if (item.dateModified) {
            const date = new Date(item.dateModified);
            if (!isNaN(date.getTime())) {
              return item.dateModified;
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    // Try meta tags
    const metaSelectors = [
      'meta[property="article:modified_time"]',
      'meta[name="last-modified"]',
      'meta[name="dcterms.modified"]',
      'meta[property="og:updated_time"]'
    ];
    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector);
      if (meta?.content) {
        const date = new Date(meta.content);
        if (!isNaN(date.getTime())) {
          return meta.content;
        }
      }
    }

    // Try time elements with specific attributes
    const timeEl = document.querySelector('time[itemprop="dateModified"], time.updated, time.modified');
    if (timeEl) {
      const dt = timeEl.getAttribute('datetime');
      if (dt) {
        const date = new Date(dt);
        if (!isNaN(date.getTime())) return dt;
      }
    }

    return null;
  }
};
