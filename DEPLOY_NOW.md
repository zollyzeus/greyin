# 🚀 DEPLOY NOW - Quick Instructions

## ⚡ 3-Step Deployment

### Step 1: Deploy Backend (15 minutes)
```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment"
chmod +x deploy-supabase.sh
./deploy-supabase.sh
```

Wait for all services to start. You'll see:
```
✓ PostgreSQL is healthy
✓ All services are running!
```

### Step 2: Setup Database (5 minutes)

1. Open browser: **https://studio.greyin.net**
2. Login:
   - Email: **admin@greyin.net**
   - Password: **Infy@121238**
3. Click **SQL Editor** → **New query**
4. Copy/paste entire contents of:
   ```
   /media/anand/WD BLACK/projects2/greyin/deployment/migrations/001_initial_schema.sql
   ```
5. Click **Run** button
6. Verify: "Success. No rows returned"

### Step 3: Deploy Frontend (20-30 minutes)
```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment"
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

This will:
1. Build 4 Docker images (~5-10 min each)
2. Deploy all frontend applications
3. Configure SSL certificates automatically

Wait for completion message:
```
✓ All frontend applications are now deployed!
```

## ✅ Verify Deployment

Visit each URL in your browser:
- **Greyin B2B**: https://greyin.net
- **GreyMatters Blog**: https://greymatters.greyin.net
- **FreeAgent**: https://freeagent.greyin.net
- **Salt & Pepper**: https://saltnpepper.greyin.net
- **API**: https://api.greyin.net
- **Admin**: https://studio.greyin.net

All should load with valid SSL certificates.

## 🎯 First Actions

1. **Create Test User:**
   - Go to https://greyin.net
   - Click "Get Started"
   - Register as candidate or company

2. **Add Blog Post:**
   - Login to Studio: https://studio.greyin.net
   - Go to Table Editor → posts
   - Insert new row
   - Visit https://greymatters.greyin.net

3. **Check Services:**
   ```bash
   docker stack ps supabase
   docker stack ps greyin-frontend
   ```

## 🆘 If Something Fails

**Backend issues:**
```bash
docker service logs supabase_supabase_db
docker service logs supabase_kong
```

**Frontend issues:**
```bash
docker service logs greyin-frontend_greyin_web
docker service logs greyin-frontend_greymatters_web
```

**Restart a service:**
```bash
docker service update --force <service_name>
```

## 📖 Full Documentation

For detailed instructions, see:
- **DEPLOYMENT_GUIDE.md** - Complete step-by-step guide
- **IMPLEMENTATION_COMPLETE.md** - What was built
- **README_SUPABASE.md** - Supabase configuration

---

**Total Time: ~45 minutes**

**That's it! Your complete platform is live! 🎉**
