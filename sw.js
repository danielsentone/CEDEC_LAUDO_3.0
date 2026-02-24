const CACHE_NAME = 'defesa-civil-pr-v1';
const TILES_CACHE_NAME = 'defesa-civil-tiles-v1';

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
      // Tenta cachear, mas não falha se alguns recursos externos (como esm.sh) falharem inicialmente
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
  // SEGURANÇA: Ignora requisições que não sejam HTTP/HTTPS (ex: chrome-extension, data, blob)
  // Isso evita o erro "Failed to construct 'URL': Invalid URL"
  if (!event.request.url.startsWith('http')) return;

  // Ignora requisições para o Supabase no Service Worker para evitar interferência
  if (event.request.url.includes('.supabase.co')) return;

  const url = new URL(event.request.url);

  // 1. Estratégia para Tiles de Mapa (Cache First, falling back to Network)
  // Identifica URLs do Google Maps ou OpenStreetMap ou ArcGIS
  if (url.href.includes('tile.openstreetmap.org') || 
      url.href.includes('mt1.google.com') || 
      url.href.includes('server.arcgisonline.com')) {
    
    event.respondWith(
      caches.open(TILES_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) return response; // Retorna do cache se existir

          // Se não, busca na rede, coloca no cache e retorna
          return fetch(event.request).then((networkResponse) => {
            // Se a resposta for válida (mesmo que opaca type 0), cacheia
            // Status 200 = OK (CORS)
            // Status 0 = Opaque (NO-CORS) - Comum para tiles sem cabeçalho CORS explícito ou fallback
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             // Se falhar (offline e sem cache), retorna nada (tile quebrada, mas não trava app)
             return new Response('', { status: 408, statusText: 'Offline tile missing' });
          });
        });
      })
    );
    return;
  }

  // 2. Estratégia para ESM.SH e bibliotecas externas (Cache First)
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

  // 3. Estratégia para a Aplicação (Network First, falling back to Cache)
  // Isso garante que o usuário sempre receba a versão mais nova do código se estiver online
  event.respondWith(
    fetch(event.request).then((response) => {
      // Se a resposta for válida, atualiza o cache
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, responseToCache);
      });
      return response;
    }).catch(() => {
      // Se estiver offline, tenta servir do cache
      return caches.match(event.request);
    })
  );
});