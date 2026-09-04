"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { AUDIT_MODULES, type AuditModule } from "@/lib/audit-modules";
import { cn } from "@/lib/utils";

export function AuditTabs({ active }: { active: AuditModule }) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (value: AuditModule) => {
    const q = new URLSearchParams(params.toString());
    if (value === "toate") q.delete("modul");
    else q.set("modul", value);
    const qs = q.toString();
    // `scroll: false`: jurnalul stă în coloana din dreapta, iar saltul în capul
    // paginii la fiecare tab ar fi enervant.
    router.push(qs ? `/admin?${qs}` : "/admin", { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {AUDIT_MODULES.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => go(m.value)}
          aria-pressed={m.value === active}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
            m.value === active
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
