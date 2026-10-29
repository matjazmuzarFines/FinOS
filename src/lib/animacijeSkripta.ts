/** Ključa v localStorage za nastavitve brskalnika (glej nastavitev.ts). */
export const ANIMACIJE_KLJUC = "fos-animacije";
export const TEMA_KLJUC = "fos-tema";

/**
 * Skripta za <head>: nastavi atributa <html> pred prvim izrisom
 * (brez utripa uvoda, ko so animacije izklopljene, in brez utripa temne teme v svetli).
 */
export const ANIMACIJE_SKRIPTA = `try{var d=document.documentElement;if(localStorage.getItem("${ANIMACIJE_KLJUC}")==="off")d.dataset.animacije="off";if(localStorage.getItem("${TEMA_KLJUC}")==="svetla")d.dataset.tema="svetla"}catch(e){}`;
