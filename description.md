# AccessMeet Description

Accessmeet is a responsive + accessible microsaas booking UI (WCAG 2.2 AA/AAA compliant) designed to compete with Calendly and other inaccessble calendar booking products.

## Core Features in MVP

1. Accessible Booking Page: WCAG-compliant booking interface (date picker, time slot list, confirmation form with live regions)
2. Availability Rules: Recurring availability, buffers, time zones, max bookings per day
3. Calendar Integrations: OAuth 2.0 for Google and Microsoft; real-time sync for availability and booked slots
4. Notifications: Accessible email confirmations with .ics file + SMS reminders (optional toggle)
5. Admin Dashboard: Manage availability, events, booking links, integrations, branding, accessibility settings
6. Public Booking Link: Shareable public URL (e.g. accessmeet.com/jane)
7. Security: JWT-based auth, hashed passwords, rate limiting, CSRF/XSS protection
8. Compliance: Privacy-first data handling; VPAT-ready from Day 1

## System Architecture

                    ┌────────────────────┐
                    │  Frontend (React)  │
                    │ - Booking page     │
                    │ - Admin dashboard  │
                    └────────┬───────────┘
                             │
                             ▼
              ┌────────────────────────────┐
              │     Node.js (Express)      │
              │  REST API / GraphQL        │
              │  Auth, CRUD, Availability  │
              └────────────┬───────────────┘
                           │
        ┌──────────────────┴───────────────────┐
        │                                      │
        ▼                                      ▼
┌──────────────┐                   ┌────────────────────┐
│ MySQL   │                   │ Redis (BullMQ)     │
│ Users, Events│                   │ Queue: Sync + Email│
└──────────────┘                   └────────────────────┘

                           ▼
       ┌────────────────────────────┐
       │ Google Calendar API        │
       │ Microsoft Graph API        │
       └────────────────────────────┘

                           ▼
       ┌────────────────────────────┐
       │ SendGrid / Postmark        │
       │ Twilio (optional)          │
       └────────────────────────────┘

                           ▼
       ┌────────────────────────────┐
       │ File Storage (S3, etc.)    │
       └────────────────────────────┘


## Database Schema

Located in the install.sql file in this repo


## Google Calendar Integration

* OAuth 2.0 flow using googleapis npm package
* Scopes:
* https://www.googleapis.com/auth/calendar
* offline_access
* Read busy slots
* Insert new event upon booking
* Store access + refresh tokens per user

## Microsoft Calendar Integration

* Use Microsoft Graph API + OAuth
* Scopes:
* Calendars.ReadWrite
* `offline_access`
* Use `@microsoft/microsoft-graph-client` npm package
