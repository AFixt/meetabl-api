#!/usr/bin/env node

/**
 * Documentation generation script
 * 
 * Automatically generates comprehensive API documentation
 * by analyzing routes and controllers
 * 
 * @author meetabl Team
 */

const fs = require('fs');
const path = require('path');
const { specs } = require('../src/config/swagger');

// Generate updated swagger.json file
const generateSwaggerJson = () => {
  const outputPath = path.join(__dirname, '../src/docs/api/swagger.json');
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write formatted JSON
  fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2));
  console.log(`✅ Generated swagger.json at ${outputPath}`);
  
  // Generate summary
  const pathCount = Object.keys(specs.paths || {}).length;
  const schemaCount = Object.keys(specs.components?.schemas || {}).length;
  const responseCount = Object.keys(specs.components?.responses || {}).length;
  
  console.log(`📊 Documentation Statistics:`);
  console.log(`   - OpenAPI Version: ${specs.openapi}`);
  console.log(`   - API Version: ${specs.info?.version}`);
  console.log(`   - Endpoints: ${pathCount}`);
  console.log(`   - Schemas: ${schemaCount}`);
  console.log(`   - Response Templates: ${responseCount}`);
  console.log(`   - Tags: ${specs.tags?.length || 0}`);
};

// Generate markdown documentation
const generateMarkdownDocs = () => {
  const markdownPath = path.join(__dirname, '../docs/API_REFERENCE.md');
  
  let markdown = `# meetabl API Reference

## Overview

${specs.info?.description || 'API documentation for the meetabl platform'}

**Version:** ${specs.info?.version}  
**Base URL:** ${specs.servers?.[0]?.url || 'http://localhost:3001/api'}

## Authentication

This API uses JWT (JSON Web Token) authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Common Response Formats

### Success Response
\`\`\`json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
\`\`\`

### Error Response
\`\`\`json
{
  "error": {
    "code": "error_code",
    "message": "Human readable error message",
    "details": [
      {
        "field": "field_name",
        "message": "Field specific error"
      }
    ],
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
\`\`\`

## Endpoints

`;

  // Group endpoints by tags
  const endpointsByTag = {};
  
  if (specs.paths) {
    Object.entries(specs.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, spec]) => {
        const tag = spec.tags?.[0] || 'Other';
        if (!endpointsByTag[tag]) {
          endpointsByTag[tag] = [];
        }
        endpointsByTag[tag].push({
          path,
          method: method.toUpperCase(),
          summary: spec.summary,
          description: spec.description,
          security: spec.security
        });
      });
    });
  }

  // Generate markdown for each tag
  Object.entries(endpointsByTag).forEach(([tag, endpoints]) => {
    markdown += `### ${tag}\n\n`;
    
    endpoints.forEach(endpoint => {
      const authRequired = !endpoint.security?.some(s => Object.keys(s).length === 0);
      const authBadge = authRequired ? '🔒' : '🔓';
      
      markdown += `#### ${authBadge} ${endpoint.method} ${endpoint.path}\n\n`;
      
      if (endpoint.summary) {
        markdown += `**${endpoint.summary}**\n\n`;
      }
      
      if (endpoint.description) {
        markdown += `${endpoint.description}\n\n`;
      }
      
      if (authRequired) {
        markdown += `*Requires authentication*\n\n`;
      }
      
      markdown += `---\n\n`;
    });
  });

  // Add schemas section
  if (specs.components?.schemas) {
    markdown += `## Data Models\n\n`;
    
    Object.entries(specs.components.schemas).forEach(([name, schema]) => {
      markdown += `### ${name}\n\n`;
      
      if (schema.description) {
        markdown += `${schema.description}\n\n`;
      }
      
      if (schema.properties) {
        markdown += `**Properties:**\n\n`;
        Object.entries(schema.properties).forEach(([prop, propSchema]) => {
          const required = schema.required?.includes(prop) ? '(required)' : '(optional)';
          markdown += `- \`${prop}\` ${required}: ${propSchema.type || 'object'}`;
          if (propSchema.description) {
            markdown += ` - ${propSchema.description}`;
          }
          markdown += `\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    });
  }

  fs.writeFileSync(markdownPath, markdown);
  console.log(`✅ Generated API_REFERENCE.md at ${markdownPath}`);
};

// Generate Postman collection
const generatePostmanCollection = () => {
  const collection = {
    info: {
      name: specs.info?.title || 'meetabl API',
      description: specs.info?.description,
      version: specs.info?.version,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{authToken}}',
          type: 'string'
        }
      ]
    },
    variable: [
      {
        key: 'baseUrl',
        value: specs.servers?.[0]?.url || 'http://localhost:3001/api',
        type: 'string'
      },
      {
        key: 'authToken',
        value: '',
        type: 'string'
      }
    ],
    item: []
  };

  // Group requests by tags
  const requestsByTag = {};
  
  if (specs.paths) {
    Object.entries(specs.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, spec]) => {
        const tag = spec.tags?.[0] || 'Other';
        if (!requestsByTag[tag]) {
          requestsByTag[tag] = [];
        }
        
        const request = {
          name: spec.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [],
            url: {
              raw: `{{baseUrl}}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(p => p)
            }
          }
        };

        // Add request body for POST/PUT/PATCH
        if (['post', 'put', 'patch'].includes(method) && spec.requestBody) {
          request.request.header.push({
            key: 'Content-Type',
            value: 'application/json'
          });
          
          request.request.body = {
            mode: 'raw',
            raw: JSON.stringify({}, null, 2),
            options: {
              raw: {
                language: 'json'
              }
            }
          };
        }

        requestsByTag[tag].push(request);
      });
    });
  }

  // Create folder structure
  Object.entries(requestsByTag).forEach(([tag, requests]) => {
    collection.item.push({
      name: tag,
      item: requests
    });
  });

  const collectionPath = path.join(__dirname, '../postman_collection.json');
  fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
  console.log(`✅ Generated Postman collection at ${collectionPath}`);
};

// Main execution
const main = () => {
  console.log('🚀 Generating API documentation...\n');
  
  try {
    generateSwaggerJson();
    generateMarkdownDocs();
    generatePostmanCollection();
    
    console.log('\n✨ Documentation generation completed successfully!');
    console.log('\n📋 Available documentation:');
    console.log('   - Interactive docs: http://localhost:3001/api/docs');
    console.log('   - JSON specification: http://localhost:3001/api/docs/json');
    console.log('   - Markdown reference: docs/API_REFERENCE.md');
    console.log('   - Postman collection: postman_collection.json');
    
  } catch (error) {
    console.error('❌ Documentation generation failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateSwaggerJson,
  generateMarkdownDocs,
  generatePostmanCollection
};