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
  Material = 'Material', // For MBOM aux items like Glue/Solder
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
  VIEW_ECO = 'VIEW_ECO',
  
  // Data Visibility (Field Level)
  VIEW_COST = 'VIEW_COST', // Can see price data
  VIEW_SUPPLIER_RISK = 'VIEW_SUPPLIER_RISK',
  
  // Actions
  EDIT_BOM_STRUCTURE = 'EDIT_BOM_STRUCTURE', // Add/Remove nodes
  EDIT_BOM_METADATA = 'EDIT_BOM_METADATA', // Edit description, refdes
  EDIT_COST = 'EDIT_COST', // Edit target cost or unit cost
  MANAGE_AVL = 'MANAGE_AVL', // Add/Remove suppliers
  APPROVE_CHANGE = 'APPROVE_CHANGE', // Approve ECOs
  CREATE_ECO = 'CREATE_ECO',
}

export interface PricingTier {
  minQty: number;
  price: number;
}

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
  imageUrl?: string; // Visual BOM support
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
  
  // Consumer Electronics Support
  refDes?: string; 
  variants?: string[]; 
  
  // P1 - Target Costing
  targetCost?: number; 

  // Feature: Procurement Intelligence
  moq?: number; // Minimum Order Quantity
  spq?: number; // Standard Pack Quantity
  pricingTiers?: PricingTier[]; // Volume pricing

  // Feature: Physical Attributes
  weightG?: number; // Weight in grams

  // Feature: MBOM Support
  isAuxiliary?: boolean; // If true, only visible in MBOM view (e.g. glue, tape)

  // Supply Chain - P2 AVL Feature
  avl?: AVLEntry[];

  children?: BOMNode[];
  isExpanded?: boolean; // UI state
  history?: RevisionLog[]; 
}

export interface BOMSnapshot {
  id: string;
  name: string;
  timestamp: string;
  data: BOMNode;
}

// --- ECO / Change Management Types ---
export interface ECOImpact {
  partNumber: string;
  name: string;
  changeType: 'RevUp' | 'New' | 'Obsolete' | 'QtyChange';
  from?: string;
  to?: string;
}

export interface ECO {
  id: string;
  ecoNumber: string;
  title: string;
  description: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Implemented';
  initiator: string;
  createdDate: string;
  approvedBy?: string;
  approvalDate?: string;
  impacts: ECOImpact[];
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
}

export interface Project {
  id: string;
  name: string;
  code: string;
  sku: string;
  phase: 'EVT' | 'DVT' | 'PVT' | 'MP';
  lastModified: string;
  totalCost: number;
  totalWeight?: number; 
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
}

export interface LibraryPart {
  id: string;
  partNumber: string;
  mpn: string;
  manufacturer: string;
  description: string;
  imageUrl?: string;
  category: string;
  state: LifecycleState;
  location: string;
  type?: ComponentType; 
  
  // Commercial & Procurement
  cost: number;
  stock: number;
  minStock: number;
  supplierId?: string;
  leadTimeWeeks?: number;
  moq?: number;
  spq?: number;
  pricingTiers?: PricingTier[];

  // Physical
  weightG?: number;

  datasheet?: string;
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