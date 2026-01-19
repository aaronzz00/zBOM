import { LibraryPart, LifecycleState, ComponentType } from '../types';

const getImg = (text: string) => `https://placehold.co/100x100/e2e8f0/475569?text=${encodeURIComponent(text)}`;

export const mockLibraryData: LibraryPart[] = [
  { 
    id: '1', 
    partNumber: '100-55512-A', 
    mpn: 'SM8650', 
    manufacturer: 'Qualcomm', 
    description: 'SoC, Snapdragon 8 Gen 3', 
    imageUrl: getImg('Qualcomm SoC'), 
    category: 'Semiconductors', 
    cost: 35.00, 
    stock: 450, 
    minStock: 200, 
    state: LifecycleState.Released, 
    location: 'WH-A-01', 
    type: ComponentType.Part, 
    supplierId: '1', 
    leadTimeWeeks: 16,
    weightG: 1.2,
    moq: 1000,
    spq: 250,
    pricingTiers: [{ minQty: 1000, price: 34.50 }, { minQty: 10000, price: 32.00 }]
  },
  { 
    id: '2', 
    partNumber: '110-22311-B', 
    mpn: 'MT62F2G64', 
    manufacturer: 'Micron', 
    description: 'Memory, LPDDR5X 16GB', 
    imageUrl: getImg('DRAM Chip'), 
    category: 'Semiconductors', 
    cost: 18.00, 
    stock: 1200, 
    minStock: 500, 
    state: LifecycleState.Released, 
    location: 'WH-A-02', 
    type: ComponentType.Part, 
    supplierId: '6', 
    leadTimeWeeks: 12,
    weightG: 0.8,
    moq: 2000,
    spq: 500
  },
  { id: '3', partNumber: '120-11100-A', mpn: 'PM8950', manufacturer: 'Qualcomm', description: 'PMIC, Main Power Management', category: 'Semiconductors', cost: 1.25, stock: 85, minStock: 100, state: LifecycleState.InReview, location: 'WH-A-01', type: ComponentType.Part, supplierId: '1', leadTimeWeeks: 14, weightG: 0.2 },
  { id: '4', partNumber: 'R-0402-10K-1', mpn: 'RC0402JR-0710KL', manufacturer: 'Yageo', description: 'Resistor, 10k, 5%, 0402', category: 'Passives', cost: 0.002, stock: 50000, minStock: 10000, state: LifecycleState.Released, location: 'WH-B-12', type: ComponentType.Part, supplierId: '9', leadTimeWeeks: 4, weightG: 0.001, moq: 10000, spq: 10000, pricingTiers: [{ minQty: 50000, price: 0.0015 }] },
  { id: '5', partNumber: 'C-0402-1U-10', mpn: 'GRM155R61A105KE15D', manufacturer: 'Murata', description: 'Capacitor, 1uF, 10V, X5R, 0402', category: 'Passives', cost: 0.005, stock: 15000, minStock: 5000, state: LifecycleState.Released, location: 'WH-B-14', type: ComponentType.Part, supplierId: '3', leadTimeWeeks: 6, weightG: 0.002, moq: 10000, spq: 10000 },
  { id: '6', partNumber: '500-22100-A', mpn: 'N/A', manufacturer: 'Foxconn', description: 'Housing, Aluminum Unibody, Grey', imageUrl: getImg('Housing Frame'), category: 'Mechanical', cost: 15.00, stock: 45, minStock: 50, state: LifecycleState.Draft, location: 'WH-C-01', type: ComponentType.Part, supplierId: '4', leadTimeWeeks: 8, weightG: 42.5 },
  { id: '7', partNumber: '150-00291-C', mpn: 'USB-C-WP-22', manufacturer: 'Luxshare', description: 'Connector, USB-C Waterproof IP68', imageUrl: getImg('USB Conn'), category: 'Electromechanical', cost: 0.45, stock: 3200, minStock: 1000, state: LifecycleState.Released, location: 'WH-B-05', type: ComponentType.Part, supplierId: '10', leadTimeWeeks: 5, weightG: 0.35, moq: 3000, spq: 100 },
  { id: '8', partNumber: 'SW-10001', mpn: 'N/A', manufacturer: 'Internal', description: 'Firmware, Bootloader v1.2', category: 'Software', cost: 0.00, stock: 0, minStock: 0, state: LifecycleState.Released, location: 'Git/Repo', type: ComponentType.Software },
  { id: '9', partNumber: 'L-0603-10U', mpn: 'LQM18PN1R0MFRD', manufacturer: 'Murata', description: 'Inductor, Power, 1.0uH, 0603', category: 'Passives', cost: 0.08, stock: 200, minStock: 1000, state: LifecycleState.Obsolete, location: 'WH-B-15', type: ComponentType.Part, supplierId: '3', leadTimeWeeks: 8, weightG: 0.005 },
];