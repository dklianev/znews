import { Blocks, Gamepad2, Grid3x3, Hash, HelpCircle, Hexagon, Link, Tangent, Type } from 'lucide-react';

const GAME_ICON_MAP = {
  Type,
  Link,
  HelpCircle,
  Grid3x3,
  Hash,
  Hexagon,
  Blocks,
  Tangent,
};

export function getGameIconComponent(iconName) {
  return GAME_ICON_MAP[iconName] || Gamepad2;
}
