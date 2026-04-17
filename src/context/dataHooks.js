import { useContext } from 'react';

import {
  AdminDataContext,
  ArticlesDataContext,
  DataContext,
  EngagementDataContext,
  PublicDataContext,
  PublicSectionsDataContext,
  SessionDataContext,
  SettingsDataContext,
  TaxonomyDataContext,
} from './dataContexts.js';

export const useData = () => useContext(DataContext);
export const useSessionData = () => useContext(SessionDataContext);
export const useArticlesData = () => useContext(ArticlesDataContext);
export const useTaxonomyData = () => useContext(TaxonomyDataContext);
export const useSettingsData = () => useContext(SettingsDataContext);
export const usePublicSectionsData = () => useContext(PublicSectionsDataContext);
export const useEngagementData = () => useContext(EngagementDataContext);
export const usePublicData = () => useContext(PublicDataContext);
export const useAdminData = () => useContext(AdminDataContext);
