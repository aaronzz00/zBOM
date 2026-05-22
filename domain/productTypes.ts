export type ProjectPhase = 'EVT' | 'DVT' | 'PVT' | 'MP';

export interface ProjectProgram {
  id: string;
  code: string;
  name: string;
  phase: ProjectPhase;
  primarySeriesId: string;
  status: 'active' | 'archived';
}

export interface ProductSeries {
  id: string;
  projectId: string;
  code: string;
  name: string;
  isPrimary: boolean;
  baseSeriesId?: string;
}

export interface ProductStructure {
  id: string;
  projectId: string;
  seriesId: string;
  code: string;
  name: string;
  baseStructureId?: string;
}

export interface VariationOption {
  id: string;
  axisId: string;
  code: string;
  label: string;
}

export interface VariationAxis {
  id: string;
  projectId: string;
  code: string;
  name: string;
  appliesToStructureIds?: string[];
  options: VariationOption[];
}

export type SKUStatus = 'candidate' | 'active' | 'frozen' | 'suppressed';

export interface SKU {
  id: string;
  projectId: string;
  seriesId: string;
  structureId: string;
  code: string;
  status: SKUStatus;
  optionIds: string[];
  generatedByRule: boolean;
  frozenAt?: string;
}
