import { describe, expect, it } from 'vitest';
import { buildAdminCommandItems } from '../../src/utils/adminCommandPalette.js';

const NAV_ITEMS = [
  { to: '/admin', label: 'Табло', shortcut: true, searchTerms: ['dashboard'] },
  { to: '/admin/articles', label: 'Статии', permission: 'articles', shortcut: true, searchTerms: ['редакция'] },
  { to: '/admin/intake', label: 'Входяща опашка', permission: ['articles', 'contact'], shortcut: true, searchTerms: ['сигнали', 'запитвания'] },
  { to: '/admin/classifieds', label: 'Малки обяви', permission: 'classifieds', shortcut: true, searchTerms: ['плащания'] },
  { type: 'divider', label: 'Администрация' },
  { to: '/admin/audit-log', label: 'Журнал', permission: 'permissions', shortcut: true, searchTerms: ['audit', 'лог'] },
];

describe('buildAdminCommandItems', () => {
  it('returns only commands that the current role can access', () => {
    const items = buildAdminCommandItems({
      navItems: NAV_ITEMS,
      canAccess: (permission) => {
        if (Array.isArray(permission)) return permission.includes('articles');
        return permission !== 'permissions';
      },
      query: '',
    });

    expect(items.map((item) => item.to)).toEqual([
      '/admin',
      '/admin/articles',
      '/admin/intake',
      '/admin/classifieds',
    ]);
  });

  it('adds entity ID shortcuts for the relevant admin sections', () => {
    const items = buildAdminCommandItems({
      navItems: NAV_ITEMS,
      canAccess: () => true,
      query: '42',
    });

    expect(items.slice(0, 5).map((item) => item.label)).toEqual([
      'Статия #42',
      'Сигнал #42',
      'Запитване #42',
      'Обява #42',
      'Журнал за #42',
    ]);
  });
});
