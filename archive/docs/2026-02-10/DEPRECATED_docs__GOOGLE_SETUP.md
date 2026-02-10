# Google Integration Setup

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Cairn Agent"
3. Enable APIs:
   - Gmail API
   - Google Calendar API

## 2. Configure OAuth Consent

1. **APIs & Services** → **OAuth consent screen**
2. User type: **External** (or Internal if Workspace)
3. App name: "Cairn"
4. Scopes: Add Gmail read, Calendar read
5. Test users: Add your email

## 3. Create Credentials

1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URI: `http://localhost:3100/oauth/callback`
5. Download JSON and note:
   - `client_id`
   - `client_secret`

## 4. Add to .env

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=  # Will be set after auth
```

## 5. Authorize (first time)

```bash
# Start gateway
pnpm dev

# Open in browser (link will be shown in logs)
# Complete Google sign-in
# Refresh token will be saved to .env
```

## Security Notes

- Only read access is requested (no write)
- Tokens are stored locally in .env
- Refresh token allows offline access
