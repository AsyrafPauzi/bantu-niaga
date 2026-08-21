"use client";

interface MarketplaceModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

export function MarketplaceModal({ children, onClose }: MarketplaceModalProps) {
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-panel-dark"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
