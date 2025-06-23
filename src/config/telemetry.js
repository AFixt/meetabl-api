/**
 * OpenTelemetry configuration for application performance monitoring
 * 
 * Configures tracing, metrics, and logging for production monitoring
 * 
 * @author meetabl Team
 */

const { NodeSDK } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const opentelemetry = require('@opentelemetry/api');
const { createLogger } = require('./logger');

const logger = createLogger('telemetry');

class TelemetryManager {
  constructor() {
    this.sdk = null;
    this.prometheusExporter = null;
    this.initialized = false;
  }

  /**
   * Initialize OpenTelemetry instrumentation
   */
  initialize() {
    if (this.initialized) {
      logger.warn('Telemetry already initialized');
      return;
    }

    try {
      // Create resource with service information
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'meetabl-api',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'meetabl',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      });

      // Initialize Prometheus metrics exporter
      this.prometheusExporter = new PrometheusExporter({
        port: parseInt(process.env.METRICS_PORT || '9090', 10),
        prefix: 'meetabl_',
      });

      // Initialize the SDK with auto-instrumentations
      this.sdk = new NodeSDK({
        resource,
        instrumentations: [
          // Auto-instrumentations will handle Express, HTTP, MySQL, etc.
        ],
      });

      // Start the SDK
      this.sdk.start();

      logger.info('OpenTelemetry instrumentation initialized', {
        service: 'meetabl-api',
        environment: process.env.NODE_ENV,
        metricsPort: process.env.METRICS_PORT || '9090'
      });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize OpenTelemetry', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a custom meter for application-specific metrics
   */
  getMeter() {
    return opentelemetry.metrics.getMeter('meetabl-api', '1.0.0');
  }

  /**
   * Create a custom tracer for application-specific tracing
   */
  getTracer() {
    return opentelemetry.trace.getTracer('meetabl-api', '1.0.0');
  }

  /**
   * Shutdown telemetry gracefully
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }

    try {
      await this.sdk.shutdown();
      logger.info('OpenTelemetry shutdown completed');
    } catch (error) {
      logger.error('Error during OpenTelemetry shutdown', { error: error.message });
    }
  }
}

// Export singleton instance
const telemetryManager = new TelemetryManager();

module.exports = {
  telemetryManager,
  getMeter: () => telemetryManager.getMeter(),
  getTracer: () => telemetryManager.getTracer()
};