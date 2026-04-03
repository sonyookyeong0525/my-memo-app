/* =============================================
   MY MEMO - Service Worker
   ============================================= */

const CACHE_NAME = 'my-memo-v1';

/* 오프라인에서도 동작할 파일 목록 */
const CACHE_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/sw-register.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/fonts/Pretendard/Pretendard-Regular.woff2',
  '/fonts/Pretendard/Pretendard-Medium.woff2',
  '/fonts/Pretendard/Pretendard-SemiBold.woff2',
  '/fonts/Pretendard/Pretendard-Bold.woff2',
];

/* =============================================
   install — 캐시 저장
   ============================================= */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_FILES);
    })
  );
  /* 새 Service Worker를 즉시 활성화 */
  self.skipWaiting();
});

/* =============================================
   activate — 이전 캐시 정리
   ============================================= */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  /* 모든 클라이언트에 즉시 적용 */
  self.clients.claim();
});

/* =============================================
   fetch — Cache First 전략
   네트워크 요청 시 캐시 우선, 없으면 네트워크
   ============================================= */
self.addEventListener('fetch', (event) => {
  /* POST 등 캐시 불가 요청은 그대로 통과 */
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      /* 캐시에 없으면 네트워크 요청 후 캐시에 저장 */
      return fetch(event.request).then((networkResponse) => {
        /* 유효한 응답만 캐시 */
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type === 'opaque'
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        /* 오프라인 + 캐시 없음 → index.html 반환 */
        return caches.match('/index.html');
      });
    })
  );
});
