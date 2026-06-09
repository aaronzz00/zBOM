import type {
  CoreBOMNode,
  CorePart,
  CoreToolingMilestone,
  CoreWorkspace,
  CreateBOMNodeInput,
  CreatePartInput,
  CreateToolingRecordInput,
  ToolingRecord,
} from '../../domain/coreTypes';
import { CoreRepositoryError } from '../../domain/coreTypes';
import { TOOLING_CATEGORIES, TOOLING_STATUSES } from '../../domain/toolingTypes';
import type { PricingTier } from '../../types';

const normalizePartNumber = (partNumber: string) => partNumber.trim().toUpperCase();

export function assertUniquePartNumber(workspace: CoreWorkspace, partNumber: string, exceptPartId?: string) {
  const normalized = normalizePartNumber(partNumber);
  const duplicate = workspace.parts.find((part) => (
    normalizePartNumber(part.partNumber) === normalized && part.id !== exceptPartId
  ));

  if (duplicate) {
    throw new CoreRepositoryError(
      'CONFLICT',
      `Part number ${partNumber} already exists.`,
      { partNumber, duplicatePartId: duplicate.id },
    );
  }
}

export function validatePricingTiers(pricingTiers: PricingTier[] | undefined) {
  if (!pricingTiers) {
    return;
  }

  for (const tier of pricingTiers) {
    if (!Number.isFinite(tier.minQty) || tier.minQty <= 0) {
      throw new CoreRepositoryError('VALIDATION', 'Pricing tier minimum quantity must be greater than zero.', { tier });
    }
    if (!Number.isFinite(tier.price) || tier.price < 0) {
      throw new CoreRepositoryError('VALIDATION', 'Pricing tier price must be zero or greater.', { tier });
    }
  }
}

export function validatePartInput(input: CreatePartInput) {
  if (!input.partNumber.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Part number is required.');
  }
  if (!input.description.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Part description is required.');
  }
  if (!input.category.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Part category is required.');
  }
  if (input.cost !== undefined && (!Number.isFinite(input.cost) || input.cost < 0)) {
    throw new CoreRepositoryError('VALIDATION', 'Part cost must be zero or greater.', { cost: input.cost });
  }
  if (input.moq !== undefined && (!Number.isFinite(input.moq) || input.moq < 0)) {
    throw new CoreRepositoryError('VALIDATION', 'MOQ must be zero or greater.', { moq: input.moq });
  }
  if (input.spq !== undefined && (!Number.isFinite(input.spq) || input.spq < 0)) {
    throw new CoreRepositoryError('VALIDATION', 'SPQ must be zero or greater.', { spq: input.spq });
  }
  validatePricingTiers(input.pricingTiers);
}

export function validatePartUpdates(updates: Partial<CorePart>) {
  if (updates.partNumber !== undefined && !updates.partNumber.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Part number is required.');
  }
  if (updates.description !== undefined && !updates.description.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Part description is required.');
  }
  if (updates.cost !== undefined && (!Number.isFinite(updates.cost) || updates.cost < 0)) {
    throw new CoreRepositoryError('VALIDATION', 'Part cost must be zero or greater.', { cost: updates.cost });
  }
  validatePricingTiers(updates.pricingTiers);
}

export function validateCreateBOMNodeInput(workspace: CoreWorkspace, input: CreateBOMNodeInput) {
  if (!input.parentId.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Parent BOM node is required.');
  }
  const bomId = input.bomId ?? workspace.boms[0]?.id;
  const parent = workspace.bomNodes.find((node) => node.id === input.parentId && node.bomId === bomId);
  if (!parent) {
    throw new CoreRepositoryError('NOT_FOUND', 'Parent BOM node was not found.', { parentId: input.parentId });
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new CoreRepositoryError('VALIDATION', 'BOM quantity must be greater than zero.', { quantity: input.quantity });
  }
  if (!input.unit.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'BOM unit is required.');
  }
  if (!input.partId && !input.localItem) {
    throw new CoreRepositoryError('VALIDATION', 'BOM node must reference a library part or define a local item.');
  }
  if (input.partId && !workspace.parts.some((part) => part.id === input.partId && part.active)) {
    throw new CoreRepositoryError('NOT_FOUND', 'Referenced part was not found or is inactive.', { partId: input.partId });
  }
  if (input.partRevisionId && !workspace.partRevisions.some((revision) => revision.id === input.partRevisionId)) {
    throw new CoreRepositoryError('NOT_FOUND', 'Referenced part revision was not found.', { partRevisionId: input.partRevisionId });
  }
  if (input.localItem && (!input.localItem.partNumber.trim() || !input.localItem.name.trim())) {
    throw new CoreRepositoryError('VALIDATION', 'Local BOM item part number and name are required.');
  }
}

export function validateBOMNodeUpdates(updates: Partial<CoreBOMNode>) {
  if (updates.quantity !== undefined && (!Number.isFinite(updates.quantity) || updates.quantity <= 0)) {
    throw new CoreRepositoryError('VALIDATION', 'BOM quantity must be greater than zero.', { quantity: updates.quantity });
  }
  if (updates.unit !== undefined && !updates.unit.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'BOM unit is required.');
  }
  if (updates.cost !== undefined && (!Number.isFinite(updates.cost) || updates.cost < 0)) {
    throw new CoreRepositoryError('VALIDATION', 'BOM node cost must be zero or greater.', { cost: updates.cost });
  }
}

export function validateMilestone(updates: Partial<CoreToolingMilestone>) {
  if (updates.status && !['not-started', 'in-progress', 'done', 'blocked'].includes(updates.status)) {
    throw new CoreRepositoryError('VALIDATION', 'Invalid tooling milestone status.', { status: updates.status });
  }
  if (updates.status === 'blocked' && !updates.blockerReason && updates.blockerReason !== undefined) {
    throw new CoreRepositoryError('VALIDATION', 'Blocked milestones require a blocker reason.');
  }
}

export function validateToolingRecordInput(input: CreateToolingRecordInput) {
  if (!input.designMasterPartId.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Design-master part is required.');
  }
  if (!input.name.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Tooling name is required.');
  }
  if (!TOOLING_CATEGORIES.includes(input.type)) {
    throw new CoreRepositoryError('VALIDATION', 'Invalid tooling type.', { type: input.type });
  }
  if (input.status !== undefined && !TOOLING_STATUSES.includes(input.status)) {
    throw new CoreRepositoryError('VALIDATION', 'Invalid tooling status.', { status: input.status });
  }
  if (input.cavityCount !== undefined && !input.cavityCount.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Cavity count cannot be empty.', { cavityCount: input.cavityCount });
  }
  if (input.leadTimeDays !== undefined && (!Number.isFinite(input.leadTimeDays) || input.leadTimeDays <= 0)) {
    throw new CoreRepositoryError('VALIDATION', 'Lead time must be greater than zero days.', { leadTimeDays: input.leadTimeDays });
  }
}

export function validateToolingRecordUpdates(updates: Partial<ToolingRecord>) {
  if (updates.name !== undefined && !updates.name.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Tooling name is required.');
  }
  if (updates.type !== undefined && !TOOLING_CATEGORIES.includes(updates.type)) {
    throw new CoreRepositoryError('VALIDATION', 'Invalid tooling type.', { type: updates.type });
  }
  if (updates.status !== undefined && !TOOLING_STATUSES.includes(updates.status)) {
    throw new CoreRepositoryError('VALIDATION', 'Invalid tooling status.', { status: updates.status });
  }
  if (updates.cavityCount !== undefined && !updates.cavityCount.trim()) {
    throw new CoreRepositoryError('VALIDATION', 'Cavity count cannot be empty.', { cavityCount: updates.cavityCount });
  }
  if (updates.leadTimeDays !== undefined && (!Number.isFinite(updates.leadTimeDays) || updates.leadTimeDays <= 0)) {
    throw new CoreRepositoryError('VALIDATION', 'Lead time must be greater than zero days.', { leadTimeDays: updates.leadTimeDays });
  }
}
