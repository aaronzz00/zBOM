export enum LifecycleState {
  Draft = 'Draft',
  InReview = 'In Review',
  Released = 'Released',
  Obsolete = 'Obsolete',
  Prototype = 'Prototype'
}

export enum ComponentType {
  Assembly = 'Assembly',
  Part = 'Part',
  Material = 'Material',
  Software = 'Software'
}

// --- IAM / Security Types ---

export type UserRole = 'ADMIN' | 'ENG_LEAD' | 'SOURCING' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
}

// Granular Permissions
export enum Permission {
  // Navigation
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_BOM = 'VIEW_BOM',
  VIEW_SUPPLY_CHAIN = 'VIEW_SUPPLY_CHAIN',
  
  // Data Visibility (Field Level)
  VIEW_COST = 'VIEW_COST', // Can see price data
  VIEW_SUPPLIER_RISK = 'VIEW_SUPPLIER_RISK',
  
  // Actions
  EDIT_BOM_STRUCTURE = 'EDIT_BOM_STRUCTURE', // Add/Remove nodes
  EDIT_BOM_METADATA = 'EDIT_BOM_METADATA', // Edit description, refdes
  EDIT_COST = 'EDIT_COST', // Edit target cost or unit cost
  MANAGE_AVL = 'MANAGE_AVL', // Add/Remove suppliers
  APPROVE_CHANGE = 'APPROVE_CHANGE',
}

// Existing Types...

export interface RevisionLog {
  revision: string;
  date: string;
  author: string;
  description: string;
  changeType: 'Major' | 'Minor' | 'Patch' | 'Initial';
}

export interface AVLEntry {
  id: string;
  manufacturer: string;
  mpn: string;
  status: 'Preferred' | 'Alternate' | 'DoNotUse' | 'Pending';
}

export interface BOMNode {
  id: string;
  partNumber: string;
  name: string;
  description?: string;
  revision: string;
  state: LifecycleState;
  type: ComponentType;
  quantity: number;
  unit: string;
  cost: number;
  currency: string;
  manufacturer?: string;
  mpn?: string; // Manufacturer Part Number
  leadTimeWeeks?: number;
  
  // New Fields for Consumer Electronics Support
  refDes?: string; // Reference Designators (e.g., "R1, R2, R5")
  variants?: string[]; // SKU applicability (e.g., ["Common"] or ["US-Only"])
  
  // P1 - Target Costing
  targetCost?: number; // The budget allocated for this subsystem/part

  // Supply Chain - P2 AVL Feature
  avl?: AVLEntry[];

  children?: BOMNode[];
  isExpanded?: boolean; // UI state
  history?: RevisionLog[]; // New history log
}

export interface BOMSnapshot {
  id: string;
  name: string;
  timestamp: string;
  data: BOMNode;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  sku: string;
  phase: 'EVT' | 'DVT' | 'PVT' | 'MP';
  lastModified: string;
  totalCost: number;
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  region: 'APAC' | 'NAM' | 'EMEA';
  riskScore: number; // 0-100, 100 is high risk
  status: 'Approved' | 'Probation' | 'Watchlist' | 'Qualifying';
  category: string;
  leadTimeAvg: number; // weeks
  lastAudit: string;
  // partsCount is now derived from relation, removed from base interface or kept optional for UI cache
}

export interface LibraryPart {
  id: string;
  partNumber: string;
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  cost: number;
  stock: number;
  minStock: number;
  state: LifecycleState;
  datasheet?: string;
  location: string;
  type?: ComponentType; 
  // Linkage fields
  supplierId?: string;
  leadTimeWeeks?: number;
}

export interface AIAnalysisResult {
  summary: string;
  costSavingOpportunities: string[];
  riskAssessment: string;
  alternatives?: Array<{
    partNumber: string;
    suggestion: string;
  }>;
}