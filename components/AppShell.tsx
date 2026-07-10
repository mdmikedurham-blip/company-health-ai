"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ExplainProvider } from "./explain/ExplainProvider";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  flush?: boolean;
}

export function AppShell({ children, title, subtitle, flush = false }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ExplainProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            title={title}
            subtitle={subtitle}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 overflow-y-auto">
            {flush ? (
              children
            ) : (
              <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
    </ExplainProvider>
  );
}
