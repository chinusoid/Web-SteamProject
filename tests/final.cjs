// End-to-end final-project checks. Real browser, real form flows, isolated test data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'docs/final');
const publishedBase = (process.env.HUB_BASE_URL || (process.argv.includes('--published') ? 'https://chinusoid.github.io/Web-SteamProject' : '')).replace(/\/$/,'');
const results = [], errors = [];
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.wav':'audio/wav'};
const server = http.createServer(async(req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)) return res.writeHead(403).end();
  try {res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));}
  catch {res.writeHead(404).end();}
});
async function check(name, action) {
  try {await action(); results.push({name,passed:true});console.log('PASS',name);}
  catch(e) {results.push({name,passed:false,error:e.message});console.error('FAIL',name,e.message);throw e;}
}
(async()=>{
 await fs.mkdir(path.join(output,'screenshots'),{recursive:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=publishedBase || 'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(e.message));
 const goto=async file=>{await page.goto(origin+'/'+file);await page.waitForFunction(()=>!window.jQuery||Boolean(document.querySelector('.hub-toasts')));};
 const shot=async name=>page.screenshot({path:path.join(output,'screenshots',name+'.png')});
 try {
 await check('All local HTML, image, script, stylesheet and anchor targets exist; no native form constraints',async()=>{
   const pages=(await fs.readdir(root)).filter(n=>n.endsWith('.html'));
   for(const file of pages){
    const html=await fs.readFile(path.join(root,file),'utf8');
    assert(!/<(?:input|select|textarea)\b[^>]*\s(?:required|pattern|minlength|maxlength|min|max)(?:\s|=|>)/i.test(html),file+' has native constraints');
    assert(!/type="email"/.test(html),file+' uses native email type');
    for(const m of html.matchAll(/<form\b([^>]*)>/g)) assert(/novalidate/.test(m[1]),file+' missing novalidate');
    for(const m of html.matchAll(/(?:src|href)="([^"#]+)(?:#[^"]*)?"/g)){
      const target=m[1].split(/[?#]/)[0];if(/^(https?:|data:|mailto:|tel:)/.test(target)||!target)continue;
      await fs.access(path.resolve(root,target));
    }
    for(const m of html.matchAll(/href="([^"#]*\.html)?#([^"]+)"/g)) {
      const target=m[1]?await fs.readFile(path.join(root,m[1]),'utf8'):html;
      assert(target.includes('id="'+m[2]+'"'),file+' broken anchor '+m[0]);
    }
   }
   for(const file of [...(await fs.readdir(path.join(root,'js'))).filter(n=>n.endsWith('.js')).map(n=>'js/'+n)]) {
     const source=await fs.readFile(path.join(root,file),'utf8');
     assert(!/\.(?:checkValidity|reportValidity|setCustomValidity)\s*\(|\.validity\b/.test(source),file+' relies on native validation');
   }
 });
 await check('14 connected pages fit desktop, tablet and mobile in both themes without JS errors',async()=>{
  const pages=(await fs.readdir(root)).filter(n=>n.endsWith('.html'));
  assert.equal(pages.length,14);
  for(const width of [375,768,1440]) {
    await page.setViewportSize({width,height:1000});
    for(const theme of ['dark','light']){
      await page.evaluate(t=>localStorage.setItem('hub-theme',t),theme).catch(()=>{});
      if(page.url()==='about:blank') { await page.goto(origin); await page.evaluate(t=>localStorage.setItem('hub-theme',t),theme); }
      for(const file of pages){
        await goto(file);
        assert.equal(await page.locator('html').getAttribute('data-bs-theme'),theme);
        const constraints=await page.evaluate(()=>[...document.forms].flatMap(form=>[
          ...(!form.noValidate?[form.id+' missing novalidate']:[]),
          ...[...form.querySelectorAll('[required],[pattern],[minlength],[maxlength],[min],[max],input[type=email]')].map(el=>el.id+' uses native constraints'),
        ]));
        assert.deepEqual(constraints,[],`${file} runtime form audit`);
        const sizes=await page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));
        assert(sizes.body<=sizes.viewport+1,`${file} ${width}px ${theme} overflows: ${sizes.body}`);
      }
    }
  }
  assert.deepEqual(errors,[]);
 });
 await page.setViewportSize({width:1440,height:1000});
 await check('Theme toggle persists across navigation and refresh',async()=>{
   await goto('index.html');const before=await page.locator('html').getAttribute('data-bs-theme');
   await page.locator('[data-theme-toggle]').click();
   const after=before==='dark'?'light':'dark';
   assert.equal(await page.locator('html').getAttribute('data-bs-theme'),after);
   // Earlier responsive init scripts deliberately set a test theme; clear them with a fresh context below.
   assert.equal(await page.evaluate(()=>localStorage.getItem('hub-theme')),after);
 });
 // Use a fresh context so responsive fixture init scripts cannot override saved preferences.
 await context.close();
 const flowContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await flowContext.addInitScript(()=>{
   // Fail if application code falls back to browser validation APIs.
   for(const prototype of [HTMLFormElement.prototype,HTMLInputElement.prototype,HTMLSelectElement.prototype,HTMLTextAreaElement.prototype]) {
     for(const method of ['checkValidity','reportValidity','setCustomValidity']) {
       if(typeof prototype[method]==='function') prototype[method]=function(){throw new Error('Native validation called: '+method);};
     }
   }
 });
 const flow=await flowContext.newPage();flow.on('pageerror',e=>errors.push(e.message));
 const go=async file=>{await flow.goto(origin+'/'+file);await flow.waitForFunction(()=>Boolean(document.querySelector('.hub-toasts')));};
 const capture=async(name,selector)=>selector?flow.locator(selector).screenshot({path:path.join(output,'screenshots',name+'.png')}):flow.screenshot({path:path.join(output,'screenshots',name+'.png')});
 await check('Theme stays selected on a different page and after reload',async()=>{
   await go('index.html');await flow.locator('[data-theme-toggle]').click();await go('games.html');
   assert.equal(await flow.locator('html').getAttribute('data-bs-theme'),'light');await flow.reload();
   assert.equal(await flow.locator('html').getAttribute('data-bs-theme'),'light');
   await capture('catalogue-light');await flow.locator('[data-theme-toggle]').click();
 });
 await check('Registration validates name, email, phone, password complexity and matching confirmation',async()=>{
   await go('community.html#join-community');const submit=flow.locator('[data-registration-next]');
   await submit.click();assert(await flow.locator('#register-name-error').isVisible());
   await flow.locator('#register-name').fill('Final Tester');await submit.click();
   await flow.locator('#register-email').fill('invalid');await flow.locator('#register-phone').fill('123');await submit.click();
   assert(await flow.locator('#register-email-error').isVisible());assert(await flow.locator('#register-phone-error').isVisible());
   await capture('registration-validation','#join-community');
   await flow.locator('#register-email').fill('final.tester@example.com');await flow.locator('#register-phone').fill('+7 700 123 45 67');await submit.click();
   await flow.locator('#register-password').fill('simplepass');await flow.locator('#register-confirm').fill('different');await submit.click();
   assert(await flow.locator('#register-password-error').isVisible());assert(await flow.locator('#register-confirm-error').isVisible());
   await flow.locator('#register-password').fill('DemoPlay1!');await flow.locator('#register-confirm').fill('DemoPlay1!');await submit.click();
   await flow.locator('[data-registration-success]').waitFor({state:'visible'});
   const stored=await flow.evaluate(()=>({accounts:JSON.parse(localStorage.getItem('hub-accounts-v1')),session:JSON.parse(localStorage.getItem('hub-session-v1'))}));
   assert.equal(stored.accounts[0].email,'final.tester@example.com');assert.equal(stored.accounts[0].phone,'+7 700 123 45 67');
   assert.match(stored.accounts[0].passwordHash,/^[a-f0-9]{64}$/);assert(!JSON.stringify(stored).includes('DemoPlay1!'));
   assert.equal(stored.session.accountId,stored.accounts[0].id);
 });
 await check('Profile shows saved details; logout, failed login and successful login redirect work',async()=>{
   await go('profile.html');assert.equal(await flow.locator('[data-detail-name]').textContent(),'Final Tester');
   assert.equal(await flow.locator('[data-detail-email]').textContent(),'final.tester@example.com');await capture('profile-desktop');
   await flow.locator('[data-logout]').click();await flow.waitForURL('**/login.html');
   await flow.locator('#login-form [type=submit]').click();assert(await flow.locator('#login-email-error').isVisible());
   await flow.locator('#login-email').fill('final.tester@example.com');await flow.locator('#login-password').fill('WrongPass1!');await flow.locator('#login-form [type=submit]').click();
   await flow.getByText(/Email or password is incorrect/).waitFor();await capture('login-error');
   await flow.locator('#login-password').fill('DemoPlay1!');await flow.locator('[data-toggle-password]').click();assert.equal(await flow.locator('#login-password').getAttribute('type'),'text');
   await flow.locator('#login-form [type=submit]').click();await flow.waitForURL('**/profile.html');assert(await flow.locator('[data-account-profile]').isVisible());
   await flow.reload();assert.equal(await flow.locator('[data-detail-name]').textContent(),'Final Tester');
 });
 await check('Existing account email cannot be registered a second time',async()=>{
   await go('community.html#join-community');await flow.locator('#register-name').fill('Another Player');await flow.locator('[data-registration-next]').click();
   await flow.locator('#register-email').fill('FINAL.TESTER@example.com');await flow.locator('#register-phone').fill('+7 700 123 45 67');await flow.locator('[data-registration-next]').click();
   assert.match(await flow.locator('#register-email-error').textContent(),/already has an account/);
 });
 await check('Catalogue filters update dynamically, persist and reset; query parameters override saved filters',async()=>{
   await go('games.html');await flow.locator('#game-search').fill('Cyberpunk');
   assert.equal(await flow.locator('[data-store-catalogue] [data-game]:visible').count(),1);
   await flow.reload();assert.equal(await flow.locator('#game-search').inputValue(),'Cyberpunk');
   await flow.locator('[data-reset-filters]').click();assert((await flow.locator('[data-store-catalogue] [data-game]:visible').count())>1);
   await go('games.html?price=free');assert.equal(await flow.locator('#game-budget').inputValue(),'free');
   await flow.locator('[data-reset-filters]').click();await flow.locator('#game-search').fill('<script>missing</script>');
   assert(await flow.locator('[data-catalogue-empty]').isVisible());await flow.locator('[data-reset-filters]').click();
 });
 await check('Purchases, personal ratings, wallet limits and library returns still work',async()=>{
   await go('games.html');await flow.locator('[data-buy="cyberpunk-2077"]').first().click();await flow.locator('[data-checkout-confirm]').click();
   await flow.locator('#checkout-dialog').waitFor({state:'hidden'});
   assert.equal(await flow.locator('[data-wallet]').textContent(),'$40.01');
   await flow.reload();assert.equal(await flow.locator('[data-wallet]').textContent(),'$40.01','a refresh must not refill the wallet');
   await flow.locator('[data-buy="elden-ring"]').first().click();assert(!(await flow.locator('[data-checkout-confirm]').isEnabled()));await flow.locator('#checkout-dialog [data-close-hub-dialog]').first().click();
   await flow.locator('[data-game="cyberpunk-2077"] label[for$="-5"]').click();
   await go('library.html');assert.equal(await flow.locator('[data-game="cyberpunk-2077"]:visible').count(),1);await capture('library-desktop');
   await flow.locator('[data-refund="cyberpunk-2077"]').click();await flow.locator('[data-checkout-confirm]').click();await flow.locator('#checkout-dialog').waitFor({state:'hidden'});
   assert.equal(await flow.locator('[data-wallet]').textContent(),'$100.00');
   assert.equal(await flow.locator('[data-game="cyberpunk-2077"]:visible').count(),0);
 });
 await check('Game details: cards link to their page; details, purchase, rating and unknown games work',async()=>{
   await go('games.html');assert.equal(await flow.locator('[data-game] .detail-button').count(),9);
   await flow.locator('[data-game="elden-ring"] .detail-button').click();await flow.waitForURL(/game-details\.html\?game=elden-ring/);
   await flow.waitForFunction(()=>Boolean(document.querySelector('.hub-toasts')));
   assert.equal(await flow.locator('#game-title').textContent(),'Elden Ring');assert.equal(await flow.locator('.detail-gallery img').count(),1);
   await flow.locator('.detail-purchase [data-buy]').click();await flow.locator('[data-checkout-confirm]').click();
   await flow.locator('#checkout-dialog').waitFor({state:'hidden'});
   assert.equal(await flow.locator('.detail-purchase [data-buy]').textContent(),'✓ In library');
   assert.equal(await flow.locator('[data-wallet]').textContent(),'$40.01');
   await flow.locator('.detail-rating label[for$="-3"]').click();
   assert.equal(await flow.locator('.detail-rating [data-rating-value]').textContent(),'3/5');
   await go('library.html');await flow.locator('[data-refund="elden-ring"]').click();await flow.locator('[data-checkout-confirm]').click();
   await flow.locator('#checkout-dialog').waitFor({state:'hidden'});assert.equal(await flow.locator('[data-wallet]').textContent(),'$100.00');
   await go('game-details.html?game=missing-game');assert.equal(await flow.locator('.detail-error h1').textContent(),'Game not found');
   await go('index.html');assert.equal(await flow.locator('[data-feature-details]').getAttribute('href'),'game-details.html?game=dota-2');
 });
 await check('Support form validates phone and email inline; valid submission stays local',async()=>{
   await go('contact.html');await flow.locator('#contact-form [type=submit]').click();
   assert(await flow.locator('#contact-phone-error').isVisible());await capture('support-validation','#contact-form');
   await flow.locator('#name').fill('Demo Player');await flow.locator('#email').fill('demo@example.com');await flow.locator('#contact-phone').fill('+7 700 123 45 67');await flow.locator('#message').fill('This is a final project test.');await flow.locator('#demo-check').check();
   await flow.locator('#contact-form [type=submit]').click();await flow.getByText('Submitted successfully in this demo. No data was sent to a server.').waitFor();
 });
 await check('Support JS rules reject whitespace, bad email/phone, long text and unchecked consent',async()=>{
   await go('contact.html');const submit=flow.locator('#contact-form [type=submit]');
   await flow.locator('#name').fill('   ');await flow.locator('#email').fill('player..name@example.com');await flow.locator('#contact-phone').fill('+7 (700 123 45 67');await flow.locator('#message').fill('   ');await submit.click();
   for(const id of ['name','email','contact-phone','message','demo-check']) assert(await flow.locator('#'+id+'-error').isVisible(),id);
   assert(await submit.isEnabled());assert.equal(await flow.locator('#contact-form').getAttribute('aria-busy'),null);
   await flow.locator('#name').fill('A'.repeat(81));await flow.locator('#message').fill('M'.repeat(2001));await submit.click();
   assert(await flow.locator('#name-error').isVisible());assert(await flow.locator('#message-error').isVisible());
   await flow.locator('#name').fill('Шынгыс Султанкулов');await flow.locator('#email').fill('player+test@sub.example.co.uk');await flow.locator('#contact-phone').fill('+7 (700) 123-45-67');await flow.locator('#message').fill('All required information is present.');
   await submit.click();assert(await flow.locator('#demo-check-error').isVisible());assert(await submit.isEnabled());
   await flow.locator('#demo-check').check();await submit.click();await flow.getByText('Submitted successfully in this demo. No data was sent to a server.').waitFor();
 });
 await check('Newsletter popup validates email in JS, recovers after errors and resets',async()=>{
   await go('news.html');await flow.locator('[data-open-dialog="subscription-dialog"]').click();const submit=flow.locator('#subscription-form [type=submit]');
   for(const email of ['   ','player@example..com','player@-example.com','player@exam_ple.com','player@example.c']) {
     await flow.locator('#subscriber-email').fill(email);await submit.click();assert(await flow.locator('#subscriber-email-error').isVisible(),email);assert(await submit.isEnabled());
   }
   await flow.locator('#subscriber-email').fill('player+news@example.com');await submit.click();await flow.getByText('Submitted successfully in this demo. No data was sent to a server.').waitFor();
   await flow.locator('#subscription-form').evaluate(form=>form.reset());assert(await flow.locator('#subscriber-email-error').isHidden());
   await flow.locator('[data-close-dialog]').click();
 });
 await check('Registration enforces JS email, phone and every password-complexity rule',async()=>{
   await go('community.html#join-community');const submit=flow.locator('[data-registration-next]');
   for(const name of ['   ','!!!','A'.repeat(25)]) {await flow.locator('#register-name').fill(name);await submit.click();assert(await flow.locator('#register-name-error').isVisible());}
   await flow.locator('#register-name').fill('Boundary Tester');await submit.click();
   await flow.locator('#register-phone').fill('+7 (700) 123-45-67');
   for(const email of ['a..b@example.com','.player@example.com','player.@example.com','player@example..com','player@-example.com','player@example.c']) {
     await flow.locator('#register-email').fill(email);await submit.click();assert(await flow.locator('#register-email-error').isVisible(),email);
   }
   await flow.locator('#register-email').fill('boundary+player@example.com');
   for(const phone of ['123456789','1234567890123456','+7 (700 123 45 67','+7 700) 123 45 67','+7 abc 1234567890','++77001234567']) {
     await flow.locator('#register-phone').fill(phone);await submit.click();assert(await flow.locator('#register-phone-error').isVisible(),phone);
   }
   await flow.locator('#register-phone').fill('+7 (700) 123-45-67');await submit.click();
   for(const password of ['   ','Ab1!aaa','lowercase1!','UPPERCASE1!','NoDigitsHere!','NoSymbols123','A1!a'+'x'.repeat(125)]) {
     await flow.locator('#register-password').fill(password);await flow.locator('#register-confirm').fill(password);await submit.click();assert(await flow.locator('#register-password-error').isVisible(),password);
   }
   await flow.locator('#register-password').fill('ValidPass1!');await flow.locator('#register-confirm').fill('Mismatch1!');await submit.click();assert(await flow.locator('#register-confirm-error').isVisible());
 });
 await check('Final signup submission revalidates earlier steps and never saves invalid account data',async()=>{
   const count=await flow.evaluate(()=>JSON.parse(localStorage.getItem('hub-accounts-v1')).length);
   await flow.locator('#register-confirm').fill('ValidPass1!');
   // Simulate autofill updating a hidden step after it was first validated.
   await flow.locator('#register-phone').evaluate(input=>{input.value='123';});await flow.locator('[data-registration-next]').click();
   assert(await flow.locator('#register-phone-error').isVisible());assert(await flow.locator('#register-phone').isVisible());
   assert.equal(await flow.evaluate(()=>JSON.parse(localStorage.getItem('hub-accounts-v1')).length),count);
   await flow.locator('#register-phone').fill('+7 700 123 45 67');await flow.locator('[data-registration-next]').click();
   await flow.locator('#register-name').evaluate(input=>{input.value='   ';});await flow.locator('[data-registration-next]').click();
   assert(await flow.locator('#register-name-error').isVisible());assert(await flow.locator('#register-name').isVisible());
   assert.equal(await flow.evaluate(()=>JSON.parse(localStorage.getItem('hub-accounts-v1')).length),count);
 });
 await check('Player card validates required selections, name length and all fields at final confirmation',async()=>{
   await go('community.html#player-profile');const next=flow.locator('[data-profile-next]');
   await next.click();assert(await flow.locator('[data-profile-error]').isVisible());
   await flow.locator('#player-name').fill('A'.repeat(41));await next.click();assert.equal(await flow.locator('#player-name').getAttribute('aria-invalid'),'true');
   await flow.locator('#player-name').fill('Card Tester');await next.click();await next.click();
   assert.equal(await flow.locator('#player-genre').getAttribute('aria-invalid'),'true');assert.equal(await flow.locator('#player-style').getAttribute('aria-invalid'),'true');
   await flow.locator('#player-genre').selectOption('RPG');await flow.locator('#player-style').selectOption('Co-op');await next.click();
   await flow.locator('#player-name').evaluate(input=>{input.value='   ';});await flow.locator('[data-profile-form] [type=submit]').click();assert(await flow.locator('#player-name').isVisible());assert(await flow.locator('[data-profile-result]').isHidden());
   await flow.locator('#player-name').fill('Card Tester');await next.click();await next.click();await flow.locator('[data-profile-form] [type=submit]').click();await flow.locator('[data-profile-result]').waitFor({state:'visible'});
   await flow.locator('[data-profile-restart]').click();assert(await flow.locator('[data-profile-result]').isHidden());
 });
 await check('Dynamic local-player dialog and login enforce JS-only name/password rules',async()=>{
   await go('index.html');await flow.locator('[data-open-profiles]').click();const count=await flow.locator('[data-switch-profile]').count();
   for(const name of ['   ','!!!','A'.repeat(25),'Final Tester']) {
     await flow.locator('#profile-name').fill(name);await flow.locator('#create-profile [type=submit]').click();assert.match(await flow.locator('.profile-error').textContent(),/\S/);assert.equal(await flow.locator('[data-switch-profile]').count(),count);
   }
   await flow.locator('#profiles-dialog [data-close-hub-dialog]').click();
   await go('login.html');await flow.locator('#login-email').fill('final.tester@example.com');await flow.locator('#login-password').fill('weak');await flow.locator('#login-form [type=submit]').click();assert(await flow.locator('#login-password-error').isVisible());
   await flow.locator('#login-password').fill('DemoPlay1!');await flow.locator('#login-form [type=submit]').click();await flow.waitForURL('**/profile.html');
 });
 await check('Real GamerPower API loads current items through browser CORS',async()=>{
   await go('giveaways.html');await flow.locator('.giveaway-card').first().waitFor({timeout:25000});
   assert((await flow.locator('.giveaway-card').count())>0);assert(await flow.locator('[data-api-error]').isHidden());
   await capture('giveaways-live');
   await flow.locator('#live-giveaways').scrollIntoViewIfNeeded();await capture('giveaways-results');
   await flow.locator('#giveaway-search').fill('zzzz-no-result');assert(await flow.locator('[data-api-empty]').isVisible());await flow.locator('#giveaway-search').fill('');
 });
 await check('API failure, cached preview, retry and empty-response states behave correctly',async()=>{
   await flow.route('https://www.gamerpower.com/api/**',route=>route.abort());await flow.locator('[data-refresh-giveaways]').click();
   await flow.locator('[data-api-error]').waitFor();assert.match(await flow.locator('[data-api-status]').textContent(),/Offline preview/);await capture('giveaways-offline');
   await flow.unroute('https://www.gamerpower.com/api/**');await flow.locator('[data-retry-giveaways]').click();await flow.locator('[data-api-error]').waitFor({state:'hidden'});await flow.locator('[data-api-loading]').waitFor({state:'hidden',timeout:20000});assert((await flow.locator('.giveaway-card').count())>0);
   await flow.route('https://www.gamerpower.com/api/**',route=>route.fulfill({status:201,contentType:'application/json',body:'{"status":0,"status_message":"No active giveaways"}'}));await flow.locator('[data-refresh-giveaways]').click();await flow.locator('[data-api-empty]').waitFor();assert.equal(await flow.locator('.giveaway-card').count(),0);
   await flow.unroute('https://www.gamerpower.com/api/**');
 });
 await check('Production pages have representative desktop/tablet/mobile screenshots in both modes',async()=>{
   await go('index.html');await capture('store-desktop-dark');await flow.locator('[data-theme-toggle]').click();await capture('store-desktop-light');
   await flow.setViewportSize({width:768,height:1000});await capture('store-tablet-light');
   await flow.setViewportSize({width:375,height:900});await capture('store-mobile-light');await flow.locator('[data-theme-toggle]').click();await capture('store-mobile-dark');
   await go('profile.html');await capture('profile-mobile');await flow.setViewportSize({width:1440,height:1000});
 });
 assert.deepEqual(errors,[]);
 } finally {
   await fs.writeFile(path.join(output,publishedBase?'verification-live.json':'verification.json'),JSON.stringify({date:new Date().toISOString(),baseURL:origin,results,uncaughtJavaScriptErrors:errors},null,2));
   await browser.close();server.close();
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;server.close();});
