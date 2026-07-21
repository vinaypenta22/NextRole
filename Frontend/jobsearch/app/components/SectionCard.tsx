type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  noPadding?: boolean;
};

export default function SectionCard({
  title,
  description,
  children,
  action,
  icon,
  noPadding = false,
}: SectionCardProps) {
  return (
    <section className="tal-card rounded-[26px] shadow-xs hover:shadow-lg transition-all duration-300">


      <div className={`${noPadding ? "" : "p-5 md:p-6"}`}>
        {(title || action) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {icon && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--accent)]">
                  {icon}
                </span>
              )}
              <div className="space-y-0.5">
                <h3 className="text-[16px] font-bold tracking-tight text-[var(--fg)]">
                  {title}
                </h3>
                {description && (
                  <p className="text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
                    {description}
                  </p>
                )}
              </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
