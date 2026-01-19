import { BOMNode, ComponentType, LifecycleState } from '../types';

export const mockProject: any = {
  id: 'PRJ-2024-001',
  name: 'zPhone Pro Max',
  code: 'ZPM-14',
  sku: 'Multi-SKU Config',
  phase: 'DVT',
  lastModified: '2024-05-20T14:30:00Z',
  totalCost: 142.50,
  totalWeight: 245.5
};

// Helper for placeholders
const getImg = (text: string) => `https://placehold.co/100x100/e2e8f0/475569?text=${encodeURIComponent(text)}`;

export const complexBOM: BOMNode = {
  id: 'root',
  partNumber: '800-00234-A',
  name: 'Top Level Assembly, zPhone Pro',
  imageUrl: getImg('Phone Assy'),
  revision: 'A.02',
  state: LifecycleState.Prototype,
  type: ComponentType.Assembly,
  quantity: 1,
  unit: 'EA',
  cost: 0, 
  currency: 'USD',
  targetCost: 135.00,
  variants: ['Common'],
  weightG: 0, // Calculated roll-up
  history: [
    {
      revision: 'A.02',
      date: '2024-05-20',
      author: 'Alex Chen',
      description: 'Updated main assembly for DVT build.',
      changeType: 'Minor'
    }
  ],
  children: [
    {
      id: 'n1',
      partNumber: '700-00112-B',
      name: 'Packaging Assy, Retail',
      imageUrl: getImg('Retail Box'),
      revision: 'B.01',
      state: LifecycleState.Draft,
      type: ComponentType.Assembly,
      quantity: 1,
      unit: 'EA',
      cost: 4.50,
      currency: 'USD',
      targetCost: 5.00,
      leadTimeWeeks: 4,
      variants: ['Common'],
      weightG: 120,
      children: [
        {
          id: 'n1-1',
          partNumber: '600-99821-A',
          name: 'Box, Rigid, Magnetic Closure',
          revision: 'A',
          state: LifecycleState.Released,
          type: ComponentType.Part,
          quantity: 1,
          unit: 'EA',
          cost: 2.20,
          currency: 'USD',
          manufacturer: 'PakSource',
          mpn: 'BX-2929',
          variants: ['Common'],
          weightG: 85,
          moq: 1000,
          spq: 50
        },
        {
          id: 'n1-2',
          partNumber: '600-99822-US',
          name: 'Insert, Molded Pulp (US Type)',
          revision: 'A',
          state: LifecycleState.Released,
          type: ComponentType.Part,
          quantity: 1,
          unit: 'EA',
          cost: 0.85,
          currency: 'USD',
          manufacturer: 'GreenPack',
          variants: ['US-Only'],
          weightG: 35
        },
        {
          id: 'n1-aux-1',
          partNumber: 'M-TAPE-001',
          name: 'Seal Tape, Tamper Evident',
          revision: 'A',
          state: LifecycleState.Released,
          type: ComponentType.Material,
          quantity: 0.2, // Meters
          unit: 'M',
          cost: 0.10,
          currency: 'USD',
          isAuxiliary: true, // MBOM Only
          description: 'Manufacturing consumable, not in EBOM',
          weightG: 0.5
        }
      ]
    },
    {
      id: 'n2',
      partNumber: '700-01000-C',
      name: 'Main Device Assembly',
      imageUrl: getImg('Device Assy'),
      revision: 'C.05',
      state: LifecycleState.InReview,
      type: ComponentType.Assembly,
      quantity: 1,
      unit: 'EA',
      cost: 0,
      currency: 'USD',
      targetCost: 120.00,
      variants: ['Common'],
      children: [
        {
          id: 'n2-1',
          partNumber: '400-00551-A',
          name: 'Display Module, OLED 6.7"',
          imageUrl: getImg('OLED Screen'),
          revision: 'A',
          state: LifecycleState.Released,
          type: ComponentType.Part,
          quantity: 1,
          unit: 'EA',
          cost: 45.00,
          currency: 'USD',
          manufacturer: 'Samsung Display',
          leadTimeWeeks: 12,
          variants: ['Common'],
          weightG: 45.2,
          moq: 100,
          pricingTiers: [
             { minQty: 1, price: 55.00 },
             { minQty: 1000, price: 45.00 },
             { minQty: 10000, price: 42.50 }
          ],
          avl: [
            { id: 'a1', manufacturer: 'Samsung Display', mpn: 'AMS667YK01', status: 'Preferred' }
          ]
        },
        {
          id: 'n2-2',
          partNumber: '300-11200-B',
          name: 'Battery Pack, 4500mAh',
          imageUrl: getImg('Battery'),
          revision: 'B',
          state: LifecycleState.Released,
          type: ComponentType.Part,
          quantity: 1,
          unit: 'EA',
          cost: 12.50,
          currency: 'USD',
          manufacturer: 'ATL',
          leadTimeWeeks: 8,
          variants: ['Common'],
          weightG: 68.5
        },
        {
          id: 'n2-3',
          partNumber: '200-88123-D',
          name: 'PCBA, Main Logic Board',
          imageUrl: getImg('Mainboard'),
          revision: 'D.11',
          state: LifecycleState.Prototype,
          type: ComponentType.Assembly,
          quantity: 1,
          unit: 'EA',
          cost: 65.00,
          currency: 'USD',
          targetCost: 60.00,
          variants: ['Common'],
          children: [
            {
              id: 'n2-3-1',
              partNumber: '100-55512-A',
              name: 'SoC, Snapdragon 8 Gen 3',
              imageUrl: getImg('SoC'),
              revision: 'A',
              state: LifecycleState.Released,
              type: ComponentType.Part,
              quantity: 1,
              unit: 'EA',
              cost: 35.00,
              currency: 'USD',
              manufacturer: 'Qualcomm',
              mpn: 'SM8650',
              refDes: 'U100',
              variants: ['Common'],
              weightG: 1.2
            },
            {
              id: 'n2-3-aux-1',
              partNumber: 'M-SOLDER-05',
              name: 'Solder Paste, SAC305',
              revision: 'A',
              state: LifecycleState.Released,
              type: ComponentType.Material,
              quantity: 0.5, // Grams per board
              unit: 'G',
              cost: 0.15,
              currency: 'USD',
              isAuxiliary: true,
              weightG: 0.5
            },
             {
              id: 'n2-3-5',
              partNumber: 'R-0402-10K-1',
              name: 'Resistor, 10k, 5%, 0402',
              revision: 'A',
              state: LifecycleState.Released,
              type: ComponentType.Part,
              quantity: 5,
              unit: 'EA',
              cost: 0.002,
              currency: 'USD',
              manufacturer: 'Yageo',
              refDes: 'R12, R14, R55, R89, R90',
              variants: ['Common'],
              weightG: 0.01,
              moq: 10000,
              spq: 5000
            }
          ]
        },
        {
          id: 'n2-5',
          partNumber: '500-22101-A',
          name: 'Screw, M1.2x3, Torx',
          revision: 'A',
          state: LifecycleState.Released,
          type: ComponentType.Part,
          quantity: 14,
          unit: 'EA',
          cost: 0.01,
          currency: 'USD',
          manufacturer: 'Generic',
          variants: ['Common'],
          weightG: 0.05,
          moq: 5000,
          spq: 1000
        }
      ]
    }
  ]
};

export const previousBOM: BOMNode = {
  id: 'root-prev',
  partNumber: '800-00234-A',
  name: 'Top Level Assembly, zPhone Pro',
  revision: 'A.01', 
  state: LifecycleState.Prototype,
  type: ComponentType.Assembly,
  quantity: 1,
  unit: 'EA',
  cost: 0,
  currency: 'USD',
  children: []
};