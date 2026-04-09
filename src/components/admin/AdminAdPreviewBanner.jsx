import { AdBannerHorizontal, AdBannerInline, AdBannerSide } from '../AdBanner';

export default function AdminAdPreviewBanner({ ad, slotMeta = null, showSafeArea = false, viewport = 'auto' }) {
  if (ad?.type === 'side') return <AdBannerSide ad={ad} slotMeta={slotMeta} showSafeArea={showSafeArea} viewport={viewport} />;
  if (ad?.type === 'inline') return <AdBannerInline ad={ad} slotMeta={slotMeta} showSafeArea={showSafeArea} viewport={viewport} />;
  return <AdBannerHorizontal ad={ad} slotMeta={slotMeta} showSafeArea={showSafeArea} viewport={viewport} />;
}
