# Vercel Deployment for CattleNet Backend

## ⚠️ Important Limitations

Vercel uses **serverless functions** which have these limitations:

### What **WON'T** Work on Vercel:
- ❌ **WebSocket/Socket.IO** - Real-time updates will not work
- ❌ **MQTT connections** - Cannot maintain long-lived MQTT connections
- ❌ **Background threads** - Serverless functions stop after request completes
- ❌ **10-second timeout** on Free tier (60s on Pro)

### What **WILL** Work on Vercel:
- ✅ **REST API endpoints** - `/api/data`, `/api/latest`, etc.
- ✅ **MongoDB integration** - If you add MongoDB
- ✅ **HTTP polling** - Frontend can poll for updates every few seconds

## Recommended Deployment Options

### Option 1: **Railway.app** (RECOMMENDED)
- ✅ Supports WebSocket
- ✅ Supports long-running processes
- ✅ Python/Flask support
- ✅ Free tier available
- 🔗 [railway.app](https://railway.app)

### Option 2: **Fly.io**
- ✅ Full Docker support
- ✅ WebSocket support
- ✅ Free tier available
- 🔗 [fly.io](https://fly.io)

### Option 3: **Vercel** (Current - Limited)
- ⚠️ REST API only
- ⚠️ No real-time updates
- ⚠️ Frontend must use HTTP polling

## Quick Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select your `CattleNet` repository
5. Railway will auto-detect Python and use:
   - Build: `pip install -r backend/requirements.txt`
   - Start: `cd backend && python app.py`
6. Add environment variables in dashboard:
   - `MQTT_BROKER`: broker.emqx.io
   - `MQTT_PORT`: 1883
   - `PORT`: 5001
7. Deploy! ✅

## If You Still Want Vercel

You'll need to use HTTP polling in your frontend instead of WebSocket.
See `vercel-backend.json` for configuration.

**Note**: Real-time features will be much slower (polling every 3-5 seconds instead of instant updates).