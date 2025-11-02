const CACHE_NAME = 'office-tools-v1';

const urlsToCache = [
  './',
  './index.html',
  './geo.html',
  './dairy.html',
  './Assets/index.css',
  './Assets/geo.css',
  './Assets/dairy.css',
  './manifest.json',
  './Assets/tool.js',
  './Assets/tool1.js',
  './Assets/geo.js',
  './Assets/app.js',
  './Assets/data.json',
  './offline.html',
  './Assets/icons/icon-72x72.png',
  './Assets/icons/icon-96x96.png',
  './Assets/icons/icon-128x128.png',
  './Assets/icons/icon-192x192.png',
  './Assets/icons/icon-256x256.png',
  './Assets/icons/icon-384x384.png',
  './Assets/icons/icon-512x512.png',
  // Bootstrap and jQuery
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://code.jquery.com/jquery-3.7.1.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  // Chart.js
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
  // Fonts and Icons
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined',
  'https://fonts.gstatic.com/s/materialsymbolsoutlined/v54/kJEyBoK2Jz0j6eIq4mwyHbuZ5U1akQ.woff2',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Merriweather:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  // Animations
  'https://cdn.jsdelivr.net/npm/animate.css@4.1.1/animate.min.css',
  // Quill Editor
  'https://cdn.quilljs.com/1.3.6/quill.snow.css',
  'https://cdn.quilljs.com/1.3.6/quill.min.js',
  // Leaflet library files
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install Event
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing and caching essential files...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache files individually to handle failures gracefully
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url)
              .catch(err => {
                console.warn(`[ServiceWorker] Failed to cache: ${url}`, err);
                return null; // Continue with other files even if one fails
              })
          )
        ).then(results => {
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed > 0) {
            console.warn(`[ServiceWorker] ${failed} files failed to cache`);
          }
          console.log('[ServiceWorker] Installation complete');
        });
      })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Firebase API and analytics requests
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('googleapis.com') || 
      url.hostname.includes('google-analytics.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached file if found
        if (response) {
          // Fetch updated version in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {/* Ignore background fetch errors */});
          return response;
        }

        // Otherwise, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response
            const responseToCache = networkResponse.clone();

            // Cache the response for future use
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => {
                console.warn('Cache put failed:', err);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.warn('Fetch failed:', error);
            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            // Return null for other resources
            return new Response(null, {status: 404});
          });
      })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating and cleaning old caches...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ))
  );
});