/**
 * App Component
 *
 * Root application component that sets up the SimulationProvider and ToastProvider
 * contexts and renders the main CommandCenter layout with ToastContainer.
 *
 * @see design.md for component tree structure
 */

import { SimulationProvider } from '@/context/SimulationContext';
import { ToastProvider } from '@/context/ToastContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSimulation } from '@/hooks/useSimulation';
import { CommandCenter } from '@/components/CommandCenter';
import { ToastContainer } from '@/components/ToastContainer';

/**
 * Inner app content that uses simulation context
 * Handles keyboard shortcuts and renders the main layout
 */
function AppContent(): React.ReactElement {
  const { toggleDemoMode, selectZone } = useSimulation();

  // Set up keyboard shortcuts
  useKeyboardShortcuts({
    onToggleDemoMode: toggleDemoMode,
    onEscape: () => selectZone(null),
  });

  return (
    <>
      <CommandCenter />
      <ToastContainer />
    </>
  );
}

/**
 * Main App component wrapped with SimulationProvider and ToastProvider
 */
function App(): React.ReactElement {
  return (
    <ToastProvider>
      <SimulationProvider>
        <AppContent />
      </SimulationProvider>
    </ToastProvider>
  );
}

export default App;
