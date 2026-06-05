import React from 'react';
import {
  Box,
  CheckCircle2,
  Layers3,
  PackageCheck,
  PauseCircle,
  Snowflake,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SKUStatus } from '../domain/productTypes';
import { useProductConfigStore } from '../stores/useProductConfigStore';
import { Permission } from '../types';

const statusStyles: Record<SKUStatus, string> = {
  candidate: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  frozen: 'bg-sky-50 text-sky-700 border-sky-200',
  suppressed: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const ProductMatrixCenter: React.FC = () => {
  const { hasPermission } = useAuth();
  const {
    projects,
    series,
    structures,
    variationAxes,
    skus,
    activeProjectId,
    selectedWorkflowSKUId,
    activateSKU,
    freezeSKU,
    suppressSKU,
    selectWorkflowSKU,
  } = useProductConfigStore();

  const activeProject = projects.find((project) => project.id === activeProjectId);
  const projectSeries = series.filter((item) => item.projectId === activeProjectId);
  const projectStructures = structures.filter((structure) => structure.projectId === activeProjectId);
  const projectAxes = variationAxes.filter((axis) => axis.projectId === activeProjectId);
  const projectSKUs = skus.filter((sku) => sku.projectId === activeProjectId);
  const optionLookup = new Map(projectAxes.flatMap((axis) => (
    axis.options.map((option) => [option.id, option])
  )));
  const canManageSkuLifecycle = hasPermission(Permission.MANAGE_SKU_LIFECYCLE);

  if (!activeProject) {
    return (
      <div className="flex-1 bg-slate-50 p-8 text-slate-500">
        No active product project selected.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-200">
                  <PackageCheck className="h-4 w-4" />
                  Product Matrix Center
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{activeProject.name}</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Govern product series, structures, variation axes, and SKU lifecycle status from the product configuration store.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-2xl font-bold">{activeProject.code}</div>
                  <div className="text-xs uppercase text-slate-300">Program</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-2xl font-bold">{activeProject.phase}</div>
                  <div className="text-xs uppercase text-slate-300">Phase</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-2xl font-bold">{projectSKUs.length}</div>
                  <div className="text-xs uppercase text-slate-300">SKUs</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Box className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Series</h2>
            </div>
            <div className="space-y-3">
              {projectSeries.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.code}</div>
                    </div>
                    {item.isPrimary && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        Primary
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Structures</h2>
            </div>
            <div className="space-y-3">
              {projectStructures.map((structure) => {
                const owningSeries = projectSeries.find((item) => item.id === structure.seriesId);

                return (
                  <div key={structure.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900">{structure.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{structure.code}</span>
                      {owningSeries && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">{owningSeries.code}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Variation Axes</h2>
            </div>
            <div className="space-y-4">
              {projectAxes.map((axis) => (
                <div key={axis.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{axis.name}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">{axis.code}</div>
                    </div>
                    {axis.appliesToStructureIds && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        Scoped
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {axis.options.map((option) => (
                      <span
                        key={option.id}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {option.code}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">SKU Matrix</h2>
            <p className="mt-1 text-sm text-slate-500">
              SKU codes resolve against their configured structure and variation option codes.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">SKU Code</th>
                  <th className="px-5 py-3">Structure</th>
                  <th className="px-5 py-3">Option Codes</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectSKUs.map((sku) => {
                  const structure = projectStructures.find((item) => item.id === sku.structureId);
                  const optionCodes = sku.optionIds.map((optionId) => optionLookup.get(optionId)?.code ?? 'UNKNOWN');
                  const isSelectedForWorkflow = selectedWorkflowSKUId === sku.id;

                  return (
                    <tr key={sku.id} data-testid={`sku-row-${sku.id}`} className="bg-white">
                      <td className="px-5 py-4 font-semibold text-slate-900">{sku.code}</td>
                      <td className="px-5 py-4 text-slate-600">{structure?.code ?? 'UNKNOWN'}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {optionCodes.map((code, index) => (
                            <span
                              key={`${sku.id}-${code}-${index}`}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${statusStyles[sku.status]}`}>
                            {sku.status}
                          </span>
                          {isSelectedForWorkflow && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                              Selected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            data-testid={`select-workflow-${sku.id}`}
                            type="button"
                            disabled={!canManageSkuLifecycle}
                            title={canManageSkuLifecycle ? 'Select this SKU for downstream workflow' : 'Requires SKU lifecycle permission'}
                            onClick={() => selectWorkflowSKU(sku.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            Select for Workflow
                          </button>
                          <button
                            data-testid={`activate-${sku.id}`}
                            type="button"
                            disabled={!canManageSkuLifecycle || sku.status !== 'candidate'}
                            title={!canManageSkuLifecycle ? 'Requires SKU lifecycle permission' : sku.status !== 'candidate' ? 'Only candidate SKUs can be activated' : 'Activate this candidate SKU'}
                            onClick={() => activateSKU(sku.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Activate
                          </button>
                          <button
                            type="button"
                            disabled={!canManageSkuLifecycle || sku.status === 'suppressed' || sku.status === 'frozen'}
                            title={!canManageSkuLifecycle ? 'Requires SKU lifecycle permission' : sku.status === 'suppressed' || sku.status === 'frozen' ? 'Suppressed or frozen SKUs cannot be frozen again' : 'Freeze this SKU'}
                            onClick={() => freezeSKU(sku.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Snowflake className="h-3.5 w-3.5" />
                            Freeze
                          </button>
                          <button
                            type="button"
                            disabled={!canManageSkuLifecycle || sku.status === 'frozen'}
                            title={!canManageSkuLifecycle ? 'Requires SKU lifecycle permission' : sku.status === 'frozen' ? 'Frozen SKUs cannot be suppressed' : 'Suppress this SKU'}
                            onClick={() => suppressSKU(sku.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <PauseCircle className="h-3.5 w-3.5" />
                            Suppress
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
