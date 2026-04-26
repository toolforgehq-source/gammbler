import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import AuthInitializer from '@/components/layout/AuthInitializer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthInitializer>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </div>
    </AuthInitializer>
  );
}
