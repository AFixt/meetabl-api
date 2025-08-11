# meetabl API Reference

## Overview

WCAG 2.2 AA/AAA compliant booking API for the meetabl platform

**Version:** 1.0.0  
**Base URL:** http://localhost:3001/api

## Authentication

This API uses JWT (JSON Web Token) authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-token>
```

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
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
```

## Endpoints

### Authentication

#### 🔒 POST /auth/register

**Register a new user**

Creates a new user account with email verification

*Requires authentication*

---

#### 🔒 POST /auth/login

**User login**

Authenticate user with email and password

*Requires authentication*

---

### Documentation

#### 🔒 GET /docs

**API Documentation**

Interactive API documentation using Swagger UI

*Requires authentication*

---

#### 🔒 GET /docs/json

**OpenAPI JSON Specification**

Raw OpenAPI 3.0 specification in JSON format

*Requires authentication*

---

## Data Models

### Error

**Properties:**

- `error` (required): object

---

### Success

**Properties:**

- `success` (required): boolean - Operation success indicator
- `data` (required): object - Response data
- `message` (optional): string - Success message
- `timestamp` (optional): string - Response timestamp

---

### PaginatedResponse

**Properties:**

- `success` (required): boolean
- `data` (required): array - Array of results
- `pagination` (required): object

---

### User

**Properties:**

- `id` (required): string - User unique identifier
- `name` (required): string - User full name
- `email` (required): string - User email address
- `timezone` (optional): string - User timezone
- `created_at` (optional): string - User creation timestamp
- `updated_at` (optional): string - User last update timestamp

---

### Booking

**Properties:**

- `id` (required): string - Booking unique identifier
- `user_id` (required): string - Host user ID
- `customer_name` (required): string - Customer name
- `customer_email` (required): string - Customer email
- `start_time` (required): string - Booking start time
- `end_time` (required): string - Booking end time
- `status` (optional): string - Booking status
- `notes` (optional): string - Additional booking notes
- `created_at` (optional): string - Booking creation timestamp

---

