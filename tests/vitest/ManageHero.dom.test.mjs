import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const loadHeroSettingsRevisions = vi.fn(async () => []);
const restoreHeroSettingsRevision = vi.fn(async () => {});
const updateArticle = vi.fn(async () => {});
const saveHeroSettings = vi.fn(async () => {});

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

const confirm = vi.fn(async () => true);

let adminDataState = {};
let publicDataState = {};

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
  usePublicData: () => publicDataState,
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
}));

vi.mock('../../src/components/admin/ConfirmDialog', () => ({
  useConfirm: () => confirm,
}));

const { default: ManageHero } = await import('../../src/pages/admin/ManageHero.jsx');

describe('ManageHero', () => {
  let root;
  let container;

  afterEach(async () => {
    loadHeroSettingsRevisions.mockClear();
    restoreHeroSettingsRevision.mockClear();
    updateArticle.mockClear();
    saveHeroSettings.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
    toast.warning.mockClear();
    confirm.mockClear();
    adminDataState = {};
    publicDataState = {};
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('compares a hero revision against the current form', async () => {
    publicDataState = {
      articles: [
        {
          id: 11,
          title: 'Гореща статия',
          excerpt: 'Резюме',
          image: '/hero.jpg',
          category: 'crime',
          authorId: 2,
          date: '2026-04-09',
          hero: true,
          breaking: true,
        },
      ],
      categories: [{ id: 'crime', name: 'Криминални' }],
      authors: [{ id: 2, name: 'Репортер' }],
      breaking: ['Ексклузивно'],
      updateArticle,
      heroSettings: {
        headline: 'Ново заглавие',
        shockLabel: 'ШОК!',
        ctaLabel: 'ЧЕТИ',
        headlineBoardText: 'ПРЕГЛЕД',
        heroTitleScale: 100,
        captions: ['Първо', 'Второ', 'Трето'],
        mainPhotoArticleId: 11,
        photoArticleIds: [],
      },
      saveHeroSettings,
    };
    adminDataState = {
      heroSettingsRevisions: [
        {
          revisionId: 'hero-rev-1',
          version: 5,
          source: 'update',
          createdAt: '2026-04-09T10:00:00.000Z',
          snapshot: {
            headline: 'Старо заглавие',
            shockLabel: 'ШОК!',
            ctaLabel: 'ЧЕТИ',
            headlineBoardText: 'СТАР BOARD',
            heroTitleScale: 100,
            captions: ['Първо', 'Второ', 'Трето'],
            mainPhotoArticleId: 11,
            photoArticleIds: [],
          },
        },
      ],
      loadHeroSettingsRevisions,
      restoreHeroSettingsRevision,
    };

    ({ root, container } = await renderIntoBody(ManageHero));

    const compareButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Сравни'));
    await click(compareButton);

    expect(container.textContent).toContain('Сравнение на Hero версии');
    expect(container.textContent).toContain('Голямо заглавие');
    expect(container.textContent).toContain('Старо заглавие');
    expect(container.textContent).toContain('Ново заглавие');
  });
});
