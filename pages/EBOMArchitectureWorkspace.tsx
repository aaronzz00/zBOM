import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Layers3, Lock, ShieldCheck } from 'lucide-react';
import { BOMTable } from '../components/BOMTable';
import { useAuth } from '../context/AuthContext';
import type { EBOMBase, EBOMEditableField, EBOMItem, InheritanceState } from '../domain/ebomArchitectureTypes';
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';
import { useProductConfigStore } from '../stores/useProductConfigStore';
import { Permission, type BOMNode } from '../types';
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

type EditValues = Record<EBOMEditableField, string>;

const editableFields: EBOMEditableField[] = [
  'partNumber',
  'name',
  'quantity',
  'unit',
  'revision',
  'designMasterPartId',
];

const emptyEditValues: EditValues = {
  partNumber: '',
  name: '',
  quantity: '',
  unit: '',
  revision: '',
  designMasterPartId: '',
};

const toEditValues = (item: EBOMItem | undefined): EditValues => ({
  partNumber: item?.partNumber ?? '',
  name: item?.name ?? '',
  quantity: item ? String(item.quantity) : '',
  unit: item?.unit ?? '',
  revision: item?.revision ?? '',
  designMasterPartId: item?.designMasterPartId ?? '',
});

export const EBOMArchitectureWorkspace: React.FC = () => {
  const { hasPermission } = useAuth();
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
    overrideField,
    lockField,
    unlockField,
    addLocalItem,
    revertItemDraft,
    resetDraft,
    publishChangePackage,
  } = useEBOMArchitectureStore();
  const selectedWorkflowSKUId = useProductConfigStore((state) => state.selectedWorkflowSKUId);
  const getSelectedWorkflowSKUContext = useProductConfigStore((state) => state.getSelectedWorkflowSKUContext);
  const selectedWorkflowContext = useMemo(
    () => getSelectedWorkflowSKUContext(),
    [getSelectedWorkflowSKUContext, selectedWorkflowSKUId],
  );
  const lastSyncedWorkflowSKUId = useRef<string | null>(null);
  const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState<string | null>(null);
  const [selectedEditItemId, setSelectedEditItemId] = useState<string | null>(null);
  const [showLocalItemForm, setShowLocalItemForm] = useState(false);
  const [editValues, setEditValues] = useState<EditValues>(emptyEditValues);
  const [draftInputError, setDraftInputError] = useState<string | null>(null);
  const [localItemValues, setLocalItemValues] = useState({
    parentItemId: '',
    partNumber: '',
    name: '',
    quantity: '1',
    unit: 'EA',
    revision: 'A',
    designMasterPartId: '',
  });

  useEffect(() => {
    if (status === 'idle') {
      void load();
    }
  }, [load, status]);

  useEffect(() => {
    if (status !== 'ready' || !selectedWorkflowContext?.structure.id) {
      return;
    }

    if (lastSyncedWorkflowSKUId.current === selectedWorkflowContext.sku.id) {
      return;
    }

    const matchingStructureBase = bases.find((base) => (
      base.scope === 'structure' && base.structureId === selectedWorkflowContext.structure.id
    ));

    if (!matchingStructureBase) {
      return;
    }

    if (selectedBaseId !== matchingStructureBase.id) {
      selectBase(matchingStructureBase.id);
    }
    lastSyncedWorkflowSKUId.current = selectedWorkflowContext.sku.id;
  }, [
    bases,
    selectBase,
    selectedBaseId,
    selectedWorkflowContext?.sku.id,
    selectedWorkflowContext?.structure.id,
    status,
  ]);

  const selectedBase = getSelectedBase();
  const draftOperations = getDraftOperations();
  const dirty = isDirty();
  const canEditSelectedBase = Boolean(
    selectedBase
    && selectedBase.status !== 'released'
    && hasPermission(Permission.EDIT_EBOM_ARCHITECTURE),
  );
  const editDisabledReason = !hasPermission(Permission.EDIT_EBOM_ARCHITECTURE)
    ? 'Requires EBOM architecture edit permission'
    : selectedBase?.status === 'released'
      ? 'Released EBOM bases cannot be edited'
      : 'Select an editable EBOM base';
  const draftError = draftInputError ?? error;

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

  const selectedEditItem = resolvedItems.find((item) => item.id === selectedEditItemId);

  useEffect(() => {
    setEditValues(toEditValues(selectedEditItem));
  }, [selectedEditItem]);

  useEffect(() => {
    if (selectedBase) {
      setLocalItemValues((values) => ({ ...values, parentItemId: selectedBase.rootItemId }));
    }
    setSelectedEditItemId(null);
    setSelectedPreviewNodeId(null);
    setDraftInputError(null);
  }, [selectedBase?.rootItemId, selectedBaseId]);

  const parseQuantityInput = (value: string) => {
    const quantity = Number(value);

    return value.trim() !== '' && Number.isFinite(quantity) ? quantity : null;
  };

  const handleApplyOverride = async () => {
    if (!selectedEditItem) {
      return;
    }

    const quantity = parseQuantityInput(editValues.quantity);
    if (quantity === null) {
      setDraftInputError('Quantity must be a valid number.');
      return;
    }

    setDraftInputError(null);
    for (const field of editableFields) {
      const nextValue = field === 'quantity'
        ? quantity
        : editValues[field] || undefined;
      const currentValue = selectedEditItem[field];

      if (String(currentValue ?? '') !== String(nextValue ?? '')) {
        await overrideField(selectedEditItem.id, field, nextValue);
      }
    }
  };

  const handleCreateLocalItem = async () => {
    const quantity = parseQuantityInput(localItemValues.quantity);
    if (quantity === null) {
      setDraftInputError('Quantity must be a valid number.');
      return;
    }

    setDraftInputError(null);
    await addLocalItem({
      parentItemId: localItemValues.parentItemId || selectedBase?.rootItemId,
      partNumber: localItemValues.partNumber,
      name: localItemValues.name,
      quantity,
      unit: localItemValues.unit,
      revision: localItemValues.revision,
      designMasterPartId: localItemValues.designMasterPartId || undefined,
    });
    setLocalItemValues((values) => ({
      ...values,
      partNumber: '',
      name: '',
      quantity: '1',
      unit: 'EA',
      revision: 'A',
      designMasterPartId: '',
    }));
    setShowLocalItemForm(false);
  };

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

        {selectedWorkflowContext && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 text-sm md:grid-cols-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Project</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {selectedWorkflowContext.project.code} · {selectedWorkflowContext.project.name}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Series</div>
                <div className="mt-1 font-semibold text-slate-900">{selectedWorkflowContext.series.code}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Structure</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {selectedWorkflowContext.structure.name} · {selectedWorkflowContext.structure.code}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">SKU</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {selectedWorkflowContext.sku.code} · {selectedWorkflowContext.sku.status}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">EBOM Base</div>
                <div className="mt-1 font-semibold text-slate-900">{selectedBaseId || 'Unselected'}</div>
              </div>
            </div>
          </section>
        )}

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
                  <th className="px-5 py-3">Actions</th>
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
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        aria-label={`Edit ${item.partNumber}`}
                        disabled={!canEditSelectedBase}
                        title={canEditSelectedBase ? `Edit ${item.partNumber}` : editDisabledReason}
                        onClick={() => setSelectedEditItemId(item.id)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">EBOM Draft Editor</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Edit the selected resolved item or add local child items to the current base.
                </p>
              </div>
              <button
                type="button"
                disabled={!canEditSelectedBase}
                title={canEditSelectedBase ? 'Add Local Item' : editDisabledReason}
                onClick={() => setShowLocalItemForm((value) => !value)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Add Local Item
              </button>
            </div>

            {selectedEditItem ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="edit-part-number">
                  Part Number
                  <input
                    id="edit-part-number"
                    value={editValues.partNumber}
                    onChange={(event) => setEditValues((values) => ({ ...values, partNumber: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="edit-name">
                  Name
                  <input
                    id="edit-name"
                    value={editValues.name}
                    onChange={(event) => setEditValues((values) => ({ ...values, name: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="edit-quantity">
                  Quantity
                  <input
                    id="edit-quantity"
                    type="number"
                    value={editValues.quantity}
                    onChange={(event) => setEditValues((values) => ({ ...values, quantity: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="edit-unit">
                  Unit
                  <input
                    id="edit-unit"
                    value={editValues.unit}
                    onChange={(event) => setEditValues((values) => ({ ...values, unit: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="edit-revision">
                  Revision
                  <input
                    id="edit-revision"
                    value={editValues.revision}
                    onChange={(event) => setEditValues((values) => ({ ...values, revision: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="edit-design-master-part">
                  Design Master Part
                  <input
                    id="edit-design-master-part"
                    value={editValues.designMasterPartId}
                    onChange={(event) => setEditValues((values) => ({ ...values, designMasterPartId: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button
                    type="button"
                    disabled={!canEditSelectedBase}
                    title={canEditSelectedBase ? 'Apply Override' : editDisabledReason}
                    onClick={() => void handleApplyOverride()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Apply Override
                  </button>
                  <button
                    type="button"
                    disabled={!canEditSelectedBase}
                    title={canEditSelectedBase ? 'Lock Quantity' : editDisabledReason}
                    onClick={() => void lockField(selectedEditItem.id, 'quantity')}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    Lock Quantity
                  </button>
                  <button
                    type="button"
                    disabled={!canEditSelectedBase}
                    title={canEditSelectedBase ? 'Unlock Quantity' : editDisabledReason}
                    onClick={() => void unlockField(selectedEditItem.id, 'quantity')}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    Unlock Quantity
                  </button>
                  <button
                    type="button"
                    disabled={!canEditSelectedBase}
                    title={canEditSelectedBase ? 'Revert Item Draft' : editDisabledReason}
                    onClick={() => void revertItemDraft(selectedEditItem.id)}
                    className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    Revert Item Draft
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Select an item from the resolved table to edit it.
              </div>
            )}

            {showLocalItemForm && (
              <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="local-parent-item">
                  Local Parent Item
                  <select
                    id="local-parent-item"
                    value={localItemValues.parentItemId}
                    onChange={(event) => setLocalItemValues((values) => ({ ...values, parentItemId: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {resolvedItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.partNumber}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="local-part-number">
                  Local Part Number
                  <input
                    id="local-part-number"
                    value={localItemValues.partNumber}
                    onChange={(event) => setLocalItemValues((values) => ({ ...values, partNumber: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="local-name">
                  Local Name
                  <input
                    id="local-name"
                    value={localItemValues.name}
                    onChange={(event) => setLocalItemValues((values) => ({ ...values, name: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="local-quantity">
                  Local Quantity
                  <input
                    id="local-quantity"
                    type="number"
                    value={localItemValues.quantity}
                    onChange={(event) => setLocalItemValues((values) => ({ ...values, quantity: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="local-unit">
                  Local Unit
                  <input
                    id="local-unit"
                    value={localItemValues.unit}
                    onChange={(event) => setLocalItemValues((values) => ({ ...values, unit: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="local-revision">
                  Local Revision
                  <input
                    id="local-revision"
                    value={localItemValues.revision}
                    onChange={(event) => setLocalItemValues((values) => ({ ...values, revision: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="local-design-master-part">
                  Local Design Master Part
                  <input
                    id="local-design-master-part"
                    value={localItemValues.designMasterPartId}
                    onChange={(event) => setLocalItemValues((values) => ({ ...values, designMasterPartId: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={!canEditSelectedBase}
                    title={canEditSelectedBase ? 'Create Local Item' : editDisabledReason}
                    onClick={() => void handleCreateLocalItem()}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Create Local Item
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Change Package</h2>
            <div className="mt-3 text-2xl font-bold text-slate-900">
              {dirty ? `${draftOperations.length} pending` : 'Clean'}
            </div>
            {draftError && (
              <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {draftError}
              </div>
            )}
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {draftOperations.map((operation) => (
                <li key={operation.id} className="rounded-lg bg-slate-50 px-3 py-2 font-semibold">
                  {operation.type}
                  {operation.field ? ` · ${operation.field}` : ''}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!selectedBase || selectedBase.status === 'released' || draftOperations.length === 0 || status === 'publishing'}
                title={!selectedBase ? 'Select an EBOM base before publishing' : selectedBase.status === 'released' ? 'Released EBOM bases cannot be published from draft' : draftOperations.length === 0 ? 'No draft operations to publish' : status === 'publishing' ? 'Publishing is already in progress' : 'Publish Change Package'}
                onClick={() => selectedBase && void publishChangePackage(`${selectedBase.id} draft update`)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Publish Change Package
              </button>
              <button
                type="button"
                disabled={draftOperations.length === 0}
                title={draftOperations.length === 0 ? 'No draft operations to reset' : 'Reset Draft'}
                onClick={() => void resetDraft()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Reset Draft
              </button>
            </div>
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
