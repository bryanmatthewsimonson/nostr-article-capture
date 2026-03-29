import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { EntitySync } from './entity-sync.js';

export const EntityBrowser = {
  TYPE_EMOJI: { person: '👤', organization: '🏢', place: '📍', thing: '🔷' },
  TYPE_LABELS: { person: 'Person', organization: 'Org', place: 'Place', thing: 'Thing' },

  _registry: {},

  init: async (panel, identity) => {
    const container = panel.querySelector('#nac-entity-browser');
    if (!container) return;

    const registry = await Storage.entities.getAll();
    EntityBrowser._registry = registry;
    const entities = Object.values(registry);

    container.innerHTML = EntityBrowser.renderListView(entities);
    EntityBrowser.bindListEvents(container, panel, identity);
  },

  renderListView: (entities) => {
    const count = entities.length;
    return `
      <div class="nac-eb-list-view">
        <div class="nac-eb-search-bar">
          <input type="text" class="nac-eb-search" placeholder="Search entities…" id="nac-eb-search">
        </div>
        <div class="nac-eb-type-filters">
          <button class="nac-eb-type-btn active" data-filter="all">All (${count})</button>
          <button class="nac-eb-type-btn" data-filter="person" aria-label="Filter by Person">👤</button>
          <button class="nac-eb-type-btn" data-filter="organization" aria-label="Filter by Organization">🏢</button>
          <button class="nac-eb-type-btn" data-filter="place" aria-label="Filter by Place">📍</button>
          <button class="nac-eb-type-btn" data-filter="thing" aria-label="Filter by Thing">🔷</button>
        </div>
        <div class="nac-eb-entity-list" id="nac-eb-entity-list">
          ${EntityBrowser.renderEntityCards(entities)}
        </div>
        ${count === 0 ? '<div class="nac-eb-empty">No entities yet. Tag text in articles to create entities.</div>' : ''}
        <div class="nac-eb-actions">
          <button class="nac-btn" id="nac-eb-export">📤 Export</button>
          <button class="nac-btn" id="nac-eb-import">📥 Import</button>
        </div>
        <div class="nac-eb-sync-section">
          <div class="nac-eb-sync-title">🔄 Entity Sync</div>
          <div class="nac-eb-sync-desc">Sync entities across browsers via encrypted NOSTR events.</div>
          <label class="nac-eb-sync-label">
            <input type="checkbox" id="nac-publish-profiles" style="accent-color: var(--nac-primary);">
            Also publish entity profiles (kind 0 — public name only)
          </label>
          <div class="nac-eb-sync-buttons">
            <button id="nac-push-entities" class="nac-eb-sync-btn">⬆ Push to NOSTR</button>
            <button id="nac-pull-entities" class="nac-eb-sync-btn">⬇ Pull from NOSTR</button>
          </div>
          <div id="nac-sync-status" class="nac-eb-sync-status" style="display: none;"></div>
        </div>
      </div>
    `;
  },

  renderEntityCards: (entities) => {
    if (!entities.length) return '';
    const sorted = [...entities].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return sorted.map(e => {
      const emoji = EntityBrowser.TYPE_EMOJI[e.type] || '🔷';
      const articleCount = (e.articles || []).length;
      const created = e.created_at ? new Date(e.created_at * 1000).toLocaleDateString() : 'Unknown';
      const canonicalEntity = e.canonical_id ? EntityBrowser._registry[e.canonical_id] : null;
      const aliasLabel = canonicalEntity ? `<div class="nac-eb-card-alias">→ ${Utils.escapeHtml(canonicalEntity.name)}</div>` : '';
      return `
        <div class="nac-eb-card nac-eb-card-${e.type}${e.canonical_id ? ' nac-eb-card-alias-entity' : ''}" data-entity-id="${Utils.escapeHtml(e.id)}" tabindex="0" role="button" aria-label="${Utils.escapeHtml(e.name)} — ${e.type}">
          <div class="nac-eb-card-main">
            <span class="nac-eb-card-emoji">${emoji}</span>
            <div class="nac-eb-card-info">
              <div class="nac-eb-card-name">${Utils.escapeHtml(e.name)}</div>
              ${aliasLabel}
              <div class="nac-eb-card-meta">${articleCount} article${articleCount !== 1 ? 's' : ''} · ${created}</div>
            </div>
            <span class="nac-eb-card-arrow">›</span>
          </div>
        </div>
      `;
    }).join('');
  },

  bindListEvents: (container, panel, identity) => {
    // Search filter
    const searchInput = container.querySelector('#nac-eb-search');
    const typeButtons = container.querySelectorAll('.nac-eb-type-btn');
    let activeFilter = 'all';

    const filterEntities = async () => {
      const query = (searchInput?.value || '').toLowerCase();
      const registry = await Storage.entities.getAll();
      let entities = Object.values(registry);

      if (activeFilter !== 'all') {
        entities = entities.filter(e => e.type === activeFilter);
      }
      if (query) {
        entities = entities.filter(e =>
          e.name.toLowerCase().includes(query) ||
          (e.aliases || []).some(a => a.toLowerCase().includes(query))
        );
      }

      const listEl = container.querySelector('#nac-eb-entity-list');
      if (listEl) listEl.innerHTML = EntityBrowser.renderEntityCards(entities);

      // Re-bind card click + keyboard events
      container.querySelectorAll('.nac-eb-card').forEach(card => {
        card.addEventListener('click', () => {
          const entityId = card.dataset.entityId;
          EntityBrowser.showDetail(container, entityId, panel, identity);
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
      });
    };

    searchInput?.addEventListener('input', filterEntities);

    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        filterEntities();
      });
    });

    // Card clicks + keyboard
    container.querySelectorAll('.nac-eb-card').forEach(card => {
      card.addEventListener('click', () => {
        const entityId = card.dataset.entityId;
        EntityBrowser.showDetail(container, entityId, panel, identity);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });

    // Export handler
    container.querySelector('#nac-eb-export')?.addEventListener('click', async () => {
      const json = await Storage.entities.exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nostr-entities-' + Date.now() + '.json';
      a.click();
      Utils.showToast('Entities exported', 'success');
    });

    // Import handler
    container.querySelector('#nac-eb-import')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const count = await Storage.entities.importAll(text);
          Utils.showToast(`Imported ${count} entities`, 'success');
          await EntityBrowser.init(panel, identity);
        } catch (err) {
          Utils.showToast('Import failed: ' + err.message, 'error');
        }
      };
      input.click();
    });

    // Sync: Push
    container.querySelector('#nac-push-entities')?.addEventListener('click', async () => {
      const statusEl = container.querySelector('#nac-sync-status');
      statusEl.style.display = 'block';
      const pushBtn = container.querySelector('#nac-push-entities');
      const pullBtn = container.querySelector('#nac-pull-entities');
      pushBtn.disabled = true;
      pullBtn.disabled = true;
      try {
        const publishProfiles = container.querySelector('#nac-publish-profiles')?.checked || false;
        await EntitySync.push({
          publishProfiles,
          onProgress: (p) => {
            if (p.phase === 'encrypting') statusEl.textContent = `⏳ Encrypting ${p.total} entities...`;
            else if (p.phase === 'publishing') statusEl.textContent = `⏳ Publishing entity ${p.current}/${p.total}: ${p.name}...`;
            else if (p.phase === 'profiles') statusEl.textContent = `⏳ Publishing ${p.total} entity profiles...`;
            else if (p.phase === 'complete') {
              const succeeded = p.results.filter(r => r.success).length;
              const failed = p.results.filter(r => !r.success).length;
              statusEl.innerHTML = `✅ Push complete: ${succeeded} entities published` + (failed > 0 ? `, <span style="color: var(--nac-error);">${failed} failed</span>` : '');
            }
          }
        });
      } catch (e) {
        statusEl.innerHTML = `<span style="color: var(--nac-error);">❌ ${Utils.escapeHtml(e.message)}</span>`;
      } finally {
        pushBtn.disabled = false;
        pullBtn.disabled = false;
      }
    });

    // Sync: Pull
    container.querySelector('#nac-pull-entities')?.addEventListener('click', async () => {
      const statusEl = container.querySelector('#nac-sync-status');
      statusEl.style.display = 'block';
      const pushBtn = container.querySelector('#nac-push-entities');
      const pullBtn = container.querySelector('#nac-pull-entities');
      pushBtn.disabled = true;
      pullBtn.disabled = true;
      try {
        await EntitySync.pull({
          onProgress: (p) => {
            if (p.phase === 'fetching') {
              const detail = p.detail || 'Connecting to relays...';
              statusEl.textContent = `⏳ ${detail}`;
            }
            else if (p.phase === 'decrypting') statusEl.textContent = `⏳ Received ${p.total} events, decrypting...`;
            else if (p.phase === 'merging') statusEl.textContent = `⏳ Merging ${p.remote} entities...`;
            else if (p.phase === 'complete') {
              const cs = p.connectionStats || {};
              const connInfo = cs.attempted
                ? `<br><span style="font-size: 10px; color: #888;">Relays: ${cs.connected}/${cs.attempted} connected` +
                  (cs.failed > 0 ? `, ${cs.failed} failed` : '') + '</span>'
                : '';
              const decryptInfo = (p.decryptErrors && p.decryptErrors.length > 0)
                ? `<br><span style="font-size: 10px; color: #ff9800;">⚠ ${p.decryptErrors.length} decrypt error(s)</span>`
                : '';

              if (p.stats.total === 0) {
                statusEl.innerHTML = 'ℹ️ No entity sync events found on relays for this identity.' +
                  connInfo + decryptInfo;
              } else {
                statusEl.innerHTML = `✅ Sync complete:<br>` +
                  `&nbsp;&nbsp;${p.stats.imported} new entities imported<br>` +
                  `&nbsp;&nbsp;${p.stats.updated} entities updated (newer remote)<br>` +
                  `&nbsp;&nbsp;${p.stats.unchanged} entities unchanged<br>` +
                  `&nbsp;&nbsp;${p.stats.keptLocal} entities kept (newer local)` +
                  connInfo + decryptInfo;
              }
            }
          }
        });
        // Delay refresh so user can read the status message
        setTimeout(async () => {
          await EntityBrowser.init(panel, identity);
        }, 3000);
      } catch (e) {
        statusEl.innerHTML = `<span style="color: var(--nac-error);">❌ ${Utils.escapeHtml(e.message)}</span>`;
      } finally {
        pushBtn.disabled = false;
        pullBtn.disabled = false;
      }
    });

    // Disable sync if no privkey
    if (!identity?.privkey) {
      const pushEl = container.querySelector('#nac-push-entities');
      const pullEl = container.querySelector('#nac-pull-entities');
      if (pushEl) pushEl.disabled = true;
      if (pullEl) pullEl.disabled = true;
      const statusEl = container.querySelector('#nac-sync-status');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = '⚠️ Entity sync requires a local private key. Import your nsec or generate a new keypair.';
      }
    }
  },

  showDetail: async (container, entityId, panel, identity) => {
    const entity = await Storage.entities.get(entityId);
    if (!entity) {
      Utils.showToast('Entity not found', 'error');
      return;
    }

    const emoji = EntityBrowser.TYPE_EMOJI[entity.type] || '🔷';
    const typeLabel = EntityBrowser.TYPE_LABELS[entity.type] || entity.type;
    const articles = entity.articles || [];
    const aliases = entity.aliases || [];
    const created = entity.created_at ? new Date(entity.created_at * 1000).toLocaleString() : 'Unknown';

    // Look up canonical relationship
    let canonicalEntity = null;
    if (entity.canonical_id) {
      canonicalEntity = await Storage.entities.get(entity.canonical_id);
    }

    // Find entities that are aliases of this entity
    const registry = await Storage.entities.getAll();
    const aliasEntities = Object.values(registry).filter(e => e.canonical_id === entityId);

    // Build canonical reference section HTML
    let canonicalSectionHtml = '';
    if (canonicalEntity) {
      canonicalSectionHtml = `
        <div class="nac-eb-section nac-eb-canonical-section">
          <div class="nac-eb-section-title">🔗 Canonical Reference</div>
          <div class="nac-eb-canonical-info">
            Alias of: <button class="nac-eb-canonical-link" id="nac-eb-goto-canonical" data-entity-id="${Utils.escapeHtml(canonicalEntity.id)}">${Utils.escapeHtml(canonicalEntity.name)}</button>
            <button class="nac-eb-remove-alias-btn" id="nac-eb-remove-alias" title="Remove alias link">✕ Unlink</button>
          </div>
        </div>
      `;
    } else if (aliasEntities.length > 0) {
      canonicalSectionHtml = `
        <div class="nac-eb-section nac-eb-canonical-section">
          <div class="nac-eb-section-title">🔗 Known Aliases</div>
          <div class="nac-eb-alias-entities">
            ${aliasEntities.map(ae => `
              <button class="nac-eb-alias-entity-link" data-entity-id="${Utils.escapeHtml(ae.id)}">${Utils.escapeHtml(ae.name)}</button>
            `).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="nac-eb-detail">
        <button class="nac-eb-back" id="nac-eb-back">← Back to list</button>
        <div class="nac-eb-detail-header">
          <span class="nac-eb-detail-emoji">${emoji}</span>
          <h3 class="nac-eb-detail-name" id="nac-eb-detail-name" title="Click to rename" tabindex="0" role="button" aria-label="Rename entity ${Utils.escapeHtml(entity.name)}">${Utils.escapeHtml(entity.name)}</h3>
          <span class="nac-eb-detail-badge nac-eb-badge-${entity.type}">${typeLabel}</span>
        </div>
        <div class="nac-eb-detail-created">Created: ${created}</div>
        
        ${canonicalSectionHtml}
        
        <div class="nac-eb-section">
          <button class="nac-btn" id="nac-eb-set-alias" style="width:100%; margin-bottom: 12px; font-size: 12px; padding: 6px;">🔗 Set as alias of…</button>
        </div>
        
        <div class="nac-eb-section">
          <div class="nac-eb-section-title">Aliases</div>
          <div class="nac-eb-aliases" id="nac-eb-aliases">
            ${aliases.map((a, i) => `
              <span class="nac-eb-alias">
                ${Utils.escapeHtml(a)}
                <button class="nac-eb-alias-remove" data-index="${i}" title="Remove alias">✕</button>
              </span>
            `).join('')}
            ${aliases.length === 0 ? '<span class="nac-eb-no-aliases">No aliases</span>' : ''}
          </div>
          <div class="nac-eb-alias-add">
            <input type="text" class="nac-eb-alias-input" id="nac-eb-alias-input" placeholder="Add alias…">
            <button class="nac-btn" id="nac-eb-add-alias">Add</button>
          </div>
        </div>
        
        <div class="nac-eb-section">
          <div class="nac-eb-section-title">Keypair</div>
          <div class="nac-eb-keypair">
            <div class="nac-eb-key-row">
              <span class="nac-eb-key-label">npub:</span>
              <code class="nac-eb-key-value">${Utils.escapeHtml(entity.keypair?.npub || 'N/A')}</code>
              <button class="nac-eb-copy-btn" data-copy="${Utils.escapeHtml(entity.keypair?.npub || '')}" title="Copy npub">📋</button>
            </div>
            <div class="nac-eb-key-row">
              <span class="nac-eb-key-label">nsec:</span>
              <code class="nac-eb-key-value nac-eb-nsec-hidden" id="nac-eb-nsec-value">••••••••••••••</code>
              <button class="nac-eb-copy-btn" id="nac-eb-toggle-nsec" title="Reveal nsec">👁</button>
              <button class="nac-eb-copy-btn" id="nac-eb-copy-nsec" title="Copy nsec">📋</button>
            </div>
          </div>
        </div>
        
        <div class="nac-eb-section">
          <div class="nac-eb-section-title">Articles (${articles.length})</div>
          <div class="nac-eb-articles" id="nac-eb-articles">
            ${articles.length === 0 ? '<div class="nac-eb-no-articles">No linked articles</div>' : ''}
            ${articles.map(a => `
              <div class="nac-eb-article-item">
                <div class="nac-eb-article-title">${Utils.escapeHtml(a.title || 'Untitled')}</div>
                <a class="nac-eb-article-url" href="${Utils.escapeHtml(a.url || '#')}" target="_blank" rel="noopener">${Utils.escapeHtml(a.url || '')}</a>
                <div class="nac-eb-article-meta">
                  <span class="nac-eb-article-context">${Utils.escapeHtml(a.context || 'mentioned')}</span>
                  ${a.tagged_at ? `<span>· ${new Date(a.tagged_at * 1000).toLocaleDateString()}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="nac-eb-danger-zone">
          <button class="nac-eb-delete-btn" id="nac-eb-delete">🗑 Delete Entity</button>
        </div>
      </div>
    `;

    EntityBrowser.bindDetailEvents(container, entity, panel, identity);
  },

  bindDetailEvents: (container, entity, panel, identity) => {
    // Back button
    container.querySelector('#nac-eb-back')?.addEventListener('click', async () => {
      await EntityBrowser.init(panel, identity);
    });

    // "Set as alias of…" button — opens search to pick canonical entity
    container.querySelector('#nac-eb-set-alias')?.addEventListener('click', async () => {
      const searchTerm = prompt('Search for canonical entity:');
      if (!searchTerm || !searchTerm.trim()) return;
      const results = await Storage.entities.search(searchTerm.trim());
      // Filter out self
      const filtered = results.filter(r => r.id !== entity.id);
      if (filtered.length === 0) {
        Utils.showToast('No matching entities found', 'error');
        return;
      }
      // If multiple results, let user pick
      let chosen;
      if (filtered.length === 1) {
        chosen = filtered[0];
      } else {
        const options = filtered.map((e, i) => `${i + 1}. ${e.name} (${e.type})`).join('\n');
        const choice = prompt(`Multiple matches:\n${options}\n\nEnter number:`);
        const idx = parseInt(choice) - 1;
        if (isNaN(idx) || idx < 0 || idx >= filtered.length) return;
        chosen = filtered[idx];
      }
      // Prevent circular: don't alias to something that's already an alias of this entity
      if (chosen.canonical_id === entity.id) {
        Utils.showToast('Cannot set alias: would create circular reference', 'error');
        return;
      }
      entity.canonical_id = chosen.id;
      await Storage.entities.save(entity.id, entity);
      Utils.showToast(`Set as alias of: ${chosen.name}`, 'success');
      EntityBrowser.showDetail(container, entity.id, panel, identity);
    });

    // "Go to canonical" link
    container.querySelector('#nac-eb-goto-canonical')?.addEventListener('click', () => {
      const canonicalId = container.querySelector('#nac-eb-goto-canonical')?.dataset.entityId;
      if (canonicalId) EntityBrowser.showDetail(container, canonicalId, panel, identity);
    });

    // "Remove alias link" button
    container.querySelector('#nac-eb-remove-alias')?.addEventListener('click', async () => {
      entity.canonical_id = null;
      await Storage.entities.save(entity.id, entity);
      Utils.showToast('Alias link removed', 'success');
      EntityBrowser.showDetail(container, entity.id, panel, identity);
    });

    // Alias entity links (click to navigate)
    container.querySelectorAll('.nac-eb-alias-entity-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.entityId;
        if (targetId) EntityBrowser.showDetail(container, targetId, panel, identity);
      });
    });

    // Rename: click or Enter/Space on name to edit
    const nameEl = container.querySelector('#nac-eb-detail-name');
    const handleRename = () => {
      const currentName = entity.name;
      const newName = prompt('Rename entity:', currentName);
      if (newName && newName.trim() && newName.trim() !== currentName) {
        entity.name = newName.trim();
        Storage.entities.save(entity.id, entity).then(() => {
          nameEl.textContent = entity.name;
          Utils.showToast('Entity renamed', 'success');
        });
      }
    };
    nameEl?.addEventListener('click', handleRename);
    nameEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRename();
      }
    });

    // Add alias
    container.querySelector('#nac-eb-add-alias')?.addEventListener('click', async () => {
      const input = container.querySelector('#nac-eb-alias-input');
      const alias = (input?.value || '').trim();
      if (!alias) return;
      if (!entity.aliases) entity.aliases = [];
      if (entity.aliases.includes(alias)) {
        Utils.showToast('Alias already exists', 'error');
        return;
      }
      entity.aliases.push(alias);
      await Storage.entities.save(entity.id, entity);
      Utils.showToast('Alias added', 'success');
      EntityBrowser.showDetail(container, entity.id, panel, identity);
    });

    // Remove alias buttons
    container.querySelectorAll('.nac-eb-alias-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        if (!entity.aliases || isNaN(index)) return;
        entity.aliases.splice(index, 1);
        await Storage.entities.save(entity.id, entity);
        Utils.showToast('Alias removed', 'success');
        EntityBrowser.showDetail(container, entity.id, panel, identity);
      });
    });

    // Toggle nsec visibility
    let nsecVisible = false;
    container.querySelector('#nac-eb-toggle-nsec')?.addEventListener('click', () => {
      const nsecEl = container.querySelector('#nac-eb-nsec-value');
      if (!nsecEl) return;
      nsecVisible = !nsecVisible;
      if (nsecVisible) {
        nsecEl.textContent = entity.keypair?.nsec || 'N/A';
        nsecEl.classList.remove('nac-eb-nsec-hidden');
        container.querySelector('#nac-eb-toggle-nsec').textContent = '🙈';
      } else {
        nsecEl.textContent = '••••••••••••••';
        nsecEl.classList.add('nac-eb-nsec-hidden');
        container.querySelector('#nac-eb-toggle-nsec').textContent = '👁';
      }
    });

    // Copy npub
    container.querySelectorAll('.nac-eb-copy-btn[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy;
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          const orig = btn.textContent;
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = orig, 1500);
        } catch {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          const orig = btn.textContent;
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = orig, 1500);
        }
      });
    });

    // Copy nsec
    container.querySelector('#nac-eb-copy-nsec')?.addEventListener('click', async () => {
      const nsec = entity.keypair?.nsec || '';
      if (!nsec) return;
      try {
        await navigator.clipboard.writeText(nsec);
        const btn = container.querySelector('#nac-eb-copy-nsec');
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '📋', 1500);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = nsec;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        const btn = container.querySelector('#nac-eb-copy-nsec');
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '📋', 1500);
      }
    });

    // Delete entity
    container.querySelector('#nac-eb-delete')?.addEventListener('click', async () => {
      if (!confirm(`Delete entity "${entity.name}"? This cannot be undone.`)) return;
      await Storage.entities.delete(entity.id);
      Utils.showToast('Entity deleted', 'success');
      await EntityBrowser.init(panel, identity);
    });
  }
};
