# Progressive Web App (PWA) Implementation

This document describes the Progressive Web App implementation for the meetabl API, providing offline capabilities, enhanced user experience, and app-like functionality.

## Overview

The PWA implementation includes:

- **Service Worker**: Background script for caching, offline support, and background sync
- **Web App Manifest**: Metadata for app installation and display
- **Offline Support**: Cached responses and fallback pages
- **Background Sync**: Data synchronization when connection is restored
- **Push Notifications**: Real-time notifications (when enabled)
- **App Installation**: Installable app experience across platforms

## Architecture

### Service Worker (`/public/service-worker.js`)

The service worker provides the core PWA functionality:

```javascript
// Cache strategies
- Static assets: Cache-first strategy
- API endpoints: Network-first with cache fallback
- Dynamic content: Stale-while-revalidate
```

#### Caching Strategy

1. **Static Cache**: Essential app shell and static assets
2. **Dynamic Cache**: API responses and user-generated content
3. **Offline Fallbacks**: Predefined responses for offline scenarios

#### Background Sync

Handles offline data synchronization:

- **Booking Sync**: Offline booking submissions
- **Metrics Sync**: Performance and usage metrics
- **Notification Sync**: Queued notifications

### Web App Manifest (`/public/manifest.json`)

Defines app metadata and installation behavior:

```json
{
  "name": "meetabl API Dashboard",
  "short_name": "meetabl API",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1f2937",
  "background_color": "#ffffff"
}
```

### PWA Middleware (`/src/middlewares/pwa.js`)

Server-side PWA support:

- **Headers Management**: PWA-specific HTTP headers
- **Service Worker Injection**: Automatic SW registration
- **Offline Storage**: Server-side offline data preparation
- **Installation Prompts**: Install banner injection

## Features

### 1. Offline Support

#### Cached Endpoints
- `/api/health` - Health check with offline fallback
- `/api/monitoring/health` - Monitoring status
- `/api/monitoring/stats` - Performance statistics
- `/api/csrf-token` - CSRF token generation

#### Offline Fallbacks
```javascript
const OFFLINE_FALLBACKS = {
  '/api/health': {
    status: 'offline',
    message: 'API is currently offline',
    offline: true
  }
};
```

#### Offline Page (`/public/offline.html`)
- Responsive design with accessibility features
- Connection status indicator
- Auto-retry functionality
- Available offline features list

### 2. Background Sync

#### Sync Types
- `booking-sync`: Offline booking submissions
- `metrics-sync`: Analytics data synchronization
- `notification-sync`: Queued notification delivery

#### Implementation
```javascript
// Register background sync
self.registration.sync.register('booking-sync');

// Handle sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'booking-sync') {
    event.waitUntil(syncBookingData());
  }
});
```

### 3. Push Notifications

#### Subscription Management
```javascript
// Subscribe to push notifications
POST /api/pwa/subscribe
{
  "subscription": {
    "endpoint": "https://...",
    "keys": { ... }
  }
}

// Unsubscribe
DELETE /api/pwa/unsubscribe
{
  "endpoint": "https://..."
}
```

#### Notification Handling
- Click actions (view, dismiss)
- Rich notifications with images and actions
- Vibration patterns for mobile devices

### 4. App Installation

#### Installation Prompt
- Automatic detection of installation eligibility
- Custom install banner with dismiss option
- Install button in PWA-compatible browsers

#### Installation Events
```javascript
// Before install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  // Show custom install UI
});

// App installed
window.addEventListener('appinstalled', () => {
  // Track installation
});
```

## API Endpoints

### PWA Routes (`/api/pwa/*`)

#### `POST /api/pwa/subscribe`
Subscribe to push notifications
- **Authentication**: Required (JWT)
- **Body**: Push subscription object
- **Response**: Success confirmation

#### `DELETE /api/pwa/unsubscribe`
Unsubscribe from push notifications
- **Authentication**: Required (JWT)
- **Body**: Subscription endpoint
- **Response**: Unsubscription confirmation

#### `POST /api/pwa/sync`
Handle background sync data
- **Authentication**: Required (JWT)
- **Body**: Sync type and data
- **Response**: Sync processing result

#### `GET /api/pwa/offline-data`
Get essential data for offline use
- **Authentication**: Required (JWT)
- **Response**: User data, settings, and constants

#### `GET /api/pwa/status`
Get PWA capabilities and status
- **Authentication**: None
- **Response**: PWA feature availability

#### `POST /api/pwa/test-notification` (Development only)
Send test push notification
- **Authentication**: Required (JWT)
- **Body**: Notification content
- **Response**: Test notification details

## Configuration

### Environment Variables

```bash
# PWA Configuration
PWA_ENABLE_SW=true                    # Enable service worker
PWA_ENABLE_PUSH=false                 # Enable push notifications
VAPID_PUBLIC_KEY=your_vapid_public    # VAPID public key for push
VAPID_PRIVATE_KEY=your_vapid_private  # VAPID private key for push

# Cache Configuration
PWA_CACHE_TIMEOUT=86400000            # Cache timeout (24 hours)
PWA_OFFLINE_PAGES=/offline.html       # Offline fallback pages
```

### Service Worker Configuration

```javascript
const PWA_CONFIG = {
  serviceWorkerPath: '/service-worker.js',
  manifestPath: '/manifest.json',
  enableServiceWorker: process.env.PWA_ENABLE_SW !== 'false',
  enablePushNotifications: process.env.PWA_ENABLE_PUSH === 'true'
};
```

## Installation & Usage

### 1. Server Setup

The PWA features are automatically initialized when the app starts:

```javascript
const { initializePWA } = require('./middlewares/pwa');

// Initialize PWA features
initializePWA(app);
```

### 2. Client-Side Integration

Service worker registration is automatically injected into HTML responses:

```html
<!-- Automatically injected -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
  }
</script>
```

### 3. Manifest Integration

Add manifest link to HTML head:

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1f2937">
```

## Testing

### Service Worker Testing

```bash
# Check service worker registration
curl -H "Accept: text/html" http://localhost:3000/

# Verify manifest
curl http://localhost:3000/manifest.json

# Test offline endpoints
curl http://localhost:3000/api/health
```

### PWA Validation

Use Chrome DevTools:
1. Open DevTools → Application tab
2. Check Service Workers section
3. Verify Manifest section
4. Test offline functionality in Network tab

### Lighthouse PWA Audit

Run Lighthouse audit to verify PWA compliance:
- Installable
- PWA optimized
- Offline functionality
- Service worker registered

## Performance Considerations

### Caching Strategy

1. **Cache Size Management**
   - Automatic cleanup of old cache entries
   - Size limits for cache storage
   - Selective caching of essential resources

2. **Network Optimization**
   - Compression for cached responses
   - Efficient cache lookup algorithms
   - Background cache updates

3. **Storage Management**
   - IndexedDB for offline data storage
   - Quota management and cleanup
   - Data compression and optimization

### Memory Usage

- Service worker lifecycle management
- Cache eviction policies
- Background sync throttling

## Security Considerations

### Service Worker Security

1. **HTTPS Requirement**: Service workers only work over HTTPS
2. **Origin Restrictions**: SW limited to same origin
3. **Content Security Policy**: CSP headers for SW scripts

### Data Privacy

1. **Cache Encryption**: Sensitive data encryption in cache
2. **Storage Limitations**: No sensitive data in offline storage
3. **Push Notification Privacy**: No personal data in notifications

### Authentication

1. **Token Management**: JWT tokens in offline storage
2. **Session Persistence**: Offline session handling
3. **Sync Security**: Authenticated background sync

## Troubleshooting

### Common Issues

#### Service Worker Not Registering
```javascript
// Check registration errors
navigator.serviceWorker.register('/service-worker.js')
  .catch(error => console.error('SW registration failed:', error));
```

#### Cache Not Working
- Verify HTTPS connection
- Check browser cache settings
- Confirm service worker activation

#### Offline Data Not Syncing
- Verify background sync support
- Check network connectivity
- Review sync event handlers

### Debugging Tools

1. **Chrome DevTools**
   - Application → Service Workers
   - Application → Storage
   - Network → Offline simulation

2. **Console Logging**
   - Service worker console messages
   - Cache operation logs
   - Sync event debugging

3. **Performance Monitoring**
   - Cache hit/miss ratios
   - Offline usage statistics
   - Sync success rates

## Browser Support

### Full PWA Support
- Chrome 67+
- Firefox 60+
- Safari 11.1+ (limited)
- Edge 17+

### Feature Support Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Workers | ✅ | ✅ | ✅ | ✅ |
| Web App Manifest | ✅ | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ❌ | ❌ | ✅ |
| Push Notifications | ✅ | ✅ | ❌ | ✅ |
| Install Prompt | ✅ | ❌ | ✅ | ✅ |

### Graceful Degradation

The PWA implementation includes graceful degradation:
- Fallback for unsupported browsers
- Progressive enhancement approach
- Feature detection and polyfills

## Future Enhancements

### Planned Features

1. **Enhanced Offline Support**
   - More comprehensive offline functionality
   - Advanced caching strategies
   - Offline-first architecture

2. **Advanced Push Notifications**
   - Rich media notifications
   - Action buttons and interactive elements
   - Notification scheduling

3. **Performance Optimizations**
   - Predictive caching
   - Background app updates
   - Resource prioritization

4. **Analytics Integration**
   - PWA usage analytics
   - Offline behavior tracking
   - Performance monitoring

### Roadmap

- **Phase 1**: Basic PWA implementation ✅
- **Phase 2**: Enhanced offline capabilities
- **Phase 3**: Advanced push notifications
- **Phase 4**: Performance optimizations
- **Phase 5**: Analytics and monitoring

## Contributing

When contributing to PWA features:

1. Test across multiple browsers
2. Verify offline functionality
3. Check accessibility compliance
4. Update documentation
5. Add appropriate tests

## Resources

- [PWA Documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Sync_API)