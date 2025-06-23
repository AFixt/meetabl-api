/**
 * Progressive Web App (PWA) middleware
 * 
 * Provides PWA features including service worker registration,
 * offline support, and app shell caching
 * 
 * @author meetabl Team
 */

const path = require('path');
const fs = require('fs').promises;
const { createLogger } = require('../config/logger');

const logger = createLogger('pwa-middleware');

/**
 * PWA configuration
 */
const PWA_CONFIG = {
  serviceWorkerPath: '/service-worker.js',
  manifestPath: '/manifest.json',
  offlinePages: ['/offline.html'],
  cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
  enableServiceWorker: process.env.PWA_ENABLE_SW !== 'false',
  enablePushNotifications: process.env.PWA_ENABLE_PUSH === 'true',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY
};

/**
 * PWA headers middleware
 */
function addPWAHeaders(req, res, next) {
  // Add PWA-related headers
  res.setHeader('X-PWA-Enabled', 'true');
  
  // Service Worker headers
  if (req.path === PWA_CONFIG.serviceWorkerPath) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
  }
  
  // Manifest headers
  if (req.path === PWA_CONFIG.manifestPath) {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
  }
  
  // Add security headers for PWA
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  next();
}

/**
 * Service worker registration middleware
 */
function injectServiceWorkerRegistration(req, res, next) {
  // Only inject for HTML requests
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  if (!acceptsHtml || !PWA_CONFIG.enableServiceWorker) {
    return next();
  }
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override res.end to inject service worker registration
  res.end = function(chunk, encoding) {
    const contentType = res.getHeader('Content-Type');
    if (contentType && contentType.includes('text/html')) {
      const swScript = generateServiceWorkerScript();
      
      if (chunk && typeof chunk === 'string') {
        // Inject script before closing body tag
        chunk = chunk.replace('</body>', `${swScript}\n</body>`);
      }
    }
    
    // Call original end function
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Generate service worker registration script
 */
function generateServiceWorkerScript() {
  return `
    <script>
      // Service Worker registration
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
          try {
            const registration = await navigator.serviceWorker.register('${PWA_CONFIG.serviceWorkerPath}');
            console.log('Service Worker registered:', registration.scope);
            
            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              console.log('New service worker found');
              
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker is ready
                  console.log('New service worker ready');
                  notifyServiceWorkerUpdate();
                }
              });
            });
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
              handleServiceWorkerMessage(event.data);
            });
            
            // Register for push notifications if enabled
            ${PWA_CONFIG.enablePushNotifications ? `
            if ('PushManager' in window && '${PWA_CONFIG.vapidPublicKey}') {
              await registerPushNotifications(registration);
            }
            ` : ''}
            
          } catch (error) {
            console.error('Service Worker registration failed:', error);
          }
        });
      }
      
      // Handle offline/online events
      window.addEventListener('online', () => {
        console.log('Connection restored');
        document.dispatchEvent(new CustomEvent('connectionrestored'));
      });
      
      window.addEventListener('offline', () => {
        console.log('Connection lost');
        document.dispatchEvent(new CustomEvent('connectionlost'));
      });
      
      // Service worker message handler
      function handleServiceWorkerMessage(data) {
        console.log('Service Worker message:', data);
        
        switch (data.type) {
          case 'SW_ACTIVATED':
            console.log('Service Worker activated at:', data.data.timestamp);
            break;
          case 'BOOKINGS_SYNCED':
            console.log('Bookings synced:', data.data.count);
            document.dispatchEvent(new CustomEvent('bookingssynced', { detail: data.data }));
            break;
          default:
            console.log('Unknown service worker message:', data.type);
        }
      }
      
      // Notify user of service worker update
      function notifyServiceWorkerUpdate() {
        if (confirm('A new version is available. Reload to update?')) {
          window.location.reload();
        }
      }
      
      ${PWA_CONFIG.enablePushNotifications ? `
      // Push notification registration
      async function registerPushNotifications(registration) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array('${PWA_CONFIG.vapidPublicKey}')
            });
            
            // Send subscription to server
            await fetch('/api/notifications/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(subscription)
            });
            
            console.log('Push notifications enabled');
          }
        } catch (error) {
          console.error('Push notification registration failed:', error);
        }
      }
      
      // Helper function for VAPID key conversion
      function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      }
      ` : ''}
    </script>
  `;
}

/**
 * Offline data storage middleware
 */
function enableOfflineStorage(req, res, next) {
  // Add offline storage capabilities to requests
  req.offlineStorage = {
    store: async (key, data) => {
      // This would integrate with the service worker's IndexedDB storage
      logger.debug('Storing data for offline use', { key, dataSize: JSON.stringify(data).length });
    },
    retrieve: async (key) => {
      // This would retrieve data from offline storage
      logger.debug('Retrieving offline data', { key });
      return null;
    }
  };
  
  next();
}

/**
 * App shell caching middleware
 */
function enableAppShellCaching(req, res, next) {
  const isAppShellRequest = req.path === '/' || 
                           req.path.startsWith('/api/health') ||
                           req.path.startsWith('/api/monitoring');
  
  if (isAppShellRequest) {
    // Set appropriate caching headers for app shell
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.setHeader('X-App-Shell', 'true');
  }
  
  next();
}

/**
 * PWA metrics middleware
 */
function trackPWAMetrics(req, res, next) {
  // Track PWA-specific metrics
  const userAgent = req.headers['user-agent'] || '';
  const isPWA = req.headers['x-requested-with'] === 'PWA' || 
                userAgent.includes('meetabl-pwa');
  
  if (isPWA) {
    logger.info('PWA request received', {
      path: req.path,
      method: req.method,
      userAgent: userAgent.substring(0, 100) // Truncate for privacy
    });
    
    res.setHeader('X-Served-By', 'PWA');
  }
  
  next();
}

/**
 * Offline fallback middleware
 */
function handleOfflineFallback(req, res, next) {
  // Add offline fallback capabilities
  res.offlineFallback = (data) => {
    const fallbackResponse = {
      ...data,
      offline: true,
      timestamp: new Date().toISOString(),
      message: 'This data may be stale - last updated while offline'
    };
    
    res.setHeader('X-Offline-Fallback', 'true');
    res.json(fallbackResponse);
  };
  
  next();
}

/**
 * Generate PWA installation banner
 */
function generateInstallBanner() {
  return `
    <div id="pwa-install-banner" style="display: none; position: fixed; bottom: 0; left: 0; right: 0; background: #1f2937; color: white; padding: 16px; text-align: center; z-index: 1000;">
      <p style="margin: 0 0 12px 0;">Install meetabl API for a better experience!</p>
      <button id="pwa-install-button" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 12px; cursor: pointer;">Install</button>
      <button id="pwa-dismiss-button" style="background: transparent; color: #9ca3af; border: 1px solid #4b5563; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Maybe Later</button>
    </div>
    
    <script>
      let deferredPrompt;
      
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        const banner = document.getElementById('pwa-install-banner');
        const installButton = document.getElementById('pwa-install-button');
        const dismissButton = document.getElementById('pwa-dismiss-button');
        
        if (banner && !localStorage.getItem('pwa-install-dismissed')) {
          banner.style.display = 'block';
        }
        
        if (installButton) {
          installButton.addEventListener('click', async () => {
            banner.style.display = 'none';
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('PWA install outcome:', outcome);
            deferredPrompt = null;
          });
        }
        
        if (dismissButton) {
          dismissButton.addEventListener('click', () => {
            banner.style.display = 'none';
            localStorage.setItem('pwa-install-dismissed', 'true');
          });
        }
      });
      
      window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        localStorage.setItem('pwa-installed', 'true');
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.style.display = 'none';
      });
    </script>
  `;
}

/**
 * PWA installation prompt middleware
 */
function injectInstallPrompt(req, res, next) {
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  if (!acceptsHtml) {
    return next();
  }
  
  const originalEnd = res.end;
  
  res.end = function(chunk, encoding) {
    const contentType = res.getHeader('Content-Type');
    if (contentType && contentType.includes('text/html')) {
      const installBanner = generateInstallBanner();
      
      if (chunk && typeof chunk === 'string') {
        chunk = chunk.replace('</body>', `${installBanner}\n</body>`);
      }
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Initialize PWA middleware
 */
function initializePWA(app) {
  logger.info('Initializing PWA middleware', {
    serviceWorkerEnabled: PWA_CONFIG.enableServiceWorker,
    pushNotificationsEnabled: PWA_CONFIG.enablePushNotifications
  });
  
  // Serve static PWA files
  app.use('/manifest.json', async (req, res) => {
    try {
      const manifestPath = path.join(__dirname, '../../public/manifest.json');
      const manifest = await fs.readFile(manifestPath, 'utf8');
      res.setHeader('Content-Type', 'application/manifest+json');
      res.send(manifest);
    } catch (error) {
      logger.error('Failed to serve manifest.json', { error: error.message });
      res.status(404).json({ error: 'Manifest not found' });
    }
  });
  
  app.use('/service-worker.js', async (req, res) => {
    try {
      const swPath = path.join(__dirname, '../../public/service-worker.js');
      const serviceWorker = await fs.readFile(swPath, 'utf8');
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
      res.send(serviceWorker);
    } catch (error) {
      logger.error('Failed to serve service-worker.js', { error: error.message });
      res.status(404).json({ error: 'Service worker not found' });
    }
  });
  
  // Apply PWA middlewares
  app.use(addPWAHeaders);
  app.use(trackPWAMetrics);
  app.use(enableOfflineStorage);
  app.use(enableAppShellCaching);
  app.use(handleOfflineFallback);
  
  if (PWA_CONFIG.enableServiceWorker) {
    app.use(injectServiceWorkerRegistration);
    app.use(injectInstallPrompt);
  }
  
  logger.info('PWA middleware initialized successfully');
}

module.exports = {
  initializePWA,
  addPWAHeaders,
  injectServiceWorkerRegistration,
  enableOfflineStorage,
  enableAppShellCaching,
  trackPWAMetrics,
  handleOfflineFallback,
  PWA_CONFIG
};