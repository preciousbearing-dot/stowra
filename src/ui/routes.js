import { troveScreen } from './screens/trove.js';
import { searchScreen } from './screens/search.js';
import { keepScreen } from './screens/keep.js';
import { collectionsScreen, collectionScreen } from './screens/collections.js';
import { settingsScreen } from './screens/settings.js';

/** Route table. A route with bare:true hides the bottom navigation. */
export function buildRoutes(ctx) {
  return {
    '/trove': { tab: 'trove', render: () => troveScreen(ctx) },
    '/search': { tab: 'trove', bare: true, render: () => searchScreen(ctx) },
    '/keep/:id': { tab: 'trove', bare: true, render: (p) => keepScreen(ctx, p) },
    '/collections': { tab: 'collections', render: () => collectionsScreen(ctx) },
    '/collection/:id': { tab: 'collections', bare: true, render: (p) => collectionScreen(ctx, p) },
    '/settings': { tab: 'settings', render: () => settingsScreen(ctx) },
  };
}
