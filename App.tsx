import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SetupPage } from './pages/SetupPage';
import { FeedbackOverlay } from './components/FeedbackOverlay';
import { useBOMStore } from './stores/useBOMStore';
import { useToolingStore } from './stores/useToolingStore';
import { useAuthStore } from './stores/useAuthStore';
import {
  isBackendApiConfigured,
  isLocalRepositoryFallbackEnabled,
  loadBackendWorkspace,
} from './services/backendApi';

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
  const {
    project,
    projects,
    setActiveProject,
    setApiHydrationLoading,
    applyBackendWorkspace,
    markBackendHydrationError,
  } = useBOMStore();
  const currentRole = useAuthStore((state) => state.currentUser.role);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const refreshToolingFromRepository = useToolingStore((state) => state.loadFromRepository);
  const applyBackendToolingWorkspace = useToolingStore((state) => state.applyBackendWorkspace);

  const applyBackendSnapshot = (snapshot: Awaited<ReturnType<typeof loadBackendWorkspace>>) => {
    applyBackendWorkspace(snapshot);
    applyBackendToolingWorkspace(snapshot);
  };

  const handleProjectChange = async (projectId: string) => {
    if (isBackendApiConfigured()) {
      setApiHydrationLoading();
      try {
        const snapshot = await loadBackendWorkspace(currentRole, projectId);
        applyBackendSnapshot(snapshot);
      } catch (error) {
        markBackendHydrationError(error);
        if (isLocalRepositoryFallbackEnabled()) {
          setActiveProject(projectId);
          refreshToolingFromRepository();
        }
      }
      return;
    }

    setActiveProject(projectId);
    refreshToolingFromRepository();
  };

  // Initialize Auth Store once on startup
  useEffect(() => {
    if (isBackendApiConfigured()) {
      initializeAuth().finally(() => {
        setAuthInitialized(true);
      });
    } else {
      setAuthInitialized(true);
    }
  }, []);

  // Listen for write auth errors globally
  useEffect(() => {
    const handleAuthRequired = () => {
      setShowAuthModal(true);
    };
    window.addEventListener('zbom:auth-required', handleAuthRequired);
    return () => window.removeEventListener('zbom:auth-required', handleAuthRequired);
  }, []);

  // Hydrate workspace once auth is ready
  useEffect(() => {
    if (!isBackendApiConfigured() || !authInitialized) {
      return;
    }

    let cancelled = false;
    setApiHydrationLoading();
    loadBackendWorkspace(currentRole)
      .then((snapshot) => {
        if (!cancelled) {
          applyBackendSnapshot(snapshot);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          markBackendHydrationError(error);
          if (!isLocalRepositoryFallbackEnabled()) {
            console.error('Backend API hydration failed without local fallback.', error);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentRole, authInitialized]);

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
	          <SettingsPage />
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
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-md scale-100 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-300">
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-6 text-slate-900">写入权限不足 / Write Permission Denied</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    当前处于只读模式（Viewer），无法保存您的修改。要获取写入权限，请通过您电脑的飞书工具链进行授权。
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">在终端运行登录命令 / Run command in terminal</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('lark-cli auth login');
                    }}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 active:scale-95 transition-all"
                  >
                    复制 / Copy
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-xs text-slate-200">
                  <span>lark-cli auth login</span>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-2.5">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                  onClick={() => setShowAuthModal(false)}
                >
                  取消 / Cancel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 transition-all"
                  onClick={async () => {
                    await initializeAuth();
                    const role = useAuthStore.getState().currentUser.role;
                    if (role !== 'VIEWER') {
                      setShowAuthModal(false);
                      const snapshot = await loadBackendWorkspace(role);
                      applyBackendSnapshot(snapshot);
                    } else {
                      alert('未检测到有效的写入权限，请确保您在终端已成功登录飞书，且您的 OpenID 映射配置正确。');
                    }
                  }}
                >
                  我已在终端登录 / Refresh Auth
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
