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
let zaseden = false;

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
    if (st.length >= 3) kartica(st);
  } else if (e.key.length === 1 && /[0-9A-Za-z]/.test(e.key)) {
    medpomnilnik += e.key;
  }
  e.preventDefault();
});

async function kartica(st) {
  if (zaseden) return;
  zaseden = true;
  const t = izbrana;
  izberi(null);
  try {
    const r = await (
      await fetch("/api/zig", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ st_kartice: st, tipka: t ? t.tipka : null }) })
    ).json();
    potrdi(r, t, st);
  } catch {
    potrdi({ ok: false, napaka: "Program krmilnika ne odgovarja." }, t, st);
  } finally {
    zaseden = false;
  }
}

function potrdi(r, t, st) {
  const ura = new Date().toTimeString().slice(0, 5);
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
  } else {
    const prihod = r.smer !== "odhod";
    naslov = r.poslano ? (prihod ? `Dober dan${ime ? `, ${ime}` : ""}!` : `Nasvidenje${ime ? `, ${ime}` : ""}!`) : "Zabeleženo";
    opis = `${ura}${t ? ` · ${t.besedilo}` : r.poslano ? (prihod ? " · Prihod" : " · Odhod") : ""}${r.poslano ? "" : " - poslano bo, ko bo povezava"}`;
  }
  pisk(r.ok);
  const p = $("potrdilo");
  p.style.setProperty("--barva", barva);
  $("potrdilo-ikona").textContent = ikona;
  $("potrdilo-naslov").textContent = naslov;
  $("potrdilo-opis").textContent = opis || "";
  p.hidden = false;
  clearTimeout(potrdi.t);
  potrdi.t = setTimeout(() => (p.hidden = true), r.akcija === "info" ? POTRDILO_MS * 2 : POTRDILO_MS);
}
