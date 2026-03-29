import { Crypto } from './crypto.js';
import { Storage } from './storage.js';
import { PlatformAccount } from './platform-account.js';
import { Utils } from './utils.js';

export const CommentExtractor = {
    /**
     * Extract comments from the current page
     * @param {string} articleUrl - URL of the article these comments belong to
     * @param {string} platform - Platform identifier
     * @returns {Array} Array of comment objects
     */
    extractComments: async (articleUrl, platform) => {
        const commentElements = findCommentElements();
        const comments = [];
        
        for (const el of commentElements) {
            const comment = await parseComment(el, articleUrl, platform);
            if (comment) comments.push(comment);
        }
        
        return comments;
    },
    
    /**
     * Display captured comments in the reader view
     */
    renderCommentsSection: (container, comments, articleUrl) => {
        if (!comments || comments.length === 0) {
            container.innerHTML = '<p class="nac-comments-empty">No comments captured yet. Click "Capture Comments" to extract comments from this page.</p>';
            return;
        }
        
        let html = `<div class="nac-comments-header">
            <span>💬 Captured Comments (${comments.length})</span>
        </div>`;
        
        html += '<div class="nac-comments-list">';
        for (const comment of comments) {
            html += `<div class="nac-comment-item" data-comment-id="${Utils.escapeHtml(comment.id)}">
                <div class="nac-comment-meta">
                    ${comment.avatarUrl ? `<img class="nac-comment-avatar" src="${Utils.escapeHtml(comment.avatarUrl)}" width="24" height="24" onerror="this.style.display='none'">` : ''}
                    <span class="nac-comment-author">${Utils.escapeHtml(comment.authorName)}</span>
                    <span class="nac-comment-platform">@${Utils.escapeHtml(comment.platform)}</span>
                    ${comment.timestamp ? `<span class="nac-comment-time">${new Date(comment.timestamp).toLocaleDateString()}</span>` : ''}
                </div>
                <div class="nac-comment-text">${Utils.escapeHtml(comment.text)}</div>
                ${comment.replyTo ? `<div class="nac-comment-reply-indicator">↩ Reply</div>` : ''}
            </div>`;
        }
        html += '</div>';
        
        container.innerHTML = html;
    },
    
    /**
     * Save captured comments to storage
     */
    saveComments: async (comments) => {
        if (comments.length > 0) {
            await Storage.comments.saveMany(comments);
            Utils.showToast(`Captured ${comments.length} comments`, 'success');
        }
    }
};

// Private helpers

function findCommentElements() {
    // Try multiple common comment selectors
    const selectors = [
        // Generic
        '.comment, .Comment',
        '[class*="comment-item"], [class*="commentItem"]',
        '[class*="comment-body"], [class*="commentBody"]',
        '[data-component="comment"]',
        // Disqus
        '.post-content .post',
        '#disqus_thread .post',
        // WordPress
        '.comment-list > li',
        '.wp-comment',
        // Medium/Substack
        '.response, .comment-content',
        // Generic article comments
        '#comments .comment, .comments-section .comment',
        '[role="comment"]',
        'article.comment'
    ];
    
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) return Array.from(elements);
    }
    
    return [];
}

async function parseComment(el, articleUrl, platform) {
    // Extract author info
    const authorEl = el.querySelector(
        '[class*="author"], [class*="username"], [class*="user-name"], ' +
        '.comment-author, .commenter, [data-author]'
    );
    const authorName = authorEl?.textContent?.trim() || 
                       el.getAttribute('data-author') || 
                       'Anonymous';
    
    // Extract comment text
    const textEl = el.querySelector(
        '[class*="comment-text"], [class*="comment-body"], [class*="commentText"], ' +
        '.comment-content, p'
    );
    const text = textEl?.textContent?.trim() || el.textContent?.trim() || '';
    
    if (!text || text.length < 2) return null;
    
    // Extract timestamp
    const timeEl = el.querySelector('time, [datetime], [class*="timestamp"], [class*="date"]');
    const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || null;
    
    // Extract avatar
    const avatarEl = el.querySelector('img[class*="avatar"], img[class*="profile"]');
    const avatarUrl = avatarEl?.src || null;
    
    // Extract profile URL
    const profileLink = authorEl?.closest('a') || el.querySelector('a[href*="/user/"], a[href*="/profile/"]');
    const profileUrl = profileLink?.href || null;
    
    // Check if this is a reply
    const isReply = !!el.closest('[class*="reply"], [class*="child"], [class*="nested"]') ||
                    el.parentElement?.closest('.comment') !== null;
    
    // Create or get platform account for this commenter
    const account = await PlatformAccount.getOrCreate(authorName, platform, profileUrl, avatarUrl);
    account.commentCount++;
    
    // Create comment object
    const commentId = 'comment_' + await Crypto.sha256(articleUrl + authorName + text.substring(0, 100));
    
    return {
        id: commentId,
        text,
        authorName,
        authorAccountId: account.id,
        avatarUrl,
        platform,
        sourceUrl: articleUrl,
        timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
        replyTo: isReply ? 'parent' : null,  // simplified for now
        capturedAt: Date.now()
    };
}
