import { CONFIG } from './config.js';
import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { EntityTagger } from './entity-tagger.js';
import { ReaderView } from './reader-view.js';

export const EntityAutoSuggest = {
  suggestions: [],
  dismissedIds: new Set(),
  maxVisible: 6,
  expanded: false,

  // Build a word-boundary regex that handles special characters
  buildWordBoundaryRegex: (term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // If term contains non-word chars (dots, hyphens), use lookaround
    if (/[^\w\s]/.test(term)) {
      return new RegExp('(?<=^|[\\s,;:!?\\.])' + escaped + '(?=$|[\\s,;:!?\\.])', 'i');
    }
    return new RegExp('\\b' + escaped + '\\b', 'i');
  },

  // Main entry point — scan article for entity suggestions
  scan: async (article) => {
    try {
      if (!article || !article.textContent) return;

      const registry = await Storage.entities.getAll();
      const existingEntities = ReaderView.entities.map(e => e.entity_id);
      const alreadyTaggedIds = new Set(existingEntities);
      const searchText = article.title + ' \n ' + article.textContent;

      // Match known entities from registry
      const suggestions = EntityAutoSuggest.matchKnownEntities(searchText, article.title, alreadyTaggedIds, registry);

      // Store suggestions
      EntityAutoSuggest.suggestions = suggestions;
      EntityAutoSuggest.expanded = false;
      EntityAutoSuggest.dismissedIds = new Set();

      // Render UI
      if (suggestions.length > 0) {
        const container = document.getElementById('nac-suggestion-bar');
        if (container) {
          EntityAutoSuggest.render(container, suggestions);
        }
      }
    } catch (e) {
      Utils.error('Entity auto-suggestion scan failed:', e);
    }
  },

  // Find known entities whose name or alias appears in the article
  matchKnownEntities: (text, title, alreadyTaggedIds, registry) => {
    const results = [];
    const entities = Object.values(registry);
    const lowerText = text.toLowerCase();

    for (const entity of entities) {
      if (alreadyTaggedIds.has(entity.id)) continue;

      const searchTerms = [entity.name, ...(entity.aliases || [])];

      for (const term of searchTerms) {
        if (!term || term.length < CONFIG.tagging.min_selection_length) continue;

        // Fast indexOf pre-filter before regex
        if (lowerText.indexOf(term.toLowerCase()) === -1) continue;

        // Confirm with word-boundary regex
        const regex = EntityAutoSuggest.buildWordBoundaryRegex(term);
        if (regex.test(text)) {
          const canonicalName = entity.canonical_id && registry[entity.canonical_id] ? registry[entity.canonical_id].name : null;
          results.push({
            type: 'known',
            entity: entity,
            entityId: entity.id,
            name: entity.name,
            matchedOn: term,
            canonicalName,
            occurrences: (text.match(new RegExp(regex.source, 'gi')) || []).length,
            position: text.search(regex)
          });
          break; // one match per entity is enough
        }
      }
    }

    // Sort by first appearance in text
    results.sort((a, b) => a.position - b.position);
    return results;
  },

  // Get emoji for entity type
  _typeEmoji: (type) => {
    const map = { person: '\u{1F464}', organization: '\u{1F3E2}', place: '\u{1F4CD}', thing: '\u{1F537}', unknown: '\u2753' };
    return map[type] || '\u2753';
  },

  // Render the suggestion bar UI
  render: (container, suggestions) => {
    container.style.display = 'block';
    const count = suggestions.length;
    const visibleCount = EntityAutoSuggest.expanded ? count : Math.min(count, EntityAutoSuggest.maxVisible);
    const hiddenCount = count - EntityAutoSuggest.maxVisible;

    container.innerHTML = `
      <div class="nac-suggestion-bar-header">
        <span class="nac-suggestion-bar-title">\u{1F50D} Recognized Entities (${count})</span>
        <button class="nac-suggestion-dismiss-all" aria-label="Dismiss all suggestions">Dismiss All</button>
      </div>
      <div class="nac-suggestion-chips">
        ${suggestions.slice(0, visibleCount).map((s, i) => EntityAutoSuggest._renderChip(s, i)).join('')}
      </div>
      ${!EntityAutoSuggest.expanded && hiddenCount > 0 ? `<button class="nac-suggestion-show-more" aria-label="Show ${hiddenCount} more suggestions">Show ${hiddenCount} more</button>` : ''}
    `;

    // Attach event listeners
    container.querySelector('.nac-suggestion-dismiss-all').addEventListener('click', EntityAutoSuggest.dismissAll);

    container.querySelectorAll('.nac-suggestion-accept').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.closest('.nac-suggestion-chip').dataset.index, 10);
        EntityAutoSuggest.acceptSuggestion(idx);
      });
    });

    container.querySelectorAll('.nac-suggestion-dismiss').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.closest('.nac-suggestion-chip').dataset.index, 10);
        EntityAutoSuggest.dismissSuggestion(idx);
      });
    });

    const showMoreBtn = container.querySelector('.nac-suggestion-show-more');
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', EntityAutoSuggest.toggleShowMore);
    }
  },

  // Render a single suggestion chip HTML
  _renderChip: (suggestion, index) => {
    const entityType = suggestion.entity.type;
    const emoji = EntityAutoSuggest._typeEmoji(entityType);
    const name = Utils.escapeHtml(suggestion.name);
    const canonicalLabel = suggestion.canonicalName ? ` → ${Utils.escapeHtml(suggestion.canonicalName)}` : '';

    return `<div class="nac-suggestion-chip nac-suggestion-known" data-index="${index}" data-entity-id="${suggestion.entityId}">
      <span class="nac-suggestion-icon">${emoji}</span>
      <span class="nac-suggestion-name">${name}${canonicalLabel}</span>
      <span class="nac-suggestion-badge">${entityType}</span>
      <div class="nac-suggestion-actions">
        <button class="nac-suggestion-accept" aria-label="Accept: ${name}">\u2713 Link</button>
        <button class="nac-suggestion-dismiss" aria-label="Dismiss: ${name}">\u2715</button>
      </div>
    </div>`;
  },

  // Accept a known entity suggestion — link it
  acceptKnown: async (entity) => {
    try {
      if (!entity.articles) entity.articles = [];
      const articleEntry = {
        url: ReaderView.article.url,
        title: ReaderView.article.title,
        context: 'mentioned',
        tagged_at: Math.floor(Date.now() / 1000)
      };
      const existingIdx = entity.articles.findIndex(a => a.url === articleEntry.url);
      if (existingIdx >= 0) {
        entity.articles[existingIdx].tagged_at = articleEntry.tagged_at;
      } else {
        entity.articles.push(articleEntry);
      }

      await Storage.entities.save(entity.id, entity);
      ReaderView.entities.push({ entity_id: entity.id, context: 'mentioned' });
      EntityTagger.addChip(entity);
      Utils.showToast(`Linked entity: ${entity.name}`, 'success');
    } catch (e) {
      Utils.error('Failed to accept known entity suggestion:', e);
      Utils.showToast('Failed to link entity', 'error');
    }
  },


  // Accept a suggestion by index
  acceptSuggestion: async (index) => {
    const suggestion = EntityAutoSuggest.suggestions[index];
    if (!suggestion) return;

    await EntityAutoSuggest.acceptKnown(suggestion.entity);

    // Remove from suggestions
    EntityAutoSuggest.suggestions.splice(index, 1);
    EntityAutoSuggest._refreshUI();
  },

  // Dismiss a single suggestion
  dismissSuggestion: (index) => {
    const suggestion = EntityAutoSuggest.suggestions[index];
    if (suggestion) {
      EntityAutoSuggest.dismissedIds.add(suggestion.entityId);
    }
    EntityAutoSuggest.suggestions.splice(index, 1);
    EntityAutoSuggest._refreshUI();
  },

  // Dismiss all suggestions
  dismissAll: () => {
    EntityAutoSuggest.suggestions = [];
    EntityAutoSuggest.dismissedIds = new Set();
    const container = document.getElementById('nac-suggestion-bar');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  },

  // Toggle show more / collapse
  toggleShowMore: () => {
    EntityAutoSuggest.expanded = !EntityAutoSuggest.expanded;
    EntityAutoSuggest._refreshUI();
  },

  // Refresh the suggestion bar UI
  _refreshUI: () => {
    const container = document.getElementById('nac-suggestion-bar');
    if (!container) return;

    if (EntityAutoSuggest.suggestions.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    EntityAutoSuggest.render(container, EntityAutoSuggest.suggestions);
  },

  // Remove a suggestion by entity ID (called when entity is manually tagged)
  removeSuggestionByEntityId: (entityId) => {
    const idx = EntityAutoSuggest.suggestions.findIndex(
      s => (s.type === 'known' && s.entityId === entityId)
    );
    if (idx >= 0) {
      EntityAutoSuggest.suggestions.splice(idx, 1);
      EntityAutoSuggest._refreshUI();
    }
  },

  // Clean up suggestion state
  destroy: () => {
    EntityAutoSuggest.suggestions = [];
    EntityAutoSuggest.dismissedIds = new Set();
    EntityAutoSuggest.expanded = false;
    const container = document.getElementById('nac-suggestion-bar');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  }
};
