/**
 * Majhen zapis Excel datoteke (.xlsx) brez zunanje knjižnice: zip (brez stiskanja) z XML deli delovnega zvezka.
 * Glava je temna s krepko belo pisavo, zamrznjena in s filtrom; DA = zelena celica, NE = rdeča (logične vrednosti).
 * Uporaba: prenesiXlsx("ime.xlsx", [{ ime: "List", glava: [...], vrstice: [[...]] }]).
 */
export type Celica = string | number | boolean | null | undefined;
export type List = { ime: string; glava: string[]; vrstice: Celica[][]; /** širine stolpcev (znaki) */ sirine?: number[]; /** zamrznjeni stolpci levo */ zamrzni?: number };

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const stolpec = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

// slogi: 0 navaden, 1 glava, 2 DA, 3 NE, 4 navaden z obrobo
const SLOGI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF006100"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF9C0006"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2B2B2F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFD0D0D4"/></left><right style="thin"><color rgb="FFD0D0D4"/></right><top style="thin"><color rgb="FFD0D0D4"/></top><bottom style="thin"><color rgb="FFD0D0D4"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function listXml(l: List) {
  const vrsta = (cel: Celica[], r: number, glava: boolean) =>
    `<row r="${r}"${glava ? ' ht="30" customHeight="1"' : ""}>${cel
      .map((v, i) => {
        const ref = `${stolpec(i)}${r}`;
        if (glava) return `<c r="${ref}" t="inlineStr" s="1"><is><t>${xml(String(v ?? ""))}</t></is></c>`;
        if (typeof v === "boolean") return `<c r="${ref}" t="inlineStr" s="${v ? 2 : 3}"><is><t>${v ? "DA" : "NE"}</t></is></c>`;
        if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="4"><v>${v}</v></c>`;
        if (v == null || v === "") return `<c r="${ref}" s="4"/>`;
        return `<c r="${ref}" t="inlineStr" s="4"><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
      })
      .join("")}</row>`;
  const zadnji = `${stolpec(Math.max(l.glava.length - 1, 0))}${l.vrstice.length + 1}`;
  const z = l.zamrzni ?? 0;
  const pane = `<pane ${z ? `xSplit="${z}" ` : ""}ySplit="1" topLeftCell="${stolpec(z)}2" activePane="${z ? "bottomRight" : "bottomLeft"}" state="frozen"/>`;
  const sirine = l.glava.map((g, i) => `<col min="${i + 1}" max="${i + 1}" width="${l.sirine?.[i] ?? Math.min(Math.max(g.length + 2, 10), 40)}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><cols>${sirine}</cols><sheetData>${vrsta(l.glava, 1, true)}${l.vrstice
    .map((v, i) => vrsta(v, i + 2, false))
    .join("")}</sheetData><autoFilter ref="A1:${zadnji}"/></worksheet>`;
}

// ---- zip (metoda 0 = brez stiskanja) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zip(datoteke: { ime: string; vsebina: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const deli: Uint8Array[] = [];
  const centralni: Uint8Array[] = [];
  let odmik = 0;
  for (const d of datoteke) {
    const ime = enc.encode(d.ime);
    const data = enc.encode(d.vsebina);
    const crc = crc32(data);
    const glava = new DataView(new ArrayBuffer(30));
    glava.setUint32(0, 0x04034b50, true);
    glava.setUint16(4, 20, true);
    glava.setUint16(6, 0x0800, true); // UTF-8 imena
    glava.setUint16(8, 0, true);
    glava.setUint32(14, crc, true);
    glava.setUint32(18, data.length, true);
    glava.setUint32(22, data.length, true);
    glava.setUint16(26, ime.length, true);
    deli.push(new Uint8Array(glava.buffer), ime, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, ime.length, true);
    c.setUint32(42, odmik, true);
    centralni.push(new Uint8Array(c.buffer), ime);
    odmik += 30 + ime.length + data.length;
  }
  const velikostC = centralni.reduce((v, b) => v + b.length, 0);
  const konec = new DataView(new ArrayBuffer(22));
  konec.setUint32(0, 0x06054b50, true);
  konec.setUint16(8, datoteke.length, true);
  konec.setUint16(10, datoteke.length, true);
  konec.setUint32(12, velikostC, true);
  konec.setUint32(16, odmik, true);
  const vse = [...deli, ...centralni, new Uint8Array(konec.buffer)];
  const out = new Uint8Array(vse.reduce((v, b) => v + b.length, 0));
  let p = 0;
  for (const b of vse) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

/** Ustvari .xlsx (listi) in ga prenese v brskalniku. */
export function prenesiXlsx(imeDatoteke: string, listi: List[]) {
  const imena = listi.map((l, i) => xml(l.ime.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `List${i + 1}`));
  const datoteke = [
    {
      ime: "[Content_Types].xml",
      vsebina: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${listi
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    },
    {
      ime: "_rels/.rels",
      vsebina: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      ime: "xl/workbook.xml",
      vsebina: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${imena
        .map((ime, i) => `<sheet name="${ime}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets><definedNames>${listi
        .map((l, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${imena[i].replace(/'/g, "''")}'!$A$1:$${stolpec(Math.max(l.glava.length - 1, 0))}$${l.vrstice.length + 1}</definedName>`)
        .join("")}</definedNames></workbook>`,
    },
    {
      ime: "xl/_rels/workbook.xml.rels",
      vsebina: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${listi
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${listi.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { ime: "xl/styles.xml", vsebina: SLOGI },
    ...listi.map((l, i) => ({ ime: `xl/worksheets/sheet${i + 1}.xml`, vsebina: listXml(l) })),
  ];
  const blob = new Blob([zip(datoteke) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = imeDatoteke;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
