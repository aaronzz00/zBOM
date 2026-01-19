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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header project={mockProject} />
        <main className="flex-1 overflow-hidden flex flex-col relative">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;