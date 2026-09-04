import { redirect } from "next/navigation";

// Lista sarcinilor s-a mutat la /sarcini. Păstrăm /tasks ca redirect pentru
// linkuri și bookmark-uri vechi.
export default function TasksRedirect() {
  redirect("/sarcini");
}
