import TrendingSidebar from './TrendingSidebar';
import VipClassifiedsWidget from './VipClassifiedsWidget';
import MostWanted from './MostWanted';
import PollWidget from './PollWidget';
import AdSlot from './ads/AdSlot';
import ErrorBoundary from './ErrorBoundary';

export default function HomeSidebarRail({ ads }) {
  return (
    <div className="space-y-5">
      <ErrorBoundary fallback={null}>
        <TrendingSidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <VipClassifiedsWidget />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <MostWanted />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <PollWidget />
      </ErrorBoundary>
      <AdSlot ads={ads} slot="home.sidebar.1" pageType="home" />
      <AdSlot ads={ads} slot="home.sidebar.2" pageType="home" />
    </div>
  );
}
