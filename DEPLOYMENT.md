# CattleNet Smartfarm - Deployment Guide

## 🚀 **Backend Deployment (Always Running)**

### **Option 1: Heroku (Recommended for Always-On Backend)**

1. **Install Heroku CLI**
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Deploy Backend to Heroku**
   ```bash
   # Login to Heroku
   heroku login
   
   # Create Heroku app for backend
   cd backend
   heroku create cattlenet-smartfarm-backend
   
   # Set environment variables
   heroku config:set FLASK_ENV=production
   heroku config:set FLASK_DEBUG=False
   heroku config:set MQTT_BROKER=broker.emqx.io
   heroku config:set MQTT_PORT=1883
   heroku config:set CORS_ORIGINS=https://your-frontend-domain.vercel.app
   
   # Deploy
   git init
   git add .
   git commit -m "Initial backend deployment"
   heroku git:remote -a cattlenet-smartfarm-backend
   git push heroku main
   ```

3. **Keep Backend Always Running**
   ```bash
   # Scale to at least 1 dyno (this ensures it's always running)
   heroku ps:scale web=1
   
   # Enable Heroku's "Always On" (requires paid plan)
   # Or use a service like Kaffeine to ping your app every 30 minutes
   ```

### **Option 2: Railway.app (Alternative Always-On Platform)**

1. **Connect to Railway**
   - Go to https://railway.app
   - Connect your GitHub repository
   - Select the backend folder for deployment

2. **Configure Environment Variables**
   ```
   FLASK_ENV=production
   FLASK_DEBUG=False
   MQTT_BROKER=broker.emqx.io
   MQTT_PORT=1883
   CORS_ORIGINS=https://your-frontend-domain.vercel.app
   ```

### **Option 3: DigitalOcean App Platform**

1. **Create App**
   - Go to DigitalOcean App Platform
   - Connect your repository
   - Select backend folder

2. **Configure**
   - Set Python version to 3.11.9
   - Set environment variables
   - Enable auto-scaling

---

## 🌐 **Frontend Deployment (Vercel)**

### **Step 1: Update Environment Variables**

1. **Update vercel.json**
   ```json
   {
     "env": {
       "REACT_APP_API_URL": "https://cattlenet-smartfarm-backend.herokuapp.com",
       "REACT_APP_WEBSOCKET_URL": "https://cattlenet-smartfarm-backend.herokuapp.com"
     }
   }
   ```

### **Step 2: Deploy to Vercel**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   # From project root
   vercel login
   vercel --prod
   ```

3. **Configure Environment Variables in Vercel Dashboard**
   - Go to your Vercel project settings
   - Add environment variables:
     - `REACT_APP_API_URL`: Your Heroku backend URL
     - `REACT_APP_WEBSOCKET_URL`: Your Heroku backend URL

---

## 🔧 **Configuration Steps**

### **1. Update CORS in Backend**
After deploying frontend, update the backend CORS settings:
```bash
heroku config:set CORS_ORIGINS=https://your-vercel-app.vercel.app
```

### **2. Update Frontend URLs**
Update your `.env.production` file with the actual backend URL:
```
REACT_APP_API_URL=https://cattlenet-smartfarm-backend.herokuapp.com
REACT_APP_WEBSOCKET_URL=https://cattlenet-smartfarm-backend.herokuapp.com
```

### **3. Test the Deployment**
1. Visit your Vercel frontend URL
2. Check if data loads from the backend
3. Test real-time features (WebSocket connections)
4. Send test MQTT data to verify functionality

---

## 📊 **Monitoring & Maintenance**

### **Keep Backend Always Running**

1. **Heroku Free Tier Limitation**
   - Free dynos sleep after 30 minutes of inactivity
   - Upgrade to paid plan ($7/month) for always-on

2. **Alternative: Uptime Monitoring**
   ```bash
   # Use services like:
   # - UptimeRobot (free)
   # - Pingdom
   # - StatusCake
   # Set them to ping your backend every 25 minutes
   ```

3. **MQTT Connection Health**
   - Monitor MQTT broker connectivity
   - Set up alerts for connection failures
   - Implement reconnection logic (already included)

### **Environment Variables Summary**

**Backend (.env):**
```
FLASK_ENV=production
FLASK_DEBUG=False
HOST=0.0.0.0
PORT=5000
MQTT_BROKER=broker.emqx.io
MQTT_PORT=1883
CORS_ORIGINS=https://your-frontend-domain.vercel.app
```

**Frontend (.env.production):**
```
REACT_APP_API_URL=https://your-backend-url.herokuapp.com
REACT_APP_WEBSOCKET_URL=https://your-backend-url.herokuapp.com
```

---

## 🔐 **Security Considerations**

1. **API Keys**: Store sensitive data in environment variables
2. **CORS**: Restrict origins to your frontend domain
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Consider adding rate limiting to APIs
5. **MQTT Security**: Use authenticated MQTT broker for production

---

## 📈 **Scaling Considerations**

1. **Database**: Consider migrating from in-memory storage to PostgreSQL/MongoDB
2. **Caching**: Implement Redis for session management
3. **Load Balancing**: Use multiple backend instances for high traffic
4. **CDN**: Use Vercel's built-in CDN for frontend assets

Your CattleNet Smartfarm will be accessible 24/7 with this setup! 🐄📡