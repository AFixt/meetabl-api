/**
 * Mock Telemetry for Tests
 *
 * Provides a mock implementation of telemetry to avoid initialization issues in tests
 *
 * @author meetabl Team
 */

// Mock telemetry manager
const mockTelemetryManager = {
  recordMetric: jest.fn(),
  recordEvent: jest.fn(),
  recordError: jest.fn(),
  recordDuration: jest.fn(),
  recordGauge: jest.fn(),
  recordHistogram: jest.fn(),
  startSpan: jest.fn(() => ({
    end: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    setAttribute: jest.fn(),
    setAttributes: jest.fn()
  })),
  shutdown: jest.fn().mockResolvedValue(),
  flush: jest.fn().mockResolvedValue()
};

// Mock telemetry instance
const telemetry = mockTelemetryManager;

// Export mocks
module.exports = telemetry;
module.exports.telemetry = telemetry;
module.exports.TelemetryManager = jest.fn(() => mockTelemetryManager);

// Helper to reset all mocks
module.exports.resetMocks = () => {
  Object.values(mockTelemetryManager).forEach(fn => {
    if (typeof fn === 'function' && fn.mockClear) {
      fn.mockClear();
    }
  });
};