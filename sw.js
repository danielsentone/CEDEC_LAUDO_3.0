const CACHE_NAME = 'defesa-civil-pr-v3';
const TILES_CACHE_NAME = 'defesa-civil-tiles-v3';

// Assets fundamentais da aplicação
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  '/assets/logos.ts',
  '/constants.ts',
  '/types.ts',
  '/App.tsx',
  '/services/pdfService.ts',
  '/components/CityAutocomplete.tsx',
  '/components/DamageInput.tsx',
  '/components/MapPicker.tsx',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
];

// Instalação: Cache dos arquivos estáticos iniciais
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('Falha parcial no cache inicial', err));
    })
  );
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== TILES_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de Requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. IGNORAR REQUISIÇÕES NÃO-GET (Cache API só suporta GET)
  if (event.request.method !== 'GET') return;

  // 2. IGNORAR API E SUPABASE (Deixar passar para a rede)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // 3. IGNORAR PROTOCOLOS NÃO-HTTP (ex: chrome-extension, data, blob)
  if (!url.protocol.startsWith('http')) return;

  // 4. Estratégia para Tiles de Mapa (Cache First)
  if (url.href.includes('tile.openstreetmap.org') || 
      url.href.includes('mt1.google.com') || 
      url.href.includes('server.arcgisonline.com')) {
    
    event.respondWith(
      caches.open(TILES_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) return response;

          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             return new Response('', { status: 408, statusText: 'Offline tile missing' });
          });
        });
      })
    );
    return;
  }

  // 5. Estratégia para ESM.SH e bibliotecas externas (Cache First)
  if (url.hostname === 'esm.sh' || url.hostname === 'cdn.tailwindcss.com' || url.hostname === 'unpkg.com') {
      event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
      );
      return;
  }

  // 6. Estratégia para a Aplicação (Network First)
  event.respondWith(
    fetch(event.request).then((response) => {
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, responseToCache);
      });
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
