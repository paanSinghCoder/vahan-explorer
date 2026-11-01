// ==UserScript==
// @name         Vahan report view – remember filters
// @namespace    parivahan-tools
// @version      1.0.0
// @description  Saves the filters on the Vahan4 report view and re-applies them every time the page opens.
// @match        https://vahan.parivahan.gov.in/vahan4dashboard/vahan/view/reportview.xhtml*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// The page itself keeps filters only in the server-side JSF session, so every
// fresh visit starts from the defaults. This script stores a snapshot in
// localStorage and replays it through the page's own PrimeFaces widgets, so
// the server sees the same AJAX calls as if the filters were picked by hand.

(function () {
  'use strict';

  const STORAGE_KEY = 'vahanReportFilters.v1';

  // Top-bar dropdowns, in the order they must be set: each change re-renders
  // the ones after it (state -> RTO list -> Y axis -> X axis -> year type -> year).
  const DROPDOWNS = [
    { key: 'unit', label: 'Type', find: () => selectWithOption(/^In Thousand$/) },
    { key: 'state', label: 'State', find: () => selectWithOption(/^All Vahan4 Running States/) },
    { key: 'rto', label: 'RTO', find: () => document.getElementById('selectedRto_input') },
    { key: 'yAxis', label: 'Y-Axis', find: () => document.getElementById('yaxisVar_input') },
    { key: 'xAxis', label: 'X-Axis', find: () => document.getElementById('xaxisVar_input') },
    { key: 'yearType', label: 'Year Type', find: () => document.getElementById('selectedYearType_input') },
    { key: 'year', label: 'Year', find: () => document.getElementById('selectedYear_input') },
  ];

  // Dropdown in the table header (shown for Vehicle Category Group); only exists after the
  // main refresh, and changing it re-renders the side-panel checkboxes.
  const TABLE_DROPDOWNS = [
    { key: 'tableGroup', label: 'Table group', find: () => document.getElementById('vchgroupTable:selectCatgGrp_input') },
  ];

  const GROUP_NAMES = { VhCatg: 'Vehicle Category', norms: 'Norms', fuel: 'Fuel', VhClass: 'Vehicle Class' };

  // ---------- page helpers ----------

  function selectWithOption(pattern) {
    return [...document.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => pattern.test(o.text.trim()))
    );
  }

  // A SelectOneMenu's hidden <select> is "<id>_input"; find the widget whose id is <id>.
  function widgetFor(select) {
    const id = select.id.replace(/_input$/, '');
    return Object.values(window.PrimeFaces.widgets).find((w) => w && w.id === id);
  }

  // Top "Refresh": the only button that re-renders the side-panel checkboxes too.
  function mainRefreshButton() {
    return [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('onclick') || '').includes('VhCatg')
    );
  }

  // "Refresh" in the left filter panel: re-renders only the table.
  function filterRefreshButton() {
    return document.querySelector('#filterLayout button');
  }

  // Side-panel checkbox groups (Vehicle Category, Norms, Fuel, Vehicle Class), keyed by input name.
  function checkboxGroups() {
    const groups = new Map();
    for (const input of document.querySelectorAll('#filterLayout input[type=checkbox]')) {
      if (!groups.has(input.name)) groups.set(input.name, []);
      groups.get(input.name).push(input);
    }
    return groups;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function isBusy() {
    const queue = window.PrimeFaces && window.PrimeFaces.ajax && window.PrimeFaces.ajax.Queue;
    return (window.jQuery && window.jQuery.active > 0) || (queue && !queue.isEmpty());
  }

  // Resolves once no AJAX request has been in flight for a short, settled moment.
  async function waitIdle(timeoutMs = 60000) {
    const start = Date.now();
    await sleep(150);
    while (Date.now() - start < timeoutMs) {
      if (!isBusy()) {
        await sleep(300);
        if (!isBusy()) return;
      }
      await sleep(200);
    }
    throw new Error('Timed out waiting for the page to finish loading');
  }

  async function waitForWidgets(timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.PrimeFaces && window.PrimeFaces.widgets && window.PrimeFaces.widgets.widget_selectedRto) return;
      await sleep(200);
    }
    throw new Error('PrimeFaces widgets did not load');
  }

  // ---------- storage ----------

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
    } catch (e) {
      return null;
    }
  }

  function store(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- save / apply ----------

  function readCurrent() {
    const dropdowns = {};
    const labels = {};
    for (const d of [...DROPDOWNS, ...TABLE_DROPDOWNS]) {
      const select = d.find();
      if (!select) continue;
      dropdowns[d.key] = select.value;
      labels[d.label] = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text.trim() : '';
    }
    const checkboxes = {};
    for (const [name, inputs] of checkboxGroups()) {
      const checked = inputs.filter((i) => i.checked);
      checkboxes[name] = checked.map((i) => i.value);
      if (checked.length) {
        labels[GROUP_NAMES[name] || name] = checked
          .map((i) => (document.querySelector(`label[for="${CSS.escape(i.id)}"]`) || {}).textContent || i.value)
          .map((t) => t.trim())
          .join(', ');
      }
    }
    return { dropdowns, labels, checkboxes, savedAt: new Date().toISOString() };
  }

  // Sets each saved dropdown value in order, waiting for the AJAX update it triggers.
  async function setDropdowns(list, saved, skipped) {
    for (const d of list) {
      const value = saved.dropdowns[d.key];
      if (value == null) continue;
      // Look the control up again each time: the previous AJAX update may have replaced it.
      const select = d.find();
      if (!select || ![...select.options].some((o) => o.value === value)) {
        skipped.push(d.label);
        continue;
      }
      if (select.value === value) continue;
      widgetFor(select).selectValue(value);
      await waitIdle();
    }
  }

  async function applySaved(saved) {
    const skipped = [];
    await waitForWidgets();
    await waitIdle();

    await setDropdowns(DROPDOWNS, saved, skipped);

    const mainRefresh = mainRefreshButton();
    if (mainRefresh) {
      mainRefresh.click();
      await waitIdle();
    }

    await setDropdowns(TABLE_DROPDOWNS, saved, skipped);

    // The side-panel checkboxes only exist (and are reset) after the refreshes above.
    let changed = false;
    const groups = checkboxGroups();
    for (const [name, values] of Object.entries(saved.checkboxes || {})) {
      const inputs = groups.get(name);
      if (!inputs) {
        skipped.push(name);
        continue;
      }
      for (const input of inputs) {
        if (input.checked !== values.includes(input.value)) {
          input.click();
          changed = true;
        }
      }
    }
    if (changed) {
      filterRefreshButton().click();
      await waitIdle();
    }
    return skipped;
  }

  // ---------- small control panel ----------

  function buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'right:12px', 'bottom:12px', 'z-index:100000',
      'background:#fff', 'border:1px solid #c8ccd4', 'border-radius:8px',
      'box-shadow:0 4px 14px rgba(0,0,0,.15)', 'padding:10px 12px',
      'font:12px/1.4 system-ui,sans-serif', 'color:#1f2328', 'max-width:280px',
    ].join(';');
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px">Saved filters</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" data-act="save">Save current</button>
        <button type="button" data-act="apply">Apply saved</button>
        <button type="button" data-act="clear">Clear</button>
      </div>
      <label style="display:flex;gap:6px;align-items:center;margin-top:8px">
        <input type="checkbox" data-act="auto"> Apply automatically on open
      </label>
      <div data-role="status" style="margin-top:6px;color:#57606a;white-space:pre-line"></div>`;
    for (const b of panel.querySelectorAll('button')) {
      b.style.cssText = 'padding:3px 8px;border:1px solid #c8ccd4;border-radius:5px;background:#f6f8fa;cursor:pointer;font:inherit';
    }
    document.body.appendChild(panel);

    const status = panel.querySelector('[data-role=status]');
    const auto = panel.querySelector('[data-act=auto]');
    const setStatus = (text) => { status.textContent = text; };

    const describe = (saved) =>
      saved
        ? Object.entries(saved.labels || {}).map(([k, v]) => `${k}: ${v}`).join('\n')
        : 'Nothing saved yet. Set filters, click Refresh, then "Save current".';

    const saved = loadSaved();
    auto.checked = !saved || saved.autoApply !== false;
    setStatus(describe(saved));

    let running = false;
    async function runApply(data) {
      if (running) return;
      running = true;
      setStatus('Applying saved filters…');
      try {
        const skipped = await applySaved(data);
        setStatus(describe(data) + (skipped.length ? `\n\nNot available now: ${skipped.join(', ')}` : ''));
      } catch (e) {
        setStatus('Could not apply: ' + e.message);
      } finally {
        running = false;
      }
    }

    panel.addEventListener('click', (e) => {
      const act = e.target.getAttribute('data-act');
      if (act === 'save') {
        const data = readCurrent();
        data.autoApply = auto.checked;
        setStatus(store(data) ? 'Saved.\n' + describe(data) : 'Could not save (browser storage blocked).');
      } else if (act === 'apply') {
        const data = loadSaved();
        if (data) runApply(data);
        else setStatus(describe(null));
      } else if (act === 'clear') {
        localStorage.removeItem(STORAGE_KEY);
        setStatus(describe(null));
      }
    });

    auto.addEventListener('change', () => {
      const data = loadSaved();
      if (data) {
        data.autoApply = auto.checked;
        store(data);
      }
    });

    if (saved && saved.autoApply !== false) runApply(saved);
  }

  buildPanel();
})();
