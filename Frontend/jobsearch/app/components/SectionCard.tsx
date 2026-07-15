type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export default function SectionCard({
  title,
  description,
  children,
  action,
}: SectionCardProps) {
  return (
    <section className="rounded-[24px] border border-[#e6ebf5] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:p-7">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[#1f2430]">{title}</h3>
          {description ? <p className="text-[13px] leading-relaxed text-[#667085]">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
