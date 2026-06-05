import React, { lazy, Suspense, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SetupPage } from './pages/SetupPage';
import { mockProject } from './data/mockBOM';
import { FeedbackOverlay } from './components/FeedbackOverlay';

const Dashboard = lazy(() => import('./pages/Dashboard').then(({ Dashboard }) => ({ default: Dashboard })));
const BOMEditor = lazy(() => import('./pages/BOMEditor').then(({ BOMEditor }) => ({ default: BOMEditor })));
const ProductMatrixCenter = lazy(() => import('./pages/ProductMatrixCenter').then(({ ProductMatrixCenter }) => ({ default: ProductMatrixCenter })));
const EBOMArchitectureWorkspace = lazy(() => import('./pages/EBOMArchitectureWorkspace').then(({ EBOMArchitectureWorkspace }) => ({ default: EBOMArchitectureWorkspace })));
const MBOMDeltaConsole = lazy(() => import('./pages/MBOMDeltaConsole').then(({ MBOMDeltaConsole }) => ({ default: MBOMDeltaConsole })));
const ToolingHub = lazy(() => import('./pages/ToolingHub').then(({ ToolingHub }) => ({ default: ToolingHub })));
const ECOManager = lazy(() => import('./pages/ECOManager').then(({ ECOManager }) => ({ default: ECOManager })));
const BOMCompare = lazy(() => import('./pages/BOMCompare').then(({ BOMCompare }) => ({ default: BOMCompare })));
const PartLibrary = lazy(() => import('./pages/PartLibrary').then(({ PartLibrary }) => ({ default: PartLibrary })));
const SupplyChain = lazy(() => import('./pages/SupplyChain').then(({ SupplyChain }) => ({ default: SupplyChain })));

const PageFallback = () => (
  <div className="flex flex-1 items-center justify-center bg-slate-50 text-sm font-medium text-slate-400" role="status">
    Loading module...
  </div>
);

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <pre className="bg-red-50 p-4 rounded border border-red-200 font-mono text-sm overflow-auto">
            {this.state.error?.toString()}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const showFeedbackOverlay = import.meta.env.VITE_ENABLE_FEEDBACK_OVERLAY === 'true';

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'bom':
        return <BOMEditor />;
      case 'product-matrix':
        return <ProductMatrixCenter />;
      case 'ebom-architecture':
        return <EBOMArchitectureWorkspace />;
      case 'mbom-delta':
        return <MBOMDeltaConsole />;
      case 'tooling':
        return <ToolingHub />;
      case 'eco':
        return <ECOManager />;
      case 'compare':
        return <BOMCompare />;
      case 'parts':
        return <PartLibrary />;
      case 'suppliers':
        return <SupplyChain />;
      case 'erp':
        return (
          <SetupPage
            eyebrow="ERP Connect"
            title="ERP Connector Setup"
            description="Mock integration checklist for mapping zBOM part, cost, AVL, and lifecycle fields before connecting a production ERP endpoint."
            checklistTitle="Mock integration checklist"
            items={[
              'Map part number, revision, lifecycle state, and unit of measure fields.',
              'Confirm supplier IDs, manufacturer part numbers, MOQ, SPQ, and lead-time ownership.',
              'Review export payload rules with commercial-field permissions applied.',
              'Run a dry-run sync report before enabling any writeback path.',
            ]}
          />
        );
      case 'settings':
        return (
          <SetupPage
            eyebrow="Admin Console"
            title="System Settings"
            description="Role access and application preferences are collected here as a deterministic setup surface for frontend testing."
            checklistTitle="Configuration areas"
            items={[
              'Role access matrix and QA/demo chrome flags.',
              'Commercial field visibility defaults by role.',
              'BOM import, export, snapshot, and approval workflow preferences.',
              'Integration readiness checks for ERP and supplier audit modules.',
            ]}
          />
        );
      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Work in Progress</h2>
              <p>The module "{activePage}" is coming soon in v2.5</p>
            </div>
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
        <ErrorBoundary>
          <Sidebar activePage={activePage} onNavigate={setActivePage} />
        </ErrorBoundary>
        <div className="min-w-0 flex-1 flex flex-col h-full overflow-hidden">
          <ErrorBoundary>
            <Header project={mockProject} />
          </ErrorBoundary>
          <main className="flex-1 overflow-hidden flex flex-col relative">
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                {renderContent()}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
        {showFeedbackOverlay && <FeedbackOverlay activePage={activePage} />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
