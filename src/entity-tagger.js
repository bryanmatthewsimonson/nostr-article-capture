import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { Crypto } from './crypto.js';
import { ClaimExtractor } from './claim-extractor.js';
import { EntityAutoSuggest } from './entity-auto-suggest.js';
import { ReaderView } from './reader-view.js';

export const EntityTagger = {
  popover: null,
  selectedText: '',

  // Show entity tagging popover
  show: (text, x, y) => {
    EntityTagger.selectedText = text;
    
    // Remove existing popover
    EntityTagger.hide();
    
    // Create popover
    EntityTagger.popover = document.createElement('div');
    EntityTagger.popover.className = 'nac-entity-popover';
    EntityTagger.popover.style.left = x + 'px';
    EntityTagger.popover.style.top = (y - 120) + 'px';
    
    EntityTagger.popover.innerHTML = `
      <div class="nac-popover-title">Tag "${Utils.escapeHtml(text)}"</div>
      <div class="nac-entity-type-buttons">
        <button class="nac-btn-entity-type" data-type="person" aria-label="Tag as Person">👤 Person</button>
        <button class="nac-btn-entity-type" data-type="organization" aria-label="Tag as Organization">🏢 Org</button>
        <button class="nac-btn-entity-type" data-type="place" aria-label="Tag as Place">📍 Place</button>
        <button class="nac-btn-entity-type" data-type="thing" aria-label="Tag as Thing">🔷 Thing</button>
        <button class="nac-btn-entity-type nac-btn-claim-type" data-type="claim" aria-label="Extract as Claim">📋 Claim</button>
      </div>
      <div id="nac-entity-search-results"></div>
    `;
    
    document.body.appendChild(EntityTagger.popover);
    
    // Event listeners
    document.querySelectorAll('.nac-btn-entity-type').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.type === 'claim') {
          ClaimExtractor.showForm(text, EntityTagger.popover);
        } else {
          EntityTagger.selectType(btn.dataset.type);
        }
      });
    });
    
    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', EntityTagger.handleOutsideClick);
    }, 100);
  },

  // Hide popover
  hide: () => {
    if (EntityTagger.popover) {
      EntityTagger.popover.remove();
      EntityTagger.popover = null;
    }
    document.removeEventListener('click', EntityTagger.handleOutsideClick);
  },

  // Handle click outside popover
  handleOutsideClick: (e) => {
    if (EntityTagger.popover && !EntityTagger.popover.contains(e.target)) {
      EntityTagger.hide();
    }
  },

  // Select entity type and search for existing
  selectType: async (type) => {
    const resultsEl = document.getElementById('nac-entity-search-results');
    resultsEl.innerHTML = '<div class="nac-spinner"></div> Searching...';
    
    // Search for existing entities
    const results = await Storage.entities.search(EntityTagger.selectedText, type);
    
    if (results.length > 0) {
      resultsEl.innerHTML = `
        <div class="nac-search-results">
          <div class="nac-results-header">Existing matches:</div>
          ${results.map(entity => `
            <button class="nac-btn-link-entity" data-id="${entity.id}">
              ${Utils.escapeHtml(entity.name)} (${entity.type})
            </button>
          `).join('')}
        </div>
        <button class="nac-btn nac-btn-primary" id="nac-create-new-entity">
          Create New ${type}
        </button>
      `;
      
      // Event listeners for linking
      document.querySelectorAll('.nac-btn-link-entity').forEach(btn => {
        btn.addEventListener('click', () => EntityTagger.linkEntity(btn.dataset.id));
      });
    } else {
      resultsEl.innerHTML = `
        <div class="nac-no-results">No existing ${type}s found</div>
        <button class="nac-btn nac-btn-primary" id="nac-create-new-entity">
          Create New ${type}
        </button>
      `;
    }
    
    document.getElementById('nac-create-new-entity')?.addEventListener('click', () => {
      EntityTagger.createEntity(type);
    });
  },

  // Create new entity
  createEntity: async (type) => {
    try {
      // Generate keypair for entity
      const privkey = Crypto.generatePrivateKey();
      const pubkey = Crypto.getPublicKey(privkey);
      
      // Create entity ID (hash of type + name)
      const entityId = 'entity_' + await Crypto.sha256(type + EntityTagger.selectedText);
      
      // Get current user
      const userIdentity = await Storage.identity.get();
      
      // Save entity
      const entity = await Storage.entities.save(entityId, {
        id: entityId,
        type,
        name: EntityTagger.selectedText,
        aliases: [],
        canonical_id: null,
        keypair: {
          pubkey,
          privkey,
          npub: Crypto.hexToNpub(pubkey),
          nsec: Crypto.hexToNsec(privkey)
        },
        created_by: userIdentity?.pubkey || 'unknown',
        created_at: Math.floor(Date.now() / 1000),
        articles: [{
          url: ReaderView.article.url,
          title: ReaderView.article.title,
          context: 'mentioned',
          tagged_at: Math.floor(Date.now() / 1000)
        }],
        metadata: {}
      });
      
      // Add to current article
      ReaderView.entities.push({
        entity_id: entityId,
        context: 'mentioned'
      });
      
      // Update UI
      EntityTagger.addChip(entity);
      EntityTagger.hide();
      
      Utils.showToast(`Created ${type}: ${EntityTagger.selectedText}`, 'success');
    } catch (e) {
      console.error('[NAC] Failed to create entity:', e);
      Utils.showToast('Failed to create entity', 'error');
    }
  },

  // Link existing entity
  linkEntity: async (entityId) => {
    try {
      const entity = await Storage.entities.get(entityId);
      
      // Add current article to entity's articles list
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
      
      await Storage.entities.save(entityId, entity);
      
      // Add to current article
      ReaderView.entities.push({
        entity_id: entityId,
        context: 'mentioned'
      });
      
      // Update UI
      EntityTagger.addChip(entity);
      EntityTagger.hide();
      
      Utils.showToast(`Linked entity: ${entity.name}`, 'success');
      EntityAutoSuggest.removeSuggestionByEntityId(entityId);
    } catch (e) {
      console.error('[NAC] Failed to link entity:', e);
      Utils.showToast('Failed to link entity', 'error');
    }
  },

  // Add entity chip to UI
  addChip: (entity) => {
    const chipsContainer = document.getElementById('nac-entity-chips');
    const chip = document.createElement('div');
    chip.className = 'nac-entity-chip nac-entity-' + entity.type;
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', entity.type + ': ' + entity.name);
    chip.innerHTML = `
      <span class="nac-chip-icon">${entity.type === 'person' ? '👤' : entity.type === 'organization' ? '🏢' : entity.type === 'thing' ? '🔷' : '📍'}</span>
      <span class="nac-chip-name">${Utils.escapeHtml(entity.name)}</span>
      <button class="nac-chip-remove" data-id="${entity.id}" aria-label="Remove entity ${Utils.escapeHtml(entity.name)}">×</button>
    `;
    
    chipsContainer.appendChild(chip);
    
    chip.querySelector('.nac-chip-remove').addEventListener('click', () => {
      chip.remove();
      ReaderView.entities = ReaderView.entities.filter(e => e.entity_id !== entity.id);
    });
  }
};
