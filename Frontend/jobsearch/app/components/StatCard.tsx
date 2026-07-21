import { FileText, Briefcase, CheckCircle } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  tone?: "sky" | "emerald" | "violet";
};

export default function StatCard({ label, value, tone = "sky" }: StatCardProps) {
  let colorClass = "from-[#4f46e5] to-[#7c3aed]";
  let Icon = FileText;

  if (tone === "emerald") {
    colorClass = "from-[#0f766e] to-[#14b8a6]";
    Icon = Briefcase;
  } else if (tone === "violet") {
    colorClass = "from-[#5b5cf4] to-[#8b5cf6]";
    Icon = CheckCircle;
  }

  return (
    <div className="group relative overflow-hidden tal-card rounded-[28px] p-6 transition-all duration-300 hover:-translate-y-0.5">
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.045]`} />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{label}</h3>
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${colorClass} text-white shadow-[0_12px_20px_rgba(79,70,229,0.25)]`}>
            <Icon size={20} />
          </div>
        </div>
        <p className="text-3xl font-black leading-none text-[var(--fg)]">{value}</p>
      </div>
    </div>
  );
}
