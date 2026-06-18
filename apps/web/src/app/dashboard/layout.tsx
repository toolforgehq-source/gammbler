import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import AuthInitializer from '@/components/layout/AuthInitializer';
import PushNotifications from '@/components/PushNotifications';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthInitializer>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 ml-0 lg:ml-64 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 pt-16 lg:p-8 lg:pt-8">
            {children}
            <div className="mt-8 pb-4 text-center text-[10px] text-muted-dark/50 space-y-1">
              <p>
                Gammbler is NOT a sportsbook and does not accept wagers. This is a skill-based analytics platform.{' '}
                <Link href="/responsible-gambling" className="underline hover:text-muted-dark">Responsible Gambling</Link>
                {' | '}
                <Link href="/terms" className="underline hover:text-muted-dark">Terms</Link>
                {' | '}
                <Link href="/privacy" className="underline hover:text-muted-dark">Privacy</Link>
              </p>
              <p>If you or someone you know has a gambling problem, call 1-800-522-4700.</p>
            </div>
          </main>
        </div>
        <PushNotifications />
      </div>
    </AuthInitializer>
  );
}
