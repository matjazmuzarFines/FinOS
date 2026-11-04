/**
 * Promo video "Moj Fines" (42 s, 1920 × 1080, 30 sl./s) - posnetek strani /promo sličico za sličico in sestava z glasbo.
 *
 *   1. npm run build && npx next start -p 3010        (aplikacija mora teči)
 *   2. node scripts/promo/posnemi.mjs                  -> promo-izvoz/MojFines_teaser.mp4
 *
 * Možnosti (spremenljivke okolja):
 *   CASI=2000,7500     samo posnetki teh trenutkov (ms) v promo-izvoz/vzorci - za hiter pregled
 *   URL=...            naslov strani (privzeto http://127.0.0.1:3010/promo?render=1)
 * Brskalnik: nameščen Microsoft Edge (playwright-core, brez prenosa brskalnika). Ura v brskalniku je "zamrznjena" in
 * se premika samo za 1/30 s na sličico - vsaka sličica je natančna. Glasba: data/*.mp3 (rez na udarcu, glej REZ / ZAMIK spodaj),
 * ffmpeg mora biti v PATH.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const URL = process.env.URL ?? "http://127.0.0.1:3010/promo?render=1";
const FPS = 30;
const TRAJANJE = 42_000;
const IZVOZ = "promo-izvoz";
const SLICICE = join(IZVOZ, "slicice");
const CASI = process.env.CASI?.split(",").map(Number);
const ZACETEK = new Date("2026-11-05T06:27:34");

mkdirSync(IZVOZ, { recursive: true });
const brskalnik = await chromium.launch({ channel: "msedge", headless: true });
const stran = await brskalnik.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
stran.on("pageerror", (e) => console.log("napaka strani:", e.message));
await stran.clock.install({ time: new Date(ZACETEK.getTime() - 15_000) });
await stran.goto(URL, { waitUntil: "networkidle" });
await stran.waitForFunction(() => typeof window.__promo === "function");
await stran.evaluate(() => document.fonts.ready);
await stran.clock.pauseAt(ZACETEK);

const sl = CASI ?? Array.from({ length: (TRAJANJE / 1000) * FPS }, (_, i) => Math.round((i * 1000) / FPS));
const mapa = CASI ? join(IZVOZ, "vzorci") : SLICICE;
rmSync(mapa, { recursive: true, force: true });
mkdirSync(mapa, { recursive: true });

let ura = 0;
const zacetek = Date.now();
for (let i = 0; i < sl.length; i++) {
  const t = sl[i];
  if (t > ura) {
    await stran.clock.runFor(t - ura);
    ura = t;
  }
  await stran.evaluate((x) => window.__promo(x), t);
  await stran.screenshot({ path: join(mapa, CASI ? `t${String(t).padStart(5, "0")}.png` : `${String(i).padStart(5, "0")}.jpg`), type: CASI ? "png" : "jpeg", ...(CASI ? {} : { quality: 93 }) });
  if (!CASI && i % 90 === 0) console.log(`${(t / 1000).toFixed(1)} s / 42 s  (${Math.round((Date.now() - zacetek) / 1000)} s)`);
}
await brskalnik.close();
if (CASI) {
  console.log("vzorci:", readdirSync(mapa).join(", "));
  process.exit(0);
}

const glasba = readdirSync("data").find((f) => f.toLowerCase().endsWith(".mp3"));
const izhod = join(IZVOZ, "MojFines_teaser.mp4");
// Glasba: tempo 75 udarcev/min (udarec 0,8001 s, takt 3,2 s). Konec skladbe je zamaknjen za CELIH 9 taktov (36 udarcev =
// 28,804 s), da se ritem in harmonija nadaljujeta; rez je NA UDARCU pri 24,188 s (tik pred prizorom Delovna ura), kjer sta
// oba dela najbolj podobna; spoj 30 ms (brez poka). Močan udarec pri 38,1 s = začetek špice, zadnji udarec 38,9 s.
const REZ = 24.188;
const ZAMIK = 28.804;
const SPOJ = 0.03;
const zvok =
  `[1:a]atrim=0:${(REZ + SPOJ / 2).toFixed(3)},asetpts=PTS-STARTPTS[a];[1:a]atrim=${(REZ + ZAMIK - SPOJ / 2).toFixed(3)}:${(42 + ZAMIK).toFixed(3)},asetpts=PTS-STARTPTS[b];` +
  `[a][b]acrossfade=d=${SPOJ}:c1=tri:c2=tri[m];[m]afade=t=in:st=0:d=0.25,afade=t=out:st=41.2:d=0.8,atrim=0:42[zvok]`;
const r = spawnSync(
  "ffmpeg",
  ["-y", "-framerate", String(FPS), "-i", join(SLICICE, "%05d.jpg"), "-i", join("data", glasba), "-filter_complex", zvok, "-map", "0:v", "-map", "[zvok]",
    "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", "42", izhod],
  { stdio: "inherit" },
);
console.log(r.status === 0 ? `Video: ${izhod}` : "ffmpeg ni uspel");
