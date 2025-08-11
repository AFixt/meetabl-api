/**
 * Meetabl API JavaScript SDK
 * 
 * A simple, lightweight SDK for integrating with the meetabl API
 * 
 * @author meetabl Team
 * @version 1.0.0
 */

class MeetablAPIClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:3000';
    this.token = options.token || null;
    this.refreshToken = options.refreshToken || null;
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.onTokenRefresh = options.onTokenRefresh || null;
    this.onError = options.onError || null;
  }

  // Authentication Methods
  async register(name, email, password) {
    const response = await this._request('POST', '/api/auth/register', {
      name,
      email,
      password
    });
    
    this._updateTokens(response);
    return response;
  }

  async login(email, password) {
    const response = await this._request('POST', '/api/auth/login', {
      email,
      password
    });
    
    this._updateTokens(response);
    return response;
  }

  async refreshAuthToken() {
    const response = await this._request('POST', '/api/auth/refresh-token', {}, true);
    this._updateTokens(response);
    return response;
  }

  async logout() {
    await this._request('POST', '/api/auth/logout', {}, true);
    this.token = null;
    this.refreshToken = null;
  }

  // User Methods
  async getCurrentUser() {
    const response = await this._request('GET', '/api/users/me', null, true);
    return response.user;
  }

  async updateUser(updates) {
    const response = await this._request('PUT', '/api/users/me', updates, true);
    return response.user;
  }

  async getUserSettings() {
    const response = await this._request('GET', '/api/users/settings', null, true);
    return response.settings;
  }

  async updateUserSettings(settings) {
    const response = await this._request('PUT', '/api/users/settings', settings, true);
    return response.settings;
  }

  // Booking Methods
  async createBooking(bookingData) {
    const response = await this._request('POST', '/api/bookings/my', bookingData, true);
    return response.booking;
  }

  async getBookings(params = {}) {
    const response = await this._request('GET', '/api/bookings/my', null, true, params);
    return response.bookings;
  }

  async getBooking(bookingId) {
    const response = await this._request('GET', `/api/bookings/my/${bookingId}`, null, true);
    return response.booking;
  }

  async cancelBooking(bookingId, reason = '') {
    const response = await this._request('PUT', `/api/bookings/my/${bookingId}/cancel`, { reason }, true);
    return response.booking;
  }

  async createPublicBooking(username, bookingData) {
    const response = await this._request('POST', `/api/bookings/public/${username}`, bookingData);
    return response.booking;
  }

  async getPublicAvailability(username, params = {}) {
    const response = await this._request('GET', `/api/bookings/public/${username}`, null, false, params);
    return response;
  }

  // Availability Methods
  async getAvailabilityRules() {
    const response = await this._request('GET', '/api/availability/rules', null, true);
    return response.rules;
  }

  async createAvailabilityRule(ruleData) {
    const response = await this._request('POST', '/api/availability/rules', ruleData, true);
    return response.rule;
  }

  async updateAvailabilityRule(ruleId, updates) {
    const response = await this._request('PUT', `/api/availability/rules/${ruleId}`, updates, true);
    return response.rule;
  }

  async deleteAvailabilityRule(ruleId) {
    await this._request('DELETE', `/api/availability/rules/${ruleId}`, null, true);
  }

  async getAvailableSlots(date, duration = 60) {
    const response = await this._request('GET', '/api/availability/slots', null, true, { date, duration });
    return response.slots;
  }

  // Calendar Methods
  async getCalendarStatus() {
    const response = await this._request('GET', '/api/calendar/status', null, true);
    return response.integrations;
  }

  async getGoogleAuthUrl() {
    const response = await this._request('GET', '/api/calendar/google/auth', null, true);
    return response.authUrl;
  }

  async getMicrosoftAuthUrl() {
    const response = await this._request('GET', '/api/calendar/microsoft/auth', null, true);
    return response.authUrl;
  }

  async disconnectCalendar(provider) {
    const response = await this._request('DELETE', `/api/calendar/disconnect/${provider}`, null, true);
    return response;
  }

  // Team Methods
  async getTeams() {
    const response = await this._request('GET', '/api/teams', null, true);
    return response.teams;
  }

  async createTeam(teamData) {
    const response = await this._request('POST', '/api/teams', teamData, true);
    return response.team;
  }

  async getTeam(teamId) {
    const response = await this._request('GET', `/api/teams/${teamId}`, null, true);
    return response.team;
  }

  async updateTeam(teamId, updates) {
    const response = await this._request('PUT', `/api/teams/${teamId}`, updates, true);
    return response.team;
  }

  async deleteTeam(teamId) {
    await this._request('DELETE', `/api/teams/${teamId}`, null, true);
  }

  async addTeamMember(teamId, memberData) {
    const response = await this._request('POST', `/api/teams/${teamId}/members`, memberData, true);
    return response.member;
  }

  async removeTeamMember(teamId, userId) {
    await this._request('DELETE', `/api/teams/${teamId}/members/${userId}`, null, true);
  }

  // Monitoring Methods
  async getHealth() {
    const response = await this._request('GET', '/health');
    return response;
  }

  async getDetailedHealth() {
    const response = await this._request('GET', '/api/monitoring/health');
    return response;
  }

  async getComponentHealth(component) {
    const response = await this._request('GET', `/api/monitoring/health/${component}`);
    return response;
  }

  // PWA Methods
  async subscribeToPushNotifications(subscription) {
    const response = await this._request('POST', '/api/pwa/subscribe', { subscription }, true);
    return response;
  }

  async unsubscribeFromPushNotifications(endpoint) {
    const response = await this._request('DELETE', '/api/pwa/unsubscribe', { endpoint }, true);
    return response;
  }

  async syncOfflineData(syncType, data) {
    const response = await this._request('POST', '/api/pwa/sync', { syncType, data }, true);
    return response;
  }

  async getOfflineData() {
    const response = await this._request('GET', '/api/pwa/offline-data', null, true);
    return response.data;
  }

  async getPWAStatus() {
    const response = await this._request('GET', '/api/pwa/status');
    return response.status;
  }

  // Subscription Methods
  async getSubscriptionStatus() {
    const response = await this._request('GET', '/api/subscriptions/status', null, true);
    return response.subscription;
  }

  async createPaymentSetupIntent() {
    const response = await this._request('GET', '/api/payments/setup-intent', null, true);
    return response.setupIntent;
  }

  // Private Methods
  async _request(method, endpoint, data = null, requiresAuth = false, params = {}) {
    let attempt = 0;
    let lastError;

    while (attempt <= this.retries) {
      try {
        const url = new URL(endpoint, this.baseURL);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
          if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
          }
        });

        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(this.timeout)
        };

        // Add authentication header
        if (requiresAuth && this.token) {
          options.headers.Authorization = `Bearer ${this.token}`;
        }

        // Add request body
        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
          options.body = JSON.stringify(data);
        }

        const response = await fetch(url.toString(), options);

        // Handle 401 with token refresh
        if (response.status === 401 && requiresAuth && this.refreshToken && attempt === 0) {
          try {
            await this.refreshAuthToken();
            attempt++;
            continue; // Retry with new token
          } catch (refreshError) {
            throw new APIError('Authentication failed', 401, 'AUTH_FAILED');
          }
        }

        const responseData = await this._parseResponse(response);

        if (!response.ok) {
          throw new APIError(
            responseData.error || 'Request failed',
            response.status,
            responseData.code || 'UNKNOWN_ERROR',
            responseData.details
          );
        }

        return responseData;

      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except 401
        if (error.status >= 400 && error.status < 500 && error.status !== 401) {
          break;
        }

        attempt++;
        if (attempt <= this.retries) {
          await this._sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }

    if (this.onError) {
      this.onError(lastError);
    }

    throw lastError;
  }

  async _parseResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  _updateTokens(response) {
    if (response.token) {
      this.token = response.token;
    }
    if (response.refreshToken) {
      this.refreshToken = response.refreshToken;
    }
    
    if (this.onTokenRefresh) {
      this.onTokenRefresh(this.token, this.refreshToken);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility Methods
  isAuthenticated() {
    return !!this.token;
  }

  setTokens(token, refreshToken) {
    this.token = token;
    this.refreshToken = refreshToken;
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
  }
}

class APIError extends Error {
  constructor(message, status, code, details = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MeetablAPIClient, APIError };
}

// Export for browsers
if (typeof window !== 'undefined') {
  window.MeetablAPIClient = MeetablAPIClient;
  window.APIError = APIError;
}