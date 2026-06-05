import { BOMNode, Project, User, LibraryPart, Supplier, ECO } from '../types';
import type {
    AuditEvent,
    CoreActor,
    CoreBOMNode,
    CoreBOMSnapshot,
    CorePart,
    CreateBOMNodeInput,
    CreateDesignMasterPartInput,
    CreatePartInput,
    CreateToolingRecordInput,
    PartSearchInput,
    ToolingRecord,
} from '../domain/coreTypes';
import type { ToolingMilestone, ToolingMilestoneKey } from '../domain/toolingTypes';
import {
    coreRepository,
    toLegacyLibraryParts,
    type CoreRepository,
} from '../repositories/core/coreRepository';

export interface ApiClient {
    // Project
    getProject(id: string): Promise<Project>;
    updateProject(id: string, updates: Partial<Project>): Promise<Project>;

    // BOM
    getBOM(projectId: string): Promise<BOMNode>;
    updateBOMNode(nodeId: string, updates: Partial<BOMNode>): Promise<BOMNode>;
    addBOMNode(parentId: string, node: BOMNode): Promise<BOMNode>;
    deleteBOMNode(nodeId: string): Promise<void>;
    createBOMNode(input: CreateBOMNodeInput): Promise<CoreBOMNode>;
    createBOMSnapshot(bomId: string, name: string): Promise<CoreBOMSnapshot>;

    // Library
    searchLibrary(query: string): Promise<LibraryPart[]>;
    searchParts(input: PartSearchInput): Promise<CorePart[]>;
    getLibraryPart(id: string): Promise<LibraryPart>;
    createPart(input: CreatePartInput): Promise<CorePart>;
    updatePart(partId: string, updates: Partial<CorePart>): Promise<CorePart>;
    archivePart(partId: string): Promise<CorePart>;
    getPartUsage(partId: string): Promise<CoreBOMNode[]>;

    // Suppliers
    getSuppliers(): Promise<Supplier[]>;

    // Tooling
    createDesignMasterPart(input: CreateDesignMasterPartInput): Promise<void>;
    createToolingRecord(input: CreateToolingRecordInput): Promise<ToolingRecord>;
    updateToolingRecord(toolingId: string, updates: Partial<ToolingRecord>): Promise<ToolingRecord>;
    updateToolingMilestone(toolingId: string, milestoneKey: ToolingMilestoneKey, updates: Partial<ToolingMilestone>): Promise<ToolingRecord>;
    getToolingLinksForPart(partId: string): Promise<ToolingRecord[]>;
    getAuditEvents(entityType?: AuditEvent['entityType'], entityId?: string): Promise<AuditEvent[]>;

    // ECOs
    getECOs(projectId: string): Promise<ECO[]>;
    createECO(eco: ECO): Promise<ECO>;

    // Auth
    getCurrentUser(): Promise<User>;
}

// Mock Implementation for Phase 4 transition
export class MockApiClient implements ApiClient {
    constructor(private readonly repository: CoreRepository = coreRepository) {}

    private getActor(): CoreActor {
        return {
            userId: 'u1',
            name: 'Mock User',
            role: 'ADMIN',
        };
    }

    async getProject(id: string): Promise<Project> {
        const snapshot = this.repository.loadWorkspace();
        return Promise.resolve({
            id,
            code: 'ZPM-14',
            name: snapshot.boms[0]?.name ?? 'zBOM Core Workspace',
            sku: 'Multi-SKU Config',
            phase: 'PVT',
            totalCost: 142.50,
            totalWeight: 450,
            lastModified: snapshot.boms[0]?.updatedAt ?? new Date().toISOString()
        });
    }

    async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
        return Promise.resolve({
            id,
            code: 'ZPM-14',
            name: 'Zephyr Omni-Drone',
            sku: 'ZOD-2024-X1',
            phase: 'PVT',
            totalCost: 142.50,
            totalWeight: 450,
            lastModified: new Date().toISOString(),
            ...updates
        })
    }

    async getBOM(projectId: string): Promise<BOMNode> {
        return Promise.resolve(this.repository.loadWorkspace().bomTree);
    }

    async updateBOMNode(nodeId: string, updates: Partial<BOMNode>): Promise<BOMNode> {
        this.repository.updateBOMNode(nodeId, updates as Partial<CoreBOMNode>, this.getActor());
        return Promise.resolve(this.repository.loadWorkspace().bomTree);
    }

    async addBOMNode(parentId: string, node: BOMNode): Promise<BOMNode> {
        this.repository.createBOMNode({
            parentId,
            localItem: {
                partNumber: node.partNumber,
                name: node.name,
                revision: node.revision,
                type: node.type,
                cost: node.cost,
                currency: node.currency,
            },
            quantity: node.quantity,
            unit: node.unit,
        }, this.getActor());
        return Promise.resolve(this.repository.loadWorkspace().bomTree);
    }

    async deleteBOMNode(nodeId: string): Promise<void> {
        this.repository.deleteBOMNode(nodeId, this.getActor());
        return Promise.resolve();
    }

    async createBOMNode(input: CreateBOMNodeInput): Promise<CoreBOMNode> {
        return Promise.resolve(this.repository.createBOMNode(input, this.getActor()));
    }

    async createBOMSnapshot(bomId: string, name: string): Promise<CoreBOMSnapshot> {
        return Promise.resolve(this.repository.createBOMSnapshot(bomId, name, this.getActor()));
    }

    async searchLibrary(query: string): Promise<LibraryPart[]> {
        const parts = this.repository.searchParts({ query }).items;
        const partIds = new Set(parts.map((part) => part.id));
        return Promise.resolve(toLegacyLibraryParts(this.repository.loadWorkspace()).filter((part) => partIds.has(part.id)));
    }

    async searchParts(input: PartSearchInput): Promise<CorePart[]> {
        return Promise.resolve(this.repository.searchParts(input).items);
    }

    async getLibraryPart(id: string): Promise<LibraryPart> {
        const part = toLegacyLibraryParts(this.repository.loadWorkspace()).find((item) => item.id === id);
        if (!part) {
            throw new Error(`Part ${id} was not found.`);
        }
        return Promise.resolve(part);
    }

    async createPart(input: CreatePartInput): Promise<CorePart> {
        return Promise.resolve(this.repository.createPart(input, this.getActor()));
    }

    async updatePart(partId: string, updates: Partial<CorePart>): Promise<CorePart> {
        return Promise.resolve(this.repository.updatePart(partId, updates, this.getActor()));
    }

    async archivePart(partId: string): Promise<CorePart> {
        return Promise.resolve(this.repository.archivePart(partId, this.getActor()));
    }

    async getPartUsage(partId: string): Promise<CoreBOMNode[]> {
        return Promise.resolve(this.repository.getPartUsage(partId));
    }

    async getSuppliers(): Promise<Supplier[]> {
        return Promise.resolve(this.repository.loadWorkspace().suppliers);
    }

    async createDesignMasterPart(input: CreateDesignMasterPartInput): Promise<void> {
        this.repository.createDesignMasterPart(input, this.getActor());
        return Promise.resolve();
    }

    async createToolingRecord(input: CreateToolingRecordInput): Promise<ToolingRecord> {
        return Promise.resolve(this.repository.createToolingRecord(input, this.getActor()));
    }

    async updateToolingRecord(toolingId: string, updates: Partial<ToolingRecord>): Promise<ToolingRecord> {
        return Promise.resolve(this.repository.updateToolingRecord(toolingId, updates, this.getActor()));
    }

    async updateToolingMilestone(toolingId: string, milestoneKey: ToolingMilestoneKey, updates: Partial<ToolingMilestone>): Promise<ToolingRecord> {
        return Promise.resolve(this.repository.updateToolingMilestone(toolingId, milestoneKey, updates, this.getActor()));
    }

    async getToolingLinksForPart(partId: string): Promise<ToolingRecord[]> {
        return Promise.resolve(this.repository.getToolingLinksForPart(partId));
    }

    async getAuditEvents(entityType?: AuditEvent['entityType'], entityId?: string): Promise<AuditEvent[]> {
        return Promise.resolve(this.repository.getAuditEvents(entityType, entityId));
    }

    async getECOs(projectId: string): Promise<ECO[]> {
        return Promise.resolve([]);
    }

    async createECO(eco: ECO): Promise<ECO> {
        return Promise.resolve(eco);
    }

    async getCurrentUser(): Promise<User> {
        return Promise.resolve({ id: 'u1', name: 'Mock User', email: 'mock@zbom.app', role: 'ADMIN', avatarInitials: 'MU' });
    }
}
