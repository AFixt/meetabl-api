/**
 * Documentation routes
 *
 * Serves API documentation using Swagger UI
 *
 * @author meetabl Team
 */

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { specs } = require('../config/swagger');

const router = express.Router();

// Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .scheme-container { 
      background: #f8f9fa; 
      border: 1px solid #dee2e6; 
      border-radius: 4px; 
      padding: 10px; 
      margin: 20px 0; 
    }
  `,
  customSiteTitle: 'meetabl API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true
  }
};

/**
 * @swagger
 * /docs:
 *   get:
 *     tags: [Documentation]
 *     summary: API Documentation
 *     description: Interactive API documentation using Swagger UI
 *     security: []
 *     responses:
 *       200:
 *         description: API documentation page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, swaggerUiOptions));

/**
 * @swagger
 * /docs/json:
 *   get:
 *     tags: [Documentation]
 *     summary: OpenAPI JSON Specification
 *     description: Raw OpenAPI 3.0 specification in JSON format
 *     security: []
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

/**
 * Health check for documentation service
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'docs',
    timestamp: new Date().toISOString(),
    specs: {
      openapi: specs.openapi,
      title: specs.info?.title,
      version: specs.info?.version,
      pathCount: Object.keys(specs.paths || {}).length,
      schemaCount: Object.keys(specs.components?.schemas || {}).length
    }
  });
});

module.exports = router;