import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { BOMEditor } from './pages/BOMEditor';
import { BOMCompare } from './pages/BOMCompare';
import { PartLibrary } from './pages/PartLibrary';
import { SupplyChain } from './pages/SupplyChain';
import { ECOManager } from './pages/ECOManager';
import { mockProject } from './data/mockBOM';

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

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'bom':
        return <BOMEditor />;
      case 'eco':
        return <ECOManager />;
      case 'compare':
        return <BOMCompare />;
      case 'parts':
        return <PartLibrary />;
      case 'suppliers':
        return <SupplyChain />;
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
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <ErrorBoundary>
            <Header project={mockProject} />
          </ErrorBoundary>
          <main className="flex-1 overflow-hidden flex flex-col relative">
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;