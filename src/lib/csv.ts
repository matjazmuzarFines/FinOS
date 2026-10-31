/**
 * CSV: branje (ločilo ; ali , se zazna samo, narekovaji, BOM) in pisanje za Excel (ločilo ;, UTF-8 z BOM).
 */
export type Csv = { glava: string[]; vrstice: string[][]; locilo: string };

/** Zazna ločilo po prvi vrstici (brez besedila v narekovajih): več ";" kot "," = ";". */
function zaznajLocilo(besedilo: string): string {
  const prva = besedilo.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, "");
  const stej = (z: string) => prva.split(z).length - 1;
  if (stej("\t") > stej(";") && stej("\t") > stej(",")) return "\t";
  return stej(";") >= stej(",") && stej(";") > 0 ? ";" : ",";
}

export function preberiCsv(vhod: string): Csv {
  const besedilo = vhod.replace(/^\uFEFF/, "");
  const locilo = zaznajLocilo(besedilo);
  const vrstice: string[][] = [];
  let vrstica: string[] = [];
  let celica = "";
  let vNarekovajih = false;
  for (let i = 0; i < besedilo.length; i++) {
    const z = besedilo[i];
    if (vNarekovajih) {
      if (z === '"' && besedilo[i + 1] === '"') {
        celica += '"';
        i++;
      } else if (z === '"') vNarekovajih = false;
      else celica += z;
    } else if (z === '"' && celica === "") vNarekovajih = true;
    else if (z === locilo) {
      vrstica.push(celica);
      celica = "";
    } else if (z === "\n" || z === "\r") {
      if (z === "\r" && besedilo[i + 1] === "\n") i++;
      vrstica.push(celica);
      vrstice.push(vrstica);
      vrstica = [];
      celica = "";
    } else celica += z;
  }
  if (celica !== "" || vrstica.length) {
    vrstica.push(celica);
    vrstice.push(vrstica);
  }
  // prazne vrstice (tudi samo ločila, kot jih pusti Excel) se prezrejo
  const polne = vrstice.filter((v) => v.some((c) => c.trim() !== ""));
  const [glava = [], ...ostale] = polne;
  return { glava: glava.map((g) => g.trim()), vrstice: ostale, locilo };
}

const celica = (v: string) => (/[";\n\r]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV za Excel (slovenske nastavitve: ločilo ;). */
export function zapisiCsv(glava: string[], vrstice: string[][]): string {
  return "\uFEFF" + [glava, ...vrstice].map((v) => v.map(celica).join(";")).join("\r\n") + "\r\n";
}

/** Prenese besedilo kot datoteko (ime samo ASCII). */
export function prenesi(ime: string, besedilo: string, tip = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([besedilo], { type: tip }));
  const a = document.createElement("a");
  a.href = url;
  a.download = ime;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
