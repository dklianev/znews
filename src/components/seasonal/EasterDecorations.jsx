import { usePublicData } from '../../context/DataContext';
import * as ReactRouterDom from 'react-router-dom';
import { getEggPlacements, getHuntPlacements, isHuntActive, shouldRenderDecorations } from '../../utils/seasonalCampaigns';
import EasterDecorationSlot from './EasterDecorationSlot';
import CollectibleEasterEgg from './CollectibleEasterEgg';

const POSITION_MAP = {
  'top-right': 'top-2 right-2',
  'top-right-inset': 'top-14 right-6 md:top-10 md:right-10',
  'top-left': 'top-2 left-2',
  'bottom-right': 'bottom-2 right-2',
  'bottom-right-inset': 'bottom-2 right-8 md:bottom-0 md:right-14',
  'bottom-left': 'bottom-2 left-2',
  'bottom-left-inset': 'bottom-4 left-4',
};

export default function EasterDecorations({ pageId, hunt }) {
  const { siteSettings } = usePublicData();
  const outletContext = typeof ReactRouterDom.useOutletContext === 'function'
    ? ReactRouterDom.useOutletContext()
    : null;
  const resolvedHunt = hunt || outletContext?.easterHunt || null;
  const huntMode = resolvedHunt?.huntActive && isHuntActive(siteSettings);
  const placements = huntMode
    ? getHuntPlacements(pageId, siteSettings)
    : shouldRenderDecorations(siteSettings)
      ? getEggPlacements(pageId, siteSettings)
      : [];

  if (placements.length === 0) return null;

  return placements.map((slot, i) => {
    if (huntMode) {
      const posClass = POSITION_MAP[slot.position] || POSITION_MAP['top-right'];
      return (
        <div
          key={slot.eggId || `easter-hunt-${pageId}-${i}`}
          className={`absolute ${posClass} z-[4] ${slot.mobileHidden ? 'hidden md:block' : ''}`}
          aria-hidden="false"
        >
          {slot.withTape && (
            <div
              className="pointer-events-none absolute -top-2 left-1/2 z-[5] h-3 w-8 -translate-x-1/2 border border-amber-300/50 bg-amber-100/80"
              style={{ transform: `translateX(-50%) rotate(${slot.tapeRotation || '0deg'})` }}
            />
          )}
          <CollectibleEasterEgg
            eggId={slot.eggId}
            variant={slot.variant}
            size={slot.size}
            isCollected={resolvedHunt.isCollected(slot.eggId)}
            onCollect={resolvedHunt.collectEgg}
          />
        </div>
      );
    }

    return (
      <EasterDecorationSlot
        key={`easter-${pageId}-${i}`}
        position={slot.position}
        variant={slot.variant}
        size={slot.size}
        withTape={slot.withTape}
        tapeRotation={slot.tapeRotation}
        mobileHidden={slot.mobileHidden}
        opacityClass={slot.opacityClass}
      />
    );
  });
}
