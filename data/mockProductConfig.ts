import {
  ProductSeries,
  ProductStructure,
  ProjectProgram,
  SKU,
  VariationAxis,
} from '../domain/productTypes';

export const mockProjectPrograms: ProjectProgram[] = [
  {
    id: 'project-zphone-2026',
    code: 'ZP26',
    name: 'zPhone 2026 Platform',
    phase: 'DVT',
    primarySeriesId: 'series-zp-a',
    status: 'active',
  },
];

export const mockSeries: ProductSeries[] = [
  {
    id: 'series-zp-a',
    projectId: 'project-zphone-2026',
    code: 'ZP-A',
    name: 'zPhone A Series',
    isPrimary: true,
  },
  {
    id: 'series-zp-b',
    projectId: 'project-zphone-2026',
    code: 'ZP-B',
    name: 'zPhone B Series',
    isPrimary: false,
    baseSeriesId: 'series-zp-a',
  },
];

export const mockStructures: ProductStructure[] = [
  {
    id: 'structure-zp-a-std',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    code: 'STD',
    name: 'Standard Structure',
  },
  {
    id: 'structure-zp-a-pro',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    code: 'PRO',
    name: 'Pro Structure',
    baseStructureId: 'structure-zp-a-std',
  },
];

export const mockVariationAxes: VariationAxis[] = [
  {
    id: 'axis-color',
    projectId: 'project-zphone-2026',
    code: 'COLOR',
    name: 'Color',
    options: [
      { id: 'opt-color-black', axisId: 'axis-color', code: 'BLK', label: 'Black' },
      { id: 'opt-color-silver', axisId: 'axis-color', code: 'SLV', label: 'Silver' },
    ],
  },
  {
    id: 'axis-region',
    projectId: 'project-zphone-2026',
    code: 'REGION',
    name: 'Region',
    options: [
      { id: 'opt-region-us', axisId: 'axis-region', code: 'US', label: 'United States' },
      { id: 'opt-region-eu', axisId: 'axis-region', code: 'EU', label: 'Europe' },
    ],
  },
  {
    id: 'axis-packaging',
    projectId: 'project-zphone-2026',
    code: 'PKG',
    name: 'Packaging',
    options: [
      { id: 'opt-packaging-retail', axisId: 'axis-packaging', code: 'RTL', label: 'Retail' },
      { id: 'opt-packaging-bulk', axisId: 'axis-packaging', code: 'BLK', label: 'Bulk' },
    ],
  },
];

export const mockSKUs: SKU[] = [
  {
    id: 'sku-zp-a-std-blk-us-rtl',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    structureId: 'structure-zp-a-std',
    code: 'ZP-A-STD-BLK-US-RTL',
    status: 'active',
    optionIds: ['opt-color-black', 'opt-region-us', 'opt-packaging-retail'],
    generatedByRule: true,
  },
  {
    id: 'sku-zp-a-std-slv-eu-rtl',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    structureId: 'structure-zp-a-std',
    code: 'ZP-A-STD-SLV-EU-RTL',
    status: 'frozen',
    optionIds: ['opt-color-silver', 'opt-region-eu', 'opt-packaging-retail'],
    generatedByRule: true,
    frozenAt: '2026-05-22T00:00:00.000Z',
  },
  {
    id: 'sku-zp-a-pro-blk-us-rtl',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    structureId: 'structure-zp-a-pro',
    code: 'ZP-A-PRO-BLK-US-RTL',
    status: 'candidate',
    optionIds: ['opt-color-black', 'opt-region-us', 'opt-packaging-retail'],
    generatedByRule: true,
  },
  {
    id: 'sku-zp-a-pro-slv-eu-bulk',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    structureId: 'structure-zp-a-pro',
    code: 'ZP-A-PRO-SLV-EU-BLK',
    status: 'suppressed',
    optionIds: ['opt-color-silver', 'opt-region-eu', 'opt-packaging-bulk'],
    generatedByRule: true,
  },
];
