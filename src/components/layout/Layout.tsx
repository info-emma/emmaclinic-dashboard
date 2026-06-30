import { useState } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const isDesktopDefault = window.innerWidth >= 1024;
  const [sidebarOpen, setSidebarOpen] = useState(isDesktopDefault);
  const [pinned, setPinned] = useState(isDesktopDefault);

  const handleMenuClick = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    if (!next) setPinned(false); // unpin when manually closed
  };

  const handleClose = () => {
    if (!pinned) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-emma-white font-inter">
      <Sidebar open={sidebarOpen} pinned={pinned} onClose={handleClose} onTogglePin={() => setPinned(p => !p)} />

      {/* Mobile overlay backdrop — only when not pinned */}
      {sidebarOpen && !pinned && (
        <div
          className="fixed inset-0 z-40 bg-emma-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header onMenuClick={handleMenuClick} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-emma-white">
          {children}
        </main>
      </div>
    </div>
  );
}
