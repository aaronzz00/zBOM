import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface FeatureDialogProps {
  title: string;
  closeLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const FeatureDialog: React.FC<FeatureDialogProps> = ({
  title,
  closeLabel = 'Close',
  onClose,
  children,
}) => {
  const titleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5 text-sm text-slate-700">
          {children}
        </div>
      </section>
    </div>
  );
};
