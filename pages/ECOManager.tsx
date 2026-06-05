import React, { useState } from 'react';
import { ECO, Permission } from '../types';
import { useAuth } from '../context/AuthContext';
import { FileSignature, Plus, CheckCircle, XCircle, Clock, ChevronRight, AlertCircle, ArrowRight } from 'lucide-react';

// Mock ECO Data
const MOCK_ECOS: ECO[] = [
  {
    id: 'eco-001',
    ecoNumber: 'ECO-2024-112',
    title: 'Replace M1.2 screws with M1.4',
    description: 'Field failure reports indicate M1.2 screws stripping during assembly torque. Upgrading to M1.4 for durability.',
    status: 'Approved',
    initiator: 'Alex Chen',
    createdDate: '2024-10-12',
    approvedBy: 'Sarah Engineer',
    approvalDate: '2024-10-14',
    priority: 'High',
    impacts: [
      { partNumber: '500-22101-A', name: 'Screw, M1.2x3, Torx', changeType: 'Obsolete' },
      { partNumber: '500-22105-A', name: 'Screw, M1.4x3, Torx', changeType: 'New' }
    ]
  },
  {
    id: 'eco-002',
    ecoNumber: 'ECO-2024-115',
    title: 'Update FW Bootloader',
    description: 'Security patch for bootloader. Required for PVT builds.',
    status: 'Pending Approval',
    initiator: 'Mike Smith',
    createdDate: '2024-10-14',
    priority: 'Medium',
    impacts: [
      { partNumber: 'SW-10001', name: 'Firmware, Bootloader', changeType: 'RevUp', from: 'v1.2', to: 'v1.3' }
    ]
  }
];

export const ECOManager: React.FC = () => {
  const { hasPermission } = useAuth();
  const [ecos, setEcos] = useState<ECO[]>(MOCK_ECOS);
  const [selectedEco, setSelectedEco] = useState<ECO | null>(null);

  const canApprove = hasPermission(Permission.APPROVE_CHANGE);
  const canCreate = hasPermission(Permission.CREATE_ECO);

  const handleCreateDraft = () => {
    const nextIndex = ecos.length + 1;
    const draftEco: ECO = {
      id: `eco-draft-${nextIndex}`,
      ecoNumber: `ECO-2024-DRAFT-${String(nextIndex).padStart(3, '0')}`,
      title: 'Draft BOM update request',
      description: 'Draft change order created from current BOM context.',
      status: 'Draft',
      initiator: 'Alex Admin',
      createdDate: '2026-06-04',
      priority: 'Medium',
      impacts: [
        {
          partNumber: '800-00234-A',
          name: 'Top Level Assembly, zPhone Pro',
          changeType: 'RevUp',
          from: 'A.02',
          to: 'Draft',
        },
      ],
    };

    setEcos((current) => [draftEco, ...current]);
    setSelectedEco(draftEco);
  };

  const handleStatusChange = (ecoId: string, newStatus: ECO['status']) => {
    setEcos(prev => prev.map(e => e.id === ecoId ? { ...e, status: newStatus } : e));
    if (selectedEco && selectedEco.id === ecoId) {
        setSelectedEco({ ...selectedEco, status: newStatus });
    }
  };

  const getStatusColor = (status: ECO['status']) => {
      switch(status) {
          case 'Approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'Rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
          case 'Pending Approval': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'Implemented': return 'bg-blue-100 text-blue-700 border-blue-200';
          default: return 'bg-slate-100 text-slate-600 border-slate-200';
      }
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* ECO List Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-blue-600" />
                Change Orders
            </h2>
            {canCreate && (
                <button
                  type="button"
                  aria-label="Create change order"
                  onClick={handleCreateDraft}
                  className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            )}
        </div>
        <div className="flex-1 overflow-y-auto">
            {ecos.map(eco => (
                <div 
                    key={eco.id}
                    onClick={() => setSelectedEco(eco)}
                    className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${selectedEco?.id === eco.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-xs font-bold text-slate-500">{eco.ecoNumber}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${getStatusColor(eco.status)}`}>
                            {eco.status}
                        </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">{eco.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{eco.initiator}</span>
                        <span>•</span>
                        <span>{eco.createdDate}</span>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Detail View */}
      <div className="flex-1 flex flex-col overflow-hidden">
          {selectedEco ? (
              <div className="flex-1 overflow-y-auto p-8">
                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex justify-between items-start">
                          <div>
                              <div className="flex items-center gap-3 mb-2">
                                  <h1 className="text-2xl font-bold text-slate-800">{selectedEco.ecoNumber}</h1>
                                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(selectedEco.status)}`}>
                                      {selectedEco.status}
                                  </span>
                                  {selectedEco.priority === 'High' && (
                                      <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" /> High Priority
                                      </span>
                                  )}
                              </div>
                              <h2 className="text-lg text-slate-700">{selectedEco.title}</h2>
                          </div>
                          
                          {/* Actions */}
                          {selectedEco.status === 'Pending Approval' && canApprove && (
                              <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleStatusChange(selectedEco.id, 'Rejected')}
                                    className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-700 bg-rose-50 rounded font-medium hover:bg-rose-100"
                                  >
                                      <XCircle className="w-4 h-4" /> Reject
                                  </button>
                                  <button 
                                    onClick={() => handleStatusChange(selectedEco.id, 'Approved')}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 shadow-sm"
                                  >
                                      <CheckCircle className="w-4 h-4" /> Approve
                                  </button>
                              </div>
                          )}
                      </div>

                      <div className="p-6 space-y-8">
                          {/* Description */}
                          <div>
                              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Reason for Change</h3>
                              <p className="text-slate-700 bg-slate-50 p-4 rounded border border-slate-200 leading-relaxed">
                                  {selectedEco.description}
                              </p>
                          </div>

                          {/* Impacts Table */}
                          <div>
                              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Impact Analysis</h3>
                              <div className="border border-slate-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-sm text-left">
                                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                          <tr>
                                              <th className="px-4 py-3">Part Number</th>
                                              <th className="px-4 py-3">Description</th>
                                              <th className="px-4 py-3">Action</th>
                                              <th className="px-4 py-3">Revision Change</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {selectedEco.impacts.map((impact, idx) => (
                                              <tr key={idx} className="bg-white">
                                                  <td className="px-4 py-3 font-mono text-blue-600">{impact.partNumber}</td>
                                                  <td className="px-4 py-3 text-slate-700">{impact.name}</td>
                                                  <td className="px-4 py-3">
                                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold 
                                                          ${impact.changeType === 'Obsolete' ? 'bg-rose-100 text-rose-700' : 
                                                            impact.changeType === 'New' ? 'bg-emerald-100 text-emerald-700' : 
                                                            'bg-blue-100 text-blue-700'}`}>
                                                          {impact.changeType}
                                                      </span>
                                                  </td>
                                                  <td className="px-4 py-3 font-mono text-xs">
                                                      {impact.from || impact.to ? (
                                                          <div className="flex items-center gap-2 text-slate-600">
                                                              <span>{impact.from || 'Initial'}</span>
                                                              <ArrowRight className="w-3 h-3 text-slate-400" />
                                                              <span className="font-bold text-slate-800">{impact.to || 'Obsolete'}</span>
                                                          </div>
                                                      ) : (
                                                          <span className="text-slate-400">-</span>
                                                      )}
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                          
                          {/* Approval History */}
                          <div>
                               <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Workflow History</h3>
                               <div className="flex flex-col gap-4 pl-2 border-l-2 border-slate-200">
                                   <div className="relative pl-6">
                                       <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-200 border-2 border-white"></div>
                                       <div className="text-sm font-bold text-slate-700">Change Request Created</div>
                                       <div className="text-xs text-slate-500">{selectedEco.createdDate} by {selectedEco.initiator}</div>
                                   </div>
                                   {selectedEco.approvedBy && (
                                       <div className="relative pl-6">
                                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></div>
                                            <div className="text-sm font-bold text-slate-700">Approved</div>
                                            <div className="text-xs text-slate-500">{selectedEco.approvalDate} by {selectedEco.approvedBy}</div>
                                       </div>
                                   )}
                               </div>
                          </div>
                      </div>
                  </div>
              </div>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                  <FileSignature className="w-16 h-16 mb-4 opacity-20" />
                  <p>Select a Change Order to view details</p>
              </div>
          )}
      </div>
    </div>
  );
};
