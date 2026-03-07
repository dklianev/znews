import { Gamepad2, Grid3x3, Hash, HelpCircle, Link, Type } from 'lucide-react';

const GAME_ICON_MAP = {
  Type,
  Link,
  HelpCircle,
  Grid3x3,
  Hash,
};

export function getGameIconComponent(iconName) {
  return GAME_ICON_MAP[iconName] || Gamepad2;
}
