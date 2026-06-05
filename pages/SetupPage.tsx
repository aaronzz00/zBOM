import React from 'react';
import { CheckCircle2, ClipboardList } from 'lucide-react';

interface SetupPageProps {
  title: string;
  eyebrow: string;
  description: string;
  checklistTitle: string;
  items: string[];
}

export const SetupPage: React.FC<SetupPageProps> = ({
  title,
  eyebrow,
  description,
  checklistTitle,
  items,
}) => (
  <div className="flex-1 overflow-auto bg-slate-50">
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
          <ClipboardList className="h-4 w-4" />
          {eyebrow}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">{checklistTitle}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-slate-700">{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
);
