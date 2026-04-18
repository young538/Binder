import { TopNav } from '@/components/nav/TopNav';
import { BottomNav } from '@/components/nav/BottomNav';
import { StoreProvider } from '@/components/providers/StoreProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <TopNav />
      <main className="pb-16 lg:pb-0">{children}</main>
      <BottomNav />
    </StoreProvider>
  );
}
