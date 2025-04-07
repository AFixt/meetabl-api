# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands

- **Start development server**: `npm run dev`
- **Run all tests**: `npm test`
- **Run unit tests**: `npm run test:unit`
- **Run integration tests**: `npm run test:integration`
- **Run model tests**: `npm run test:models`
- **Run controller tests**: `npm run test:controllers`
- **Run service tests**: `npm run test:services`
- **Run middleware tests**: `npm run test:middlewares`
- **Run route tests**: `npm run test:routes`
- **Run specific test**: `npx jest path/to/test.test.js`
- **Run tests for specific pattern**: `npm run test:unit -- -t 'Auth Middleware'`
- **Run tests in watch mode**: `npm run test:watch`
- **Run test coverage**: `npm run test:coverage`
- **Lint JavaScript**: `npm run lint:js`
- **Lint Markdown**: `npm run lint:md`
- **Lint everything**: `npm run lint`
- **Run database migrations**: `npm run db:migrate`

## Code Style Guidelines

- **ESLint**: Follow Airbnb config with custom overrides (no comma-dangle, ignore 'next' in unused vars)
- **Formatting**: 2 spaces indentation, 100 char line length, Unix LF line endings
- **Variables**: Use `const` by default, `let` when needed, never `var`
- **Imports**: Group external packages first, then internal modules
- **Naming**: camelCase for variables/functions, PascalCase for classes, kebab-case for files
- **Strings**: Use template literals for interpolation, single quotes for simple strings
- **Documentation**: JSDoc comments required for all files and functions
- **Error Handling**: Always use try/catch with proper logging via the logger utility
- **Validation**: Validate all inputs using express-validator
- **Security**: Never expose sensitive data, use environment variables for secrets

Always refer to detailed standards in the `docs/standards/` directory.