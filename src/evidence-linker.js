import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { Crypto } from './crypto.js';
import { ClaimExtractor } from './claim-extractor.js';
import { ReaderView } from './reader-view.js';

export const EvidenceLinker = {
  // Load evidence link indicators for all rendered claim chips
  loadIndicators: async (chipsEl, claims) => {
    for (const claim of claims) {
      try {
        const links = await Storage.evidenceLinks.getForClaim(claim.id);
        const slot = chipsEl.querySelector(`.nac-evidence-link-indicator-slot[data-claim-id="${claim.id}"]`);
        if (!slot || links.length === 0) continue;

        const indicator = document.createElement('span');
        indicator.className = 'nac-evidence-link-indicator';
        indicator.setAttribute('tabindex', '0');
        indicator.setAttribute('role', 'button');
        indicator.setAttribute('aria-label', `${links.length} evidence link${links.length !== 1 ? 's' : ''}`);
        indicator.textContent = `🔗 ${links.length}`;
        indicator.dataset.claimId = claim.id;
        slot.replaceWith(indicator);

        indicator.addEventListener('click', (e) => {
          e.stopPropagation();
          EvidenceLinker.showLinksTooltip(claim.id, indicator);
        });
      } catch (e) {
        // Indicator loading is optional
      }
    }
  },

  // Show tooltip with linked claims
  showLinksTooltip: async (claimId, anchorEl) => {
    // Remove any existing tooltip
    document.querySelectorAll('.nac-evidence-tooltip').forEach(t => t.remove());

    const links = await Storage.evidenceLinks.getForClaim(claimId);
    if (links.length === 0) return;

    const allClaims = await Storage.claims.getAll();

    const tooltip = document.createElement('div');
    tooltip.className = 'nac-evidence-tooltip';
    tooltip.setAttribute('role', 'tooltip');

    const relIcons = { supports: '🟢', contradicts: '🔴', contextualizes: '🔵' };
    const relClasses = { supports: 'nac-evidence-rel-supports', contradicts: 'nac-evidence-rel-contradicts', contextualizes: 'nac-evidence-rel-contextualizes' };

    let html = '<div class="nac-evidence-tooltip-title">🔗 Linked Evidence:</div>';
    for (const link of links) {
      const otherId = link.source_claim_id === claimId ? link.target_claim_id : link.source_claim_id;
      const otherClaim = allClaims[otherId];
      const relIcon = relIcons[link.relationship] || '🔗';
      const relClass = relClasses[link.relationship] || '';
      const otherText = otherClaim
        ? Utils.escapeHtml(otherClaim.text.substring(0, 60)) + (otherClaim.text.length > 60 ? '…' : '')
        : '(deleted claim)';
      const source = otherClaim ? Utils.escapeHtml(new URL(otherClaim.source_url).hostname) : '';

      html += `<div class="nac-evidence-tooltip-item">
        <span class="${relClass}">${relIcon} ${Utils.escapeHtml(link.relationship)}:</span>
        <span>"${otherText}"${source ? ' (' + source + ')' : ''}</span>
        <button class="nac-evidence-delete-btn" data-link-id="${Utils.escapeHtml(link.id)}" aria-label="Delete evidence link" title="Delete link">✕</button>
      </div>`;
    }
    tooltip.innerHTML = html;

    // Position near anchor
    const rect = anchorEl.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = Math.min(rect.left, window.innerWidth - 420) + 'px';
    tooltip.style.top = (rect.bottom + 4) + 'px';
    document.body.appendChild(tooltip);

    // Delete link handlers
    tooltip.querySelectorAll('.nac-evidence-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await Storage.evidenceLinks.delete(btn.dataset.linkId);
        tooltip.remove();
        ClaimExtractor.refreshClaimsBar();
        Utils.showToast('Evidence link removed', 'info');
      });
    });

    // Close on click outside
    const closeHandler = (e) => {
      if (!tooltip.contains(e.target) && e.target !== anchorEl) {
        tooltip.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  },

  // Show modal to create an evidence link
  showLinkModal: async (sourceClaimId) => {
    const sourceClaim = (ReaderView.claims || []).find(c => c.id === sourceClaimId);
    if (!sourceClaim) return;

    // Get all claims from other articles
    const allClaims = await Storage.claims.getAll();
    const currentUrl = ReaderView.article?.url || '';
    const otherClaims = Object.values(allClaims).filter(c => c.source_url !== currentUrl);

    if (otherClaims.length === 0) {
      Utils.showToast('No other article claims to link to', 'info');
      return;
    }

    // Group by source_url
    const groups = {};
    for (const c of otherClaims) {
      if (!groups[c.source_url]) {
        groups[c.source_url] = { title: c.source_title || 'Untitled', url: c.source_url, claims: [] };
      }
      groups[c.source_url].claims.push(c);
    }

    // Remove any existing modal
    document.querySelectorAll('.nac-evidence-modal').forEach(m => m.remove());

    const modal = document.createElement('div');
    modal.className = 'nac-evidence-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Link evidence between claims');

    const sourceText = sourceClaim.text.length > 100
      ? Utils.escapeHtml(sourceClaim.text.substring(0, 100)) + '…'
      : Utils.escapeHtml(sourceClaim.text);

    let groupsHtml = '';
    for (const [url, group] of Object.entries(groups)) {
      const hostname = Utils.escapeHtml(new URL(url).hostname);
      groupsHtml += `<div class="nac-evidence-article-group">
        <div class="nac-evidence-article-title">📄 "${Utils.escapeHtml(group.title)}" (${hostname})</div>`;
      for (const c of group.claims) {
        const cText = c.text.length > 80
          ? Utils.escapeHtml(c.text.substring(0, 80)) + '…'
          : Utils.escapeHtml(c.text);
        groupsHtml += `<label class="nac-evidence-claim-option">
          <input type="radio" name="nac-evidence-target" value="${Utils.escapeHtml(c.id)}">
          <span>"${cText}"</span>
        </label>`;
      }
      groupsHtml += '</div>';
    }

    modal.innerHTML = `
      <div class="nac-evidence-modal-content">
        <div class="nac-evidence-modal-header">
          <h3>Link Evidence</h3>
          <button class="nac-btn-close" id="nac-evidence-modal-close" aria-label="Close evidence link modal">×</button>
        </div>
        <div class="nac-evidence-modal-body">
          <div class="nac-evidence-source">
            <strong>Current claim:</strong> "${sourceText}"
          </div>
          <div class="nac-evidence-target-label">Select a claim to link to:</div>
          <div class="nac-evidence-target-list">${groupsHtml}</div>
          <div class="nac-evidence-options">
            <div class="nac-form-group">
              <label for="nac-evidence-relationship">Relationship:</label>
              <select id="nac-evidence-relationship" class="nac-form-select" aria-label="Evidence relationship type">
                <option value="supports">Supports</option>
                <option value="contradicts">Contradicts</option>
                <option value="contextualizes">Contextualizes</option>
              </select>
            </div>
            <div class="nac-form-group">
              <label for="nac-evidence-note">Note (optional):</label>
              <input type="text" id="nac-evidence-note" class="nac-form-input" placeholder="Optional explanation…" aria-label="Evidence link note">
            </div>
          </div>
        </div>
        <div class="nac-evidence-modal-footer">
          <button class="nac-btn nac-btn-primary" id="nac-evidence-create" aria-label="Create evidence link">Create Link</button>
          <button class="nac-btn" id="nac-evidence-cancel" aria-label="Cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Focus the modal
    modal.querySelector('.nac-evidence-modal-content').focus();

    // Close handlers
    const closeModal = () => modal.remove();

    modal.querySelector('#nac-evidence-modal-close').addEventListener('click', closeModal);
    modal.querySelector('#nac-evidence-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Create link handler
    modal.querySelector('#nac-evidence-create').addEventListener('click', async () => {
      const selectedRadio = modal.querySelector('input[name="nac-evidence-target"]:checked');
      if (!selectedRadio) {
        Utils.showToast('Please select a target claim', 'error');
        return;
      }

      const targetClaimId = selectedRadio.value;
      const relationship = modal.querySelector('#nac-evidence-relationship').value;
      const note = modal.querySelector('#nac-evidence-note').value.trim();

      const linkId = 'link_' + await Crypto.sha256(sourceClaimId + targetClaimId + relationship);

      const identity = await Storage.identity.get();

      const link = {
        id: linkId,
        source_claim_id: sourceClaimId,
        target_claim_id: targetClaimId,
        relationship: relationship,
        note: note,
        created_at: Date.now(),
        created_by: identity?.pubkey || 'local'
      };

      await Storage.evidenceLinks.save(link);
      closeModal();
      ClaimExtractor.refreshClaimsBar();
      Utils.showToast(`Evidence link created: ${relationship}`, 'success');
    });
  }
};
