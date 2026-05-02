/**
 * CommandCenter Component
 *
 * Main layout component for the command center dashboard.
 * Full viewport layout with header, control panel, map view, and results panel.
 * Manages mobile drawer state for responsive behavior.
 *
 * @see design.md for layout architecture
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { HeaderBar } from './HeaderBar';
import { ControlPanel } from '@/features/controls/ControlPanel';
import { MapView } from '@/features/map/MapView';
import { ResultsPanel } from '@/features/results/ResultsPanel';

export function CommandCenter(): React.ReactElement {
  // Mobile drawer state
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  // Drawer handlers
  const openLeftPanel = useCallback(() => {
    setIsLeftPanelOpen(true);
    setIsRightPanelOpen(false); // Close other panel
  }, []);

  const closeLeftPanel = useCallback(() => {
    setIsLeftPanelOpen(false);
  }, []);

  const openRightPanel = useCallback(() => {
    setIsRightPanelOpen(true);
    setIsLeftPanelOpen(false); // Close other panel
  }, []);

  const closeRightPanel = useCallback(() => {
    setIsRightPanelOpen(false);
  }, []);

  // Close panels when clicking backdrop
  const handleBackdropClick = useCallback(() => {
    setIsLeftPanelOpen(false);
    setIsRightPanelOpen(false);
  }, []);

  const isAnyPanelOpen = isLeftPanelOpen || isRightPanelOpen;

  return (
    <div className="h-screen flex flex-col bg-surface-base">
      {/* Header */}
      <HeaderBar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Control Panel (Left) */}
        <ControlPanel isOpen={isLeftPanelOpen} onClose={closeLeftPanel} />

        {/* Map View (Center) */}
        <MapView
          onOpenLeftPanel={openLeftPanel}
          onOpenRightPanel={openRightPanel}
        />

        {/* Results Panel (Right) */}
        <ResultsPanel isOpen={isRightPanelOpen} onClose={closeRightPanel} />
      </div>

      {/* Mobile Backdrop Overlay */}
      {isAnyPanelOpen && (
        <div
          className={cn(
            'lg:hidden fixed inset-0 bg-black/50 z-10',
            'transition-opacity duration-300'
          )}
          onClick={handleBackdropClick}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleBackdropClick();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close panel"
        />
      )}
    </div>
  );
}
