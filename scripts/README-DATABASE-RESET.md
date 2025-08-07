# Database Reset Scripts

This directory contains scripts for resetting the database in development and test environments.

## ⚠️ WARNING

**These scripts will DELETE ALL DATA in the database!**  
Only use them in development or test environments. They include safety checks to prevent accidental use in production.

## Available Scripts

### Node.js Script (reset-database.js)

The primary database reset script for local development.

#### Usage

```bash
# Basic reset (will prompt for confirmation)
node scripts/reset-database.js

# Skip confirmation prompt
node scripts/reset-database.js --force

# Reset and seed with demo data
node scripts/reset-database.js --force --seed

# Reset test database
node scripts/reset-database.js --env=test --force

# Show help
node scripts/reset-database.js --help
```

#### NPM Scripts

For convenience, you can also use npm scripts:

```bash
# Full database reset (drops all tables, runs migrations)
npm run db:reset:full

# Full reset with demo data seeding
npm run db:reset:full:seed
```

### Bash Script (reset-database.sh)

Located in `meetabl-infra/scripts/reset-database.sh` for Docker environments.

#### Usage

```bash
# Navigate to meetabl-infra directory
cd ../meetabl-infra

# Basic reset in Docker (will prompt for confirmation)
./scripts/reset-database.sh

# Skip confirmation and seed data
./scripts/reset-database.sh --force --seed

# Reset local database (not Docker)
./scripts/reset-database.sh --local --force

# Show help
./scripts/reset-database.sh --help
```

## What the Scripts Do

1. **Safety Check**: Verify the environment is not production
2. **Connection Test**: Ensure database is accessible
3. **Show Statistics**: Display current table and record count
4. **Confirmation**: Ask for user confirmation (unless --force is used)
5. **Drop Tables**: Remove all tables from the database
6. **Run Migrations**: Recreate the database schema
7. **Seed Data** (optional): Populate with demo/test data
8. **Final Statistics**: Show the new database state

## Features

- **Environment Protection**: Prevents accidental production database reset
- **Confirmation Prompt**: Requires explicit confirmation unless forced
- **Statistics Display**: Shows before/after database statistics
- **Docker Support**: Works with both local and Docker environments
- **Flexible Seeding**: Optional data seeding after reset
- **Error Handling**: Comprehensive error messages and logging

## Common Use Cases

### Starting Fresh Development

```bash
# Reset everything and add demo data
npm run db:reset:full:seed
```

### Clean Test Environment

```bash
# Reset test database without data
node scripts/reset-database.js --env=test --force
```

### Docker Development Reset

```bash
cd ../meetabl-infra
./scripts/reset-database.sh --force --seed
```

### Quick Reset Without Prompts

```bash
# For automated scripts or CI/CD
node scripts/reset-database.js --force
```

## Differences from Other Database Scripts

- `db:reset` - Uses manage-test-data.js, less comprehensive
- `db:clean` - Only removes data, doesn't drop tables
- `db:migrate` - Only runs migrations, doesn't clear existing data
- `db:seed` - Only adds data, doesn't reset structure

The `reset-database` scripts provide a complete, clean slate by:
- Dropping ALL tables (not just truncating)
- Running ALL migrations from scratch
- Optionally seeding with fresh data

## Troubleshooting

### Docker Connection Issues

If you get connection errors with Docker:

1. Ensure containers are running:
   ```bash
   docker-compose ps
   ```

2. Start containers if needed:
   ```bash
   docker-compose up -d
   ```

### Permission Errors

If you get permission errors:

1. Make the bash script executable:
   ```bash
   chmod +x scripts/reset-database.sh
   ```

2. Check database user permissions

### Migration Failures

If migrations fail after reset:

1. Check for migration file issues
2. Ensure all migration files are present
3. Check database connection settings

## Safety Features

1. **Production Guard**: Scripts refuse to run if NODE_ENV=production
2. **Confirmation Required**: User must type "yes" to proceed (unless --force)
3. **Connection Test**: Verifies database is accessible before proceeding
4. **Transaction Safety**: Uses proper foreign key handling during drops
5. **Detailed Logging**: Shows exactly what's being done at each step

## Contributing

When modifying these scripts:

1. Maintain the safety checks
2. Test in development environment first
3. Update this documentation
4. Consider backward compatibility