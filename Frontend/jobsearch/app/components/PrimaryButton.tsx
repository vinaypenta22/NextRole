type PrimaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  isLoading?: boolean;
  className?: string;
  variant?: "amber" | "outline" | "dark";
};

export default function PrimaryButton({
  children,
  onClick,
  type = "button",
  isLoading = false,
  className = "",
  variant = "amber",
}: PrimaryButtonProps) {
  const base =
    "cursor-pointer inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";

  const styles: Record<string, string> = {
    amber:
      "text-white bg-gradient-to-r from-[#0052cc] to-[#1e5fff] hover:opacity-95 shadow-[0_8px_24px_rgba(0,82,204,0.20)] hover:shadow-[0_12px_30px_rgba(0,82,204,0.30)]",
    outline:
      "border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-hover)]",
    dark:
      "bg-[#0f172a] text-white hover:bg-[#1e293b] dark:bg-white dark:text-[#0f172a]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isLoading}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {isLoading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          <span>Working...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
