# Calendar OAuth Setup Guide

This guide explains how to obtain OAuth credentials for Google     Calendar and Microsoft Calendar integrations in the
 meetabl application.

## Google Calendar OAuth Setup

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Configure the OAuth consent screen if prompted:
   - Choose "External" user type for testing
   - Fill in required application information
   - Add your email to test users
4. Choose "Web application" as application type
5. Add authorized redirect URIs:
   - **Development**: `http://localhost:3001/api/calendar/google/callback`
   - **Production**: `https://yourdomain.com/api/calendar/google/callback`

### 3. Configure Environment Variables

Copy the **Client ID** and **Client Secret** and add them to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar/google/callback
```

## Microsoft Calendar OAuth Setup

### 1. Azure Portal Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. In the search bar at the top, search for **"App registrations"** and select it
   - Alternative: Look for **"Microsoft Entra ID"** in the left sidebar, then click **"App registrations"**
3. Click **"+ New registration"**

### 2. Register Your Application

1. **Name**: "Meetabl Calendar Integration" (or your preferred name)
2. **Supported account types**: "Accounts in any organizational directory and personal Microsoft accounts"
3. **Redirect URI**:
   - Platform: Web
   - **Development**: `http://localhost:3001/api/calendar/microsoft/callback`
   - **Production**: `https://yourdomain.com/api/calendar/microsoft/callback`

### 3. Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph"
4. Choose "Delegated permissions"
5. Add the following permissions:
   - `Calendars.ReadWrite` - Read and write access to user calendars
   - `offline_access` - Maintain access to data you have given it access to

### 4. Create Client Secret

1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Add description: "Meetabl Calendar Integration"
4. Set expiration (recommended: 24 months)
5. Click "Add"
6. **Important**: Copy the **Value** immediately (this is your client secret)

### 5. Configure Environment Variables

Copy the **Application (client) ID** from the Overview page and the client secret, then add them to your `.env` file:

```bash
MICROSOFT_CLIENT_ID=your_microsoft_application_id_here
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret_here
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/calendar/microsoft/callback
```

## Complete Environment Configuration

Your final `.env` file should include all calendar OAuth settings:

```bash
# Google Calendar OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar/google/callback

# Microsoft Calendar OAuth
MICROSOFT_CLIENT_ID=your_microsoft_application_id_here
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret_here
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/calendar/microsoft/callback
```

## Testing the Integration

After adding credentials to your `.env` file:

1. Restart your API server
2. Test the status endpoints:

   ```bash
   curl http://localhost:3001/api/calendar/google/status
   curl http://localhost:3001/api/calendar/microsoft/status
   ```

3. Both should return `"configured": true`

## Security Best Practices

### Development

- ⚠️ **Never commit credentials to your repository**
- Keep `.env` in your `.gitignore`
- Use separate credentials for development and production

### Production

- 🔒 Use HTTPS for all redirect URIs in production
- Update redirect URIs to match your production domain
- Consider using Azure Key Vault or Google Secret Manager for credential storage
- Rotate secrets regularly (at least annually)
- Monitor OAuth application usage and access logs

### OAuth Consent Screen

- For Google: Complete the OAuth consent screen verification for production use
- For Microsoft: Consider multi-tenant vs single-tenant application based on your needs

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**
   - Ensure redirect URIs in OAuth config match exactly with your `.env` settings
   - Check for trailing slashes or typos

2. **"Client secret expired"**
   - Microsoft client secrets expire - create a new one in Azure Portal
   - Google client secrets don't expire unless manually revoked

3. **"Insufficient permissions"**
   - Verify Calendar permissions are granted in both Google and Microsoft configs
   - For Microsoft, ensure admin consent is granted if required

4. **"Integration not configured" status**
   - Check that environment variables are properly set
   - Restart the API server after updating `.env`
   - Verify no extra spaces or quotes in credential values

## API Endpoints

Once configured, the following endpoints will be available:

- `GET /api/calendar/google/status` - Check Google Calendar integration status
- `GET /api/calendar/microsoft/status` - Check Microsoft Calendar integration status
- `GET /api/calendar/google/auth` - Get Google OAuth authorization URL (requires authentication)
- `GET /api/calendar/microsoft/auth` - Get Microsoft OAuth authorization URL (requires authentication)
- `GET /api/calendar/google/callback` - Handle Google OAuth callback
- `GET /api/calendar/microsoft/callback` - Handle Microsoft OAuth callback

For more technical details, refer to the API documentation and calendar controller implementation.
