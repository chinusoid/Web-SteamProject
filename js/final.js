/* Final-project features: light/dark theme toggle, shared footer links and the GamerPower API page. */
(() => {
  'use strict';
  const root = document.documentElement;
  // theme-init.js already applied the saved theme before paint; this keeps every toggle
  // button's icon, label and aria-pressed state in sync with the current theme.
  function updateThemeControls() {
    const light = root.dataset.bsTheme === 'light';
    document.body.style.background = '';
    document.dispatchEvent(new CustomEvent('hub:theme-change'));
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(light));
      button.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
      button.querySelector('[data-theme-label]').textContent = light ? 'Dark' : 'Light';
      button.firstElementChild.textContent = light ? '☾' : '☀';
    });
  }
  updateThemeControls();
  document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
    root.dataset.bsTheme = root.dataset.bsTheme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('hub-theme', root.dataset.bsTheme); } catch {}
    updateThemeControls();
  }));
  // The storage event fires in other open tabs, so switching the theme updates them too.
  window.addEventListener('storage', event => {
    if (event.key === 'hub-theme') { root.dataset.bsTheme = event.newValue === 'light' ? 'light' : 'dark'; updateThemeControls(); }
  });
  // All pages expose the discovery and account destinations, including footer navigation.
  const footer = document.querySelector('.footer-bottom');
  if (footer) {
    const links = document.createElement('span'); links.className = 'final-footer-links';
    for (const [label, href] of [['Live giveaways','giveaways.html'],['My profile','profile.html'],['Create account','community.html#join-community']]) {
      const link = document.createElement('a'); link.href = href; link.textContent = label; links.append(link);
    }
    footer.prepend(links);
  }
  document.querySelectorAll('[data-topic-toggle]').forEach(button => button.addEventListener('click', () => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded',String(open));
    panel.hidden = !open;
  }));
  const host = document.querySelector('[data-giveaways]');
  if (!host) return;
  const platform = document.getElementById('giveaway-platform'), search = document.getElementById('giveaway-search');
  const grid = host.querySelector('[data-giveaway-grid]'), status = host.querySelector('[data-api-status]');
  const errorPanel = host.querySelector('[data-api-error]'), loading = host.querySelector('[data-api-loading]');
  // items: offers from the last response; controller: aborts an outdated request;
  // generation: increases on every load so a slow, older response is ignored.
  let items = [], controller, generation = 0;
  // Only HTTPS URLs (optionally limited to given domains) from the API are used in the page.
  const safeURL = (value, fallback, domains) => {
    try { const url = new URL(value); return url.protocol === 'https:' && (!domains || domains.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) ? url.href : fallback; }
    catch { return fallback; }
  };
  // Builds up to 12 cards with textContent (never innerHTML), filtered by the search box.
  function render() {
    const query = search.value.trim().toLowerCase();
    const visible = items.filter(item => (item.title + ' ' + item.type).toLowerCase().includes(query)).slice(0,12);
    grid.replaceChildren();
    for (const item of visible) {
      const article = document.createElement('article'); article.className = 'giveaway-card';
      const image = document.createElement('img'); image.src = safeURL(item.thumbnail,'images/placeholder.svg'); image.alt = item.title; image.loading = 'lazy'; image.width = 400; image.height = 220;
      image.addEventListener('error', () => { image.src = 'images/placeholder.svg'; }, {once:true});
      const content = document.createElement('div'); content.className = 'giveaway-copy';
      const tag = document.createElement('p'); tag.className = 'giveaway-tag'; tag.textContent = item.type + ' · ' + item.platforms;
      const title = document.createElement('h3'); title.textContent = item.title;
      const description = document.createElement('p'); description.textContent = String(item.description || '').slice(0,160); description.className = 'giveaway-description';
      const end = document.createElement('p'); end.className = 'giveaway-end'; end.textContent = item.end_date && item.end_date !== 'N/A' ? 'Ends: ' + item.end_date : 'Available while the offer lasts';
      const link = document.createElement('a'); link.className = 'text-button'; link.textContent = 'View giveaway ↗'; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.href = safeURL(item.gamerpower_url || item.open_giveaway_url,'https://www.gamerpower.com/',['gamerpower.com']);
      content.append(tag,title,description,end,link); article.append(image,content); grid.append(article);
    }
    host.querySelector('[data-api-empty]').hidden = !loading.hidden || visible.length > 0 || !errorPanel.hidden;
    // The option may be displayed in RU/KZ; keep the English label so js/i18n.js can translate the whole line.
    const label = platform.options[platform.selectedIndex].text;
    if (errorPanel.hidden && loading.hidden) status.textContent = `Showing ${visible.length} of ${items.length} current giveaways · ${window.HUB_I18N?.source(label) || label}`;
  }
  // Fetches offers for the selected platform: shows a loading state, times out after 12 s,
  // and on failure shows an error with Retry plus any results cached in the last 24 hours.
  async function load() {
    controller?.abort(); controller = new AbortController();
    const requestController = controller;
    const currentGeneration = ++generation;
    const timeout = setTimeout(() => requestController.abort(),12000);
    loading.hidden = false; grid.setAttribute('aria-busy','true'); errorPanel.hidden = true;
    host.querySelector('[data-api-empty]').hidden = true; status.textContent = 'Loading current giveaways…';
    // A platform change must not show another platform's offers under the new label.
    items = []; grid.replaceChildren();
    const refresh = host.querySelector('[data-refresh-giveaways]'); refresh.disabled = true;
    const selected = platform.value; const cacheKey = 'hub-giveaways-' + selected;
    try {
      const response = await fetch('https://www.gamerpower.com/api/giveaways?platform=' + encodeURIComponent(selected) + '&sort-by=date', {signal:requestController.signal});
      if (!response.ok) throw new Error('The giveaway service returned an error.');
      const data = await response.json();
      if (currentGeneration !== generation) return;
      // GamerPower answers 201 with {status: 0} when a platform has no active giveaways.
      if (response.status === 201 || data?.status === 0) items = [];
      else if (!Array.isArray(data)) throw new Error('The giveaway service returned an unexpected response.');
      else items = data.filter(i => i && typeof i.title === 'string' && typeof i.type === 'string');
      try { sessionStorage.setItem(cacheKey, JSON.stringify({items, savedAt:Date.now()})); } catch {}
      render();
    } catch (error) {
      if (currentGeneration !== generation) return;
      items = []; let cached;
      try { cached = JSON.parse(sessionStorage.getItem(cacheKey)); } catch {}
      if (cached && Array.isArray(cached.items) && Date.now() - cached.savedAt < 86400000) items = cached.items;
      errorPanel.hidden = false;
      host.querySelector('[data-api-error-message]').textContent = error.name === 'AbortError' ? 'The request timed out. Check your connection and try again.' : 'Check your connection and try again. The rest of your game hub is still available.';
      status.textContent = items.length ? 'Offline preview: saved results from ' + new Date(cached.savedAt).toLocaleString() + '. Offers may have expired.' : 'Live giveaways are currently unavailable.';
      render();
    } finally {
      clearTimeout(timeout);
      if (currentGeneration === generation) { loading.hidden = true; grid.removeAttribute('aria-busy'); refresh.disabled = false; render(); }
    }
  }
  document.getElementById('giveaway-filters').addEventListener('submit', event => event.preventDefault());
  platform.addEventListener('change', load); search.addEventListener('input', render);
  host.querySelector('[data-refresh-giveaways]').addEventListener('click', load);
  host.querySelector('[data-retry-giveaways]').addEventListener('click', load);
  load();
})();
