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
      <div className="below-fold-section-compact">
        <ErrorBoundary fallback={null}>
          <VipClassifiedsWidget />
        </ErrorBoundary>
      </div>
      <div className="below-fold-section-compact">
        <ErrorBoundary fallback={null}>
          <MostWanted />
        </ErrorBoundary>
      </div>
      <div className="below-fold-section-compact">
        <ErrorBoundary fallback={null}>
          <PollWidget />
        </ErrorBoundary>
      </div>
      <div className="below-fold-section-compact">
        <AdSlot ads={ads} slot="home.sidebar.1" pageType="home" />
      </div>
      <div className="below-fold-section-compact">
        <AdSlot ads={ads} slot="home.sidebar.2" pageType="home" />
      </div>
    </div>
  );
}
