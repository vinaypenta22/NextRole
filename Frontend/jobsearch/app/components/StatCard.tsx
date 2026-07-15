import { FileText, Briefcase, CheckCircle } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  tone?: "sky" | "emerald" | "violet";
};

export default function StatCard({ label, value, tone = "sky" }: StatCardProps) {
  // Map tone to colors and icons
  let colorClass = "from-blue-600 to-cyan-600";
  let Icon = FileText;

  if (tone === "emerald") {
    colorClass = "from-purple-600 to-pink-600";
    Icon = Briefcase;
  } else if (tone === "violet") {
    colorClass = "from-green-600 to-emerald-600";
    Icon = CheckCircle;
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 hover:border-slate-300 transition-all duration-300 shadow-sm shadow-purple-950/[0.01]">
      {/* Subtle hover background highlight */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-0 group-hover:opacity-[0.025] transition-opacity duration-300`} />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</h3>
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center text-white shadow-sm`}>
            <Icon size={20} />
          </div>
        </div>
        <p className="text-3xl font-black text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  );
}
