import { Gamepad2, HelpCircle, Link, Type } from 'lucide-react';

const GAME_ICON_MAP = {
  Type,
  Link,
  HelpCircle,
};

export function getGameIconComponent(iconName) {
  return GAME_ICON_MAP[iconName] || Gamepad2;
}
