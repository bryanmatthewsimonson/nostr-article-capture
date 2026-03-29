import { CONFIG } from './config.js';
import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { Crypto } from './crypto.js';
import { EntityTagger } from './entity-tagger.js';
import { EvidenceLinker } from './evidence-linker.js';
import { ReaderView } from './reader-view.js';
import { RelayClient } from './relay-client.js';

export const ClaimExtractor = {
  // Show the claim extraction form inside the popover (progressive disclosure)
  showForm: async (text, popover) => {
    const truncated = text.length > CONFIG.tagging.max_claim_length
      ? text.substring(0, CONFIG.tagging.max_claim_length) + '…'
      : text;

    // Load entity data for dropdowns
    const entityOptions = [];
    for (const ref of (ReaderView.entities || [])) {
      try {
        const entity = await Storage.entities.get(ref.entity_id);
        if (entity) {
          const emoji = entity.type === 'person' ? '👤' : entity.type === 'organization' ? '🏢' : entity.type === 'place' ? '📍' : '🔷';
          entityOptions.push({ id: entity.id, name: entity.name, type: entity.type, emoji });
        }
      } catch (e) { /* skip unavailable entities */ }
    }

    // Auto-match entities from claim text (case-insensitive)
    const matchedEntities = entityOptions.filter(e =>
      text.toLowerCase().includes(e.name.toLowerCase())
    );
    const autoSubject = matchedEntities.length >= 1 ? `${matchedEntities[0].emoji} ${matchedEntities[0].name}` : '';
    const autoObject = matchedEntities.length >= 2 ? `${matchedEntities[1].emoji} ${matchedEntities[1].name}` : '';
    const autoExpandAttribution = false;
    const autoExpandStructure = matchedEntities.length > 0;

    const entityDatalistOptions = entityOptions.map(e =>
      `<option value="${e.emoji} ${Utils.escapeHtml(e.name)}">`
    ).join('');

    const claimantOptionsHtml = entityOptions.map(e =>
      `<option value="${Utils.escapeHtml(e.id)}">${e.emoji} ${Utils.escapeHtml(e.name)}</option>`
    ).join('');

    popover.innerHTML = `
      <div class="nac-claim-form" role="form" aria-label="Extract claim">
        <div class="nac-claim-form-title">📋 Extract Claim</div>
        <div class="nac-claim-form-text">"${Utils.escapeHtml(truncated)}"</div>

        <div class="nac-claim-form-field nac-claim-form-row">
          <div class="nac-claim-form-row-left">
            <label for="nac-claim-type">Type:</label>
            <select id="nac-claim-type" class="nac-form-select" aria-label="Claim type">
              <option value="factual">Factual</option>
              <option value="causal">Causal</option>
              <option value="evaluative">Evaluative</option>
              <option value="predictive">Predictive</option>
            </select>
          </div>
          <label class="nac-claim-crux-label">
            <input type="checkbox" id="nac-claim-crux" aria-label="Mark as key claim (crux)">
            ☐ Key claim (crux)
          </label>
        </div>

        <div class="nac-claim-form-field nac-claim-confidence-field" id="nac-claim-confidence-field" style="display: none;">
          <label for="nac-claim-confidence">Confidence: <span id="nac-claim-confidence-value">50</span>%</label>
          <input type="range" id="nac-claim-confidence" min="0" max="100" value="50" class="nac-claim-confidence-range" aria-label="Confidence level">
        </div>

        <!-- Collapsible: Who Said It -->
        <div class="nac-claim-section-header" data-section="attribution" aria-expanded="${autoExpandAttribution}" aria-controls="nac-claim-attribution-section" tabindex="0" role="button">
          <span class="nac-claim-section-arrow">${autoExpandAttribution ? '▾' : '▸'}</span> Who Said It
        </div>
        <div class="nac-claim-section-body" id="nac-claim-attribution-section" style="display:${autoExpandAttribution ? '' : 'none'}">
          <div class="nac-claim-form-field">
            <label for="nac-claim-attribution">Attribution:</label>
            <select id="nac-claim-attribution" class="nac-form-select" aria-label="Claim attribution">
              <option value="editorial">Editorial (article's own assertion)</option>
              <option value="direct_quote">Direct Quote</option>
              <option value="paraphrase">Paraphrase</option>
              <option value="thesis">Article's Main Thesis</option>
            </select>
          </div>
          <div class="nac-claim-form-field">
            <label for="nac-claim-claimant">Claimed by:</label>
            <select id="nac-claim-claimant" class="nac-form-select" aria-label="Who made this claim">
              <option value="">Article / Editorial Voice</option>
              ${claimantOptionsHtml}
            </select>
          </div>
          <div class="nac-claim-form-field" id="nac-claim-quote-date-field" style="display:none;">
            <label for="nac-claim-quote-date">Quote date:</label>
            <input type="date" id="nac-claim-quote-date" class="nac-form-input" aria-label="Date of quote or statement">
          </div>
        </div>

        <!-- Collapsible: What It Says (sentence builder) -->
        <div class="nac-claim-section-header" data-section="structure" aria-expanded="${autoExpandStructure}" aria-controls="nac-claim-structure-section" tabindex="0" role="button">
          <span class="nac-claim-section-arrow">${autoExpandStructure ? '▾' : '▸'}</span> What It Says
        </div>
        <div class="nac-claim-section-body" id="nac-claim-structure-section" style="display:${autoExpandStructure ? '' : 'none'}">
          <div class="nac-claim-sentence-builder">
            <div class="nac-claim-sentence-slot">
              <input type="text" id="nac-claim-subject" list="nac-claim-subject-list" placeholder="Entity or text…" class="nac-form-input" aria-label="Subject">
              <datalist id="nac-claim-subject-list">
                ${entityDatalistOptions}
              </datalist>
              <span class="nac-claim-sentence-label">subject</span>
            </div>
            <div class="nac-claim-sentence-slot">
              <input id="nac-claim-predicate" list="nac-predicates" class="nac-form-input" placeholder="is, funds, causes…" aria-label="Predicate verb">
              <datalist id="nac-predicates">
                <option value="is">
                <option value="causes">
                <option value="funds">
                <option value="prevents">
                <option value="supports">
                <option value="opposes">
                <option value="characterizes">
                <option value="employs">
                <option value="produces">
                <option value="regulates">
              </datalist>
              <span class="nac-claim-sentence-label">verb</span>
            </div>
            <div class="nac-claim-sentence-slot">
              <input type="text" id="nac-claim-object" list="nac-claim-object-list" placeholder="Entity or text…" class="nac-form-input" aria-label="Object">
              <datalist id="nac-claim-object-list">
                ${entityDatalistOptions}
              </datalist>
              <span class="nac-claim-sentence-label">object</span>
            </div>
          </div>
        </div>

        <div class="nac-claim-form-actions">
          <button class="nac-btn nac-btn-primary" id="nac-claim-save" aria-label="Save claim">Save Claim</button>
          <button class="nac-btn" id="nac-claim-cancel" aria-label="Cancel">Cancel</button>
        </div>
      </div>
    `;

    // --- Auto-populate subject/object from entity matches ---
    if (autoSubject) {
      const subjectEl = popover.querySelector('#nac-claim-subject');
      if (subjectEl) subjectEl.value = autoSubject;
    }
    if (autoObject) {
      const objectEl = popover.querySelector('#nac-claim-object');
      if (objectEl) objectEl.value = autoObject;
    }

    // --- Section toggle handlers ---
    popover.querySelectorAll('.nac-claim-section-header').forEach(header => {
      const toggle = () => {
        const section = header.dataset.section;
        const bodyId = section === 'attribution' ? 'nac-claim-attribution-section' : 'nac-claim-structure-section';
        const body = popover.querySelector('#' + bodyId);
        const arrow = header.querySelector('.nac-claim-section-arrow');
        if (!body) return;
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? '' : 'none';
        arrow.textContent = isHidden ? '▾' : '▸';
        header.setAttribute('aria-expanded', String(isHidden));
      };
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });

    // --- Toggle confidence slider visibility when crux is checked ---
    popover.querySelector('#nac-claim-crux').addEventListener('change', (e) => {
      const confField = popover.querySelector('#nac-claim-confidence-field');
      if (confField) confField.style.display = e.target.checked ? '' : 'none';
    });

    // --- Update confidence label as slider moves ---
    const confRange = popover.querySelector('#nac-claim-confidence');
    const confLabel = popover.querySelector('#nac-claim-confidence-value');
    if (confRange && confLabel) {
      confRange.addEventListener('input', () => { confLabel.textContent = confRange.value; });
    }

    // --- Conditional quote date visibility ---
    const attrSelect = popover.querySelector('#nac-claim-attribution');
    const quoteDateField = popover.querySelector('#nac-claim-quote-date-field');
    if (attrSelect && quoteDateField) {
      const updateQuoteDateVisibility = () => {
        const val = attrSelect.value;
        quoteDateField.style.display = (val === 'direct_quote' || val === 'paraphrase') ? '' : 'none';
      };
      attrSelect.addEventListener('change', updateQuoteDateVisibility);
      updateQuoteDateVisibility();
    }

    // --- Save handler ---
    popover.querySelector('#nac-claim-save').addEventListener('click', async () => {
      const type = document.getElementById('nac-claim-type').value;
      const isCrux = document.getElementById('nac-claim-crux').checked;
      const confidence = isCrux ? parseInt(document.getElementById('nac-claim-confidence')?.value) : null;
      const attribution = document.getElementById('nac-claim-attribution')?.value || 'editorial';
      const claimantId = document.getElementById('nac-claim-claimant')?.value || null;
      const quoteDate = document.getElementById('nac-claim-quote-date')?.value || null;
      const predicate = document.getElementById('nac-claim-predicate')?.value || null;

      // Resolve subject: entity match or freetext
      const subjectInput = document.getElementById('nac-claim-subject')?.value?.trim() || '';
      let subjectEntityIds = [];
      let subjectText = null;
      if (subjectInput) {
        const matchedSubject = entityOptions.find(e =>
          subjectInput === `${e.emoji} ${e.name}` || subjectInput === e.name || subjectInput.includes(e.name)
        );
        if (matchedSubject) {
          subjectEntityIds = [matchedSubject.id];
        } else {
          subjectText = subjectInput;
        }
      }

      // Resolve object: entity match or freetext
      const objectInput = document.getElementById('nac-claim-object')?.value?.trim() || '';
      let objectEntityIds = [];
      let objectText = null;
      if (objectInput) {
        const matchedObject = entityOptions.find(e =>
          objectInput === `${e.emoji} ${e.name}` || objectInput === e.name || objectInput.includes(e.name)
        );
        if (matchedObject) {
          objectEntityIds = [matchedObject.id];
        } else {
          objectText = objectInput;
        }
      }

      await ClaimExtractor.saveClaim(text, type, isCrux, confidence, attribution, claimantId, subjectEntityIds, objectEntityIds, predicate, quoteDate, subjectText, objectText);
      EntityTagger.hide();
    });

    popover.querySelector('#nac-claim-cancel').addEventListener('click', () => {
      EntityTagger.hide();
    });
  },

  // Save a claim for the current article
  saveClaim: async (text, type, isCrux, confidence = null, attribution = 'editorial', claimantEntityId = null, subjectEntityIds = [], objectEntityIds = [], predicate = null, quoteDate = null, subjectText = null, objectText = null) => {
    if (!ReaderView.article) return;

    const claimId = 'claim_' + await Crypto.sha256(ReaderView.article.url + text);

    // Get surrounding paragraph for context
    let context = '';
    try {
      const contentEl = document.getElementById('nac-content');
      if (contentEl) {
        const paragraphs = contentEl.querySelectorAll('p');
        for (const p of paragraphs) {
          if (p.textContent.includes(text.substring(0, 40))) {
            context = p.textContent.substring(0, 300);
            break;
          }
        }
      }
    } catch (e) {
      // Context extraction is optional
    }

    const identity = await Storage.identity.get();

    const claim = {
      id: claimId,
      text: text,
      type: type,
      is_crux: isCrux,
      confidence: confidence,
      claimant_entity_id: claimantEntityId || null,
      subject_entity_ids: Array.isArray(subjectEntityIds) ? subjectEntityIds : [],
      object_entity_ids: Array.isArray(objectEntityIds) ? objectEntityIds : [],
      subject_text: subjectText || null,
      object_text: objectText || null,
      predicate: predicate || null,
      quote_date: quoteDate || null,
      attribution: attribution || 'editorial',
      source_url: ReaderView.article.url,
      source_title: ReaderView.article.title || 'Untitled',
      context: context,
      created_at: Date.now(),
      created_by: identity?.pubkey || 'local'
    };

    await Storage.claims.save(claim);

    // Add to in-memory claims list
    if (!ReaderView.claims.find(c => c.id === claimId)) {
      ReaderView.claims.push(claim);
    } else {
      // Update existing
      const idx = ReaderView.claims.findIndex(c => c.id === claimId);
      ReaderView.claims[idx] = claim;
    }

    ClaimExtractor.refreshClaimsBar();
    Utils.showToast(`Claim saved: ${text.substring(0, 50)}…`, 'success');
  },

  // Remove a claim
  removeClaim: async (claimId) => {
    await Storage.claims.delete(claimId);
    ReaderView.claims = ReaderView.claims.filter(c => c.id !== claimId);
    ClaimExtractor.refreshClaimsBar();
    Utils.showToast('Claim removed', 'info');
  },

  // Toggle crux status for a claim
  toggleCrux: async (claimId) => {
    const claim = ReaderView.claims.find(c => c.id === claimId);
    if (!claim) return;
    claim.is_crux = !claim.is_crux;
    if (!claim.is_crux) claim.confidence = null;
    await Storage.claims.save(claim);
    ClaimExtractor.refreshClaimsBar();
    Utils.showToast(claim.is_crux ? 'Marked as crux claim' : 'Unmarked as crux claim', 'info');
  },

  // Update confidence for a crux claim (no UI refresh — slider already shows new value)
  updateConfidence: async (claimId, value) => {
    const claim = ReaderView.claims.find(c => c.id === claimId);
    if (!claim) return;
    claim.confidence = value;
    await Storage.claims.save(claim);
  },

  // Edit claim text inline
  editClaimText: async (claimId, newText) => {
    const claim = ReaderView.claims.find(c => c.id === claimId);
    if (!claim || !newText.trim()) return;
    claim.text = newText.trim();
    await Storage.claims.save(claim);
    ClaimExtractor.refreshClaimsBar();
    Utils.showToast('Claim text updated', 'info');
  },

  // Refresh the claims bar UI
  refreshClaimsBar: async () => {
    const bar = document.getElementById('nac-claims-bar');
    if (!bar) return;

    const claims = ReaderView.claims || [];
    const countEl = bar.querySelector('.nac-claims-count');
    if (countEl) countEl.textContent = claims.length;

    const chipsEl = bar.querySelector('.nac-claims-chips');
    if (!chipsEl) return;

    // Update toolbar badge
    const toolbarBadge = document.getElementById('nac-claims-badge');
    if (toolbarBadge) {
      toolbarBadge.textContent = claims.length;
      toolbarBadge.style.display = claims.length > 0 ? 'inline-flex' : 'none';
    }

    if (claims.length === 0) {
      chipsEl.innerHTML = '<div class="nac-claims-empty">No claims extracted yet. Select text and click 📋 Claim.</div>';
      return;
    }

    const typeColors = {
      factual: 'nac-claim-type-factual',
      causal: 'nac-claim-type-causal',
      evaluative: 'nac-claim-type-evaluative',
      predictive: 'nac-claim-type-predictive'
    };

    const typeLabels = {
      factual: 'Factual',
      causal: 'Causal',
      evaluative: 'Evaluative',
      predictive: 'Predictive'
    };

    const attributionLabels = {
      direct_quote: 'Quote',
      paraphrase: 'Paraphrase',
      thesis: 'Thesis'
    };

    // Pre-load entity names for claimant display
    const entityNameCache = {};
    const entityTypeCache = {};
    for (const claim of claims) {
      const idsToLoad = [...(claim.subject_entity_ids || []), ...(claim.object_entity_ids || [])];
      if (claim.claimant_entity_id) idsToLoad.push(claim.claimant_entity_id);
      for (const eid of idsToLoad) {
        if (!entityNameCache[eid]) {
          try {
            const entity = await Storage.entities.get(eid);
            if (entity) {
              entityNameCache[eid] = entity.name;
              entityTypeCache[eid] = entity.type;
            }
          } catch (e) { /* skip */ }
        }
      }
    }

    // Sort crux claims to top
    const sorted = [...claims].sort((a, b) => (b.is_crux ? 1 : 0) - (a.is_crux ? 1 : 0));

    chipsEl.innerHTML = sorted.map(claim => {
      const cruxIcon = claim.is_crux ? '<span class="nac-claim-crux-icon" title="Key claim (crux)">🔑</span> ' : '';
      const confDisplay = (claim.is_crux && claim.confidence != null) ? `<span class="nac-claim-confidence-display">${claim.confidence}%</span> ` : '';
      const truncatedText = claim.text.length > 80
        ? Utils.escapeHtml(claim.text.substring(0, 80)) + '…'
        : Utils.escapeHtml(claim.text);
      const typeClass = typeColors[claim.type] || 'nac-claim-type-factual';
      const typeLabel = typeLabels[claim.type] || 'Factual';

      // Claimant label
      const claimantName = claim.claimant_entity_id && entityNameCache[claim.claimant_entity_id]
        ? ` — <span class="nac-claim-claimant-label" title="Claimed by ${Utils.escapeHtml(entityNameCache[claim.claimant_entity_id])}">${Utils.escapeHtml(entityNameCache[claim.claimant_entity_id])}</span>`
        : '';

      // Subject entity emojis
      const subjectEmojis = (claim.subject_entity_ids || []).map(eid => {
        const t = entityTypeCache[eid];
        return t === 'person' ? '👤' : t === 'organization' ? '🏢' : t === 'place' ? '📍' : t === 'thing' ? '🔷' : '';
      }).filter(Boolean).join('');
      const subjectBadge = subjectEmojis ? `<span class="nac-claim-subject-emojis" title="About entities">${subjectEmojis}</span>` : '';

      // Attribution badge (only show if not editorial)
      const attrLabel = attributionLabels[claim.attribution];
      const attrBadge = attrLabel ? `<span class="nac-claim-attribution-badge">${attrLabel}</span>` : '';

      // Structured triple line (subject → predicate → object)
      // Resolve subject display: entity name or freetext
      let subjectDisplay = '';
      for (const sid of (claim.subject_entity_ids || [])) {
        if (entityNameCache[sid]) {
          const emojiForType = (t) => t === 'person' ? '👤' : t === 'organization' ? '🏢' : t === 'place' ? '📍' : t === 'thing' ? '🔷' : '•';
          const sEmoji = emojiForType(entityTypeCache[sid]);
          subjectDisplay += `${sEmoji} ${entityNameCache[sid]}`;
        }
      }
      if (!subjectDisplay && claim.subject_text) subjectDisplay = claim.subject_text;

      // Resolve object display: entity name or freetext
      let objectDisplay = '';
      for (const oid of (claim.object_entity_ids || [])) {
        if (entityNameCache[oid]) {
          const emojiForType = (t) => t === 'person' ? '👤' : t === 'organization' ? '🏢' : t === 'place' ? '📍' : t === 'thing' ? '🔷' : '•';
          const oEmoji = emojiForType(entityTypeCache[oid]);
          objectDisplay += `${oEmoji} ${entityNameCache[oid]}`;
        }
      }
      if (!objectDisplay && claim.object_text) objectDisplay = claim.object_text;

      const hasStructure = (subjectDisplay || objectDisplay) && claim.predicate;
      let tripleLine = '';
      if (hasStructure) {
        const emojiForType = (t) => t === 'person' ? '👤' : t === 'organization' ? '🏢' : t === 'place' ? '📍' : t === 'thing' ? '🔷' : '•';

        let claimantPart = '';
        if (claim.claimant_entity_id && entityNameCache[claim.claimant_entity_id]) {
          const cEmoji = emojiForType(entityTypeCache[claim.claimant_entity_id]);
          claimantPart = `<span class="nac-claim-triple-claimant">${cEmoji} ${Utils.escapeHtml(entityNameCache[claim.claimant_entity_id])} →</span> `;
        }

        const subjectPart = subjectDisplay ? `<span class="nac-claim-triple-subject">${Utils.escapeHtml(subjectDisplay)}</span> ` : '';
        const predicatePart = `<span class="nac-claim-triple-predicate">${Utils.escapeHtml(claim.predicate)}</span> `;
        const objectPart = objectDisplay ? `<span class="nac-claim-triple-object">${Utils.escapeHtml(objectDisplay)}</span> ` : '';

        let datePart = '';
        if (claim.quote_date) {
          try {
            const d = new Date(claim.quote_date);
            if (!isNaN(d.getTime())) {
              datePart = `<span class="nac-claim-triple-date">• ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
            }
          } catch (e) { /* skip */ }
        }

        tripleLine = `<div class="nac-claim-triple">${claimantPart}${subjectPart}${predicatePart}${objectPart}${datePart}</div>`;
      }

      return `
        <div class="nac-claim-chip${claim.is_crux ? ' nac-claim-crux' : ''}" data-claim-id="${Utils.escapeHtml(claim.id)}" title="Click text to edit · Click 🔑 to toggle crux" tabindex="0" role="button" aria-label="Claim: ${Utils.escapeHtml(claim.text.substring(0, 60))}">
          <span class="nac-claim-text-display" data-claim-id="${Utils.escapeHtml(claim.id)}">${cruxIcon}${confDisplay}${truncatedText}${claimantName}</span>
          <span class="nac-claim-type-badge ${typeClass}">${typeLabel}</span>
          ${attrBadge}${subjectBadge}
          <span class="nac-evidence-link-indicator-slot" data-claim-id="${Utils.escapeHtml(claim.id)}"></span>
          <button class="nac-claim-link-btn" data-claim-id="${Utils.escapeHtml(claim.id)}" aria-label="Link evidence" title="Link evidence to another claim">🔗</button>
          <button class="nac-claim-crux-toggle" data-claim-id="${Utils.escapeHtml(claim.id)}" aria-label="Toggle crux" title="Toggle crux">🔑</button>
          <button class="nac-claim-remove" data-claim-id="${Utils.escapeHtml(claim.id)}" aria-label="Remove claim">✕</button>
          ${tripleLine}
        </div>
        ${claim.is_crux ? `<div class="nac-claim-confidence-row" data-claim-id="${Utils.escapeHtml(claim.id)}">
          <label class="nac-claim-confidence-label">Confidence: <span class="nac-claim-conf-val">${claim.confidence != null ? claim.confidence : 50}%</span></label>
          <input type="range" class="nac-claim-confidence-range" min="0" max="100" value="${claim.confidence != null ? claim.confidence : 50}" data-claim-id="${Utils.escapeHtml(claim.id)}" aria-label="Set confidence for claim">
        </div>` : ''}
      `;
    }).join('');

    // Attach event listeners — crux toggle
    chipsEl.querySelectorAll('.nac-claim-crux-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        ClaimExtractor.toggleCrux(btn.dataset.claimId);
      });
    });

    // Inline text editing — click on text to edit
    chipsEl.querySelectorAll('.nac-claim-text-display').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const claimId = span.dataset.claimId;
        const claim = ReaderView.claims.find(c => c.id === claimId);
        if (!claim) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'nac-claim-text-edit';
        input.value = claim.text;
        input.setAttribute('aria-label', 'Edit claim text');
        span.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => {
          if (input.value.trim() && input.value.trim() !== claim.text) {
            ClaimExtractor.editClaimText(claimId, input.value.trim());
          } else {
            ClaimExtractor.refreshClaimsBar(); // revert
          }
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
          if (ke.key === 'Escape') { input.value = claim.text; input.blur(); }
        });
      });
    });

    // Confidence sliders
    chipsEl.querySelectorAll('.nac-claim-confidence-range').forEach(range => {
      const valEl = range.closest('.nac-claim-confidence-row')?.querySelector('.nac-claim-conf-val');
      range.addEventListener('input', () => {
        if (valEl) valEl.textContent = range.value + '%';
      });
      range.addEventListener('change', () => {
        ClaimExtractor.updateConfidence(range.dataset.claimId, parseInt(range.value, 10));
      });
    });

    chipsEl.querySelectorAll('.nac-claim-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        ClaimExtractor.removeClaim(btn.dataset.claimId);
      });
    });

    // Evidence link buttons
    chipsEl.querySelectorAll('.nac-claim-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        EvidenceLinker.showLinkModal(btn.dataset.claimId);
      });
    });

    // Async load evidence link indicators for each claim
    EvidenceLinker.loadIndicators(chipsEl, claims);
  },

  // Load claims for a URL and initialize the bar
  loadForArticle: async (url) => {
    const claims = await Storage.claims.getForUrl(url);
    ReaderView.claims = claims;
    ClaimExtractor.refreshClaimsBar();
  },

  // Fetch kind 30040 claim events from relays for an article URL
  fetchRemoteClaims: async (articleUrl) => {
    const relayConfig = await Storage.relays.get();
    const enabledRelayUrls = relayConfig.relays.filter(r => r.enabled && r.read).map(r => r.url);

    if (enabledRelayUrls.length === 0) {
      Utils.showToast('No read-enabled relays configured', 'error');
      return [];
    }

    // Fetch kind 30040 events with r tag matching this article URL
    const filter = {
      kinds: [30040],
      '#r': [articleUrl]
    };

    const events = await RelayClient.subscribe(filter, enabledRelayUrls, { timeout: 15000, idleTimeout: 10000 });

    // Deduplicate by event id
    const seen = new Set();
    const unique = [];
    for (const evt of events) {
      if (evt.id && !seen.has(evt.id)) {
        seen.add(evt.id);
        unique.push(evt);
      }
    }

    // Parse events into displayable claims
    return unique.map(event => {
      // Build a tag lookup (first value per tag name)
      const tagMap = {};
      for (const tag of (event.tags || [])) {
        if (tag.length >= 2 && !tagMap[tag[0]]) {
          tagMap[tag[0]] = tag.slice(1);
        }
      }
      return {
        pubkey: event.pubkey,
        text: tagMap['claim-text']?.[0] || event.content || '',
        type: tagMap['claim-type']?.[0] || 'factual',
        is_crux: !!(tagMap['crux']),
        confidence: tagMap['confidence'] ? parseInt(tagMap['confidence'][0]) : null,
        claimant: tagMap['claimant']?.[0] || null,
        attribution: tagMap['attribution']?.[0] || 'editorial',
        subjects: (event.tags || []).filter(t => t[0] === 'subject').map(t => t[1]),
        created_at: event.created_at,
        npub: Crypto.hexToNpub(event.pubkey) || event.pubkey.substring(0, 16) + '…'
      };
    });
  },

  // Show remote claims panel (with caching)
  showRemoteClaims: async () => {
    const section = document.getElementById('nac-remote-claims-section');

    // If already visible, toggle off
    if (section && section.style.display !== 'none') {
      section.style.display = 'none';
      return;
    }

    // If we have a cached result, re-render from cache
    if (ReaderView._remoteClaimsCache !== null) {
      ClaimExtractor.renderRemoteClaims(ReaderView._remoteClaimsCache);
      return;
    }

    // Show loading state
    ClaimExtractor.renderRemoteClaimsLoading();

    try {
      const articleUrl = ReaderView.article?.url;
      if (!articleUrl) {
        Utils.showToast('No article URL available', 'error');
        return;
      }

      const remoteClaims = await ClaimExtractor.fetchRemoteClaims(articleUrl);

      // Filter out current user's own claims
      const identity = await Storage.identity.get();
      const ownPubkey = identity?.pubkey || null;
      const othersClaims = ownPubkey
        ? remoteClaims.filter(c => c.pubkey !== ownPubkey)
        : remoteClaims;

      // Cache the results
      ReaderView._remoteClaimsCache = othersClaims;

      ClaimExtractor.renderRemoteClaims(othersClaims);
    } catch (e) {
      console.error('[NAC] Failed to fetch remote claims:', e);
      ClaimExtractor.renderRemoteClaimsError('Could not reach relays');
    }
  },

  // Render loading spinner for remote claims
  renderRemoteClaimsLoading: () => {
    let section = document.getElementById('nac-remote-claims-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'nac-remote-claims-section';
      section.className = 'nac-remote-claims-section';
      section.setAttribute('role', 'region');
      section.setAttribute('aria-label', 'Other users\' claims');
      const claimsBar = document.getElementById('nac-claims-bar');
      if (claimsBar) claimsBar.appendChild(section);
    }
    section.style.display = '';
    section.innerHTML = `
      <div class="nac-remote-claims-header">
        <span class="nac-remote-claims-title">🌐 Others' Claims</span>
        <button class="nac-remote-claims-close" id="nac-remote-claims-close" aria-label="Close others' claims">✕</button>
      </div>
      <div class="nac-remote-claims-loading" aria-label="Loading remote claims">
        <div class="nac-spinner"></div> Fetching claims from relays…
      </div>
    `;
    section.querySelector('#nac-remote-claims-close')?.addEventListener('click', () => {
      section.style.display = 'none';
    });
  },

  // Render error state for remote claims
  renderRemoteClaimsError: (message) => {
    let section = document.getElementById('nac-remote-claims-section');
    if (!section) return;
    section.style.display = '';
    section.innerHTML = `
      <div class="nac-remote-claims-header">
        <span class="nac-remote-claims-title">🌐 Others' Claims</span>
        <button class="nac-remote-claims-close" id="nac-remote-claims-close" aria-label="Close others' claims">✕</button>
      </div>
      <div class="nac-remote-claims-empty">${Utils.escapeHtml(message)}</div>
    `;
    section.querySelector('#nac-remote-claims-close')?.addEventListener('click', () => {
      section.style.display = 'none';
    });
  },

  // Render fetched remote claims grouped by publisher npub
  renderRemoteClaims: (claims) => {
    let section = document.getElementById('nac-remote-claims-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'nac-remote-claims-section';
      section.className = 'nac-remote-claims-section';
      section.setAttribute('role', 'region');
      section.setAttribute('aria-label', 'Other users\' claims');
      const claimsBar = document.getElementById('nac-claims-bar');
      if (claimsBar) claimsBar.appendChild(section);
    }
    section.style.display = '';

    if (!claims || claims.length === 0) {
      section.innerHTML = `
        <div class="nac-remote-claims-header">
          <span class="nac-remote-claims-title">🌐 Others' Claims</span>
          <button class="nac-remote-claims-close" id="nac-remote-claims-close" aria-label="Close others' claims">✕</button>
        </div>
        <div class="nac-remote-claims-empty">No other users have extracted claims from this article yet</div>
      `;
      section.querySelector('#nac-remote-claims-close')?.addEventListener('click', () => {
        section.style.display = 'none';
      });
      return;
    }

    // Group by pubkey
    const groups = {};
    for (const claim of claims) {
      if (!groups[claim.pubkey]) {
        groups[claim.pubkey] = { npub: claim.npub, claims: [] };
      }
      groups[claim.pubkey].claims.push(claim);
    }

    const userCount = Object.keys(groups).length;
    const typeLabels = { factual: 'Factual', causal: 'Causal', evaluative: 'Evaluative', predictive: 'Predictive' };
    const typeColors = { factual: 'nac-claim-type-factual', causal: 'nac-claim-type-causal', evaluative: 'nac-claim-type-evaluative', predictive: 'nac-claim-type-predictive' };

    let groupsHtml = '';
    for (const [pubkey, group] of Object.entries(groups)) {
      const truncNpub = group.npub.length > 20 ? group.npub.substring(0, 20) + '…' : group.npub;

      const claimsHtml = group.claims.map(claim => {
        const cruxIcon = claim.is_crux ? '<span class="nac-claim-crux-icon" title="Key claim (crux)">🔑</span> ' : '';
        const confDisplay = (claim.is_crux && claim.confidence != null) ? `<span class="nac-claim-confidence-display">${claim.confidence}%</span> ` : '';
        const truncatedText = claim.text.length > 100
          ? Utils.escapeHtml(claim.text.substring(0, 100)) + '…'
          : Utils.escapeHtml(claim.text);
        const typeClass = typeColors[claim.type] || 'nac-claim-type-factual';
        const typeLabel = typeLabels[claim.type] || 'Factual';
        const claimantLabel = claim.claimant
          ? ` — <span class="nac-claim-claimant-label">${Utils.escapeHtml(claim.claimant)}</span>`
          : '';

        return `<div class="nac-remote-claim-chip${claim.is_crux ? ' nac-claim-crux' : ''}" aria-label="Claim: ${Utils.escapeHtml(claim.text.substring(0, 60))}">
          <span class="nac-remote-claim-text">${cruxIcon}${confDisplay}"${truncatedText}"${claimantLabel}</span>
          <span class="nac-claim-type-badge ${typeClass}">${typeLabel}</span>
        </div>`;
      }).join('');

      groupsHtml += `
        <div class="nac-remote-claims-group">
          <div class="nac-remote-npub" title="${Utils.escapeHtml(group.npub)}" aria-label="Publisher ${Utils.escapeHtml(truncNpub)}">
            ${Utils.escapeHtml(truncNpub)} (${group.claims.length} claim${group.claims.length !== 1 ? 's' : ''})
          </div>
          ${claimsHtml}
        </div>
      `;
    }

    section.innerHTML = `
      <div class="nac-remote-claims-header">
        <span class="nac-remote-claims-title">🌐 Others' Claims (${claims.length} from ${userCount} user${userCount !== 1 ? 's' : ''})</span>
        <button class="nac-remote-claims-close" id="nac-remote-claims-close" aria-label="Close others' claims">✕</button>
      </div>
      ${groupsHtml}
    `;

    section.querySelector('#nac-remote-claims-close')?.addEventListener('click', () => {
      section.style.display = 'none';
    });
  }
};
