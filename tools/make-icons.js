// Erzeugt alle App-Icons aus icons/icon.svg (einzige Quelle).
// Aufruf im Projektordner: node tools/make-icons.js   (braucht Playwright mit Chromium)
// Danach in sw.js die CACHE-Version erhöhen und veröffentlichen.
const {chromium} = require("playwright");
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "icons");
const svg = fs.readFileSync(path.join(dir, "icon.svg"), "utf8");
// Maskierbares Icon (Android): Zeichen in die sichere Zone (80 %) verkleinern, Hintergrund bleibt randlos
const masked = svg.replace('<g id="mark">', '<g id="mark" transform="translate(51.2 51.2) scale(0.8)">');
const jobs = [["icon-512.png", 512, svg], ["icon-192.png", 192, svg], ["icon-180.png", 180, svg], ["icon-maskable-512.png", 512, masked]];
(async () => {
  const b = await chromium.launch();
  for (const [name, size, src] of jobs) {
    const p = await b.newPage({viewport: {width: size, height: size}});
    await p.setContent(`<body style="margin:0"><img style="display:block;width:${size}px;height:${size}px" src="data:image/svg+xml;base64,${Buffer.from(src).toString("base64")}">`);
    await p.screenshot({path: path.join(dir, name), omitBackground: false});
    await p.close();
    console.log("✓", name);
  }
  await b.close();
})();
