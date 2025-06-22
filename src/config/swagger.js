/**
 * Swagger/OpenAPI configuration
 * 
 * This file configures automatic API documentation generation
 * using swagger-jsdoc and swagger-ui-express
 * 
 * @author meetabl Team
 */

const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'meetabl API',
      version: '1.0.0',
      description: 'WCAG 2.2 AA/AAA compliant booking API for the meetabl platform',
      contact: {
        name: 'meetabl Team',
        email: 'support@meetabl.com',
        url: 'https://meetabl.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001/api',
        description: 'Development server'
      },
      {
        url: 'https://api.meetabl.com/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'meetabl.sid',
          description: 'Session cookie for CSRF protection'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code identifier'
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error message'
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        description: 'Field that caused the error'
                      },
                      message: {
                        type: 'string',
                        description: 'Field-specific error message'
                      }
                    }
                  },
                  description: 'Detailed error information'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Error timestamp'
                }
              }
            }
          }
        },
        Success: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: {
              type: 'boolean',
              example: true,
              description: 'Operation success indicator'
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          required: ['success', 'data', 'pagination'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'array',
              items: {
                type: 'object'
              },
              description: 'Array of results'
            },
            pagination: {
              type: 'object',
              required: ['total', 'limit', 'offset'],
              properties: {
                total: {
                  type: 'integer',
                  description: 'Total number of items'
                },
                limit: {
                  type: 'integer',
                  description: 'Items per page'
                },
                offset: {
                  type: 'integer',
                  description: 'Current offset'
                },
                hasMore: {
                  type: 'boolean',
                  description: 'Whether more items are available'
                }
              }
            }
          }
        },
        User: {
          type: 'object',
          required: ['id', 'name', 'email'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User unique identifier'
            },
            name: {
              type: 'string',
              description: 'User full name',
              example: 'John Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john@example.com'
            },
            timezone: {
              type: 'string',
              description: 'User timezone',
              example: 'America/New_York'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'User last update timestamp'
            }
          }
        },
        Booking: {
          type: 'object',
          required: ['id', 'user_id', 'customer_name', 'customer_email', 'start_time', 'end_time'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Booking unique identifier'
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              description: 'Host user ID'
            },
            customer_name: {
              type: 'string',
              description: 'Customer name',
              example: 'Jane Smith'
            },
            customer_email: {
              type: 'string',
              format: 'email',
              description: 'Customer email',
              example: 'jane@example.com'
            },
            start_time: {
              type: 'string',
              format: 'date-time',
              description: 'Booking start time'
            },
            end_time: {
              type: 'string',
              format: 'date-time',
              description: 'Booking end time'
            },
            status: {
              type: 'string',
              enum: ['confirmed', 'cancelled', 'completed'],
              description: 'Booking status'
            },
            notes: {
              type: 'string',
              description: 'Additional booking notes'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Booking creation timestamp'
            }
          }
        }
      },
      responses: {
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: {
                  code: 'validation_error',
                  message: 'Validation failed',
                  details: [
                    {
                      field: 'email',
                      message: 'Email is required'
                    }
                  ],
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        },
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: {
                  code: 'authentication_error',
                  message: 'Authentication required',
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: {
                  code: 'authorization_error',
                  message: 'Insufficient permissions',
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: {
                  code: 'not_found',
                  message: 'Resource not found',
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: {
                  code: 'internal_error',
                  message: 'An internal server error occurred',
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      },
      {
        cookieAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Users',
        description: 'User management operations'
      },
      {
        name: 'Bookings',
        description: 'Booking management operations'
      },
      {
        name: 'Availability',
        description: 'Availability rules and time slots'
      },
      {
        name: 'Calendar',
        description: 'Calendar integration operations'
      },
      {
        name: 'Notifications',
        description: 'Notification management'
      },
      {
        name: 'Teams',
        description: 'Team and collaboration features'
      },
      {
        name: 'Payments',
        description: 'Payment processing operations'
      },
      {
        name: 'Analytics',
        description: 'Usage analytics and reporting'
      }
    ]
  },
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../controllers/*.js'),
    path.join(__dirname, '../models/*.js')
  ]
};

// Generate swagger specification
const specs = swaggerJSDoc(options);

module.exports = {
  specs,
  options
};