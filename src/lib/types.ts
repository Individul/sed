export type TaskStatus = "todo" | "in_progress" | "waiting" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type Role = "admin" | "member";

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: Role;
}
export interface Tag {
  id: string;
  name: string;
  color: string;
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  /** De când așteaptă răspuns extern; null în orice altă stare. */
  waiting_since: string | null;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  tags?: Tag[];
}
export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: Profile;
}
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
  done_at: string | null;
  created_at: string;
}
export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity:
    | "tasks"
    | "comments"
    | "tags"
    | "task_tags"
    | "profiles"
    | "subtasks"
    | "petitions"
    | "petition_attachments"
    | "hearings"
    | "transfer_plans"
    | "obligations"
    | "obligation_completions"
    | "defendants"
    | "releases"
    | "transfers";
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
export type NotificationType =
  | "assigned"
  | "comment"
  | "status"
  | "edited"
  | "deleted"
  | "created";
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  task_id: string | null;
  petition_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  message: string;
  read: boolean;
  created_at: string;
}
export type PetitionStatus = "in_examinare" | "solutionat";
export type PetitionerType = "detinut" | "avocat" | "civil";
export interface Petition {
  id: string;
  number: string;
  petitioner: string;
  petitioner_type: PetitionerType;
  subject: string | null;
  received_date: string;
  response_deadline: string | null;
  status: PetitionStatus;
  response: string | null;
  response_date: string | null;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  // Derivate din relația petition_attachments, nu o coloană. Lista le folosește
  // ca să deschidă scanarea direct, fără a mai trece prin dialogul petiției.
  attachments?: Pick<PetitionAttachment, "id" | "path" | "name" | "kind">[];
}
export interface PetitionAttachment {
  id: string;
  petition_id: string;
  kind: "petitie" | "raspuns";
  path: string;
  name: string;
  mime: string | null;
  size: number | null;
  uploaded_by: string | null;
  created_at: string;
}
export interface StatReport {
  id: string;
  /** Unul dintre `StatKind` (vezi lib/stats/types.ts); text în baza de date. */
  kind: string;
  period_date: string;
  period_type: "saptamanal" | "lunar";
  file_path: string | null;
  file_name: string | null;
  uploaded_by: string | null;
  created_at: string;
  // derivate
  values_count?: number;
}
export interface StatValue {
  id: string;
  report_id: string;
  indicator: string;
  series: "cumulat" | "perioada";
  value: number | null;
  position: number;
}
/**
 * Eliberările unei zile: ziua și câți. Atât.
 *
 * `release_date` e unic în bază — un singur rând pe zi — deci a doua
 * introducere pentru aceeași zi o corectează pe prima. Cifre, nu persoane.
 */
export interface Release {
  id: string;
  release_date: string;
  count: number;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
/**
 * Un transfer de deținuți: o zi + un penitenciar partener + planificat/urgent,
 * cu plecările și sosirile în același rând. Cifre, nu persoane.
 */
export interface Transfer {
  id: string;
  transfer_date: string;
  /** Numărul penitenciarului partener; eticheta se compune cu `institutionLabel`. */
  institution: number;
  kind: "planificat" | "urgent";
  plecati: number;
  sositi: number;
  /** Coloană generată în Postgres (`plecati + sositi`) — nu se scrie niciodată. */
  total: number;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
