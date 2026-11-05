import { troveScreen } from './screens/trove.js';
import { searchScreen } from './screens/search.js';
import { keepScreen } from './screens/keep.js';
import { collectionsScreen, collectionScreen } from './screens/collections.js';
import { kikoScreen } from './screens/kiko.js';
import { creationsScreen, creationScreen } from './screens/creations.js';
import { rediscoverScreen, reviewScreen, laptopScreen } from './screens/discover.js';
import { dataScreen, privacyScreen } from './screens/data.js';
import { aboutScreen } from './screens/about.js';
import { settingsScreen, aiSettingsScreen, smartSettingsScreen, lookSettingsScreen } from './screens/settings.js';

/** Route table. A route with bare:true hides the bottom navigation. */
export function buildRoutes(ctx) {
  return {
    '/trove': { tab: 'trove', render: () => troveScreen(ctx) },
    '/search': { tab: 'trove', bare: true, render: () => searchScreen(ctx) },
    '/keep/:id': { tab: 'trove', bare: true, render: (p) => keepScreen(ctx, p) },
    '/collections': { tab: 'collections', render: () => collectionsScreen(ctx) },
    '/collection/:id': { tab: 'collections', bare: true, render: (p) => collectionScreen(ctx, p) },
    '/kiko': { tab: 'kiko', render: () => kikoScreen(ctx, { type: 'trove', label: 'Trove' }) },
    '/kiko/keep/:id': { tab: 'kiko', bare: true, render: (p) => kikoScreen(ctx, { type: 'keep', ids: [p.id], label: 'This Keep' }) },
    '/kiko/keeps/:ids': { tab: 'kiko', bare: true, render: (p) => kikoScreen(ctx, { type: 'keeps', ids: p.ids.split(','), label: 'Selected' }) },
    '/kiko/collection/:id': { tab: 'kiko', bare: true, render: (p) => kikoScreen(ctx, { type: 'collection', collectionId: p.id, label: 'Collection' }) },
    '/creations': { tab: 'collections', render: () => creationsScreen(ctx) },
    '/creation/:id': { tab: 'collections', bare: true, render: (p) => creationScreen(ctx, p) },
    '/rediscover': { tab: 'trove', bare: true, render: () => rediscoverScreen(ctx) },
    '/review': { tab: 'trove', bare: true, render: () => reviewScreen(ctx) },
    '/laptop': { tab: 'collections', bare: true, render: () => laptopScreen(ctx) },
    '/settings': { tab: 'settings', render: () => settingsScreen(ctx) },
    '/settings/data': { tab: 'settings', bare: true, render: () => dataScreen(ctx) },
    '/settings/privacy': { tab: 'settings', bare: true, render: () => privacyScreen(ctx) },
    '/settings/about': { tab: 'settings', bare: true, render: () => aboutScreen(ctx) },
    '/settings/look': { tab: 'settings', bare: true, render: () => lookSettingsScreen(ctx) },
    '/settings/smart': { tab: 'settings', bare: true, render: () => smartSettingsScreen(ctx) },
    '/settings/ai': { tab: 'settings', bare: true, render: () => aiSettingsScreen(ctx) },
  };
}
