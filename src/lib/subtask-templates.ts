// Șabloane de pași pentru etichetele-categorie. Cheile sunt normalizate
// (litere mici, fără diacritice) ca să se potrivească indiferent de scriere.

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const DEMERS = ["Demers întocmit", "Demers expediat la instanță", "Demers examinat de instanță"];

const TEMPLATES: Record<string, string[]> = {
  cumulare: DEMERS,
  "arest preventiv": DEMERS,
  neclaritati: DEMERS,
  "erori materiale": DEMERS,
  "solicitare hotariri": ["Solicitare întocmită", "Solicitare expediată", "Hotărâre primită"],
  // Același drum ca la solicitarea de hotărâri; se schimbă doar actul așteptat.
  "dispozitie de executare": [
    "Solicitare întocmită",
    "Solicitare expediată",
    "Dispoziție de executare primită",
  ],
};

// Un pas de „expediere" (demers/solicitare expediat/ă) — de la bifarea lui
// sarcina depinde de instanță, nu de responsabil, deci trece „în așteptare".
export function isDispatchStep(title: string): boolean {
  return norm(title).includes("expediat");
}

// Pasul prin care răspunsul a sosit — „Demers examinat de instanță",
// „Hotărâre primită". Bifarea lui închide sarcina: nu mai e nimic de așteptat.
export function isResponseStep(title: string): boolean {
  const t = norm(title);
  return t.includes("examinat") || t.includes("primit");
}

// Pașii standard (fără duplicate) pentru un set de nume de etichete.
export function templateStepsForTags(tagNames: string[]): string[] {
  const steps: string[] = [];
  for (const name of tagNames) {
    const t = TEMPLATES[norm(name)];
    if (t) for (const s of t) if (!steps.includes(s)) steps.push(s);
  }
  return steps;
}
