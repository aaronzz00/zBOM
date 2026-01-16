import { Supplier } from '../types';

export const mockSuppliers: Supplier[] = [
  { id: '1', name: 'Qualcomm', country: 'USA', region: 'NAM', riskScore: 12, status: 'Approved', category: 'Semiconductors', leadTimeAvg: 16, lastAudit: '2024-01-15' },
  { id: '2', name: 'Samsung Display', country: 'South Korea', region: 'APAC', riskScore: 25, status: 'Approved', category: 'Display', leadTimeAvg: 12, lastAudit: '2023-11-20' },
  { id: '3', name: 'Murata Mfg', country: 'Japan', region: 'APAC', riskScore: 5, status: 'Approved', category: 'Passives', leadTimeAvg: 8, lastAudit: '2024-03-10' },
  { id: '4', name: 'Foxconn', country: 'Taiwan', region: 'APAC', riskScore: 35, status: 'Approved', category: 'Mechanical', leadTimeAvg: 6, lastAudit: '2024-02-01' },
  { id: '5', name: 'Shenzhen FastPCB', country: 'China', region: 'APAC', riskScore: 78, status: 'Watchlist', category: 'PCB', leadTimeAvg: 5, lastAudit: '2023-09-10' },
  { id: '6', name: 'Micron Technology', country: 'USA', region: 'NAM', riskScore: 15, status: 'Approved', category: 'Memory', leadTimeAvg: 10, lastAudit: '2024-04-12' },
  { id: '7', name: 'STMicroelectronics', country: 'Switzerland', region: 'EMEA', riskScore: 22, status: 'Approved', category: 'Semiconductors', leadTimeAvg: 14, lastAudit: '2023-12-05' },
  { id: '8', name: 'Local Metals Inc', country: 'Vietnam', region: 'APAC', riskScore: 65, status: 'Probation', category: 'Mechanical', leadTimeAvg: 4, lastAudit: '2024-05-01' },
  { id: '9', name: 'Yageo', country: 'Taiwan', region: 'APAC', riskScore: 10, status: 'Approved', category: 'Passives', leadTimeAvg: 6, lastAudit: '2024-01-20' },
  { id: '10', name: 'Luxshare', country: 'China', region: 'APAC', riskScore: 28, status: 'Approved', category: 'Electromechanical', leadTimeAvg: 5, lastAudit: '2024-02-15' },
];