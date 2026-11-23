/**
 * Meritev animacij (standard: finos_stil.txt, razdelek 29). Odpre stran v nameščenem Edgeu, počaka 8 s (uvod) in
 * 15 s snema sled brskalnika v mirovanju (brez miške): koliko dela teče ves čas.
 *
 *   node scripts/animacije/meri.mjs prej  http://127.0.0.1:3000/
 *   node scripts/animacije/meri.mjs potem http://127.0.0.1:3011/      (tretji argument = pot za posnetek .jpg)
 *
 * Izpis: skripta (JavaScript), slog, risanje, raster (ploščice, ki se narišejo znova), kartica, sestavljanje.
 * Mirujoča stran naj ima risanje in raster blizu 0. SW=1 = brez grafične kartice (šibka naprava), MS=trajanje.
 * Primerjaj vedno dve gradnji (next build + next start) na istem računalniku, vsako vsaj dvakrat.
 */
import { chromium } from "playwright-core";
const [, , oznaka, url, slika] = process.argv;
const MS = Number(process.env.MS ?? 15000);
const b = await chromium.launch({ channel: "msedge", headless: true, args: process.env.SW === "1" ? ["--disable-gpu"] : [] });
const s = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const cdp = await s.context().newCDPSession(s);
await s.goto(url, { waitUntil: "networkidle" });
await s.waitForTimeout(8000); // uvodna animacija mine
if (slika) await s.screenshot({ path: slika, type: "jpeg", quality: 85 });
const dogodki = [];
cdp.on("Tracing.dataCollected", (e) => dogodki.push(...e.value));
const konec = new Promise((ok) => cdp.once("Tracing.tracingComplete", ok));
await cdp.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "cc", "viz", "gpu"] } });
await s.waitForTimeout(MS);
await cdp.send("Tracing.end");
await konec;
const v = new Map();
for (const e of dogodki) {
  if (e.ph !== "X" || !e.dur) continue;
  const x = v.get(e.name) ?? { ms: 0, n: 0 };
  x.ms += e.dur / 1000;
  x.n++;
  v.set(e.name, x);
}
const p = (ime) => {
  const x = v.get(ime);
  return x ? `${x.ms.toFixed(0)} ms/${x.n}x` : "0";
};
console.log(`${oznaka.padEnd(6)} skripta ${p("FunctionCall")} | slog ${p("UpdateLayoutTree")} | risanje ${p("Paint")} | raster ${p("RasterTask")} | kartica ${p("GPUTask")} | sestavljanje ${p("Display::DrawAndSwap")}`);
await b.close();
