import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SetupPage } from './pages/SetupPage';
import { FeedbackOverlay } from './components/FeedbackOverlay';
import { useBOMStore } from './stores/useBOMStore';
import { useToolingStore } from './stores/useToolingStore';

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
import { SettingsPage } from './pages/SettingsPage';

const PageFallback = () => (
  <div className="flex flex-1 items-center justify-center bg-slate-50 text-sm font-medium text-slate-400" role="status">
    Loading module...
  </div>
);

const DevelopmentPreviewFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
      Development Preview - not part of the production core test scope.
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">
      {children}
    </div>
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
  const { project, projects, setActiveProject } = useBOMStore();
  const refreshToolingFromRepository = useToolingStore((state) => state.loadFromRepository);

  const handleProjectChange = (projectId: string) => {
    setActiveProject(projectId);
    refreshToolingFromRepository();
  };

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ page?: string }>).detail;
      if (detail?.page) {
        setActivePage(detail.page);
      }
    };

    window.addEventListener('zbom:navigate', handleNavigate);
    return () => window.removeEventListener('zbom:navigate', handleNavigate);
  }, []);

  const renderContent = () => {
    switch (activePage) {
	      case 'dashboard':
	        return <DevelopmentPreviewFrame><Dashboard /></DevelopmentPreviewFrame>;
      case 'bom':
        return <BOMEditor />;
	      case 'product-matrix':
	        return <DevelopmentPreviewFrame><ProductMatrixCenter /></DevelopmentPreviewFrame>;
	      case 'ebom-architecture':
	        return <DevelopmentPreviewFrame><EBOMArchitectureWorkspace /></DevelopmentPreviewFrame>;
	      case 'mbom-delta':
	        return <DevelopmentPreviewFrame><MBOMDeltaConsole /></DevelopmentPreviewFrame>;
      case 'tooling':
        return <ToolingHub />;
	      case 'eco':
	        return <DevelopmentPreviewFrame><ECOManager /></DevelopmentPreviewFrame>;
	      case 'compare':
	        return <DevelopmentPreviewFrame><BOMCompare /></DevelopmentPreviewFrame>;
      case 'parts':
        return <PartLibrary />;
	      case 'suppliers':
	        return <DevelopmentPreviewFrame><SupplyChain /></DevelopmentPreviewFrame>;
      case 'erp':
        return (
	          <DevelopmentPreviewFrame><SetupPage
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
	          /></DevelopmentPreviewFrame>
	        );
	      case 'settings':
	        return (
	          <DevelopmentPreviewFrame><SettingsPage /></DevelopmentPreviewFrame>
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
            <Header project={project} projects={projects} onProjectChange={handleProjectChange} />
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
