import { BOMNode, ComponentType, LifecycleState } from '../types';

export const mockProject: any = {
  id: 'PRJ-2024-001',
  name: 'zPhone Pro Max',
  code: 'ZPM-14',
  sku: 'Multi-SKU Config',
  phase: 'DVT',
  lastModified: '2024-05-20T14:30:00Z',
  totalCost: 142.50
};

export const complexBOM: BOMNode = {
  id: 'root',
  partNumber: '800-00234-A',
  name: 'Top Level Assembly, zPhone Pro',
  revision: 'A.02',
  state: LifecycleState.Prototype,
  type: ComponentType.Assembly,
  quantity: 1,
  unit: 'EA',
  cost: 0, // calculated
  currency: 'USD',
  targetCost: 135.00, // Slightly over budget (142.50 actual)
  variants: ['Common'],
  history: [
    {
      revision: 'A.02',
      date: '2024-05-20',
      author: 'Alex Chen',
      description: 'Updated main assembly for DVT build. Replaced screws and updated packaging.',
      changeType: 'Minor'
    },
    {
      revision: 'A.01',
      date: '2024-04-10',
      author: 'Sarah Jones',
      description: 'Initial Prototype release for EVT. Integration of new OLED module.',
      changeType: 'Major'
    }
  ],
  children: [
    {
      id: 'n1',
      partNumber: '700-00112-B',
      name: 'Packaging Assy, Retail',
      revision: 'B.01',
      state: LifecycleState.Draft,
      type: ComponentType.Assembly,
      quantity: 1,
      unit: 'EA',
      cost: 4.50,
      currency: 'USD',
      targetCost: 5.00, // Under budget
      leadTimeWeeks: 4,
      variants: ['Common'],
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
          variants: ['Common']
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
          variants: ['US-Only']
        },
        {
          id: 'n1-3',
          partNumber: '600-99822-EU',
          name: 'Insert, Molded Pulp (EU Type)',
          revision: 'A',
          state: LifecycleState.Released,
          type: ComponentType.Part,
          quantity: 1,
          unit: 'EA',
          cost: 0.85,
          currency: 'USD',
          manufacturer: 'GreenPack',
          variants: ['EU-Only']
        }
      ]
    },
    {
      id: 'n2',
      partNumber: '700-01000-C',
      name: 'Main Device Assembly',
      revision: 'C.05',
      state: LifecycleState.InReview,
      type: ComponentType.Assembly,
      quantity: 1,
      unit: 'EA',
      cost: 0,
      currency: 'USD',
      targetCost: 120.00, // Over budget
      variants: ['Common'],
      children: [
        {
          id: 'n2-1',
          partNumber: '400-00551-A',
          name: 'Display Module, OLED 6.7"',
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
          history: [
             {
               revision: 'A',
               date: '2024-02-01',
               author: 'Mike Ross',
               description: 'Selected Samsung panel for DVT.',
               changeType: 'Initial'
             }
          ],
          avl: [
            { id: 'a1', manufacturer: 'Samsung Display', mpn: 'AMS667YK01', status: 'Preferred' },
            { id: 'a2', manufacturer: 'BOE', mpn: 'BF067OLED', status: 'Alternate' },
            { id: 'a3', manufacturer: 'LG Display', mpn: 'LH670OLED', status: 'Pending' }
          ]
        },
        {
          id: 'n2-2',
          partNumber: '300-11200-B',
          name: 'Battery Pack, 4500mAh',
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
          avl: [
             { id: 'b1', manufacturer: 'ATL', mpn: '455060-2S', status: 'Preferred' },
             { id: 'b2', manufacturer: 'Desay', mpn: 'DS-4500-2', status: 'Alternate' }
          ]
        },
        {
          id: 'n2-3',
          partNumber: '200-88123-D',
          name: 'PCBA, Main Logic Board',
          revision: 'D.11',
          state: LifecycleState.Prototype,
          type: ComponentType.Assembly,
          quantity: 1,
          unit: 'EA',
          cost: 65.00,
          currency: 'USD',
          targetCost: 60.00, // Significantly over budget
          variants: ['Common'],
          children: [
            {
              id: 'n2-3-1',
              partNumber: '100-55512-A',
              name: 'SoC, Snapdragon 8 Gen 3',
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
              variants: ['Common']
            },
            {
              id: 'n2-3-2',
              partNumber: '110-22311-B',
              name: 'Memory, LPDDR5X 16GB',
              revision: 'B',
              state: LifecycleState.Released,
              type: ComponentType.Part,
              quantity: 1,
              unit: 'EA',
              cost: 18.00,
              currency: 'USD',
              manufacturer: 'Micron',
              mpn: 'MT62F2G64',
              refDes: 'U200',
              variants: ['Pro-Model'],
              avl: [
                { id: 'm1', manufacturer: 'Micron', mpn: 'MT62F2G64', status: 'Preferred' },
                { id: 'm2', manufacturer: 'SK Hynix', mpn: 'H9HCNNNCPMML', status: 'Alternate' }
              ]
            },
            {
              id: 'n2-3-3',
              partNumber: '120-11100-A',
              name: 'PMIC, Main',
              revision: 'A',
              state: LifecycleState.Released,
              type: ComponentType.Part,
              quantity: 2,
              unit: 'EA',
              cost: 1.25,
              currency: 'USD',
              manufacturer: 'Qualcomm',
              refDes: 'U401, U402',
              variants: ['Common']
            },
            {
              id: 'n2-3-4',
              partNumber: '150-00291-C',
              name: 'Connector, USB-C Waterproof',
              revision: 'C',
              state: LifecycleState.Released,
              type: ComponentType.Part,
              quantity: 1,
              unit: 'EA',
              cost: 0.45,
              currency: 'USD',
              manufacturer: 'Luxshare',
              refDes: 'J1',
              variants: ['Common']
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
              avl: [
                  { id: 'r1', manufacturer: 'Yageo', mpn: 'RC0402JR-0710KL', status: 'Preferred' },
                  { id: 'r2', manufacturer: 'Murata', mpn: 'MCR01MZPJ103', status: 'Alternate' },
                  { id: 'r3', manufacturer: 'Samsung', mpn: 'RC1005J103CS', status: 'Alternate' },
                  { id: 'r4', manufacturer: 'Walsin', mpn: 'WR04X103 JTL', status: 'Alternate' }
              ]
            },
            // DUPLICATE REFDES SCENARIO: R89 repeated
            {
              id: 'n2-3-6-error',
              partNumber: 'R-0402-1K-1',
              name: 'Resistor, 1k, 5%, 0402',
              revision: 'A',
              state: LifecycleState.Released,
              type: ComponentType.Part,
              quantity: 1,
              unit: 'EA',
              cost: 0.002,
              currency: 'USD',
              manufacturer: 'Yageo',
              refDes: 'R89', // Intentionally Duplicate with R-0402-10K-1 above
              variants: ['Common']
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
          variants: ['Common']
        }
      ]
    },
    {
      id: 'n3',
      partNumber: 'SW-10001',
      name: 'Firmware, Bootloader',
      revision: '1.2.0',
      state: LifecycleState.Released,
      type: ComponentType.Software,
      quantity: 1,
      unit: 'LIC',
      cost: 0,
      currency: 'USD',
      variants: ['Common']
    }
  ]
};

// Previous Revision for Comparison (v1.0 vs v2.0 logic)
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
  children: [
     // ... (Previous data kept simple for brevity, but technically would lack RefDes in old version if this was a database migration)
    {
      id: 'n1-prev',
      partNumber: '700-00112-B',
      name: 'Packaging Assy, Retail',
      revision: 'B.00',
      state: LifecycleState.Released,
      type: ComponentType.Assembly,
      quantity: 1,
      unit: 'EA',
      cost: 4.00,
      currency: 'USD',
      children: [
        {
          id: 'n1-1-prev',
          partNumber: '600-99821-A',
          name: 'Box, Rigid, Magnetic Closure',
          revision: 'A',
          state: LifecycleState.Released,
          type: ComponentType.Part,
          quantity: 1,
          unit: 'EA',
          cost: 2.20,
          currency: 'USD',
          manufacturer: 'PakSource'
        }
      ]
    },
    {
        id: 'n2-prev',
        partNumber: '700-01000-C',
        name: 'Main Device Assembly',
        revision: 'C.04',
        state: LifecycleState.InReview,
        type: ComponentType.Assembly,
        quantity: 1,
        unit: 'EA',
        cost: 0,
        currency: 'USD',
        children: [] 
    }
  ]
};