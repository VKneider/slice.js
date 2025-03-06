import Slice from '/Slice/Slice.js';

const CACHE_NAME = 'slice-cache-v1';
const urlsToCache = [
   // Añade aquí las rutas de los archivos que deseas almacenar
   './Slice/Slice.js',
   './Slice/Components/Structural/Logger/Logger.js',
   './Slice/Components/Structural/Debugger/Debugger.js',
   './Slice/Components/Structural/Router/Router.js',
   './Slice/Components/Structural/Router/routes.js',
   './Slice/Components/Structural/Controller/Controller.js',
   './Slice/Components/Structural/StylesManager/StylesManager.js',
   './Slice/Components/Structural/StylesManager/ThemeManager/ThemeManager.js',
];

self.addEventListener('install', (event) => {
   event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
         console.log('Opened cache');
         return cache.addAll(urlsToCache);
      })
   );
});

self.addEventListener('fetch', (event) => {
   event.respondWith(
      caches.match(event.request).then((response) => {
         if (response) {
            return response;
         }
         return fetch(event.request);
      })
   );
});

self.addEventListener('activate', (event) => {
   const cacheWhitelist = [CACHE_NAME];

   event.waitUntil(
      caches.keys().then((cacheNames) => {
         return Promise.all(
            cacheNames.map((cacheName) => {
               if (cacheWhitelist.indexOf(cacheName) === -1) {
                  return caches.delete(cacheName);
               }
            })
         );
      })
   );
});

if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => {
      navigator.serviceWorker
         .register('/service-worker.js')
         .then((registration) => {
            console.log('Service Worker registrado con éxito:', registration);
         })
         .catch((error) => {
            console.log('Error al registrar el Service Worker:', error);
         });
   });
}
