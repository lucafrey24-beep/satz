// Erzeugt Screenshots für das Web-App-Manifest (Installationsdialog) mit Beispieldaten.
// Aufruf: lokalen Server auf Port 8766 starten (python3 -m http.server 8766), dann node tools/make-screens.js
const {chromium} = require("playwright");
const path = require("path"), out = path.join(__dirname, "..", "icons", "screens");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, reducedMotion: "reduce"});
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { sessionStorage.setItem("satz-splash", "1"); } catch (e) {} });
  await p.goto("http://localhost:8766/"); await p.waitForTimeout(400);
  await p.click('[data-act="adopt"][data-id="arnold"]'); await p.waitForTimeout(7000);
  await p.screenshot({path: path.join(out, "heute.png")});
  await p.click('[data-act="start"]'); await p.waitForTimeout(500);
  await p.screenshot({path: path.join(out, "training.png")});
  await p.click('[data-act="mini"]'); await p.waitForTimeout(300);
  await p.goto("http://localhost:8766/#/koerper"); await p.waitForTimeout(2500);
  await p.click('[data-act="bm"][data-m="brust"]'); await p.waitForTimeout(500); await p.$eval("#view", e => e.scrollTop = 0);
  await p.screenshot({path: path.join(out, "koerper.png")});
  await b.close(); console.log("ok");
})();
