// Erzeugt die iOS-Startbilder (apple-touch-startup-image) in hell und dunkel und gibt die <link>-Zeilen für index.html aus.
// Aufruf im Projektordner: node tools/make-splash.js   (braucht Playwright mit Chromium)
const {chromium} = require("playwright");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), out = path.join(root, "icons", "splash");
// [CSS-Breite, CSS-Höhe, Pixeldichte] gängiger iPhones
const DEV = [[320, 568, 2], [375, 667, 2], [414, 896, 2], [375, 812, 3], [414, 896, 3], [390, 844, 3], [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3]];
const THEMES = {light: {bg: "#F2F2F7", fg: "#000000", tint: "#00703A"}, dark: {bg: "#000000", fg: "#FFFFFF", tint: "#00C46A"}};
const font = "data:font/woff2;base64," + fs.readFileSync(path.join(root, "fonts", "archivo-satz.woff2")).toString("base64");
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const b = await chromium.launch(), links = [];
  for (const [w, h, d] of DEV) for (const [name, c] of Object.entries(THEMES)) {
    const p = await b.newPage({viewport: {width: w, height: h}, deviceScaleFactor: d});
    await p.setContent(`<style>@font-face{font-family:A;src:url(${font});font-weight:900;font-stretch:62%}
      body{margin:0;height:100vh;background:${c.bg};display:grid;place-items:center}
      .m{font:900 54px A;font-stretch:62%;letter-spacing:.02em;color:${c.fg};margin-bottom:56px}.m span{color:${c.tint}}</style><div class="m">SATZ<span>.</span></div>`);
    await p.evaluate(() => document.fonts.ready);
    const file = `splash-${w * d}x${h * d}-${name}.png`;
    await p.screenshot({path: path.join(out, file)}); await p.close();
    links.push(`<link rel="apple-touch-startup-image" href="icons/splash/${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait) and (prefers-color-scheme: ${name})">`);
  }
  await b.close();
  console.log(links.join("\n"));
})();
