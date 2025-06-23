/**
 * Service Worker for meetabl API
 * 
 * Provides offline capabilities, caching, and background sync
 * 
 * @author meetabl Team
 */

const CACHE_NAME = 'meetabl-api-v1.0.0';
const STATIC_CACHE = 'meetabl-static-v1.0.0';
const DYNAMIC_CACHE = 'meetabl-dynamic-v1.0.0';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/api/health',
  '/status',
  '/api/monitoring/health',
  // Add essential API endpoints that should be cached
  '/api/csrf-token'
];

// API endpoints that should be cached with network-first strategy
const CACHEABLE_API_ENDPOINTS = [
  '/api/health',
  '/api/monitoring/health',
  '/api/monitoring/stats',
  '/api/monitoring/performance',
  '/api/csrf-token'
];

// API endpoints that should work offline (fallback responses)
const OFFLINE_FALLBACKS = {
  '/api/health': {
    status: 'offline',
    timestamp: new Date().toISOString(),
    message: 'API is currently offline',
    offline: true
  },
  '/api/monitoring/health': {
    status: 'offline',
    timestamp: new Date().toISOString(),
    message: 'Monitoring is currently offline',
    offline: true
  }
};

// Background sync tags
const SYNC_TAGS = {
  BOOKING_SYNC: 'booking-sync',
  METRICS_SYNC: 'metrics-sync',
  NOTIFICATION_SYNC: 'notification-sync'
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE);
        
        // Cache static assets
        await staticCache.addAll(STATIC_ASSETS);
        
        // Force activation of new service worker
        await self.skipWaiting();
        
        console.log('[SW] Static assets cached successfully');
      } catch (error) {
        console.error('[SW] Failed to cache static assets:', error);
      }
    })()
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    (async () => {
      try {
        // Take control of all pages
        await self.clients.claim();
        
        // Clean up old caches
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          !name.includes('v1.0.0') && name.startsWith('meetabl-')
        );
        
        await Promise.all(
          oldCaches.map(cacheName => caches.delete(cacheName))
        );
        
        console.log('[SW] Old caches cleaned up:', oldCaches);
        
        // Notify clients of service worker activation
        await notifyClients('SW_ACTIVATED', { timestamp: new Date().toISOString() });
        
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

/**
 * Fetch event - handle network requests with caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and external requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  
  // Determine caching strategy based on request type
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else {
    event.respondWith(handleStaticRequest(request));
  }
});

/**
 * Handle API requests with network-first strategy
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Try network first for API requests
    const networkResponse = await fetch(request);
    
    // Cache successful responses for cacheable endpoints
    if (networkResponse.ok && CACHEABLE_API_ENDPOINTS.some(endpoint => 
      pathname.startsWith(endpoint))) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] Network failed for API request:', pathname);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving API request from cache:', pathname);
      return cachedResponse;
    }
    
    // Provide offline fallback for specific endpoints
    if (OFFLINE_FALLBACKS[pathname]) {
      console.log('[SW] Serving offline fallback for:', pathname);
      return new Response(
        JSON.stringify(OFFLINE_FALLBACKS[pathname]),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Served-By': 'service-worker',
            'X-Offline': 'true'
          }
        }
      );
    }
    
    // Generic offline response
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'This feature is not available offline',
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Served-By': 'service-worker',
          'X-Offline': 'true'
        }
      }
    );
  }
}

/**
 * Handle static requests with cache-first strategy
 */
async function handleStaticRequest(request) {
  try {
    // Try cache first for static assets
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, fetch from network and cache
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] Failed to serve static request:', request.url);
    
    // For HTML requests, provide a basic offline page
    const acceptHeader = request.headers.get('Accept');
    if (acceptHeader && acceptHeader.includes('text/html')) {
      return new Response(
        generateOfflinePage(),
        {
          headers: {
            'Content-Type': 'text/html',
            'X-Served-By': 'service-worker'
          }
        }
      );
    }
    
    // For other requests, return network error
    throw error;
  }
}

/**
 * Background sync event - handle offline actions
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.BOOKING_SYNC:
      event.waitUntil(syncBookingData());
      break;
    case SYNC_TAGS.METRICS_SYNC:
      event.waitUntil(syncMetricsData());
      break;
    case SYNC_TAGS.NOTIFICATION_SYNC:
      event.waitUntil(syncNotificationData());
      break;
    default:
      console.log('[SW] Unknown sync tag:', event.tag);
  }
});

/**
 * Push event - handle push notifications
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('[SW] Error parsing push data:', error);
  }
  
  const options = {
    title: data.title || 'meetabl API',
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: data.data || {},
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view-32x32.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-32x32.png'
      }
    ],
    tag: data.tag || 'general',
    renotify: true,
    requireInteraction: data.urgent || false,
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    const urlToOpen = event.notification.data.url || '/';
    event.waitUntil(
      self.clients.openWindow(urlToOpen)
    );
  }
  // Dismiss action doesn't need any additional handling
});

/**
 * Sync booking data when back online
 */
async function syncBookingData() {
  try {
    console.log('[SW] Syncing booking data...');
    
    // Get pending booking data from IndexedDB
    const pendingBookings = await getPendingData('bookings');
    
    for (const booking of pendingBookings) {
      try {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': booking.token
          },
          body: JSON.stringify(booking.data)
        });
        
        if (response.ok) {
          await removePendingData('bookings', booking.id);
          console.log('[SW] Booking synced successfully:', booking.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync booking:', booking.id, error);
      }
    }
    
    await notifyClients('BOOKINGS_SYNCED', { count: pendingBookings.length });
    
  } catch (error) {
    console.error('[SW] Booking sync failed:', error);
  }
}

/**
 * Sync metrics data when back online
 */
async function syncMetricsData() {
  try {
    console.log('[SW] Syncing metrics data...');
    
    // Send offline metrics to server
    const offlineMetrics = await getPendingData('metrics');
    
    if (offlineMetrics.length > 0) {
      const response = await fetch('/api/monitoring/metrics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: offlineMetrics })
      });
      
      if (response.ok) {
        await clearPendingData('metrics');
        console.log('[SW] Metrics synced successfully');
      }
    }
    
  } catch (error) {
    console.error('[SW] Metrics sync failed:', error);
  }
}

/**
 * Sync notification data when back online
 */
async function syncNotificationData() {
  try {
    console.log('[SW] Syncing notification data...');
    
    const pendingNotifications = await getPendingData('notifications');
    
    for (const notification of pendingNotifications) {
      try {
        const response = await fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': notification.token
          },
          body: JSON.stringify(notification.data)
        });
        
        if (response.ok) {
          await removePendingData('notifications', notification.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync notification:', notification.id, error);
      }
    }
    
  } catch (error) {
    console.error('[SW] Notification sync failed:', error);
  }
}

/**
 * Generate offline page HTML
 */
function generateOfflinePage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>meetabl API - Offline</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f8fafc;
          color: #1f2937;
          text-align: center;
        }
        .container {
          max-width: 500px;
          margin: 100px auto;
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 {
          color: #1f2937;
          margin: 0 0 16px 0;
        }
        p {
          color: #6b7280;
          line-height: 1.6;
          margin: 0 0 24px 0;
        }
        .retry-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        }
        .retry-btn:hover {
          background: #2563eb;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">📡</div>
        <h1>You're Offline</h1>
        <p>meetabl API is currently unavailable. Please check your internet connection and try again.</p>
        <button class="retry-btn" onclick="window.location.reload()">
          Try Again
        </button>
      </div>
    </body>
    </html>
  `;
}

/**
 * Notify all clients of service worker events
 */
async function notifyClients(type, data) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type,
      data,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * IndexedDB helpers for offline data storage
 */
async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('meetabl-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores for different data types
      if (!db.objectStoreNames.contains('bookings')) {
        db.createObjectStore('bookings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('metrics')) {
        db.createObjectStore('metrics', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { keyPath: 'id' });
      }
    };
  });
}

async function getPendingData(storeName) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to get pending data:', error);
    return [];
  }
}

async function removePendingData(storeName, id) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to remove pending data:', error);
  }
}

async function clearPendingData(storeName) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to clear pending data:', error);
  }
}

console.log('[SW] Service worker loaded successfully');