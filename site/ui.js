// Sanctum & Shadow — interaction, accessibility, and preference controller.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SanctumUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const STORAGE_KEY = 'ss_ui_preferences_v1';
  const DEFAULTS = Object.freeze({ reduceMotion:false, largeText:false, highContrast:false });
  let busy = false;
  let previousFocus = null;

  function normalizePreferences(value = {}) {
    return {
      reduceMotion:!!value.reduceMotion,
      largeText:!!value.largeText,
      highContrast:!!value.highContrast,
    };
  }

  function loadPreferences() {
    if (!root?.localStorage) return { ...DEFAULTS };
    try { return normalizePreferences(JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '{}')); }
    catch { return { ...DEFAULTS }; }
  }

  function applyPreferences(preferences = loadPreferences()) {
    if (!root?.document) return normalizePreferences(preferences);
    const prefs = normalizePreferences(preferences);
    root.document.body.classList.toggle('ui-reduce-motion', prefs.reduceMotion);
    root.document.body.classList.toggle('ui-large-text', prefs.largeText);
    root.document.body.classList.toggle('ui-high-contrast', prefs.highContrast);
    return prefs;
  }

  function savePreferences(preferences) {
    const prefs = applyPreferences(preferences);
    try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
    return prefs;
  }

  function setActionBusy(next, message = '') {
    busy = !!next;
    if (!root?.document) return;
    const input = root.document.getElementById('action-input');
    const button = root.document.getElementById('action-submit-btn');
    const area = root.document.querySelector('.action-area');
    const status = root.document.getElementById('action-status');
    if (input) input.disabled = busy;
    if (button) {
      button.disabled = busy;
      button.textContent = busy ? '⏳ RESOLVING' : '⚔ ACT';
    }
    if (area) area.setAttribute('aria-busy', String(busy));
    if (status) status.textContent = message || (busy ? 'Resolving your action…' : 'Ready. Enter acts; Shift+Enter adds a new line.');
  }

  function installActionGuard() {
    if (!root?.submitAction || root.submitAction._uiGuarded) return false;
    const original = root.submitAction;
    const guarded = async function (...args) {
      if (busy) {
        root.toast?.('Your previous action is still resolving.', 'info');
        return { pending:true };
      }
      const input = root.document?.getElementById('action-input');
      if (!String(input?.value || '').trim()) return;
      setActionBusy(true);
      const started = Date.now();
      try { return await original.apply(this, args); }
      finally {
        const remaining = Math.max(0, 350 - (Date.now() - started));
        root.setTimeout(() => setActionBusy(false), remaining);
      }
    };
    guarded._uiGuarded = true;
    guarded._original = original;
    root.submitAction = guarded;
    return true;
  }

  function openManagedOverlay(id) {
    const overlay = root.document?.getElementById(id);
    if (!overlay) return false;
    previousFocus = root.document.activeElement;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('role', overlay.getAttribute('role') || 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (!overlay._focusTrapInstalled) {
      overlay._focusTrapInstalled = true;
      overlay.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const items = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter(element => element.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && root.document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && root.document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
    }
    const focusable = overlay.querySelector('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
    root.setTimeout(() => focusable?.focus(), 0);
    return true;
  }

  function closeManagedOverlay(id) {
    const overlay = root.document?.getElementById(id);
    if (!overlay) return false;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
    return true;
  }

  function openAccessibilityPanel() {
    root.document?.getElementById('accessibility-panel')?.remove();
    const prefs = loadPreferences();
    const panel = root.document.createElement('div');
    panel.id = 'accessibility-panel';
    panel.className = 'accessibility-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'accessibility-title');
    panel.innerHTML = `<div class="accessibility-backdrop" data-close-accessibility></div>
      <div class="accessibility-card">
        <h2 id="accessibility-title">⚙ Display & Accessibility</h2>
        <label><input type="checkbox" data-pref="largeText" ${prefs.largeText?'checked':''}> Larger interface text</label>
        <label><input type="checkbox" data-pref="highContrast" ${prefs.highContrast?'checked':''}> Higher contrast panels</label>
        <label><input type="checkbox" data-pref="reduceMotion" ${prefs.reduceMotion?'checked':''}> Reduce animation and motion</label>
        <p>These settings are saved on this device.</p>
        <button class="btn-primary" data-close-accessibility>Done</button>
      </div>`;
    root.document.body.appendChild(panel);
    previousFocus = root.document.activeElement;
    panel.querySelectorAll('[data-pref]').forEach(input => input.addEventListener('change', () => {
      const updated = loadPreferences();
      updated[input.dataset.pref] = input.checked;
      savePreferences(updated);
    }));
    const close = () => {
      panel.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      previousFocus = null;
    };
    panel.querySelectorAll('[data-close-accessibility]').forEach(element => element.addEventListener('click', close));
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    panel.querySelector('input')?.focus();
  }

  function init() {
    if (!root?.document) return;
    const systemReduced = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const stored = loadPreferences();
    if (systemReduced && !root.localStorage?.getItem(STORAGE_KEY)) stored.reduceMotion = true;
    applyPreferences(stored);
    // dialogue.js installs its final submitAction wrapper after startup.
    root.setTimeout(installActionGuard, 1400);
    root.setTimeout(installActionGuard, 2200);
  }

  if (root?.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init, { once:true });
    else init();
  }

  return {
    DEFAULTS, normalizePreferences, loadPreferences, savePreferences, applyPreferences,
    setActionBusy, isActionBusy:() => busy, installActionGuard,
    openManagedOverlay, closeManagedOverlay, openAccessibilityPanel,
  };
});
