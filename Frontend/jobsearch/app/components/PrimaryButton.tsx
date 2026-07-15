type PrimaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  isLoading?: boolean;
  className?: string;
};

export default function PrimaryButton({
  children,
  onClick,
  type = "button",
  isLoading = false,
  className = "",
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] px-5 py-3 text-sm font-bold text-white shadow-md shadow-purple-500/10 transition duration-150 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
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
