import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { AppHeader } from '@/components/AppHeader';

export function AppLayout() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar />
      <div className="flex flex-1 flex-col pl-60">
        <AppHeader
          mes={mes}
          ano={ano}
          onMesChange={setMes}
          onAnoChange={setAno}
        />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ mes, ano }} />
        </main>
      </div>
    </div>
  );
}
