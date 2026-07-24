# Vault API - Node.js Backend

REST API for Vault mobile application, built with Node.js, Express, and PostgreSQL.

## Deployment to Railway

### Prerequisites
1. GitHub account
2. Railway account (https://railway.app)

### Steps

1. **Create GitHub repository**
   ```bash
   cd C:\bitrix\mimo\backend-node
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/vault-api.git
   git push -u origin main
   ```

2. **Deploy to Railway**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect Node.js and deploy

3. **Add PostgreSQL**
   - In Railway dashboard, click "New" → "Database" → "PostgreSQL"
   - Railway will provide a `DATABASE_URL` environment variable

4. **Set Environment Variables**
   - `DATABASE_URL`: PostgreSQL connection string (auto-provided by Railway)
   - `JWT_SECRET`: Your secret key for JWT tokens
   - `NODE_ENV`: production

5. **Initialize Database**
   - Connect to your Railway PostgreSQL database
   - Run the SQL from `schema.sql`

6. **Get API URL**
   - Railway will provide a public URL like `https://vault-api.up.railway.app`
   - Update `API_BASE` in your Android app's `api.js`

## Local Development

1. Install PostgreSQL locally
2. Create database and run `schema.sql`
3. Copy `.env.example` to `.env` and update values
4. Run `npm install`
5. Run `npm run dev`

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Items
- `GET /api/items` - Get all items
- `GET /api/items/:id` - Get single item
- `POST /api/items` - Create item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Containers
- `GET /api/containers` - Get all containers
- `GET /api/containers/tree` - Get container tree
- `POST /api/containers` - Create container
- `PUT /api/containers/:id` - Update container
- `DELETE /api/containers/:id` - Delete container

### Search
- `GET /api/search?q=query` - Search items

### Photos
- `POST /api/photos` - Upload photo (multipart/form-data)
- `DELETE /api/photos` - Delete photo

### Health
- `GET /api/health` - Health check
