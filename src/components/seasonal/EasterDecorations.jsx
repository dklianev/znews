import { usePublicData } from '../../context/DataContext';
import * as ReactRouterDom from 'react-router-dom';
import { shouldRenderDecorations, getEggPlacements, isHuntActive, getHuntEggId } from '../../utils/seasonalCampaigns';
import EasterDecorationSlot from './EasterDecorationSlot';
import CollectibleEasterEgg from './CollectibleEasterEgg';

const POSITION_MAP = {
  'top-right': 'top-2 right-2',
  'top-left': 'top-2 left-2',
  'bottom-right': 'bottom-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-left-inset': 'bottom-4 left-4',
};

export default function EasterDecorations({ pageId, hunt }) {
  const { siteSettings } = usePublicData();
  const outletContext = typeof ReactRouterDom.useOutletContext === 'function'
    ? ReactRouterDom.useOutletContext()
    : null;
  const resolvedHunt = hunt || outletContext?.easterHunt || null;

  if (!shouldRenderDecorations(siteSettings)) return null;

  const placements = getEggPlacements(pageId, siteSettings);
  if (placements.length === 0) return null;

  const huntMode = resolvedHunt?.huntActive && isHuntActive(siteSettings);

  return placements.map((slot, i) => {
    if (huntMode) {
      const eggId = getHuntEggId(pageId, i);
      const posClass = POSITION_MAP[slot.position] || POSITION_MAP['top-right'];
      return (
        <div
          key={`easter-hunt-${pageId}-${i}`}
          className={`absolute ${posClass} z-[3] hidden md:block`}
          aria-hidden="false"
        >
          <CollectibleEasterEgg
            eggId={eggId}
            variant={slot.variant}
            size={slot.size}
            isCollected={resolvedHunt.isCollected(eggId)}
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
      />
    );
  });
}
