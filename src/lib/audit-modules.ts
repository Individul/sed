import type { AuditEntry } from "./types";

export type AuditModule =
  | "toate"
  | "sarcini"
  | "petitii"
  | "sedinte"
  | "transferuri"
  | "informari"
  | "inculpati"
  | "eliberari"
  | "utilizatori";

/**
 * Ce entități din jurnal aparțin fiecărui modul.
 *
 * Filtrarea se face în interogare, nu peste intrările deja aduse: jurnalul se
 * citește în ultimele N acțiuni, iar filtrarea în pagină ar face ca un modul
 * puțin activ să pară gol doar pentru că altul a fost aglomerat.
 */
export const AUDIT_MODULES: {
  value: AuditModule;
  label: string;
  entities: AuditEntry["entity"][];
}[] = [
  { value: "toate", label: "Toate", entities: [] },
  {
    value: "sarcini",
    label: "Sarcini",
    entities: ["tasks", "subtasks", "comments", "tags", "task_tags"],
  },
  { value: "petitii", label: "Petiții", entities: ["petitions", "petition_attachments"] },
  { value: "sedinte", label: "Ședințe", entities: ["hearings"] },
  { value: "transferuri", label: "Transferuri", entities: ["transfers", "transfer_plans"] },
  {
    value: "informari",
    label: "Informări",
    entities: ["obligations", "obligation_completions"],
  },
  { value: "inculpati", label: "Inculpați", entities: ["defendants"] },
  // Modul propriu, nu la „Ședințe": o eliberare nu e o ședință de judecată, iar
  // pusă acolo ar umple filtrul ședințelor cu intrări care n-au legătură cu ele.
  // Un registru de sine stătător își ține tabul lui — ca „Inculpați".
  { value: "eliberari", label: "Eliberări", entities: ["releases"] },
  { value: "utilizatori", label: "Utilizatori", entities: ["profiles"] },
];

export function readAuditModule(value: string | undefined): AuditModule {
  return AUDIT_MODULES.some((m) => m.value === value) ? (value as AuditModule) : "toate";
}

/** Entitățile de interogat; listă goală înseamnă „fără filtru". */
export function entitiesFor(module: AuditModule): AuditEntry["entity"][] {
  return AUDIT_MODULES.find((m) => m.value === module)?.entities ?? [];
}
