import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1, "Titlul e obligatoriu.").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  status: z.enum(["todo", "in_progress", "waiting", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  due_date: z.string().optional().or(z.literal("")), // ISO date string yyyy-mm-dd or ""
  assignee_id: z.string().uuid().optional().or(z.literal("")),
});

export type TaskInput = z.infer<typeof taskSchema>;
