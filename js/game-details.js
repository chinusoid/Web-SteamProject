/* Game details page: renders one catalogue game chosen by ?game=<id> in the URL.
   Purchase and rating controls reuse the storefront wallet in js/script.js.
   Text is English here; js/i18n.js translates every fragment to RU/KZ, so labels stay separate nodes. */
(function () {
  'use strict';

  // Longer overviews than the one-line catalogue descriptions in js/games-data.js.
  const overviews = {
    'counter-strike-2': 'Counter-Strike 2 is a team-based tactical first-person shooter. In its classic competitive mode, two teams face off in short rounds, where accurate aim, smart equipment choices and clear coordination can turn the match.',
    'grand-theft-auto-v': 'Explore Los Santos and Blaine County in an open-world action adventure. The story follows three protagonists whose lives intersect; take on missions, drive across the city and discover the world at your own pace.',
    'dota-2': 'Dota 2 is a free team strategy game in the MOBA genre. Choose a hero, work with your teammates, strengthen your character during the match and push toward the opposing team’s Ancient.',
    'cyberpunk-2077': 'Play as V, a mercenary navigating Night City in this open-world role-playing game. Take on jobs, explore a dense futuristic city and shape your approach through combat, technology and story choices.',
    minecraft: 'Explore a world made of blocks, gather resources, craft tools and build whatever you can imagine. Creative mode focuses on building, while Survival adds resource gathering and the challenge of staying safe.',
    'red-dead-redemption-2': 'Follow outlaw Arthur Morgan and the Van der Linde gang in a story-driven western adventure. Travel through a detailed open world, take on missions and spend time exploring its towns and wilderness.',
    'elden-ring': 'An action role-playing adventure set in the Lands Between. Explore a vast fantasy world, face demanding enemies, develop your character and uncover the story through the places and people you encounter.',
    'baldurs-gate-3': 'Bring a party of adventurers together in a fantasy role-playing story shaped by your choices. Explore, talk with characters and take part in turn-based battles where positioning and teamwork matter.',
    'hogwarts-legacy': 'Step into the wizarding world as a student at Hogwarts. Learn spells, attend classes and explore beyond the castle in an open-world adventure built around magic and discovery.'
  };

  const tags = {
    'counter-strike-2': ['Tactical shooter', 'Team-based', 'Competitive'],
    'grand-theft-auto-v': ['Open world', 'Action adventure', 'Story'],
    'dota-2': ['MOBA', 'Team strategy', 'Free to play'],
    'cyberpunk-2077': ['Open world', 'Role-playing', 'Story choices'],
    minecraft: ['Sandbox', 'Building', 'Survival'],
    'red-dead-redemption-2': ['Open world', 'Western', 'Story adventure'],
    'elden-ring': ['Action RPG', 'Fantasy', 'Exploration'],
    'baldurs-gate-3': ['Party-based RPG', 'Turn-based combat', 'Choices'],
    'hogwarts-legacy': ['Wizarding world', 'Open world', 'Adventure']
  };

  // Games with a local gameplay screenshot; the others show their cover artwork.
  const screenshots = {
    'counter-strike-2': ['images/games/counter-strike-2-screenshot.jpg'],
    'cyberpunk-2077': ['images/games/cyberpunk-2077-screenshot.jpg'],
    'elden-ring': ['images/games/elden-ring-screenshot.jpg']
  };

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const root = document.querySelector('[data-game-content]');
  if (!root) return;

  const id = new URLSearchParams(window.location.search).get('game');
  const game = (window.HUB_GAMES || []).find(entry => entry.id === id);

  // Unknown or missing ?game= value: explain and link back to the catalogue.
  if (!game) {
    root.innerHTML = '<section class="detail-error"><h1>Game not found</h1><p>The requested game is not in this catalogue.</p><a class="buy-button" href="games.html">Open all games</a></section>';
    return;
  }

  document.title = 'Steam Game Hub — ' + game.title;
  const type = game.cents ? 'Paid game' : 'Free to play';
  const price = game.cents ? '$' + (game.cents / 100).toFixed(2) : 'Free to play';
  const gallery = screenshots[game.id] || [];
  const images = gallery.length ? gallery : [game.image];
  const imageCards = images.map(src => {
    const caption = gallery.length ? 'Gameplay screenshot' : 'Cover artwork';
    return `<figure class="m-0"><a href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" alt="${escapeHtml(game.title + ' — ' + caption)}" loading="lazy" width="640" height="360"></a><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
  }).join('');
  const gameTags = (tags[game.id] || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('');

  // data-buy and data-rating-for are picked up by js/script.js, which runs after this file,
  // so the checkout dialog, wallet and personal rating work exactly as on the catalogue.
  root.innerHTML = `<section class="detail-hero" aria-labelledby="game-title">
      <div class="detail-art"><img src="${escapeHtml(game.image)}" alt="${escapeHtml(game.title + ' — cover artwork')}" width="1200" height="675"></div>
      <div class="detail-summary"><p class="eyebrow"><span>${escapeHtml(game.genre)}</span> · <span>${escapeHtml(type)}</span></p>
        <h1 id="game-title">${escapeHtml(game.title)}</h1>
        <p>${escapeHtml(game.description)}</p>
        <div class="detail-tags" aria-label="Tags">${gameTags}</div>
        <div class="detail-facts">
          <div class="detail-fact"><span>Genre</span><strong>${escapeHtml(game.genre)}</strong></div>
          <div class="detail-fact"><span>Price</span><strong>${escapeHtml(price)}</strong></div>
          <div class="detail-fact"><span>Type</span><strong>${escapeHtml(type)}</strong></div>
        </div>
        <div class="detail-purchase"><button type="button" class="buy-button" data-buy="${escapeHtml(game.id)}">${game.cents ? 'Buy game' : 'Add to library'}</button></div>
        <div class="personal-rating detail-rating" data-rating-for="${escapeHtml(game.id)}"></div>
      </div>
    </section>
    <section class="detail-section" aria-labelledby="game-overview-title"><h2 id="game-overview-title">About this game</h2>
      <p class="detail-overview">${escapeHtml(overviews[game.id] || game.description)}</p>
    </section>
    <section class="detail-section" aria-labelledby="game-gallery-title"><h2 id="game-gallery-title">Screenshots &amp; artwork</h2>
      ${gallery.length ? '' : '<p class="detail-note">Only cover artwork is available in this gallery so far.</p>'}
      <div class="detail-gallery">${imageCards}</div>
    </section>`;
})();
