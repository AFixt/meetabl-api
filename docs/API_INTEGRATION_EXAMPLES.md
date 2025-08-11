# API Integration Examples

This document provides comprehensive code examples for integrating with the meetabl API across different programming languages and use cases.

## Table of Contents

1. [Authentication Examples](#authentication-examples)
2. [User Management](#user-management)
3. [Booking Management](#booking-management)
4. [Calendar Integration](#calendar-integration)
5. [Team Management](#team-management)
6. [Payment Integration](#payment-integration)
7. [Monitoring and Health Checks](#monitoring-and-health-checks)
8. [PWA Integration](#pwa-integration)
9. [Webhook Handling](#webhook-handling)
10. [Error Handling](#error-handling)

## Authentication Examples

### JavaScript/Node.js

#### Basic Authentication Flow

```javascript
const axios = require('axios');

class MeetablAPIClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = null;
    this.refreshToken = null;
  }

  // Register a new user
  async register(name, email, password) {
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/register`, {
        name,
        email,
        password
      });
      
      this.token = response.data.token;
      this.refreshToken = response.data.refreshToken;
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Login existing user
  async login(email, password) {
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/login`, {
        email,
        password
      });
      
      this.token = response.data.token;
      this.refreshToken = response.data.refreshToken;
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Refresh authentication token
  async refreshAuthToken() {
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/refresh-token`, {}, {
        headers: this.getAuthHeaders()
      });
      
      this.token = response.data.token;
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get authorization headers
  getAuthHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  // Handle API errors
  handleError(error) {
    if (error.response) {
      return new Error(`API Error: ${error.response.data.error || error.response.statusText}`);
    }
    return error;
  }
}

// Usage example
async function example() {
  const client = new MeetablAPIClient();
  
  try {
    // Register new user
    await client.register('John Doe', 'john@example.com', 'securepassword123');
    console.log('User registered successfully');
    
    // Or login existing user
    // await client.login('john@example.com', 'securepassword123');
    
  } catch (error) {
    console.error('Authentication failed:', error.message);
  }
}
```

#### Automatic Token Refresh

```javascript
const axios = require('axios');

class MeetablAPIClientWithAutoRefresh extends MeetablAPIClient {
  constructor(baseURL) {
    super(baseURL);
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor to add auth header
    axios.interceptors.request.use(
      (config) => {
        if (this.token && config.url.startsWith(this.baseURL)) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshAuthToken();
            originalRequest.headers.Authorization = `Bearer ${this.token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.token = null;
            this.refreshToken = null;
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }
}
```

### Python

```python
import requests
import json
from typing import Optional, Dict, Any

class MeetablAPIClient:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.session = requests.Session()

    def register(self, name: str, email: str, password: str) -> Dict[str, Any]:
        """Register a new user"""
        data = {
            "name": name,
            "email": email,
            "password": password
        }
        
        response = self.session.post(f"{self.base_url}/api/auth/register", json=data)
        response.raise_for_status()
        
        result = response.json()
        self.token = result.get("token")
        self.refresh_token = result.get("refreshToken")
        
        return result

    def login(self, email: str, password: str) -> Dict[str, Any]:
        """Login existing user"""
        data = {"email": email, "password": password}
        
        response = self.session.post(f"{self.base_url}/api/auth/login", json=data)
        response.raise_for_status()
        
        result = response.json()
        self.token = result.get("token")
        self.refresh_token = result.get("refreshToken")
        
        return result

    def get_auth_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def authenticated_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make authenticated request with automatic retry on 401"""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.get("headers", {})
        headers.update(self.get_auth_headers())
        kwargs["headers"] = headers
        
        response = self.session.request(method, url, **kwargs)
        
        # Handle token refresh on 401
        if response.status_code == 401 and self.refresh_token:
            self.refresh_auth_token()
            headers.update(self.get_auth_headers())
            response = self.session.request(method, url, **kwargs)
        
        return response

    def refresh_auth_token(self) -> None:
        """Refresh authentication token"""
        headers = self.get_auth_headers()
        response = self.session.post(f"{self.base_url}/api/auth/refresh-token", headers=headers)
        response.raise_for_status()
        
        result = response.json()
        self.token = result.get("token")

# Usage example
if __name__ == "__main__":
    client = MeetablAPIClient()
    
    try:
        # Register new user
        user_data = client.register("Jane Doe", "jane@example.com", "securepassword123")
        print(f"User registered: {user_data['user']['name']}")
        
    except requests.exceptions.RequestException as e:
        print(f"Registration failed: {e}")
```

### PHP

```php
<?php

class MeetablAPIClient {
    private string $baseURL;
    private ?string $token = null;
    private ?string $refreshToken = null;

    public function __construct(string $baseURL = 'http://localhost:3000') {
        $this->baseURL = $baseURL;
    }

    public function register(string $name, string $email, string $password): array {
        $data = [
            'name' => $name,
            'email' => $email,
            'password' => $password
        ];

        $response = $this->makeRequest('POST', '/api/auth/register', $data);
        
        $this->token = $response['token'] ?? null;
        $this->refreshToken = $response['refreshToken'] ?? null;
        
        return $response;
    }

    public function login(string $email, string $password): array {
        $data = [
            'email' => $email,
            'password' => $password
        ];

        $response = $this->makeRequest('POST', '/api/auth/login', $data);
        
        $this->token = $response['token'] ?? null;
        $this->refreshToken = $response['refreshToken'] ?? null;
        
        return $response;
    }

    public function makeAuthenticatedRequest(string $method, string $endpoint, array $data = []): array {
        $headers = [];
        if ($this->token) {
            $headers[] = 'Authorization: Bearer ' . $this->token;
        }

        try {
            return $this->makeRequest($method, $endpoint, $data, $headers);
        } catch (Exception $e) {
            // Handle 401 by refreshing token
            if (strpos($e->getMessage(), '401') !== false && $this->refreshToken) {
                $this->refreshAuthToken();
                $headers = ['Authorization: Bearer ' . $this->token];
                return $this->makeRequest($method, $endpoint, $data, $headers);
            }
            throw $e;
        }
    }

    private function makeRequest(string $method, string $endpoint, array $data = [], array $headers = []): array {
        $url = $this->baseURL . $endpoint;
        
        $defaultHeaders = [
            'Content-Type: application/json',
            'Accept: application/json'
        ];
        
        $allHeaders = array_merge($defaultHeaders, $headers);
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $allHeaders,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_TIMEOUT => 30
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            throw new Exception("API request failed with status $httpCode: $response");
        }

        return json_decode($response, true);
    }

    private function refreshAuthToken(): void {
        $headers = ['Authorization: Bearer ' . $this->token];
        $response = $this->makeRequest('POST', '/api/auth/refresh-token', [], $headers);
        $this->token = $response['token'] ?? null;
    }
}

// Usage example
try {
    $client = new MeetablAPIClient();
    
    $userData = $client->register('Alice Smith', 'alice@example.com', 'securepassword123');
    echo "User registered: " . $userData['user']['name'] . "\n";
    
} catch (Exception $e) {
    echo "Registration failed: " . $e->getMessage() . "\n";
}
?>
```

## User Management

### Get Current User Profile

```javascript
// JavaScript
async function getCurrentUser(client) {
  try {
    const response = await axios.get(`${client.baseURL}/api/users/me`, {
      headers: client.getAuthHeaders()
    });
    return response.data.user;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const user = await getCurrentUser(client);
console.log(`Welcome, ${user.name}!`);
```

```python
# Python
def get_current_user(client):
    """Get current user profile"""
    response = client.authenticated_request('GET', '/api/users/me')
    response.raise_for_status()
    return response.json()['user']

# Usage
user = get_current_user(client)
print(f"Welcome, {user['name']}!")
```

### Update User Profile

```javascript
// JavaScript
async function updateUserProfile(client, updates) {
  try {
    const response = await axios.put(`${client.baseURL}/api/users/me`, updates, {
      headers: client.getAuthHeaders()
    });
    return response.data.user;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const updatedUser = await updateUserProfile(client, {
  name: 'John Smith',
  timezone: 'America/New_York',
  bio: 'Software Developer'
});
```

### User Settings Management

```javascript
// JavaScript
async function getUserSettings(client) {
  const response = await axios.get(`${client.baseURL}/api/users/settings`, {
    headers: client.getAuthHeaders()
  });
  return response.data.settings;
}

async function updateUserSettings(client, settings) {
  const response = await axios.put(`${client.baseURL}/api/users/settings`, settings, {
    headers: client.getAuthHeaders()
  });
  return response.data.settings;
}

// Usage
const settings = await getUserSettings(client);
const updatedSettings = await updateUserSettings(client, {
  ...settings,
  notifications: {
    email: true,
    sms: false,
    push: true
  },
  accessibility: {
    screenReader: false,
    highContrast: false,
    fontSize: 'medium'
  }
});
```

## Booking Management

### Create a Booking

```javascript
// JavaScript
async function createBooking(client, bookingData) {
  try {
    const response = await axios.post(`${client.baseURL}/api/bookings/my`, bookingData, {
      headers: client.getAuthHeaders()
    });
    return response.data.booking;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const booking = await createBooking(client, {
  title: 'Strategy Meeting',
  start: '2024-02-15T10:00:00Z',
  end: '2024-02-15T11:00:00Z',
  attendeeEmail: 'colleague@example.com',
  description: 'Quarterly strategy planning session',
  location: 'Conference Room A'
});
```

```python
# Python
def create_booking(client, booking_data):
    """Create a new booking"""
    response = client.authenticated_request('POST', '/api/bookings/my', json=booking_data)
    response.raise_for_status()
    return response.json()['booking']

# Usage
booking = create_booking(client, {
    'title': 'Team Standup',
    'start': '2024-02-15T09:00:00Z',
    'end': '2024-02-15T09:30:00Z',
    'attendeeEmail': 'team@example.com',
    'description': 'Daily team standup meeting',
    'recurring': {
        'frequency': 'daily',
        'until': '2024-03-15T09:30:00Z'
    }
})
```

### Get Available Time Slots

```javascript
// JavaScript
async function getAvailableSlots(client, date, duration = 60) {
  try {
    const response = await axios.get(`${client.baseURL}/api/availability/slots`, {
      params: { date, duration },
      headers: client.getAuthHeaders()
    });
    return response.data.slots;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const slots = await getAvailableSlots(client, '2024-02-15', 30);
console.log('Available 30-minute slots:', slots);
```

### Public Booking (No Authentication Required)

```javascript
// JavaScript
async function createPublicBooking(username, bookingData) {
  try {
    const response = await axios.post(`${baseURL}/api/bookings/public/${username}`, bookingData);
    return response.data.booking;
  } catch (error) {
    throw new Error(`Booking failed: ${error.response?.data?.error || error.message}`);
  }
}

// Usage
const publicBooking = await createPublicBooking('johnsmith', {
  attendeeName: 'Jane Client',
  attendeeEmail: 'jane@clientcompany.com',
  start: '2024-02-15T14:00:00Z',
  end: '2024-02-15T15:00:00Z',
  message: 'Looking forward to discussing our project requirements.'
});
```

### Cancel a Booking

```javascript
// JavaScript
async function cancelBooking(client, bookingId, reason = '') {
  try {
    const response = await axios.put(`${client.baseURL}/api/bookings/my/${bookingId}/cancel`, {
      reason
    }, {
      headers: client.getAuthHeaders()
    });
    return response.data.booking;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const cancelledBooking = await cancelBooking(client, 'booking-123', 'Schedule conflict');
```

## Calendar Integration

### Google Calendar Integration

```javascript
// JavaScript
async function connectGoogleCalendar(client) {
  try {
    // Get OAuth URL
    const response = await axios.get(`${client.baseURL}/api/calendar/google/auth`, {
      headers: client.getAuthHeaders()
    });
    
    // Redirect user to OAuth URL
    window.location.href = response.data.authUrl;
  } catch (error) {
    throw client.handleError(error);
  }
}

async function getCalendarStatus(client) {
  try {
    const response = await axios.get(`${client.baseURL}/api/calendar/status`, {
      headers: client.getAuthHeaders()
    });
    return response.data.integrations;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const integrations = await getCalendarStatus(client);
if (!integrations.google.connected) {
  await connectGoogleCalendar(client);
}
```

### Microsoft Calendar Integration

```javascript
// JavaScript
async function connectMicrosoftCalendar(client) {
  try {
    const response = await axios.get(`${client.baseURL}/api/calendar/microsoft/auth`, {
      headers: client.getAuthHeaders()
    });
    
    window.location.href = response.data.authUrl;
  } catch (error) {
    throw client.handleError(error);
  }
}

async function disconnectCalendar(client, provider) {
  try {
    const response = await axios.delete(`${client.baseURL}/api/calendar/disconnect/${provider}`, {
      headers: client.getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
await disconnectCalendar(client, 'google');
```

## Team Management

### Create and Manage Teams

```javascript
// JavaScript
async function createTeam(client, teamData) {
  try {
    const response = await axios.post(`${client.baseURL}/api/teams`, teamData, {
      headers: client.getAuthHeaders()
    });
    return response.data.team;
  } catch (error) {
    throw client.handleError(error);
  }
}

async function addTeamMember(client, teamId, memberData) {
  try {
    const response = await axios.post(`${client.baseURL}/api/teams/${teamId}/members`, memberData, {
      headers: client.getAuthHeaders()
    });
    return response.data.member;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const team = await createTeam(client, {
  name: 'Marketing Team',
  description: 'Marketing department collaboration',
  isPublic: false
});

const member = await addTeamMember(client, team.id, {
  email: 'newmember@example.com',
  role: 'member'
});
```

### Get Team Information

```javascript
// JavaScript
async function getUserTeams(client) {
  try {
    const response = await axios.get(`${client.baseURL}/api/teams`, {
      headers: client.getAuthHeaders()
    });
    return response.data.teams;
  } catch (error) {
    throw client.handleError(error);
  }
}

async function getTeamDetails(client, teamId) {
  try {
    const response = await axios.get(`${client.baseURL}/api/teams/${teamId}`, {
      headers: client.getAuthHeaders()
    });
    return response.data.team;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const teams = await getUserTeams(client);
const teamDetails = await getTeamDetails(client, teams[0].id);
```

## Payment Integration

### Setup Payment Intent

```javascript
// JavaScript
async function createPaymentSetupIntent(client) {
  try {
    const response = await axios.get(`${client.baseURL}/api/payments/setup-intent`, {
      headers: client.getAuthHeaders()
    });
    return response.data.setupIntent;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage with Stripe Elements (frontend)
const setupIntent = await createPaymentSetupIntent(client);

// Initialize Stripe
const stripe = Stripe('pk_test_your_publishable_key');
const elements = stripe.elements();

// Create card element
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// Confirm setup intent
const {error, setupIntent: confirmedSetupIntent} = await stripe.confirmCardSetup(
  setupIntent.client_secret,
  {
    payment_method: {
      card: cardElement,
      billing_details: {
        name: 'Customer Name',
      },
    }
  }
);
```

### Get Subscription Status

```javascript
// JavaScript
async function getSubscriptionStatus(client) {
  try {
    const response = await axios.get(`${client.baseURL}/api/subscriptions/status`, {
      headers: client.getAuthHeaders()
    });
    return response.data.subscription;
  } catch (error) {
    throw client.handleError(error);
  }
}

// Usage
const subscription = await getSubscriptionStatus(client);
console.log(`Subscription status: ${subscription.status}`);
console.log(`Plan: ${subscription.plan.name}`);
console.log(`Next billing: ${subscription.currentPeriodEnd}`);
```

## Monitoring and Health Checks

### Health Check Implementation

```javascript
// JavaScript - Client-side health monitoring
class HealthMonitor {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.isHealthy = true;
    this.lastCheck = null;
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      
      this.isHealthy = response.status === 200;
      this.lastCheck = new Date();
      
      return {
        healthy: this.isHealthy,
        timestamp: this.lastCheck,
        details: response.data
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastCheck = new Date();
      
      return {
        healthy: false,
        timestamp: this.lastCheck,
        error: error.message
      };
    }
  }

  async getDetailedHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/api/monitoring/health`);
      return response.data;
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  startMonitoring(interval = 30000) {
    setInterval(async () => {
      const health = await this.checkHealth();
      console.log(`Health check: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      
      if (!health.healthy) {
        // Trigger reconnection logic or user notification
        this.handleUnhealthy(health);
      }
    }, interval);
  }

  handleUnhealthy(health) {
    console.warn('Service unhealthy:', health);
    // Implement retry logic, user notification, etc.
  }
}

// Usage
const monitor = new HealthMonitor('http://localhost:3000');
monitor.startMonitoring(30000); // Check every 30 seconds
```

### Load Balancer Health Check

```bash
#!/bin/bash
# Simple health check script for load balancers

ENDPOINT="http://localhost:3000/health"
TIMEOUT=5

response=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT "$ENDPOINT")

if [ "$response" = "200" ]; then
    echo "Health check passed"
    exit 0
else
    echo "Health check failed with status: $response"
    exit 1
fi
```

## PWA Integration

### Service Worker Registration

```javascript
// JavaScript - PWA Service Worker Integration
class PWAManager {
  constructor() {
    this.swRegistration = null;
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered successfully');
        
        // Handle updates
        this.swRegistration.addEventListener('updatefound', () => {
          this.handleServiceWorkerUpdate();
        });
        
        return this.swRegistration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async enablePushNotifications(client) {
    if (!this.swRegistration) {
      await this.registerServiceWorker();
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array('your-vapid-public-key')
        });

        // Send subscription to server
        await client.subscribeToPushNotifications(subscription);
        return subscription;
      }
    } catch (error) {
      console.error('Push notification subscription failed:', error);
    }
  }

  setupEventListeners() {
    // Online/offline detection
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOffline();
    });

    // Service Worker messages
    navigator.serviceWorker?.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event.data);
    });
  }

  handleOnline() {
    console.log('Connection restored');
    // Sync offline data
    this.syncOfflineData();
  }

  handleOffline() {
    console.log('Connection lost');
    // Show offline notification
    this.showOfflineNotification();
  }

  async syncOfflineData() {
    // Trigger background sync
    if (this.swRegistration?.sync) {
      await this.swRegistration.sync.register('background-sync');
    }
  }

  urlBase64ToUint8Array(base64String) {
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
}

// Usage
const pwaManager = new PWAManager();
await pwaManager.registerServiceWorker();
```

### Offline Data Sync

```javascript
// JavaScript - Offline Data Management
class OfflineDataManager {
  constructor(client) {
    this.client = client;
    this.dbName = 'meetabl-offline';
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('bookings')) {
          db.createObjectStore('bookings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('offline-actions')) {
          db.createObjectStore('offline-actions', { keyPath: 'id' });
        }
      };
    });
  }

  async storeOfflineAction(action) {
    const transaction = this.db.transaction(['offline-actions'], 'readwrite');
    const store = transaction.objectStore('offline-actions');
    
    const actionWithId = {
      ...action,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };
    
    await store.add(actionWithId);
    return actionWithId;
  }

  async getOfflineActions() {
    const transaction = this.db.transaction(['offline-actions'], 'readonly');
    const store = transaction.objectStore('offline-actions');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async syncOfflineActions() {
    const actions = await this.getOfflineActions();
    
    for (const action of actions) {
      try {
        await this.executeAction(action);
        await this.removeOfflineAction(action.id);
      } catch (error) {
        console.error('Failed to sync action:', action, error);
      }
    }
  }

  async executeAction(action) {
    switch (action.type) {
      case 'CREATE_BOOKING':
        return await this.client.createBooking(action.data);
      case 'UPDATE_BOOKING':
        return await this.client.updateBooking(action.data.id, action.data);
      case 'CANCEL_BOOKING':
        return await this.client.cancelBooking(action.data.id, action.data.reason);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async removeOfflineAction(actionId) {
    const transaction = this.db.transaction(['offline-actions'], 'readwrite');
    const store = transaction.objectStore('offline-actions');
    await store.delete(actionId);
  }
}

// Usage
const offlineManager = new OfflineDataManager(client);
await offlineManager.initialize();

// Store action for later sync when offline
if (!navigator.onLine) {
  await offlineManager.storeOfflineAction({
    type: 'CREATE_BOOKING',
    data: bookingData
  });
} else {
  await client.createBooking(bookingData);
}
```

## Webhook Handling

### Express.js Webhook Handler

```javascript
// Node.js/Express webhook handler
const express = require('express');
const crypto = require('crypto');

const app = express();

// Middleware to verify webhook signatures
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-meetabl-signature'];
  const webhookSecret = process.env.MEETABL_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    return res.status(401).json({ error: 'Webhook signature verification failed' });
  }
  
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(req.body, 'utf8');
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  
  next();
}

// Raw body parsing for webhook verification
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Webhook endpoint
app.post('/webhooks/meetabl', verifyWebhookSignature, (req, res) => {
  const event = JSON.parse(req.body);
  
  console.log('Received webhook event:', event.type);
  
  try {
    switch (event.type) {
      case 'booking.created':
        handleBookingCreated(event.data);
        break;
      case 'booking.cancelled':
        handleBookingCancelled(event.data);
        break;
      case 'user.subscription.updated':
        handleSubscriptionUpdated(event.data);
        break;
      default:
        console.log('Unhandled webhook event type:', event.type);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

function handleBookingCreated(booking) {
  console.log('New booking created:', booking.id);
  // Send confirmation email, update calendar, etc.
}

function handleBookingCancelled(booking) {
  console.log('Booking cancelled:', booking.id);
  // Send cancellation notice, update calendar, etc.
}

function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);
  // Update user permissions, send notification, etc.
}

app.listen(3001, () => {
  console.log('Webhook server listening on port 3001');
});
```

## Error Handling

### Comprehensive Error Handling

```javascript
// JavaScript - Advanced Error Handling
class APIError extends Error {
  constructor(message, status, code, details = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class MeetablAPIClientWithErrorHandling extends MeetablAPIClient {
  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      const message = data.error || data.message || 'API request failed';
      const code = data.code || 'UNKNOWN_ERROR';
      
      // Handle specific error types
      switch (status) {
        case 400:
          throw new APIError(message, status, code, data.details);
        case 401:
          throw new APIError('Authentication failed', status, 'AUTH_FAILED');
        case 403:
          throw new APIError('Access denied', status, 'ACCESS_DENIED');
        case 404:
          throw new APIError('Resource not found', status, 'NOT_FOUND');
        case 422:
          throw new APIError('Validation failed', status, 'VALIDATION_ERROR', data.details);
        case 429:
          throw new APIError('Rate limit exceeded', status, 'RATE_LIMIT');
        case 500:
          throw new APIError('Internal server error', status, 'SERVER_ERROR');
        default:
          throw new APIError(message, status, code);
      }
    } else if (error.request) {
      throw new APIError('Network error', 0, 'NETWORK_ERROR');
    } else {
      throw new APIError(error.message, 0, 'CLIENT_ERROR');
    }
  }

  async retryableRequest(requestFn, maxRetries = 3, backoffMs = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = backoffMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

// Usage with error handling
async function safeApiCall() {
  const client = new MeetablAPIClientWithErrorHandling();
  
  try {
    const booking = await client.retryableRequest(async () => {
      return await client.createBooking({
        title: 'Important Meeting',
        start: '2024-02-15T10:00:00Z',
        end: '2024-02-15T11:00:00Z',
        attendeeEmail: 'client@example.com'
      });
    });
    
    console.log('Booking created successfully:', booking.id);
    
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.code) {
        case 'VALIDATION_ERROR':
          console.error('Invalid booking data:', error.details);
          break;
        case 'AUTH_FAILED':
          console.error('Please log in again');
          // Redirect to login
          break;
        case 'RATE_LIMIT':
          console.error('Too many requests, please try again later');
          break;
        default:
          console.error('API error:', error.message);
      }
    } else {
      console.error('Unexpected error:', error.message);
    }
  }
}
```

### Validation Error Handling

```javascript
// JavaScript - Validation Error Display
function displayValidationErrors(errors) {
  const errorContainer = document.getElementById('error-container');
  errorContainer.innerHTML = '';
  
  if (errors && typeof errors === 'object') {
    Object.keys(errors).forEach(field => {
      const fieldErrors = Array.isArray(errors[field]) ? errors[field] : [errors[field]];
      
      fieldErrors.forEach(error => {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = `${field}: ${error}`;
        errorContainer.appendChild(errorElement);
        
        // Highlight the corresponding form field
        const fieldElement = document.getElementById(field);
        if (fieldElement) {
          fieldElement.classList.add('error');
        }
      });
    });
  }
}

// Usage in form submission
async function submitBookingForm(formData) {
  try {
    const booking = await client.createBooking(formData);
    showSuccess('Booking created successfully!');
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      displayValidationErrors(error.details);
    } else {
      showError(error.message);
    }
  }
}
```

## Testing Your Integration

### Unit Tests

```javascript
// Jest test example
const MeetablAPIClient = require('./meetabl-client');

describe('MeetablAPIClient', () => {
  let client;

  beforeEach(() => {
    client = new MeetablAPIClient('http://localhost:3000');
  });

  describe('Authentication', () => {
    test('should register a new user', async () => {
      const mockResponse = {
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
        token: 'mock-jwt-token'
      };

      // Mock axios
      const axios = require('axios');
      axios.post.mockResolvedValue({ data: mockResponse });

      const result = await client.register('Test User', 'test@example.com', 'password123');

      expect(result.user.name).toBe('Test User');
      expect(client.token).toBe('mock-jwt-token');
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/register',
        {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        }
      );
    });
  });
});
```

### Integration Tests

```javascript
// Integration test example
describe('Integration Tests', () => {
  let client;

  beforeAll(async () => {
    client = new MeetablAPIClient(process.env.TEST_API_URL);
    await client.login(process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  });

  test('should create and cancel a booking', async () => {
    // Create booking
    const booking = await client.createBooking({
      title: 'Test Meeting',
      start: '2024-12-31T10:00:00Z',
      end: '2024-12-31T11:00:00Z',
      attendeeEmail: 'test@example.com'
    });

    expect(booking.id).toBeDefined();
    expect(booking.title).toBe('Test Meeting');

    // Cancel booking
    const cancelledBooking = await client.cancelBooking(booking.id, 'Test cancellation');

    expect(cancelledBooking.status).toBe('cancelled');
  });
});
```

This comprehensive guide provides practical examples for integrating with the meetabl API across different programming languages and use cases. Use these examples as starting points for your own integrations, adapting them to your specific requirements and technology stack.