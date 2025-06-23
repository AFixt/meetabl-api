/**
 * Telemetry initialization
 * 
 * This file must be required before any other modules to ensure
 * OpenTelemetry auto-instrumentation works correctly
 * 
 * @author meetabl Team
 */

// Only initialize telemetry in production or when explicitly enabled
const shouldInitializeTelemetry = process.env.NODE_ENV === 'production' || 
                                  process.env.ENABLE_TELEMETRY === 'true';

if (shouldInitializeTelemetry) {
  const { telemetryManager } = require('./config/telemetry');
  
  // Initialize telemetry before any other imports
  telemetryManager.initialize();
  
  console.log('🔍 Telemetry initialized');
}

module.exports = { enabled: shouldInitializeTelemetry };