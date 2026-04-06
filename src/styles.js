export const STYLES = `
  /* CSS Variables */
  :root {
    --nac-primary: #6366f1;
    --nac-primary-hover: #4f46e5;
    --nac-success: #22c55e;
    --nac-error: #ef4444;
    --nac-bg: #fafaf9;
    --nac-text: #1a1a1a;
    --nac-text-muted: #6b7280;
    --nac-border: #e5e7eb;
    --nac-surface: #ffffff;
    --nac-entity-person: #8b5cf6;
    --nac-entity-org: #0891b2;
    --nac-entity-place: #16a34a;
    --nac-entity-thing: #4a9eff;
  }
  
  @media (prefers-color-scheme: dark) {
    :root {
      --nac-bg: #1a1a1a;
      --nac-text: #e5e7eb;
      --nac-text-muted: #9ca3af;
      --nac-border: #374151;
      --nac-surface: #2a2a2a;
    }
  }
  
  /* FAB Button styles are inside Shadow DOM — see init() */
  
  /* Reader Container */
  .nac-reader-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--nac-bg);
    color: var(--nac-text);
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  
  /* YouTube video layout — half-page overlay leaving player visible */
  .nac-reader-container.nac-video-layout {
    top: 40vh !important;
    height: 60vh !important;
    border-top: 2px solid var(--nac-primary);
    border-radius: 12px 12px 0 0;
  }

  @media (max-width: 768px) {
    .nac-reader-container.nac-video-layout {
      top: 35vh !important;
      height: 65vh !important;
    }
  }
  
  /* Toolbar */
  .nac-reader-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    background: var(--nac-surface);
    border-bottom: 1px solid var(--nac-border);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  .nac-toolbar-title {
    flex: 1;
    font-weight: 600;
    color: var(--nac-text-muted);
  }
  
  .nac-toolbar-actions {
    display: flex;
    gap: 8px;
  }
  
  .nac-btn-back,
  .nac-btn-toolbar {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    color: var(--nac-text);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .nac-btn-back:hover,
  .nac-btn-toolbar:hover {
    background: var(--nac-bg);
  }
  
  .nac-btn-toolbar.nac-btn-primary {
    background: var(--nac-primary);
    color: white;
    border-color: var(--nac-primary);
  }
  
  .nac-btn-toolbar.active {
    background: var(--nac-success);
    color: white;
    border-color: var(--nac-success);
  }
  
  /* Reader Content */
  .nac-reader-content {
    flex: 1;
    overflow-y: auto;
    padding: 40px 20px;
  }
  
  .nac-reader-article {
    max-width: var(--reader-max-width, 680px);
    margin: 0 auto;
  }
  
  /* Masthead */
  .nac-masthead {
    margin: -24px -24px 24px -24px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--nac-border);
    display: flex;
    align-items: center;
  }

  .nac-masthead-inner {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .nac-masthead-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .nac-masthead-name {
    font-weight: 600;
    font-size: 1.1em;
    color: var(--nac-text);
  }

  .nac-masthead-domain {
    font-size: 0.8em;
    color: var(--nac-text-muted);
  }

  .nac-masthead-link {
    margin-left: auto;
    color: var(--nac-primary);
    text-decoration: none;
    font-size: 0.85em;
    padding: 6px 12px;
    border: 1px solid var(--nac-primary);
    border-radius: 6px;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .nac-masthead-link:hover {
    background: var(--nac-primary);
    color: white;
  }

  /* Featured Image */
  .nac-featured-image {
    margin: 0 -24px 24px -24px;
    text-align: center;
  }

  .nac-featured-image img {
    max-width: 100%;
    max-height: 500px;
    object-fit: contain;
    border-radius: 0;
  }

  /* Article Header */
  .nac-article-header {
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--nac-border);
  }
  
  .nac-article-title {
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 16px;
    outline: none;
  }
  
  .nac-article-title[contenteditable="true"] {
    padding: 8px;
    border: 2px dashed var(--nac-primary);
    border-radius: 4px;
  }
  
  .nac-article-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 14px;
    color: var(--nac-text-muted);
    margin-bottom: 12px;
  }
  
  .nac-meta-separator {
    opacity: 0.5;
  }
  
  .nac-meta-icon {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    margin-right: 6px;
    vertical-align: middle;
    object-fit: contain;
  }
  
  .nac-editable-field {
    cursor: pointer;
    position: relative;
    border-bottom: 1px dashed transparent;
    transition: border-color 0.2s, background-color 0.2s;
    padding: 2px 4px;
    border-radius: 3px;
  }
  
  .nac-editable-field:hover {
    border-bottom-color: var(--nac-primary);
    background-color: rgba(99, 102, 241, 0.08);
  }
  
  .nac-editable-field:hover::after {
    content: ' ✏️';
    font-size: 11px;
  }
  
  .nac-inline-edit-input {
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--nac-primary);
    color: var(--nac-text-muted);
    font: inherit;
    font-size: inherit;
    padding: 2px 4px;
    margin: 0;
    outline: none;
    width: auto;
    min-width: 120px;
    max-width: 300px;
    box-sizing: border-box;
  }
  
  .nac-inline-edit-input:focus {
    border-bottom-color: var(--nac-primary);
    background-color: rgba(99, 102, 241, 0.05);
  }
  
  .nac-inline-edit-input[type="date"] {
    min-width: 160px;
    color-scheme: dark;
  }
  
  @media (prefers-color-scheme: light) {
    .nac-inline-edit-input[type="date"] {
      color-scheme: light;
    }
  }
  
  .nac-article-source {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--nac-text-muted);
    margin-bottom: 8px;
  }
  
  .nac-source-url {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    cursor: pointer;
    border-bottom: 1px dashed var(--nac-border);
    padding-bottom: 1px;
  }
  
  .nac-source-url:hover {
    color: var(--nac-accent);
    border-bottom-color: var(--nac-accent);
  }
  
  .nac-source-link {
    color: var(--nac-text-muted);
    text-decoration: none;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  
  .nac-source-link:hover {
    color: var(--nac-accent);
    background: var(--nac-surface);
  }
  
  .nac-btn-copy {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    color: var(--nac-text-muted);
    cursor: pointer;
    font-size: 12px;
  }
  
  .nac-article-archived {
    font-size: 12px;
    color: var(--nac-text-muted);
  }
  
  /* Article Body */
  .nac-article-body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 18px;
    line-height: 1.7;
    outline: none;
  }
  
  .nac-article-body[contenteditable="true"] {
    padding: 16px;
    border: 2px dashed var(--nac-primary);
    border-radius: 4px;
  }
  
  .nac-article-body h1,
  .nac-article-body h2,
  .nac-article-body h3 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.3;
  }
  
  .nac-article-body p {
    margin-bottom: 1em;
  }
  
  .nac-article-body img {
    max-width: 100% !important;
    height: auto !important;
    display: block;
    margin: 1em auto;
    border-radius: 8px;
  }

  /* Don't hide images on error — show a broken image indicator instead */
  .nac-article-body img[onerror] {
    min-height: 40px;
    min-width: 100px;
    background: var(--nac-surface);
    border: 1px dashed var(--nac-border);
  }

  /* Fix B: Don't enlarge small inline images (avatars, icons, emoji) */
  .nac-article-body img.nac-inline-img {
    max-width: none !important;
    display: inline-block !important;
    vertical-align: middle;
    border-radius: 0;
    margin: 0 4px;
  }
  
  .nac-article-body blockquote {
    border-left: 3px solid var(--nac-primary);
    padding-left: 1em;
    margin: 1em 0;
    color: var(--nac-text-muted);
  }

  .nac-article-body blockquote.twitter-tweet,
  .nac-article-body blockquote.nac-tweet-embed {
    border-left: 4px solid #1da1f2;
    padding: 12px 16px;
    margin: 1.5em 0;
    background: rgba(29, 161, 242, 0.05);
    border-radius: 0 8px 8px 0;
  }

  .nac-article-body blockquote.twitter-tweet img,
  .nac-article-body blockquote.nac-tweet-embed img {
    max-width: 48px !important;
    height: 48px !important;
    border-radius: 50%;
    display: inline-block;
  }

  .nac-article-body img[src*="twimg.com/profile"],
  .nac-article-body img[src*="pbs.twimg.com/profile_images"] {
    max-width: 48px !important;
    max-height: 48px !important;
    border-radius: 50%;
    display: inline-block;
  }

  /* Entity Bar */
  .nac-entity-bar {
    max-width: var(--reader-max-width, 680px);
    margin: 32px auto 0;
    padding-top: 24px;
    border-top: 1px solid var(--nac-border);
  }
  
  .nac-entity-bar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--nac-text-muted);
    margin-bottom: 12px;
  }
  
  .nac-entity-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .nac-entity-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 14px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
  }
  
  .nac-entity-chip.nac-entity-person {
    border-color: var(--nac-entity-person);
    background: rgba(139, 92, 246, 0.1);
  }
  
  .nac-entity-chip.nac-entity-organization {
    border-color: var(--nac-entity-org);
    background: rgba(8, 145, 178, 0.1);
  }
  
  .nac-entity-chip.nac-entity-place {
    border-color: var(--nac-entity-place);
    background: rgba(22, 163, 74, 0.1);
  }
  
  .nac-entity-chip.nac-entity-thing {
    border-color: var(--nac-entity-thing);
    background: rgba(74, 158, 255, 0.1);
  }
  
  .nac-chip-remove {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 18px;
    color: var(--nac-text-muted);
    padding: 0;
    line-height: 1;
  }
  
  .nac-btn-add-entity {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px dashed var(--nac-border);
    background: transparent;
    color: var(--nac-text-muted);
    cursor: pointer;
    font-size: 14px;
  }
  
  /* Entity Popover */
  .nac-entity-popover {
    position: absolute;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 2147483647;
    min-width: 280px;
  }
  
  .nac-popover-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--nac-text);
  }
  
  .nac-entity-type-buttons {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .nac-btn-entity-type {
    flex: 1;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    cursor: pointer;
    font-size: 13px;
  }
  
  .nac-btn-entity-type:hover {
    background: var(--nac-bg);
  }
  
  .nac-search-results {
    margin-bottom: 12px;
  }
  
  .nac-results-header {
    font-size: 12px;
    color: var(--nac-text-muted);
    margin-bottom: 8px;
  }
  
  .nac-btn-link-entity {
    display: block;
    width: 100%;
    padding: 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }
  
  .nac-btn-link-entity:hover {
    background: var(--nac-bg);
  }
  
  .nac-no-results {
    font-size: 13px;
    color: var(--nac-text-muted);
    margin-bottom: 12px;
  }
  
  /* Suggestion Bar */
  .nac-suggestion-bar {
    max-width: var(--reader-max-width, 680px);
    margin: 24px auto 0;
    padding: 16px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    border-radius: 8px;
  }
  
  .nac-suggestion-bar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  
  .nac-suggestion-bar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--nac-text-muted);
  }
  
  .nac-suggestion-dismiss-all {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--nac-text-muted);
    text-decoration: underline;
    padding: 0;
  }
  
  .nac-suggestion-dismiss-all:hover {
    color: var(--nac-error);
  }
  
  .nac-suggestion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .nac-suggestion-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 13px;
    background: var(--nac-surface);
    border: 1px dashed var(--nac-border);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  
  .nac-suggestion-chip.nac-suggestion-known {
    border-color: var(--nac-primary);
    background: rgba(99, 102, 241, 0.06);
  }
  
  
  .nac-suggestion-icon {
    font-size: 14px;
  }
  
  .nac-suggestion-name {
    font-weight: 500;
    color: var(--nac-text);
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .nac-suggestion-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 10px;
    color: var(--nac-text-muted);
    background: var(--nac-bg);
    white-space: nowrap;
  }
  
  .nac-suggestion-actions {
    display: inline-flex;
    gap: 4px;
    margin-left: 4px;
  }
  
  .nac-suggestion-accept {
    background: none;
    border: 1px solid var(--nac-success);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: var(--nac-success);
    padding: 2px 6px;
    white-space: nowrap;
  }
  
  .nac-suggestion-accept:hover {
    background: var(--nac-success);
    color: white;
  }
  
  .nac-suggestion-dismiss {
    background: none;
    border: 1px solid var(--nac-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: var(--nac-text-muted);
    padding: 2px 6px;
  }
  
  .nac-suggestion-dismiss:hover {
    border-color: var(--nac-error);
    color: var(--nac-error);
  }
  
  .nac-suggestion-show-more {
    display: block;
    width: 100%;
    padding: 6px;
    background: none;
    border: 1px dashed var(--nac-border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--nac-text-muted);
    text-align: center;
  }
  
  .nac-suggestion-show-more:hover {
    background: var(--nac-bg);
    color: var(--nac-text);
  }
  
  /* Publish Panel */
  .nac-publish-panel,
  .nac-settings-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    z-index: 1000001;
    display: flex;
    flex-direction: column;
  }
  
  .nac-publish-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--nac-border);
  }
  
  .nac-publish-header h3 {
    margin: 0;
    font-size: 18px;
  }
  
  .nac-btn-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--nac-text-muted);
  }
  
  .nac-publish-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  
  .nac-form-group {
    margin-bottom: 16px;
  }
  
  .nac-form-group label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .nac-form-select,
  .nac-form-input {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--nac-border);
    background: var(--nac-bg);
    color: var(--nac-text);
    font-size: 14px;
  }
  
  .nac-relay-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .nac-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  
  .nac-event-preview {
    background: var(--nac-bg);
    padding: 12px;
    border-radius: 6px;
    font-family: monospace;
    font-size: 12px;
    overflow-x: auto;
    max-height: 200px;
  }
  
  .nac-btn {
    padding: 10px 20px;
    border-radius: 6px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    color: var(--nac-text);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .nac-btn:hover {
    background: var(--nac-bg);
  }
  
  .nac-btn.nac-btn-primary {
    background: var(--nac-primary);
    color: white;
    border-color: var(--nac-primary);
    width: 100%;
  }
  
  .nac-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .nac-warning {
    padding: 12px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 6px;
    font-size: 13px;
    color: var(--nac-text);
    margin-bottom: 16px;
  }
  
  .nac-publish-status {
    margin-top: 16px;
  }
  
  .nac-publish-results {
    font-size: 13px;
  }
  
  .nac-result-success {
    color: var(--nac-success);
    margin-bottom: 4px;
  }
  
  .nac-result-error {
    color: var(--nac-error);
    margin-bottom: 4px;
  }
  
  .nac-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--nac-border);
    border-top-color: var(--nac-primary);
    border-radius: 50%;
    animation: nac-spin 0.8s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-right: 8px;
  }
  
  @keyframes nac-spin {
    to { transform: rotate(360deg); }
  }
  
  /* Toast */
  .nac-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    background: var(--nac-surface);
    color: var(--nac-text);
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s;
  }
  
  .nac-toast.visible {
    opacity: 1;
    transform: translateY(0);
  }
  
  .nac-toast.nac-toast-success {
    border-left: 4px solid var(--nac-success);
  }
  
  .nac-toast.nac-toast-error {
    border-left: 4px solid var(--nac-error);
  }
  
  .nac-version {
    margin-top: 20px;
    font-size: 12px;
    color: var(--nac-text-muted);
    text-align: center;
  }
  
  .nac-identity-info {
    padding: 12px;
    background: var(--nac-bg);
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  
  .nac-identity-info div {
    margin-bottom: 8px;
  }
  
  .nac-relay-item {
    display: flex;
    align-items: center;
    padding: 8px;
    background: var(--nac-bg);
    border-radius: 4px;
    margin-bottom: 4px;
    gap: 6px;
    transition: opacity 0.2s;
  }

  .nac-relay-item.nac-relay-disabled {
    opacity: 0.45;
  }

  .nac-relay-remove {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 3px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }

  .nac-relay-remove:hover {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.15);
  }
  
  /* Markdown Textarea */
  .nac-md-textarea {
    width: 100%;
    min-height: 400px;
    padding: 16px;
    border: 2px dashed var(--nac-primary);
    border-radius: 4px;
    background: var(--nac-bg);
    color: var(--nac-text);
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', 'Consolas', 'Monaco', 'Andale Mono', monospace;
    font-size: 14px;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
    tab-size: 4;
    white-space: pre-wrap;
    overflow: hidden;
  }
  
  .nac-md-textarea:focus {
    border-color: var(--nac-primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
  
  /* Markdown toggle button */
  .nac-btn-toolbar.nac-btn-md-toggle {
    font-size: 13px;
  }
  
  .nac-btn-toolbar.nac-btn-md-toggle.active {
    background: var(--nac-primary);
    color: white;
    border-color: var(--nac-primary);
  }
  
  /* ===== Entity Browser ===== */
  .nac-eb-list-view,
  .nac-eb-detail {
    font-size: 13px;
  }
  
  .nac-eb-search-bar {
    margin-bottom: 10px;
  }
  
  .nac-eb-search {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--nac-border);
    background: var(--nac-bg);
    color: var(--nac-text);
    font-size: 13px;
    box-sizing: border-box;
  }
  
  .nac-eb-search:focus {
    outline: none;
    border-color: var(--nac-primary);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
  
  .nac-eb-type-filters {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  
  .nac-eb-type-btn {
    padding: 4px 10px;
    border-radius: 14px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    color: var(--nac-text);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
  }
  
  .nac-eb-type-btn:hover {
    background: var(--nac-bg);
  }
  
  .nac-eb-type-btn.active {
    background: var(--nac-primary);
    color: white;
    border-color: var(--nac-primary);
  }
  
  .nac-eb-entity-list {
    max-height: 240px;
    overflow-y: auto;
    margin-bottom: 12px;
    border: 1px solid var(--nac-border);
    border-radius: 8px;
  }
  
  .nac-eb-card {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--nac-border);
    transition: background 0.15s;
  }
  
  .nac-eb-card:last-child {
    border-bottom: none;
  }
  
  .nac-eb-card:hover {
    background: var(--nac-bg);
  }
  
  .nac-eb-card-person { border-left: 3px solid var(--nac-entity-person); }
  .nac-eb-card-organization { border-left: 3px solid var(--nac-entity-org); }
  .nac-eb-card-place { border-left: 3px solid var(--nac-entity-place); }
  .nac-eb-card-thing { border-left: 3px solid var(--nac-entity-thing); }
  
  .nac-eb-card-main {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }
  
  .nac-eb-card-emoji {
    font-size: 18px;
    flex-shrink: 0;
  }
  
  .nac-eb-card-info {
    flex: 1;
    min-width: 0;
  }
  
  .nac-eb-card-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .nac-eb-card-meta {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-top: 2px;
  }
  
  .nac-eb-card-arrow {
    font-size: 18px;
    color: var(--nac-text-muted);
    flex-shrink: 0;
  }
  
  .nac-eb-empty {
    text-align: center;
    color: var(--nac-text-muted);
    padding: 20px;
    font-size: 13px;
  }
  
  .nac-eb-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  
  .nac-eb-actions .nac-btn {
    flex: 1;
    text-align: center;
    padding: 8px;
    font-size: 13px;
  }
  
  .nac-eb-sync-section {
    border-top: 1px solid var(--nac-border);
    padding-top: 12px;
  }
  
  .nac-eb-sync-title {
    font-weight: 600;
    margin-bottom: 6px;
  }
  
  .nac-eb-sync-desc {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-bottom: 8px;
  }
  
  .nac-eb-sync-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    margin-bottom: 10px;
    cursor: pointer;
  }
  
  .nac-eb-sync-buttons {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }
  
  .nac-eb-sync-btn {
    flex: 1;
    padding: 8px;
    background: var(--nac-primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: opacity 0.15s;
  }
  
  .nac-eb-sync-btn:hover {
    opacity: 0.9;
  }
  
  .nac-eb-sync-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .nac-eb-sync-status {
    font-size: 11px;
    color: var(--nac-text-muted);
    padding: 8px;
    background: var(--nac-bg);
    border-radius: 6px;
    min-height: 20px;
  }
  
  /* Detail view */
  .nac-eb-back {
    background: none;
    border: none;
    color: var(--nac-primary);
    cursor: pointer;
    font-size: 13px;
    padding: 0;
    margin-bottom: 12px;
  }
  
  .nac-eb-back:hover {
    text-decoration: underline;
  }
  
  .nac-eb-detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  
  .nac-eb-detail-emoji {
    font-size: 28px;
  }
  
  .nac-eb-detail-name {
    flex: 1;
    font-size: 18px;
    margin: 0;
    cursor: pointer;
    border-bottom: 1px dashed transparent;
    transition: border-color 0.15s;
  }
  
  .nac-eb-detail-name:hover {
    border-bottom-color: var(--nac-primary);
  }
  
  .nac-eb-detail-badge {
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  
  .nac-eb-badge-person { background: rgba(139, 92, 246, 0.15); color: var(--nac-entity-person); }
  .nac-eb-badge-organization { background: rgba(8, 145, 178, 0.15); color: var(--nac-entity-org); }
  .nac-eb-badge-place { background: rgba(22, 163, 74, 0.15); color: var(--nac-entity-place); }
  .nac-eb-badge-thing { background: rgba(74, 158, 255, 0.15); color: var(--nac-entity-thing); }
  
  .nac-eb-detail-created {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-bottom: 16px;
  }
  
  .nac-eb-section {
    margin-bottom: 16px;
  }
  
  .nac-eb-section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--nac-text-muted);
    margin-bottom: 8px;
  }
  
  .nac-eb-aliases {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  
  .nac-eb-alias {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 12px;
    background: var(--nac-bg);
    border: 1px solid var(--nac-border);
    font-size: 12px;
  }
  
  .nac-eb-alias-remove {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: var(--nac-text-muted);
    padding: 0 2px;
    line-height: 1;
  }
  
  .nac-eb-alias-remove:hover {
    color: var(--nac-error);
  }
  
  .nac-eb-no-aliases {
    color: var(--nac-text-muted);
    font-size: 12px;
    font-style: italic;
  }
  
  .nac-eb-alias-add {
    display: flex;
    gap: 6px;
  }
  
  .nac-eb-alias-input {
    flex: 1;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--nac-border);
    background: var(--nac-bg);
    color: var(--nac-text);
    font-size: 12px;
  }
  
  .nac-eb-alias-add .nac-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .nac-eb-keypair {
    background: var(--nac-bg);
    border-radius: 6px;
    padding: 10px;
  }
  
  .nac-eb-key-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  
  .nac-eb-key-row:last-child {
    margin-bottom: 0;
  }
  
  .nac-eb-key-label {
    font-weight: 600;
    font-size: 11px;
    flex-shrink: 0;
    width: 36px;
  }
  
  .nac-eb-key-value {
    flex: 1;
    font-family: monospace;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  
  .nac-eb-nsec-hidden {
    color: var(--nac-text-muted);
  }
  
  .nac-eb-copy-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    flex-shrink: 0;
    border-radius: 4px;
    transition: background 0.15s;
  }
  
  .nac-eb-copy-btn:hover {
    background: var(--nac-border);
  }
  
  .nac-eb-articles {
    max-height: 160px;
    overflow-y: auto;
  }
  
  .nac-eb-article-item {
    padding: 8px;
    border: 1px solid var(--nac-border);
    border-radius: 6px;
    margin-bottom: 6px;
  }
  
  .nac-eb-article-title {
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .nac-eb-article-url {
    font-size: 11px;
    color: var(--nac-primary);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }
  
  .nac-eb-article-url:hover {
    text-decoration: underline;
  }
  
  .nac-eb-article-meta {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-top: 3px;
    display: flex;
    gap: 4px;
  }
  
  .nac-eb-article-context {
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--nac-bg);
    border: 1px solid var(--nac-border);
    font-size: 10px;
  }
  
  .nac-eb-no-articles {
    color: var(--nac-text-muted);
    font-size: 12px;
    font-style: italic;
    padding: 8px 0;
  }
  
  .nac-eb-danger-zone {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--nac-border);
  }
  
  .nac-eb-delete-btn {
    width: 100%;
    padding: 8px;
    background: rgba(239, 68, 68, 0.1);
    color: var(--nac-error);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s;
  }
  
  .nac-eb-delete-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  
  /* Entity Alias Styles */
  .nac-eb-card-alias {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .nac-eb-card-alias-entity {
    opacity: 0.85;
  }
  
  .nac-eb-canonical-section {
    padding: 10px;
    background: rgba(99, 102, 241, 0.06);
    border: 1px dashed var(--nac-primary);
    border-radius: 8px;
  }
  
  .nac-eb-canonical-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  
  .nac-eb-canonical-link {
    background: none;
    border: none;
    color: var(--nac-primary);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 0;
    text-decoration: underline;
  }
  
  .nac-eb-canonical-link:hover {
    color: var(--nac-primary-hover);
  }
  
  .nac-eb-remove-alias-btn {
    background: none;
    border: 1px solid var(--nac-border);
    border-radius: 4px;
    color: var(--nac-text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 8px;
    margin-left: auto;
  }
  
  .nac-eb-remove-alias-btn:hover {
    border-color: var(--nac-error);
    color: var(--nac-error);
  }
  
  .nac-eb-alias-entities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .nac-eb-alias-entity-link {
    background: var(--nac-bg);
    border: 1px solid var(--nac-border);
    border-radius: 12px;
    color: var(--nac-primary);
    cursor: pointer;
    font-size: 12px;
    padding: 3px 10px;
  }
  
  .nac-eb-alias-entity-link:hover {
    background: var(--nac-primary);
    color: white;
    border-color: var(--nac-primary);
  }
  
  /* Focus-visible styles for keyboard accessibility */
  /* Note: .nac-fab:focus-visible is handled inside Shadow DOM */
  .nac-btn-back:focus-visible,
  .nac-btn-toolbar:focus-visible,
  .nac-btn:focus-visible,
  .nac-btn-copy:focus-visible,
  .nac-btn-close:focus-visible,
  .nac-btn-add-entity:focus-visible,
  .nac-btn-entity-type:focus-visible,
  .nac-btn-link-entity:focus-visible,
  .nac-chip-remove:focus-visible,
  .nac-relay-remove:focus-visible,
  .nac-eb-type-btn:focus-visible,
  .nac-eb-card:focus-visible,
  .nac-eb-back:focus-visible,
  .nac-eb-copy-btn:focus-visible,
  .nac-eb-alias-remove:focus-visible,
  .nac-eb-delete-btn:focus-visible,
  .nac-eb-sync-btn:focus-visible,
  .nac-eb-detail-name:focus-visible,
  .nac-form-select:focus-visible,
  .nac-form-input:focus-visible,
  .nac-editable-field:focus-visible,
  .nac-entity-chip:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }
  
  .nac-reader-container:focus {
    outline: none;
  }
  
  .nac-publish-panel:focus,
  .nac-settings-panel:focus {
    outline: none;
  }

  /* Claims Bar */
  .nac-claims-bar {
    max-width: var(--reader-max-width, 680px);
    margin: 24px auto 0;
    padding-top: 20px;
    border-top: 1px solid var(--nac-border);
  }

  .nac-claims-bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .nac-claims-bar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--nac-text-muted);
  }

  .nac-claims-count {
    font-weight: 700;
  }

  .nac-btn-add-claim {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px dashed var(--nac-border);
    background: transparent;
    color: var(--nac-text-muted);
    cursor: pointer;
    font-size: 13px;
  }

  .nac-btn-add-claim:hover {
    background: var(--nac-bg);
    color: var(--nac-text);
  }

  .nac-claims-chips {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nac-claims-empty {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 12px 0;
  }

  .nac-claim-chip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .nac-claim-chip:hover {
    border-color: var(--nac-primary);
  }

  .nac-claim-crux {
    border-color: #f59e0b;
    border-width: 2px;
    background: rgba(245, 158, 11, 0.08);
  }

  .nac-claim-crux .nac-claim-text-display {
    font-weight: 700;
  }

  .nac-claim-crux:hover {
    border-color: #d97706;
  }

  .nac-claim-text,
  .nac-claim-text-display {
    flex: 1;
    font-size: 13px;
    color: var(--nac-text);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: text;
  }

  .nac-claim-text-edit {
    flex: 1;
    font-size: 13px;
    color: var(--nac-text);
    line-height: 1.4;
    padding: 2px 6px;
    border: 1px solid var(--nac-primary);
    border-radius: 4px;
    background: var(--nac-bg);
    outline: none;
    font-family: inherit;
  }

  .nac-claim-crux-icon {
    font-size: 12px;
  }

  .nac-claim-confidence-display {
    font-size: 11px;
    font-weight: 600;
    color: #f59e0b;
  }

  .nac-claim-crux-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .nac-claim-crux-toggle:hover {
    opacity: 1;
  }

  .nac-claim-confidence-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 8px;
    margin-top: -4px;
  }

  .nac-claim-confidence-label {
    font-size: 12px;
    color: var(--nac-text-muted);
    white-space: nowrap;
    min-width: 100px;
  }

  .nac-claim-conf-val {
    font-weight: 600;
    color: #f59e0b;
  }

  .nac-claim-confidence-range {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--nac-border);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .nac-claim-confidence-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f59e0b;
    cursor: pointer;
  }

  .nac-claim-confidence-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f59e0b;
    cursor: pointer;
    border: none;
  }

  .nac-publish-info {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 8px 12px;
    background: var(--nac-bg);
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .nac-claim-type-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .nac-claim-type-factual {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .nac-claim-type-causal {
    background: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
  }

  .nac-claim-type-evaluative {
    background: rgba(249, 115, 22, 0.15);
    color: #f97316;
  }

  .nac-claim-type-predictive {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .nac-claim-remove {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: var(--nac-text-muted);
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
  }

  .nac-claim-remove:hover {
    color: var(--nac-error);
  }

  .nac-claim-subjects {
    max-height: 100px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }

  .nac-claim-subjects label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--nac-text);
    cursor: pointer;
  }

  .nac-claim-subjects input[type="checkbox"] {
    margin: 0;
    flex-shrink: 0;
  }

  .nac-claim-claimant-label {
    font-size: 12px;
    font-style: italic;
    color: var(--nac-text-muted);
    white-space: nowrap;
  }

  .nac-claim-attribution-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 8px;
    white-space: nowrap;
    flex-shrink: 0;
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .nac-claim-subject-emojis {
    font-size: 11px;
    flex-shrink: 0;
    letter-spacing: 1px;
  }

  .nac-claim-triple {
    width: 100%;
    font-size: 0.85em;
    color: var(--nac-text-muted);
    padding-left: 20px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nac-claim-triple-claimant {
    color: var(--nac-text);
  }

  .nac-claim-triple-subject {
    color: var(--nac-text);
  }

  .nac-claim-triple-predicate {
    font-style: italic;
    color: var(--nac-text-muted);
  }

  .nac-claim-triple-object {
    color: var(--nac-text);
  }

  .nac-claim-triple-date {
    color: var(--nac-text-muted);
    font-size: 0.9em;
  }

  .nac-claims-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--nac-primary);
    color: white;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    padding: 0 4px;
    margin-left: 4px;
  }

  /* Claim Form (in popover) — progressive disclosure */
  .nac-claim-form {
    min-width: 300px;
    max-width: 380px;
  }

  .nac-claim-form-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
    color: var(--nac-text);
  }

  .nac-claim-form-text {
    font-size: 13px;
    color: var(--nac-text-muted);
    font-style: italic;
    margin-bottom: 12px;
    padding: 8px;
    background: var(--nac-bg);
    border-radius: 6px;
    max-height: 80px;
    overflow-y: auto;
    line-height: 1.4;
  }

  .nac-claim-form-field {
    margin-bottom: 10px;
  }

  .nac-claim-form-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .nac-claim-form-row-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .nac-claim-form-field label {
    font-size: 13px;
    color: var(--nac-text);
    margin-right: 4px;
  }

  .nac-claim-form-field select,
  .nac-claim-form-field input[type="date"],
  .nac-form-input {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    color: var(--nac-text);
    font-size: 13px;
  }

  .nac-claim-crux-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--nac-text);
    cursor: pointer;
    white-space: nowrap;
  }

  .nac-claim-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  /* Collapsible section headers */
  .nac-claim-section-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 0;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--nac-text);
    border-bottom: 1px solid var(--nac-border);
    margin-bottom: 6px;
    user-select: none;
  }

  .nac-claim-section-header:hover {
    color: var(--nac-primary);
  }

  .nac-claim-section-header:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  .nac-claim-section-arrow {
    display: inline-block;
    width: 12px;
    text-align: center;
    font-size: 12px;
  }

  .nac-claim-section-body {
    padding-left: 16px;
    padding-bottom: 4px;
  }

  /* Sentence builder (subject-verb-object row) */
  .nac-claim-sentence-builder {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }

  .nac-claim-sentence-slot {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
  }

  .nac-claim-sentence-slot select,
  .nac-claim-sentence-slot input {
    width: 100%;
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    color: var(--nac-text);
    font-size: 12px;
    box-sizing: border-box;
  }

  .nac-claim-sentence-label {
    font-size: 10px;
    color: var(--nac-text-muted);
    text-align: center;
    margin-top: 2px;
  }

  /* Claim button in popover */
  .nac-btn-claim-type {
    border-color: #f59e0b !important;
    color: #92400e;
  }

  .nac-btn-claim-type:hover {
    background: rgba(245, 158, 11, 0.1) !important;
  }

  @media (prefers-color-scheme: dark) {
    .nac-btn-claim-type {
      color: #fbbf24;
    }
  }

  .nac-claim-chip:focus-visible,
  .nac-claim-remove:focus-visible,
  .nac-claim-crux-toggle:focus-visible,
  .nac-claim-text-edit:focus-visible,
  .nac-btn-add-claim:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  .nac-claim-confidence-field label {
    font-size: 13px;
    color: var(--nac-text-muted);
  }

  /* Evidence Linking */
  .nac-evidence-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .nac-evidence-modal-content {
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .nac-evidence-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--nac-border);
  }

  .nac-evidence-modal-header h3 {
    margin: 0;
    font-size: 16px;
    color: var(--nac-text);
  }

  .nac-evidence-modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .nac-evidence-source {
    font-size: 13px;
    color: var(--nac-text);
    background: rgba(99, 102, 241, 0.08);
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .nac-evidence-target-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--nac-text-muted);
    margin-bottom: 8px;
  }

  .nac-evidence-target-list {
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid var(--nac-border);
    border-radius: 8px;
    padding: 8px;
    margin-bottom: 16px;
  }

  .nac-evidence-article-group {
    margin-bottom: 12px;
  }

  .nac-evidence-article-group:last-child {
    margin-bottom: 0;
  }

  .nac-evidence-article-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--nac-text-muted);
    padding: 4px 0;
    margin-bottom: 4px;
  }

  .nac-evidence-claim-option {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--nac-text);
    line-height: 1.4;
    transition: background 0.15s;
  }

  .nac-evidence-claim-option:hover {
    background: rgba(99, 102, 241, 0.08);
  }

  .nac-evidence-claim-option input[type="radio"] {
    margin-top: 3px;
    flex-shrink: 0;
  }

  .nac-evidence-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .nac-evidence-options .nac-form-group {
    margin-bottom: 0;
  }

  .nac-evidence-options .nac-form-group label {
    font-size: 13px;
    font-weight: 600;
    color: var(--nac-text-muted);
    display: block;
    margin-bottom: 4px;
  }

  .nac-evidence-modal-footer {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--nac-border);
    justify-content: flex-end;
  }

  .nac-evidence-link-indicator {
    font-size: 11px;
    background: rgba(99, 102, 241, 0.12);
    color: var(--nac-primary);
    padding: 2px 6px;
    border-radius: 10px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .nac-evidence-link-indicator:hover {
    background: rgba(99, 102, 241, 0.25);
  }

  .nac-claim-link-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    opacity: 0.5;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .nac-claim-link-btn:hover {
    opacity: 1;
  }

  .nac-evidence-tooltip {
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    font-size: 12px;
    color: var(--nac-text);
    z-index: 2147483647;
  }

  .nac-evidence-tooltip-title {
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 13px;
  }

  .nac-evidence-tooltip-item {
    padding: 3px 0;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .nac-evidence-rel-supports {
    color: #22c55e;
  }

  .nac-evidence-rel-contradicts {
    color: #ef4444;
  }

  .nac-evidence-rel-contextualizes {
    color: #3b82f6;
  }

  .nac-evidence-delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: var(--nac-text-muted);
    padding: 0 4px;
    margin-left: auto;
    opacity: 0.5;
    flex-shrink: 0;
  }

  .nac-evidence-delete-btn:hover {
    opacity: 1;
    color: var(--nac-error);
  }

  .nac-form-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--nac-border);
    border-radius: 6px;
    background: var(--nac-surface);
    color: var(--nac-text);
    font-size: 13px;
    box-sizing: border-box;
  }

  .nac-form-input:focus {
    outline: 2px solid var(--nac-primary);
    outline-offset: -1px;
  }

  .nac-claim-link-btn:focus-visible,
  .nac-evidence-link-indicator:focus-visible,
  .nac-evidence-delete-btn:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  /* Remote Claims Section */
  .nac-remote-claims-section {
    margin-top: 16px;
    padding: 16px;
    background: var(--nac-bg);
    border: 1px solid var(--nac-border);
    border-radius: 8px;
  }

  .nac-remote-claims-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .nac-remote-claims-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--nac-text-muted);
  }

  .nac-remote-claims-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: var(--nac-text-muted);
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
  }

  .nac-remote-claims-close:hover {
    color: var(--nac-error);
    background: rgba(239, 68, 68, 0.1);
  }

  .nac-remote-claims-loading {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 12px 0;
    display: flex;
    align-items: center;
  }

  .nac-remote-claims-empty {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 12px 0;
    text-align: center;
    font-style: italic;
  }

  .nac-remote-claims-group {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--nac-border);
  }

  .nac-remote-claims-group:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .nac-remote-npub {
    font-size: 12px;
    font-weight: 600;
    color: var(--nac-primary);
    font-family: monospace;
    margin-bottom: 8px;
    padding: 4px 8px;
    background: rgba(99, 102, 241, 0.06);
    border-radius: 6px;
    display: inline-block;
  }

  .nac-remote-claim-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--nac-text);
  }

  .nac-remote-claim-chip.nac-claim-crux {
    border-color: #f59e0b;
    border-width: 2px;
    background: rgba(245, 158, 11, 0.08);
  }

  .nac-remote-claim-chip.nac-claim-crux .nac-remote-claim-text {
    font-weight: 700;
  }

  .nac-remote-claim-text {
    flex: 1;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nac-btn-remote-claims {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--nac-primary);
    background: rgba(99, 102, 241, 0.08);
    color: var(--nac-primary);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .nac-btn-remote-claims:hover {
    background: rgba(99, 102, 241, 0.18);
  }

  .nac-claims-bar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .nac-remote-claims-close:focus-visible,
  .nac-btn-remote-claims:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  /* ==========================================
     MOBILE RESPONSIVE STYLES
     ========================================== */
  @media (max-width: 768px) {
    /* Reader View — Mobile Layout */
    .nac-reader-container {
      padding: 0 !important;
    }
    .nac-reader-content {
      max-width: 100% !important;
      padding: 12px !important;
      margin: 0 !important;
    }
    .nac-article-title {
      font-size: 1.5em !important;
    }
    .nac-article-body {
      font-size: 1em !important;
      line-height: 1.6 !important;
    }

    /* Toolbar — Mobile Responsive */
    .nac-toolbar {
      flex-wrap: wrap !important;
      gap: 4px !important;
      padding: 8px !important;
    }
    .nac-toolbar button,
    .nac-btn-toolbar {
      font-size: 12px !important;
      padding: 6px 8px !important;
      min-height: 36px !important;
    }

    /* Entity/Claims Bars — Horizontal Scroll */
    .nac-entity-bar,
    .nac-claims-bar {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
      flex-wrap: nowrap !important;
    }
    .nac-entity-chip,
    .nac-claim-chip {
      flex-shrink: 0 !important;
      font-size: 12px !important;
    }

    /* Entity Tagger Popover — Bottom Sheet */
    .nac-entity-popover {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      top: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      border-radius: 12px 12px 0 0 !important;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.3) !important;
    }
    .nac-btn-entity-type,
    .nac-btn-claim-type {
      min-height: 44px !important;
      font-size: 14px !important;
    }

    /* Claim Extraction Form — Stacked Layout */
    .nac-claim-sentence-builder {
      flex-direction: column !important;
      gap: 8px !important;
    }
    .nac-claim-sentence-slot {
      width: 100% !important;
    }
    .nac-claim-form select,
    .nac-claim-form input {
      font-size: 16px !important;
      min-height: 40px !important;
    }

    /* Settings / Publish Panels — Full Screen */
    .nac-settings-panel,
    .nac-publish-panel {
      width: 100% !important;
      max-width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      border-radius: 0 !important;
      margin: 0 !important;
    }

    /* Evidence Modal — Bottom Sheet */
    .nac-evidence-modal {
      width: 100% !important;
      max-width: 100% !important;
      height: 80vh !important;
      bottom: 0 !important;
      top: auto !important;
      left: 0 !important;
      border-radius: 12px 12px 0 0 !important;
    }

    /* Touch-Friendly Targets */
    button,
    [role="button"],
    .nac-editable-field,
    input[type="checkbox"],
    select {
      min-height: 44px !important;
      min-width: 44px !important;
    }

    /* Metadata Header — Stack Vertically */
    .nac-meta-info {
      flex-direction: column !important;
      gap: 4px !important;
    }
    .nac-meta-separator {
      display: none !important;
    }

    /* Remote Claims Section — Compact */
    .nac-remote-claims-section {
      max-height: 40vh !important;
    }
    .nac-remote-claim-chip {
      font-size: 12px !important;
    }
  }

  /* ===== Phase 1: Enhanced Metadata Display ===== */

  /* Word count / reading time line */
  .nac-meta-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--nac-text-muted);
    margin-top: 6px;
  }

  .nac-meta-modified {
    font-style: italic;
  }

  .nac-meta-lang {
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--nac-bg);
    border: 1px solid var(--nac-border);
  }

  /* Section / category badge */
  .nac-meta-section-row {
    margin-top: 8px;
  }

  .nac-meta-section-badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 12px;
    background: rgba(99, 102, 241, 0.1);
    color: var(--nac-primary);
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  /* Keyword tag pills */
  .nac-meta-keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }

  .nac-meta-keyword-pill {
    display: inline-block;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    background: var(--nac-bg);
    color: var(--nac-text-muted);
    border: 1px solid var(--nac-border);
    white-space: nowrap;
  }

  /* Paywall indicator */
  .nac-meta-paywall {
    font-size: 14px;
    margin-left: 4px;
    cursor: help;
  }

  @media (max-width: 768px) {
    .nac-meta-stats {
      font-size: 12px;
    }
    .nac-meta-section-badge {
      font-size: 11px;
    }
    .nac-meta-keyword-pill {
      font-size: 10px;
    }
  }

  /* Content Type Detection (Phase 2) */
  .nac-meta-detection-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
    margin-bottom: 4px;
  }

  .nac-meta-content-type {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    background: rgba(99, 102, 241, 0.1);
    color: var(--nac-primary);
  }

  .nac-meta-comments-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    cursor: pointer;
  }

  .nac-meta-comments-indicator:hover {
    background: rgba(34, 197, 94, 0.18);
  }

  /* ===== Comments Section (Phase 3) ===== */

  .nac-comments-section {
    max-width: var(--reader-max-width, 680px);
    margin: 24px auto 0;
    padding-top: 20px;
    border-top: 1px solid var(--nac-border);
  }

  .nac-comments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--nac-text-muted);
  }

  .nac-comments-list {
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nac-comment-item {
    padding: 10px 14px;
    border-radius: 8px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    transition: border-color 0.2s;
  }

  .nac-comment-item:hover {
    border-color: var(--nac-primary);
  }

  .nac-comment-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--nac-text-muted);
  }

  .nac-comment-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .nac-comment-author {
    font-weight: 600;
    color: var(--nac-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .nac-comment-platform {
    font-size: 11px;
    color: var(--nac-text-muted);
    opacity: 0.7;
  }

  .nac-comment-time {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-left: auto;
  }

  .nac-comment-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--nac-text);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .nac-comment-reply-indicator {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-top: 4px;
  }

  .nac-comments-empty {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 12px 0;
    text-align: center;
    font-style: italic;
  }

  .nac-btn-capture-comments {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #22c55e;
    background: rgba(34, 197, 94, 0.08);
    color: #22c55e;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .nac-btn-capture-comments:hover {
    background: rgba(34, 197, 94, 0.18);
  }

  .nac-btn-capture-comments:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nac-comments-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 0;
  }

  .nac-comments-toggle:hover {
    color: var(--nac-text);
  }

  .nac-btn-capture-comments:focus-visible,
  .nac-comments-toggle:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .nac-comments-list {
      max-height: 300px;
    }
    .nac-comment-item {
      padding: 8px 10px;
    }
    .nac-comment-text {
      font-size: 12px;
    }
  }

  /* Engagement Metrics Display */
  .nac-meta-engagement {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85em;
    color: var(--nac-text-muted);
    padding: 4px 0;
  }

  /* Transcript Section (YouTube / Video) */
  .nac-transcript-section {
    margin: 1.5em 0;
    border: 1px solid var(--nac-border);
    border-radius: 8px;
  }

  .nac-transcript-header {
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 600;
    user-select: none;
    border-radius: 8px;
    transition: background 0.15s;
  }

  .nac-transcript-header:hover {
    background: var(--nac-bg);
  }

  .nac-transcript-header:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  .nac-transcript-arrow {
    display: inline-block;
    width: 14px;
    text-align: center;
    font-size: 14px;
    transition: transform 0.15s;
  }

  .nac-transcript-body {
    padding: 0 16px 16px;
  }

  .nac-transcript-text {
    white-space: pre-wrap;
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', 'Consolas', monospace;
    font-size: 0.9em;
    line-height: 1.8;
    max-height: 500px;
    overflow-y: auto;
    padding: 12px;
    background: var(--nac-bg);
    border-radius: 6px;
    border: 1px solid var(--nac-border);
    color: var(--nac-text);
    margin: 0;
  }

  /* YouTube Description Section (paste option) */
  .nac-description-section {
    margin: 1.5em 0;
    border: 1px solid var(--nac-border);
    border-radius: 8px;
  }

  .nac-description-header {
    padding: 12px 16px;
    font-weight: 600;
    font-size: 1.1em;
    color: var(--nac-text);
  }

  .nac-description-body {
    padding: 0 16px 16px;
  }

  .nac-description-input {
    width: 100%;
    min-height: 150px;
    font-family: system-ui, sans-serif;
    font-size: 0.9em;
    line-height: 1.5;
    padding: 12px;
    border: 1px solid var(--nac-border);
    border-radius: 6px;
    background: var(--nac-surface);
    color: var(--nac-text);
    resize: vertical;
    margin-top: 8px;
    box-sizing: border-box;
  }

  .nac-description-input:focus {
    outline: 2px solid var(--nac-primary);
    outline-offset: -1px;
  }

  .nac-description-instructions {
    font-size: 0.85em;
    color: var(--nac-text-muted);
    margin: 8px 0;
  }

  .nac-description-save-btn {
    margin-top: 8px;
  }

  /* YouTube Video Embed */
  .nac-video-embed {
    border-radius: 8px;
    overflow: hidden;
    margin: 1em 0;
  }

  .nac-video-meta {
    padding: 8px 0;
    font-size: 0.9em;
    color: var(--nac-text-muted, #888);
  }

  .nac-video-description {
    margin: 1em 0;
    padding: 12px;
    background: var(--nac-surface, #f5f5f5);
    border-radius: 8px;
  }

  .nac-transcript-load-btn {
    padding: 8px 16px;
    background: var(--nac-primary, #6366f1);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin: 8px 0;
    font-size: 13px;
    transition: opacity 0.2s;
  }

  .nac-transcript-load-btn:hover {
    opacity: 0.9;
  }

  .nac-transcript-load-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nac-transcript-load-btn:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  /* ===== Facebook Post Styling ===== */

  .nac-facebook-post {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: var(--nac-surface, #fff);
    border: 1px solid var(--nac-border, #ddd);
    border-radius: 8px;
    padding: 16px;
    margin: 1em 0;
  }

  .nac-fb-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .nac-fb-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  .nac-fb-author-name {
    font-weight: 600;
    font-size: 0.95em;
    color: var(--nac-text);
  }

  .nac-fb-timestamp {
    font-size: 0.8em;
    color: var(--nac-text-muted, #888);
  }

  .nac-fb-text {
    font-size: 0.95em;
    line-height: 1.5;
    margin: 12px 0;
    white-space: pre-wrap;
  }

  .nac-fb-images {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 12px 0;
  }

  .nac-fb-image {
    max-width: 100%;
    border-radius: 8px;
  }

  .nac-fb-links {
    margin: 8px 0;
  }

  .nac-fb-link {
    display: block;
    padding: 8px 12px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    border-radius: 6px;
    color: var(--nac-primary);
    text-decoration: none;
    margin: 4px 0;
  }

  /* Platform Account Display */
  .nac-platform-account {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    margin-bottom: 4px;
    font-size: 13px;
    color: var(--nac-text-muted);
  }

  .nac-platform-account-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .nac-platform-account-name {
    font-weight: 600;
    color: var(--nac-text);
  }

  .nac-platform-account-link {
    color: var(--nac-primary);
    text-decoration: none;
    font-size: 12px;
  }

  .nac-platform-account-link:hover {
    text-decoration: underline;
  }

  .nac-platform-account-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 10px;
    background: rgba(99, 102, 241, 0.1);
    color: var(--nac-primary);
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  /* Selection Overlay */
  #nac-selection-overlay {
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* Instagram Post Styles */
  .nac-instagram-post {
    border: 1px solid var(--nac-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--nac-surface);
    margin: 1em 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  .nac-ig-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--nac-border);
  }

  .nac-ig-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid transparent;
    background: linear-gradient(var(--nac-surface), var(--nac-surface)) padding-box,
                linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888) border-box;
  }

  .nac-ig-author-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .nac-ig-author-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--nac-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nac-ig-timestamp {
    font-size: 12px;
    color: var(--nac-text-muted);
  }

  .nac-ig-images {
    width: 100%;
    background: #000;
  }

  .nac-ig-image {
    width: 100%;
    display: block;
    object-fit: contain;
    max-height: 600px;
  }

  .nac-ig-caption {
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--nac-text);
    word-wrap: break-word;
  }

  .nac-ig-caption-author {
    font-weight: 600;
    margin-right: 4px;
  }

  /* ===== TikTok Post Styling ===== */

  .nac-tiktok-post {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: var(--nac-surface, #fff);
    border: 1px solid var(--nac-border, #ddd);
    border-radius: 8px;
    overflow: hidden;
    margin: 1em 0;
  }

  .nac-tt-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
  }

  .nac-tt-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .nac-tt-author-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .nac-tt-author-name {
    font-weight: 700;
    font-size: 15px;
    color: var(--nac-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nac-tt-timestamp {
    font-size: 12px;
    color: var(--nac-text-muted);
  }

  .nac-tt-thumbnail {
    position: relative;
    width: 100%;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nac-tt-image {
    width: 100%;
    display: block;
    object-fit: contain;
    max-height: 600px;
  }

  .nac-tt-play-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 48px;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }

  .nac-tt-caption {
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--nac-text);
    word-wrap: break-word;
  }

  .nac-tt-hashtags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 14px;
  }

  .nac-tt-hashtag {
    display: inline-block;
    font-size: 13px;
    font-weight: 600;
    color: #fe2c55;
    cursor: default;
  }

  @media (prefers-color-scheme: dark) {
    .nac-tt-hashtag {
      color: #ff6a8a;
    }
  }

  /* YouTube Transcript Paste */
  .nac-transcript-input {
    width: 100%;
    min-height: 200px;
    font-family: monospace;
    font-size: 0.9em;
    line-height: 1.6;
    padding: 12px;
    border: 1px solid var(--nac-border);
    border-radius: 6px;
    background: var(--nac-surface);
    color: var(--nac-text);
    resize: vertical;
    margin-top: 8px;
    box-sizing: border-box;
  }

  .nac-transcript-instructions {
    font-size: 0.85em;
    color: var(--nac-text-muted);
    margin: 12px 0;
    line-height: 1.5;
  }

  .nac-transcript-instructions ol {
    padding-left: 20px;
    margin: 8px 0;
  }

  .nac-transcript-save-btn {
    margin-top: 8px;
  }

  .nac-btn-close-watch {
    background: #ff0000 !important;
    color: white !important;
  }

  .nac-btn-close-watch:hover {
    background: #cc0000 !important;
  }

  /* ===== Pending Captures Banner ===== */
  .nac-pending-banner {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    margin: -40px -20px 16px -20px;
    border-radius: 0;
    flex-wrap: wrap;
  }

  .nac-pending-banner span {
    flex: 1;
    min-width: 200px;
  }

  .nac-pending-btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .nac-pending-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .nac-pending-publish {
    background: white;
    color: #4f46e5;
    font-weight: 600;
  }

  .nac-pending-publish:hover:not(:disabled) {
    background: #f0f0f0;
  }

  .nac-pending-dismiss {
    background: rgba(255,255,255,0.2);
    color: white;
  }

  .nac-pending-dismiss:hover {
    background: rgba(255,255,255,0.3);
  }

  @media (max-width: 768px) {
    .nac-pending-banner {
      margin: -12px -12px 12px -12px;
      padding: 10px 12px;
      font-size: 13px;
    }
  }
`;
