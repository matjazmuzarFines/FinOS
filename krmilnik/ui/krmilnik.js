/*
 * FIN:OS krmilnik - zaslon. Potek kot na starem krmilniku:
 *   prisloni kartico           -> žig brez tipke (prihod / odhod - smer določi FIN:OS)
 *   pritisni tipko, nato kartico -> žig s tipko (npr. Odmor); tipka velja 10 s, ponoven pritisk jo prekliče
 *   Info + kartica             -> današnji žigi;  Prekliči + kartica -> prekliče zadnji žig (5 min)
 * Čitalec kartic = USB tipkovnica: "natipka" številko in Enter. Brez povezave se žig shrani in pošlje kasneje.
 */
const $ = (id) => document.getElementById(id);
const DNEVI = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];
const VELJA_TIPKA_MS = 10000;
const POTRDILO_MS = 3500;

let tipke = [];
let izbrana = null; // tipka (objekt) ali null
let izbranaDo = 0;
let medpomnilnik = "";
let zadnjiZnak = 0;
let prviZnak = 0; // čas prvega znaka kartice - koliko časa čitalec "tipka" številko (dnevnik krmilnika)

// ---- ura ----
function ura() {
  const d = new Date();
  const dv = (n) => String(n).padStart(2, "0");
  $("ure").textContent = dv(d.getHours());
  $("minute").textContent = dv(d.getMinutes());
  $("sekunde").textContent = dv(d.getSeconds());
  $("datum").textContent = `${DNEVI[d.getDay()]}, ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  if (izbrana && Date.now() > izbranaDo) izberi(null);
}
setInterval(ura, 1000);
ura();

// ---- zvok ----
let zvok;
function pisk(ok) {
  try {
    zvok ??= new AudioContext();
    const o = zvok.createOscillator();
    const g = zvok.createGain();
    o.frequency.value = ok ? 1320 : 330;
    g.gain.setValueAtTime(0.25, zvok.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, zvok.currentTime + (ok ? 0.18 : 0.5));
    o.connect(g).connect(zvok.destination);
    o.start();
    o.stop(zvok.currentTime + (ok ? 0.2 : 0.5));
  } catch {}
}

// ---- stanje in tipke ----
async function stanje() {
  try {
    const s = await (await fetch("/api/stanje", { cache: "no-store" })).json();
    $("naprava").textContent = s.naprava?.ime ?? "";
    const z = $("zveza");
    z.className = "zveza " + (s.na_zvezi ? "ok" : "ne");
    z.querySelector("span").textContent = s.na_zvezi ? (s.cakajo ? `Pošiljam (${s.cakajo})` : "Na zvezi") : `Brez povezave${s.cakajo ? ` · čaka ${s.cakajo}` : ""}`;
    if (JSON.stringify(s.tipke) !== JSON.stringify(tipke)) {
      tipke = s.tipke ?? [];
      narisiTipke();
    }
  } catch {
    $("zveza").className = "zveza ne";
    $("zveza").querySelector("span").textContent = "Program krmilnika se zaganja ...";
  }
}
setInterval(stanje, 5000);
stanje();

const IKONE = { info: "i", preklici: "↶" };
function narisiTipke() {
  const el = $("tipke");
  el.innerHTML = "";
  for (const t of tipke) {
    const b = document.createElement("button");
    b.className = "tipka";
    b.innerHTML = `<span class="st"></span><span class="ime"></span>`;
    b.querySelector(".st").textContent = IKONE[t.funkcija] ?? t.tipka;
    b.querySelector(".ime").textContent = t.besedilo;
    b.addEventListener("click", () => izberi(izbrana?.tipka === t.tipka ? null : t));
    b.dataset.tipka = t.tipka;
    el.appendChild(b);
  }
}

function izberi(t) {
  izbrana = t;
  izbranaDo = Date.now() + VELJA_TIPKA_MS;
  document.querySelectorAll(".tipka").forEach((b) => b.classList.toggle("izbrana", t != null && Number(b.dataset.tipka) === t.tipka));
  $("sporocilo").classList.toggle("izbrana", !!t);
  $("sporocilo-besedilo").textContent = t ? `${t.besedilo} - prisloni kartico` : "Prisloni kartico";
}

// ---- čitalec kartic (USB tipkovnica) ----
document.addEventListener("keydown", (e) => {
  const zdaj = Date.now();
  if (zdaj - zadnjiZnak > 400) medpomnilnik = ""; // človek ne tipka tako hitro - star vnos se zavrže
  zadnjiZnak = zdaj;
  if (e.key === "Enter") {
    const st = medpomnilnik.trim();
    medpomnilnik = "";
    if (st.length >= 3) kartica(st, zdaj - prviZnak);
  } else if (e.key.length === 1 && /[0-9A-Za-z]/.test(e.key)) {
    if (!medpomnilnik) prviZnak = zdaj;
    medpomnilnik += e.key;
  }
  e.preventDefault();
});

// Kartice gredo po vrsti (nobena se ne zavrže, tudi ko več ljudi štemplja zapored). Navaden žig program krmilnika
// shrani in TAKOJ vrne -> potrdilo "Zabeleženo"; ime / opozorilo dopiše, ko odgovori FIN:OS (/api/rezultat).
let vrsta = Promise.resolve();
let prikazan = null; // lokalni_id žiga, katerega potrdilo je zdaj na zaslonu (null = skrito)
let zadnjiZig = null; // lokalni_id zadnjega žiga (novejši žig ustavi čakanje starejšega)
const POCASI_MS = 3000; // brez odgovora do takrat: "poslano bo, ko bo povezava"
const CAKAJ_ODGOVOR_MS = 15000; // do takrat še pokaže težavo (neznana kartica, napaka)

function kartica(st, citalecMs) {
  const t = izbrana;
  izberi(null);
  vrsta = vrsta.then(() => obdelaj(st, t, citalecMs)).catch(() => {}); // napaka ene kartice ne ustavi naslednjih
}

// ---- varnostna vrsta zaslona ----
// Navaden žig gre NAJPREJ v localStorage, šele nato programu krmilnika. Če program ne odgovori (ponovni zagon po
// napaki, zrušitev), žig ostane v vrsti in ga zaslon pošilja znova (isti lokalni_id + čas prislona - nič se ne
// podvoji); odstrani se šele, ko ga je program zapisal na kartico SD. Info / Prekliči ne gresta v vrsto.
const VRSTA_KLJUC = "fos_krmilnik_vrsta";
const beriVrsto = () => {
  try {
    return JSON.parse(localStorage.getItem(VRSTA_KLJUC) || "[]");
  } catch {
    return [];
  }
};
const pisiVrsto = (v) => {
  try {
    localStorage.setItem(VRSTA_KLJUC, JSON.stringify(v));
  } catch {}
};
const novId = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(""));

async function posljiProgramu(z) {
  const r = await (
    await fetch("/api/zig", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...z, zamik_ms: Date.now() - new Date(z.cas).getTime() }),
    })
  ).json();
  if (r.takoj) pisiVrsto(beriVrsto().filter((x) => x.lokalni_id !== z.lokalni_id)); // na kartici SD - iz vrste zaslona
  return r;
}

// zaostali žigi (program ni odgovoril / zaslon se je znova naložil) - vsake 3 s, po vrsti s karticami
setInterval(() => {
  if (!beriVrsto().length) return;
  vrsta = vrsta
    .then(async () => {
      for (const z of beriVrsto()) await posljiProgramu(z);
    })
    .catch(() => {});
}, 3000);

async function obdelaj(st, t, citalecMs) {
  const ura = new Date().toTimeString().slice(0, 5);
  const navaden = !t || !["info", "preklici"].includes(t.funkcija);
  const z = { lokalni_id: novId(), cas: new Date().toISOString(), st_kartice: st, tipka: t ? t.tipka : null, citalec_ms: citalecMs };
  if (navaden) pisiVrsto([...beriVrsto(), z]);
  let r;
  try {
    r = navaden
      ? await posljiProgramu(z)
      : await (await fetch("/api/zig", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(z) })).json();
  } catch {
    // program ne odgovarja: navaden žig je varen v vrsti zaslona
    r = navaden ? { ok: true, akcija: "zig", poslano: false, vrstaZaslona: true } : { ok: false, napaka: "Program krmilnika ne odgovarja." };
  }
  zadnjiZig = r.takoj ? r.lokalni_id : null;
  potrdi(r, t, st, ura, true);
  prikazan = zadnjiZig; // po potrdi(): ta nastavi skrivanje, ki ga počisti
  if (r.takoj) pocakajOdgovor(r.lokalni_id, t, st, ura, r.na_zvezi); // v ozadju - naslednja kartica ne čaka
}

/**
 * Čaka odgovor FIN:OS za žig: če je potrdilo še na zaslonu, ga zamenja (pozdrav / opozorilo); če je že skrito, ga
 * odpre znova SAMO ob težavi (neznana kartica, napaka). Novejši žig čakanje ustavi.
 */
async function pocakajOdgovor(lid, t, st, ura, naZvezi) {
  const zacetek = Date.now();
  let pocasi = !naZvezi; // brez povezave je "poslano bo ..." že izpisano
  while (Date.now() - zacetek < CAKAJ_ODGOVOR_MS) {
    await new Promise((res) => setTimeout(res, naZvezi ? 150 : 500));
    if (zadnjiZig !== lid) return;
    if (!pocasi && Date.now() - zacetek > POCASI_MS) {
      pocasi = true;
      if (prikazan === lid) potrdi({ ok: true, akcija: "zig", poslano: false }, t, st, ura, false, true);
    }
    let r;
    try {
      r = await (await fetch(`/api/rezultat?id=${encodeURIComponent(lid)}`, { cache: "no-store" })).json();
    } catch {
      continue;
    }
    if (zadnjiZig !== lid || r.stanje !== "koncano") continue;
    const tezava = !r.ok || r.znana === false;
    if (prikazan === lid) potrdi(r, t, st, ura, tezava, true); // pisk samo ob težavi (prvi je bil ob prislonu)
    else if (tezava) {
      potrdi(r, t, st, ura, true);
      prikazan = lid;
    }
    return;
  }
}

// ---- Finesek v kotu potrdila ----
// maha = prihod, malica = tipka z "malica" v besedilu (sedi in je), odhod = pomaha in odide. Hrana naključno.
const HRANA = ["burger", "pica", "sendvic"]; // finesek/hrana-*.svg (enake datoteke v public/finesek za predogled)
const MALICA = /malic|kosil|obrok|hran|jest/i;
const fz = $("finesek");
function fineskovPrizor(prizor) {
  const kartica = $("potrdilo-kartica");
  fz.className = "fz";
  if (!prizor) {
    fz.hidden = true;
    kartica.classList.remove("s-fineskom");
    return;
  }
  const h = Math.min(innerWidth, innerHeight) * 0.3;
  const s = h / 750;
  fz.style.width = `${640 * s}px`;
  fz.style.height = `${h}px`;
  fz.style.setProperty("--s", String(s));
  kartica.style.setProperty("--fz-w", `${640 * s + 8}px`);
  if (prizor === "malica") {
    $("finesek-hrana").innerHTML = `<img src="finesek/hrana-${HRANA[Math.floor(Math.random() * HRANA.length)]}.svg" alt="" />`;
  }
  fz.hidden = false;
  kartica.classList.add("s-fineskom");
  void fz.offsetWidth; // animacija se začne znova
  fz.classList.add(`fz--${prizor}`);
}
function prizorZiga(r, t) {
  if (!r.ok || r.akcija !== "zig" || !r.poslano || r.znana === false) return null;
  if (t && MALICA.test(t.besedilo || "")) return "malica";
  return r.smer === "odhod" ? "odhod" : "maha";
}

function potrdi(r, t, st, ura, zPiskom, posodobitev = false) {
  const ime = r.ime ? `${r.ime}` : "";
  let barva = "var(--ok)";
  let ikona = "✓";
  let naslov;
  let opis;
  const seznam = $("potrdilo-seznam");
  seznam.innerHTML = "";

  if (!r.ok) {
    barva = "var(--nok)";
    ikona = "✕";
    naslov = r.napaka || "Napaka";
    opis = ime ? `${ime} - poskusi znova` : "Poskusi znova";
  } else if (r.akcija === "info") {
    ikona = "i";
    barva = "#60a5fa";
    naslov = ime || "Današnji žigi";
    opis = r.zigi?.length ? "Današnji žigi:" : "Danes še ni žigov.";
    for (const z of r.zigi ?? []) {
      const li = document.createElement("li");
      li.textContent = `${z.cas}${z.tipka ? ` · ${z.tipka}` : ""}`;
      seznam.appendChild(li);
    }
  } else if (r.akcija === "preklic") {
    ikona = "↶";
    barva = "var(--warn)";
    naslov = "Zadnji žig je preklican";
    opis = ime;
  } else if (r.poslano && r.znana === false) {
    barva = "var(--warn)";
    ikona = "!";
    naslov = "Kartica ni dodeljena";
    opis = `Žig ${ura} je shranjen (kartica ${st}). Javi kadrovski službi.`;
  } else if (r.vrstaZaslona) {
    naslov = "Zabeleženo";
    opis = `${ura}${t ? ` · ${t.besedilo}` : ""} - shranjeno, poslano bo v trenutku`;
  } else if (r.takoj) {
    // takoj po prislonu: shranjeno na krmilniku, odgovor FIN:OS pride v trenutku
    naslov = "Zabeleženo";
    opis = `${ura}${t ? ` · ${t.besedilo}` : ""}${r.na_zvezi ? "" : " - poslano bo, ko bo povezava"}`;
  } else {
    const prihod = r.smer !== "odhod";
    const malica = t && MALICA.test(t.besedilo || "");
    naslov = r.poslano ? (malica ? `Dober tek${ime ? `, ${ime}` : ""}!` : prihod ? `Dober dan${ime ? `, ${ime}` : ""}!` : `Nasvidenje${ime ? `, ${ime}` : ""}!`) : "Zabeleženo";
    opis = `${ura}${t ? ` · ${t.besedilo}` : r.poslano ? (prihod ? " · Prihod" : " · Odhod") : ""}${r.poslano ? "" : " - poslano bo, ko bo povezava"}`;
  }
  if (zPiskom) pisk(r.ok && r.znana !== false);
  fineskovPrizor(prizorZiga(r, t));
  const p = $("potrdilo");
  p.style.setProperty("--barva", barva);
  $("potrdilo-ikona").textContent = ikona;
  $("potrdilo-naslov").textContent = naslov;
  $("potrdilo-opis").textContent = opis || "";
  p.hidden = false;
  clearTimeout(potrdi.t);
  // posodobitev istega potrdila (odgovor FIN:OS) ga ne podaljša na novo - ostane vsaj še 2,5 s
  const trajanje = posodobitev ? Math.max((potrdi.konec ?? 0) - Date.now(), 2500) : r.akcija === "info" ? POTRDILO_MS * 2 : POTRDILO_MS;
  potrdi.konec = Date.now() + trajanje;
  potrdi.t = setTimeout(() => {
    p.hidden = true;
    prikazan = null;
  }, trajanje);
}
