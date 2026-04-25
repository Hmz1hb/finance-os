import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "income" | "risk" | "deadline" | "plan";
  icon?: ReactNode;
}) {
  const tones = {
    neutral: "border-ledger-border",
    income: "border-green-income/30",
    risk: "border-red-risk/30",
    deadline: "border-orange-deadline/30",
    plan: "border-purple-plan/30",
  };
  return (
    <Card className={cn("min-h-28", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-ledger">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
          {detail ? <p className="mt-2 text-xs text-muted-ledger">{detail}</p> : null}
        </div>
        {icon ? <div className="rounded-md bg-white/[0.04] p-2 text-muted-ledger">{icon}</div> : null}
      </div>
    </Card>
  );
}
