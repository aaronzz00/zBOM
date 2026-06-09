import { z } from 'zod';
import { LifecycleState, ComponentType, UserRole } from './types';

// Enums
export const LifecycleStateSchema = z.nativeEnum(LifecycleState);
export const ComponentTypeSchema = z.nativeEnum(ComponentType);
export const UserRoleSchema = z.nativeEnum(Object.freeze({
    ADMIN: 'ADMIN',
    ENG_LEAD: 'ENG_LEAD',
    SOURCING: 'SOURCING',
    VIEWER: 'VIEWER'
} as const)); // nativeEnum works best with numeric or string enums, standard object for union

export const PricingTierSchema = z.object({
    minQty: z.number().min(0),
    price: z.number().min(0)
});

export const AVLEntrySchema = z.object({
    id: z.string(),
    manufacturer: z.string(),
    mpn: z.string(),
    status: z.enum(['Preferred', 'Alternate', 'DoNotUse', 'Pending'])
});

export const AttachmentSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['datasheet', 'cad', 'drawing', 'other']),
    url: z.string().url(),
    size: z.string().optional(),
    uploadDate: z.string()
});

export const BOMNodeSchema: z.ZodType<any> = z.lazy(() => z.object({
    id: z.string(),
    partNumber: z.string().min(1, "Part Number is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    revision: z.string(),
    state: LifecycleStateSchema,
    type: ComponentTypeSchema,
    quantity: z.number().min(0),
    unit: z.string(),
    cost: z.number().min(0),
    currency: z.string(),
    manufacturer: z.string().optional(),
    mpn: z.string().optional(),
    leadTimeWeeks: z.number().optional(),

    // Consumer Electronics Support
    refDes: z.string().optional(),
    variants: z.array(z.string()).optional(),

    // P1 - Target Costing
    targetCost: z.number().optional(),

    // Feature: Procurement Intelligence
    moq: z.number().optional(),
    spq: z.number().optional(),
    pricingTiers: z.array(PricingTierSchema).optional(),

    // Feature: Physical Attributes
    weightG: z.number().optional(),

    // Feature: MBOM Support
    isAuxiliary: z.boolean().optional(),

    // Supply Chain
    avl: z.array(AVLEntrySchema).optional(),

    // P1: Data Flexibility
    customAttributes: z.record(z.string(), z.any()).optional(),
    attachments: z.array(AttachmentSchema).optional(),

    children: z.array(BOMNodeSchema).optional(),
    isExpanded: z.boolean().optional(),
    // history: RevisionLog[] - omitted for now
}));

export const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['ADMIN', 'ENG_LEAD', 'SOURCING', 'VIEWER']), // Matching UserRole manually for Zod
    avatarInitials: z.string()
});
