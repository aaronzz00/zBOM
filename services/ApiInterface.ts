import { BOMNode, Project, User, LibraryPart, Supplier, ECO } from '../types';

export interface ApiClient {
    // Project
    getProject(id: string): Promise<Project>;
    updateProject(id: string, updates: Partial<Project>): Promise<Project>;

    // BOM
    getBOM(projectId: string): Promise<BOMNode>;
    updateBOMNode(nodeId: string, updates: Partial<BOMNode>): Promise<BOMNode>;
    addBOMNode(parentId: string, node: BOMNode): Promise<BOMNode>;
    deleteBOMNode(nodeId: string): Promise<void>;

    // Library
    searchLibrary(query: string): Promise<LibraryPart[]>;
    getLibraryPart(id: string): Promise<LibraryPart>;

    // Suppliers
    getSuppliers(): Promise<Supplier[]>;

    // ECOs
    getECOs(projectId: string): Promise<ECO[]>;
    createECO(eco: ECO): Promise<ECO>;

    // Auth
    getCurrentUser(): Promise<User>;
}

// Mock Implementation for Phase 4 transition
export class MockApiClient implements ApiClient {
    async getProject(id: string): Promise<Project> {
        return Promise.resolve({
            id,
            code: 'ZPM-14',
            name: 'Zephyr Omni-Drone',
            revision: 'A.02',
            sku: 'ZOD-2024-X1',
            phase: 'PVT',
            totalCost: 142.50,
            totalWeight: 450,
            lastUpdated: new Date().toISOString()
        });
    }

    async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
        return Promise.resolve({
            id,
            code: 'ZPM-14',
            name: 'Zephyr Omni-Drone',
            revision: 'A.02',
            sku: 'ZOD-2024-X1',
            phase: 'PVT',
            totalCost: 142.50,
            totalWeight: 450,
            lastUpdated: new Date().toISOString(),
            ...updates
        })
    }

    async getBOM(projectId: string): Promise<BOMNode> {
        // Return empty or mock depending on needs. 
        // Consumers should likely continue using useBOMStore for now until full migration.
        throw new Error("Method not implemented.");
    }

    async updateBOMNode(nodeId: string, updates: Partial<BOMNode>): Promise<BOMNode> {
        throw new Error("Method not implemented.");
    }

    async addBOMNode(parentId: string, node: BOMNode): Promise<BOMNode> {
        throw new Error("Method not implemented.");
    }

    async deleteBOMNode(nodeId: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async searchLibrary(query: string): Promise<LibraryPart[]> {
        return Promise.resolve([]);
    }

    async getLibraryPart(id: string): Promise<LibraryPart> {
        throw new Error("Method not implemented.");
    }

    async getSuppliers(): Promise<Supplier[]> {
        return Promise.resolve([]);
    }

    async getECOs(projectId: string): Promise<ECO[]> {
        return Promise.resolve([]);
    }

    async createECO(eco: ECO): Promise<ECO> {
        return Promise.resolve(eco);
    }

    async getCurrentUser(): Promise<User> {
        return Promise.resolve({ id: 'u1', name: 'Mock User', email: 'mock@zbom.app', role: 'ADMIN', lastLogin: new Date().toISOString() });
    }
}
