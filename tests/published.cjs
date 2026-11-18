// Live-site acceptance checks. Isolated browser contexts; no real payments/messages.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=(process.env.HUB_BASE_URL||'https://chinusoid.github.io/Web-SteamProject').replace(/\/$/,'');
const output=path.join(root,'docs/final');
const results=[],errors=[],badResponses=[],apiEvidence=[];
const assetInventory={};
const pages=['index.html','games.html','library.html','featured.html','categories.html','community.html','news.html','about.html','contact.html','responsive.html','login.html','profile.html','giveaways.html','game-details.html'];
let browser;
async function scenario(name,fn){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',error=>errors.push({scenario:name,error:error.message}));
 page.on('response',response=>{if(response.url().startsWith(base+'/')&&response.status()>=400)badResponses.push({url:response.url(),status:response.status()});});
 const go=async file=>{const response=await page.goto(base+'/'+file);assert.equal(response.status(),200,file);await page.waitForFunction(()=>!window.jQuery||Boolean(document.querySelector('.hub-toasts')));};
 try{await fn({page,context,go});results.push({name,passed:true});console.log('PASS',name);}
 catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL',name,error.message);await page.screenshot({path:path.join(output,'screenshots','failure-'+results.length+'.png')}).catch(()=>{});}
 finally{await context.close();}
}
async function poll(action,expected,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){if(await action()===expected)return;await new Promise(r=>setTimeout(r,80));}assert.equal(await action(),expected);}
(async()=>{
 await fs.mkdir(path.join(output,'screenshots'),{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 await scenario('Published internal links, anchors, images, scripts, styles and audio resolve',async({page,context,go})=>{
  const targets=new Set();const anchorTargets=[];
  for(const file of pages){
   await go(file);
   const links=await page.evaluate(()=>[...document.querySelectorAll('[href],[src],img[data-src]')].map(el=>new URL(el.getAttribute('href')||el.getAttribute('src')||el.getAttribute('data-src'),location.href).href));
   for(const value of links){if(!value.startsWith(base+'/'))continue;const u=new URL(value);if(u.hash)anchorTargets.push({url:u.href,hash:decodeURIComponent(u.hash.slice(1))});u.hash='';targets.add(u.href);}
  }
  const documents=new Map();
  for(const url of targets){const response=await context.request.get(url);assert.equal(response.status(),200,url);if((response.headers()['content-type']||'').includes('text/html'))documents.set(url,await response.text());}
  for(const target of anchorTargets){const u=new URL(target.url);u.hash='';const text=documents.get(u.href);if(text)assert(text.includes('id="'+target.hash+'"')||text.includes("id='"+target.hash+"'"),target.url);}
  Object.assign(assetInventory,{uniqueResources:targets.size,anchorLinks:anchorTargets.length});
 });
 await scenario('Every page exposes working theme, mobile navigation and player-dialog controls',async({page,go})=>{
  await page.setViewportSize({width:375,height:900});
  for(const file of pages){
   await go(file);const original=await page.locator('html').getAttribute('data-bs-theme');
   await page.locator('[data-theme-toggle]').click();assert.notEqual(await page.locator('html').getAttribute('data-bs-theme'),original);await page.locator('[data-theme-toggle]').click();
   if(await page.locator('.navbar-toggler').count()){
    await page.locator('.navbar-toggler').click();await poll(()=>page.locator('.navbar-toggler').getAttribute('aria-expanded'),'true');assert.equal(await page.locator('#main-nav a:visible').count(),8);
    await page.locator('.navbar-toggler').click();await poll(()=>page.locator('.navbar-toggler').getAttribute('aria-expanded'),'false');
    await page.locator('[data-open-profiles]').click();assert(await page.locator('#profiles-dialog').isVisible());await page.keyboard.press('Escape');assert(await page.locator('#profiles-dialog').isHidden());
   }
  }
 });
 await scenario('Homepage previous/next and every featured pagination button select the correct game',async({page,go})=>{
  await go('index.html');const titles=['Dota 2','Cyberpunk 2077','Elden Ring'];
  for(let i=0;i<3;i++){await page.locator(`[data-feature-index="${i}"]`).click();assert.equal(await page.locator('[data-feature-title]').textContent(),titles[i]);assert.equal(await page.locator(`[data-feature-index="${i}"]`).getAttribute('aria-pressed'),'true');}
  await page.locator('[data-feature-step="1"]').click();assert.equal(await page.locator('[data-feature-title]').textContent(),'Dota 2');await page.locator('[data-feature-step="-1"]').click();assert.equal(await page.locator('[data-feature-title]').textContent(),'Elden Ring');
  await page.locator('[data-feature-buy]').click();assert.match(await page.locator('[data-checkout-name]').textContent(),/Elden Ring/);await page.locator('#checkout-dialog [data-close-hub-dialog]').first().click();
 });
 await scenario('Both galleries: all 18 slide selectors, next/previous and announcements work',async({page,go})=>{
  for(const file of ['about.html','community.html']){
   await go(file);
   for(let i=0;i<9;i++){await page.locator(`[data-bs-slide-to="${i}"]`).click();await poll(()=>page.locator('.carousel-item.active').getAttribute('aria-label'),`${i+1} of 9`);}
   await page.locator('.carousel-control-next').click();await poll(()=>page.locator('.carousel-item.active').getAttribute('aria-label'),'1 of 9');
   await page.locator('.carousel-control-prev').click();await poll(()=>page.locator('.carousel-item.active').getAttribute('aria-label'),'9 of 9');
   assert.match(await page.locator('.carousel-status').textContent(),/Image 9 of 9/);
  }
 });
 await scenario('All FAQ controls and newsletter open/close/Escape behavior work',async({page,go})=>{
  await go('contact.html');
  for(const button of await page.locator('[data-accordion-button]').all()){
   const id=await button.getAttribute('aria-controls');await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('#'+id).evaluate(el=>el.inert),false);await button.click();assert.equal(await page.locator('#'+id).evaluate(el=>el.inert),true);
  }
  await go('news.html');await page.locator('[data-open-dialog]').click();assert(await page.locator('#subscription-dialog').isVisible());await page.locator('[data-close-dialog]').click();assert(await page.locator('#subscription-dialog').isHidden());
  await page.locator('[data-open-dialog]').click();await page.keyboard.press('Escape');assert(await page.locator('#subscription-dialog').isHidden());
 });
 await scenario('Every community topic opens/closes its own content and related links are relevant',async({page,go})=>{
  await go('community.html');assert.equal(await page.locator('[data-topic-toggle]').count(),5);
  for(const button of await page.locator('[data-topic-toggle]').all()){
   const panel=page.locator('#'+await button.getAttribute('aria-controls'));await button.click();assert(await panel.isVisible());assert((await panel.textContent()).length>100);assert(await panel.locator('a').isVisible());await button.click();assert(await panel.isHidden());
  }
  const channelLinks=await page.locator('.custom-ul a').allTextContents();assert(!channelLinks.some(t=>/Discord|Reddit|Official/.test(t)));
 });
 await scenario('Autocomplete mouse/keyboard, submitted search and all six category links work',async({page,go})=>{
  await go('index.html');await page.locator('#store-search').fill('Cyber');await page.locator('[data-suggest="cyberpunk-2077"]').click();await page.waitForURL('**/games.html?q=Cyberpunk*');assert.equal(await page.locator('[data-store-catalogue] [data-game]:visible').count(),1);
  await go('about.html');await page.locator('#store-search').fill('Elden');await page.locator('#store-search').press('ArrowDown');await page.locator('#store-search').press('Enter');await page.waitForURL('**/games.html?q=Elden*');
  await go('news.html');await page.locator('#store-search').fill('Minecraft');await page.locator('.store-search [type=submit]').click();await page.waitForURL('**/games.html?q=Minecraft');
  await go('categories.html');const hrefs=await page.locator('.genre-card a').evaluateAll(links=>links.map(a=>a.getAttribute('href')));assert.equal(hrefs.length,6);
  for(const href of hrefs){await go(href);const q=new URL(base+'/'+href).searchParams.get('q');assert.equal(await page.locator('#game-search').inputValue(),q);assert((await page.locator('[data-store-catalogue] [data-game]:visible').count())>0,href);}
 });
 await scenario('All nine game purchase/cancel, ratings/clear and return buttons work',async({page,go})=>{
  await go('games.html');const games=await page.evaluate(()=>window.HUB_GAMES.map(g=>({id:g.id,title:g.title,cents:g.cents})));
  for(const game of games){
   await go('games.html');await page.locator(`[data-buy="${game.id}"]`).click();assert.equal(await page.locator('[data-checkout-name]').textContent(),game.title);await page.locator('#checkout-dialog .dialog-actions [data-close-hub-dialog]').click();
   await page.locator(`[data-buy="${game.id}"]`).click();await page.locator('[data-checkout-confirm]').click();await page.locator('#checkout-dialog').waitFor({state:'hidden'});
   assert.equal(await page.locator('[data-wallet]').textContent(),'$'+((10000-game.cents)/100).toFixed(2));
   await page.locator(`[data-game="${game.id}"] label[for$="-5"]`).click();assert.equal(await page.locator(`[data-game="${game.id}"] [data-rating-value]`).textContent(),'5/5');await page.locator(`[data-clear-rating="${game.id}"]`).click();assert.equal(await page.locator(`[data-game="${game.id}"] [data-rating-value]`).textContent(),'Not rated');
   await go('library.html');assert.equal(await page.locator(`[data-game="${game.id}"]:visible`).count(),1);await page.locator(`[data-refund="${game.id}"]`).click();await page.locator('[data-checkout-confirm]').click();await page.locator('#checkout-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('[data-wallet]').textContent(),'$100.00');
  }
 });
 await scenario('Creating/switching players isolates collections and synchronizes another tab',async({page,context,go})=>{
  await go('index.html');await page.locator('[data-open-profiles]').click();await page.locator('#profile-name').fill('Button Tester');await page.locator('#create-profile [type=submit]').click();await page.locator('#profiles-dialog').waitFor({state:'hidden'});
  const other=await context.newPage();other.on('pageerror',error=>errors.push({scenario:'second tab',error:error.message}));await other.goto(base+'/index.html');await other.waitForFunction(()=>Boolean(document.querySelector('.hub-toasts')));
  await page.locator('[data-theme-toggle]').click();await poll(()=>other.locator('html').getAttribute('data-bs-theme'),await page.locator('html').getAttribute('data-bs-theme'));await page.locator('[data-theme-toggle]').click();
  await page.locator('[data-feature-buy]').click();await page.locator('[data-checkout-confirm]').click();await page.locator('#checkout-dialog').waitFor({state:'hidden'});await poll(()=>other.locator('[data-owned-count]').textContent(),'1');
  await page.locator('[data-open-profiles]').click();await page.locator('[data-switch-profile="player-1"]').click();await poll(()=>other.locator('[data-profile-name]').textContent(),'Player 1');await go('library.html');assert(await page.locator('[data-catalogue-empty]').isVisible());
 });
 await scenario('Clock, visible background change, sound, counters and clipboard share work',async({page,go})=>{
  await go('index.html');await page.locator('.legacy-tools summary').click();const time=await page.locator('[data-live-clock]').textContent();await poll(async()=>await page.locator('[data-live-clock]').textContent()!==time,true,4000);
  await page.locator('[data-change-background]').click();assert.equal(await page.locator('[data-background-name]').textContent(),'Ocean');assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage),'none','Background button must change visible background, not a color hidden behind an opaque gradient');
  await page.locator('[data-theme-toggle]').click();assert.equal(await page.locator('body').evaluate(el=>el.style.background),'');assert.equal(await page.locator('[data-background-name]').textContent(),'Midnight');await page.locator('[data-change-background]').click();assert.equal(await page.locator('[data-background-name]').textContent(),'Ocean');
  await page.locator('[data-play-sound]').click();await page.getByText('Sound finished. You can play it again.').waitFor({timeout:8000});assert(await page.locator('[data-play-sound]').isEnabled());
  for(const counter of await page.locator('[data-counter]').all()){await counter.scrollIntoViewIfNeeded();const value=(await counter.getAttribute('data-counter-prefix')||'')+await counter.getAttribute('data-counter');await poll(()=>counter.textContent(),value);}
  await page.locator('[data-copy-link]').click();await page.getByText('Copied to clipboard!',{exact:true}).waitFor();assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).trim(),'https://chinusoid.github.io/Web-SteamProject/');
 });
 await scenario('Real public API loads PC, Steam, Epic and GOG; search/filter and offer links work',async({page,go})=>{
  page.on('response',async r=>{if(r.url().startsWith('https://www.gamerpower.com/api/giveaways')){let body;try{body=await r.json();}catch{}apiEvidence.push({url:r.url(),status:r.status(),items:Array.isArray(body)?body.length:0});}});
  await go('giveaways.html');
  for(const platform of ['pc','steam','epic-games-store','gog']){
   if(platform!=='pc')await page.locator('#giveaway-platform').selectOption(platform);
   await page.locator('[data-api-loading]').waitFor({state:'hidden',timeout:18000});
   if(await page.locator('[data-api-error]').isVisible()){await page.locator('[data-retry-giveaways]').click();await page.locator('[data-api-loading]').waitFor({state:'hidden',timeout:18000});}
   assert(await page.locator('[data-api-error]').isHidden(),platform+' real API failed');
   const count=await page.locator('.giveaway-card').count();assert(count>0||await page.locator('[data-api-empty]').isVisible());
   for(const href of await page.locator('.giveaway-card a').evaluateAll(links=>links.map(a=>a.href)))assert(href.startsWith('https://www.gamerpower.com/'));
   await page.locator('#giveaway-search').fill('zz-no-result-2026');assert(await page.locator('[data-api-empty]').isVisible());await page.locator('#giveaway-search').fill('');
  }
  assert(apiEvidence.length>=4);await page.locator('#live-giveaways').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'screenshots','published-api.png')});
 });
 await scenario('API loading, rapid platform changes and stale responses keep correct platform data',async({page,go})=>{
  let releaseSteam;const held=new Promise(r=>releaseSteam=r);
  const item=title=>({title,type:'Game',platforms:'PC',thumbnail:base+'/images/placeholder.svg',description:'Controlled UI recovery test',gamerpower_url:'https://www.gamerpower.com/'});
  await page.route('https://www.gamerpower.com/api/**',async route=>{
   const platform=new URL(route.request().url()).searchParams.get('platform');if(platform==='steam')await held;
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify([item(platform==='epic-games-store'?'Fresh Epic offer':platform==='steam'?'Stale Steam offer':'PC offer')])}).catch(()=>{});
  });
  await go('giveaways.html');await page.locator('[data-api-loading]').waitFor({state:'hidden'});await page.locator('#giveaway-platform').selectOption('steam');await page.locator('#giveaway-search').fill('fresh');
  assert.match(await page.locator('[data-api-status]').textContent(),/Loading/);assert.equal(await page.locator('.giveaway-card').count(),0);assert(await page.locator('[data-api-empty]').isHidden());
  await page.locator('#giveaway-platform').selectOption('epic-games-store');await page.locator('[data-api-loading]').waitFor({state:'hidden'});releaseSteam();await page.locator('.giveaway-card h3').waitFor();assert.equal(await page.locator('.giveaway-card h3').textContent(),'Fresh Epic offer');
 });
 await scenario('API timeout, HTTP failure, malformed response and expired cache have recovery controls',async({page,go})=>{
  let mode='http';await page.route('https://www.gamerpower.com/api/**',route=>{
   if(mode==='timeout')return;
   return route.fulfill({status:mode==='http'?500:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:mode==='malformed'?'not JSON':'{"unexpected":true}'});
  });
  await go('giveaways.html');await page.locator('[data-api-error]').waitFor();assert(await page.locator('[data-retry-giveaways]').isEnabled());
  for(const next of ['malformed','shape','timeout']){mode=next;await page.locator('[data-retry-giveaways]').click();await page.locator('[data-api-error]').waitFor({timeout:16000});assert.equal(await page.locator('.giveaway-card').count(),0);}
  assert.match(await page.locator('[data-api-error-message]').textContent(),/timed out/);
  await page.evaluate(()=>sessionStorage.setItem('hub-giveaways-pc',JSON.stringify({savedAt:Date.now()-172800000,items:[{title:'Expired offer',type:'Game'}]})));mode='http';await page.locator('[data-retry-giveaways]').click();await page.locator('[data-api-error]').waitFor();assert.equal(await page.locator('.giveaway-card').count(),0);
 });
 await scenario('Keyboard skip link, focus and reduced-motion/hover behavior are usable',async({page,go})=>{
  await go('index.html');await page.keyboard.press('Tab');assert.match(await page.locator(':focus').textContent(),/Skip/);await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'main-content');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.store-card').first().hover();await poll(()=>page.locator('.store-card').first().evaluate(el=>getComputedStyle(el).transform!=='none'),true);
  await page.emulateMedia({reducedMotion:'reduce'});const duration=await page.locator('.store-card').first().evaluate(el=>getComputedStyle(el).transitionDuration);assert(parseFloat(duration)<.01);
 });
 const data={date:new Date().toISOString(),baseURL:base,results,assetInventory,uncaughtJavaScriptErrors:errors,brokenOwnResponses:badResponses,apiEvidence};
 await fs.writeFile(path.join(output,'published-audit.json'),JSON.stringify(data,null,2));
 await browser.close();assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);assert(results.every(r=>r.passed),'Some published-site checks failed.');
})().catch(async error=>{console.error(error.stack);if(browser)await browser.close();process.exitCode=1;});
