import React, { useEffect, useMemo, useState } from 'react';
import { GitBranch, Layers3, Lock, ShieldCheck } from 'lucide-react';
import { BOMTable } from '../components/BOMTable';
import type { EBOMBase, InheritanceState } from '../domain/ebomArchitectureTypes';
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';
import type { BOMNode } from '../types';
import { getInheritanceChain, resolveEBOMBase } from '../utils/ebomInheritance';
import { toLegacyBOMNode } from '../utils/legacyBomAdapter';

const stateStyles: Record<InheritanceState, string> = {
  inherited: 'border-blue-200 bg-blue-50 text-blue-700',
  overridden: 'border-amber-200 bg-amber-50 text-amber-700',
  local: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  locked: 'border-slate-300 bg-slate-100 text-slate-700',
};

const statusStyles: Record<EBOMBase['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  review: 'bg-amber-50 text-amber-700',
  released: 'bg-emerald-50 text-emerald-700',
};

export const EBOMArchitectureWorkspace: React.FC = () => {
  const {
    bases,
    items,
    selectedBaseId,
    status,
    error,
    load,
    selectBase,
    getSelectedBase,
    getDraftOperations,
    isDirty,
  } = useEBOMArchitectureStore();
  const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'idle') {
      void load();
    }
  }, [load, status]);

  const selectedBase = getSelectedBase();
  const draftOperations = getDraftOperations();
  const dirty = isDirty();

  const {
    inheritanceChain,
    resolvedItems,
    resolutionError,
  } = useMemo(() => {
    if (!selectedBase) {
      return {
        inheritanceChain: [],
        resolvedItems: [],
        resolutionError: null,
      };
    }

    try {
      return {
        inheritanceChain: getInheritanceChain(selectedBase.id, bases),
        resolvedItems: resolveEBOMBase(selectedBase.id, bases, items),
        resolutionError: null,
      };
    } catch {
      return {
        inheritanceChain: [],
        resolvedItems: [],
        resolutionError: 'Unable to resolve EBOM items.',
      };
    }
  }, [bases, items, selectedBase]);

  const {
    legacyPreviewRoot,
    previewError,
  } = useMemo<{ legacyPreviewRoot: BOMNode | null; previewError: string | null }>(() => {
    if (!selectedBase || resolutionError) {
      return { legacyPreviewRoot: null, previewError: null };
    }

    try {
      return {
        legacyPreviewRoot: toLegacyBOMNode(resolvedItems, selectedBase.rootItemId),
        previewError: null,
      };
    } catch {
      return {
        legacyPreviewRoot: null,
        previewError: 'Unable to build legacy BOM preview for this EBOM base.',
      };
    }
  }, [resolutionError, resolvedItems, selectedBase]);

  if ((status === 'idle' || status === 'loading') && bases.length === 0) {
    return (
      <div className="flex-1 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
        Loading EBOM architecture...
      </div>
    );
  }

  if (status === 'error' && bases.length === 0) {
    return (
      <div className="flex-1 bg-slate-50 p-6">
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error ?? 'Unable to load EBOM architecture.'}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-950 p-6 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-cyan-200">
                  <GitBranch className="h-4 w-4" />
                  EBOM Architecture Workspace
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Inheritance-first EBOM Review</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Inspect platform, series, and structure bases without editing the legacy BOM tree.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <label htmlFor="ebom-base-select" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                  EBOM Base
                </label>
                <select
                  id="ebom-base-select"
                  value={selectedBaseId}
                  onChange={(event) => selectBase(event.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm font-semibold text-white focus:border-cyan-300 focus:outline-none"
                >
                  {bases.map((base) => (
                    <option key={base.id} value={base.id}>
                      {base.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {selectedBase && (
          <section className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Scope</div>
              <div className="mt-2 text-2xl font-bold capitalize text-slate-900">{selectedBase.scope}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Revision</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{selectedBase.revision}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</div>
              <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${statusStyles[selectedBase.status]}`}>
                {selectedBase.status}
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Resolved Items</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{resolvedItems.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Draft Status</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {dirty ? `${draftOperations.length} pending` : 'Clean'}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Inheritance Chain</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {inheritanceChain.map((base, index) => (
              <div key={base.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Level {index + 1} · {base.scope}
                </div>
                <div className="font-semibold text-slate-900">{base.id}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">Rev {base.revision}</span>
                  <span className={`rounded-full px-2.5 py-1 uppercase ${statusStyles[base.status]}`}>{base.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Resolved EBOM Items</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Items are resolved through inheritance and shown read-only with their architecture state.
            </p>
          </div>
          {resolutionError && (
            <div role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {resolutionError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Part Number</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Qty</th>
                  <th className="px-5 py-3">Revision</th>
                  <th className="px-5 py-3">State</th>
                  <th className="px-5 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolvedItems.map((item) => (
                  <tr key={item.id} className="bg-white">
                    <td className="px-5 py-4 font-semibold text-slate-900">{item.partNumber}</td>
                    <td className="px-5 py-4 text-slate-700">{item.name}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.revision}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${stateStyles[item.inheritanceState]}`}>
                        {item.inheritanceState === 'locked' && <Lock className="h-3 w-3" />}
                        {item.inheritanceState}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{item.sourceBaseId ?? 'Local base'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section data-testid="legacy-bom-preview" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Legacy BOM Preview</h2>
            <p className="mt-1 text-sm text-slate-500">
              Read-only projection through the legacy BOM table. This does not write back to EBOM architecture state.
            </p>
          </div>
          <div className="h-[420px]">
            {legacyPreviewRoot ? (
              <BOMTable
                key={legacyPreviewRoot.id}
                data={legacyPreviewRoot}
                selectedId={selectedPreviewNodeId}
                onSelect={(node) => setSelectedPreviewNodeId(node.id)}
                isMBOMView={false}
                initialExpandedIds={[legacyPreviewRoot.id]}
                enableColumnControls={false}
                enableWhereUsed={false}
              />
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                {previewError ?? 'Unable to build legacy BOM preview for this EBOM base.'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
