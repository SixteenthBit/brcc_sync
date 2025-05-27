# Environment Setup Guide

This comprehensive guide explains how to set up the Backroom Comedy Club Event Management System on **Windows with PowerShell**, including all required environment variables, development tools, and production configurations.

## 🖥️ System Requirements

### Windows Development Environment
- **Windows 10/11** (PowerShell 5.1+ included)
- **Python 3.8+** (Download from [python.org](https://python.org))
- **Node.js 16+** (Download from [nodejs.org](https://nodejs.org))
- **Git for Windows** (Download from [git-scm.com](https://git-scm.com))
- **VS Code** (Optional but recommended)

### Required Access
- **Eventbrite API Token** (for event capacity management)
- **WooCommerce API Credentials** (for product inventory management) 
- **WordPress Database Access** (for real ticket sales data)

## 🚀 Initial Setup (Windows PowerShell)

### 1. Clone Repository and Setup Structure

```powershell
# Open PowerShell and navigate to your projects directory
cd C:\Users\$env:USERNAME\Documents
# OR
cd E:\github_projects  # Example: Use your preferred directory

# Clone the repository
git clone https://github.com/your-repo/brcc_sync.git
cd brcc_sync

# Verify directory structure
Get-ChildItem
```

Expected structure:
```
brcc_sync/
├── backend/
├── frontend/
├── README.md
├── DEVELOPMENT.md
├── DESIGN.md
└── ENVIRONMENT_SETUP.md  # This file
```

### 2. Backend Setup

```powershell
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Verify installation
python -c "import fastapi, pymysql, requests; print('✅ Dependencies installed successfully')"
```

### 3. Frontend Setup

```powershell
# Open new PowerShell window or tab
cd frontend

# Install Node.js dependencies
npm install

# Verify installation
npm list --depth=0
```

### 4. Environment Configuration

Create a `.env` file in the `backend` directory:

```powershell
# Navigate to backend directory
cd backend

# Create environment file
New-Item -Path ".env" -ItemType File

# Edit with your preferred editor
notepad .env
# OR
code .env  # If using VS Code
```

## 🔧 Environment Variables Configuration

### Complete .env Template

Create `backend/.env` with the following configuration:

```env
# =============================================================================
# Eventbrite API Configuration
# =============================================================================
PRIVATE_TOKEN=your_eventbrite_private_token_here

# Optional: Default values for Eventbrite testing
DEFAULT_EVENT_ID=1219650199579
DEFAULT_TICKET_CLASS_ID=2183507083

# =============================================================================
# WooCommerce API Configuration
# =============================================================================
WOOCOMMERCE_CONSUMER_KEY=ck_your_woocommerce_consumer_key_here
WOOCOMMERCE_CONSUMER_SECRET=cs_your_woocommerce_consumer_secret_here
WOOCOMMERCE_API_URL=https://backroomcomedyclub.com

# =============================================================================
# WordPress Database Configuration (CRITICAL for real ticket data)
# =============================================================================
WORDPRESS_DB_HOST=your_server_ip_or_hostname
WORDPRESS_DB_PORT=3306
WORDPRESS_DB_USER=your_database_username
WORDPRESS_DB_PASSWORD=your_database_password
WORDPRESS_DB_NAME=your_wordpress_database_name
WORDPRESS_TABLE_PREFIX=wp_

# =============================================================================
# Development Configuration (Optional)
# =============================================================================
# Uncomment for development settings
# DEBUG=true
# LOG_LEVEL=debug
```

### Variable Descriptions

#### Eventbrite Configuration
- **PRIVATE_TOKEN**: Your Eventbrite API private token (required for capacity management)
  - Obtain from: Eventbrite Account Settings → Developer Links → API Keys
  - Format: Long alphanumeric string
  - Permissions needed: `event:read`, `ticket_class:write`

#### WooCommerce Configuration
- **WOOCOMMERCE_CONSUMER_KEY**: WooCommerce REST API consumer key
  - Format: `ck_` followed by alphanumeric string
  - Obtain from: WordPress Admin → WooCommerce → Settings → Advanced → REST API
  - Permissions needed: `Read/Write`

- **WOOCOMMERCE_CONSUMER_SECRET**: WooCommerce REST API consumer secret
  - Format: `cs_` followed by alphanumeric string
  - Generated alongside the consumer key

- **WOOCOMMERCE_API_URL**: Base URL of your WooCommerce site
  - Format: `https://your-domain.com` (no trailing slash)
  - Must be HTTPS for production

#### WordPress Database Configuration
- **WORDPRESS_DB_HOST**: Database server hostname or IP address
  - **NOT** `localhost` when connecting remotely
  - Examples: `mysql.yourdomain.com`, `104.152.168.209`
  - Get from your hosting provider (DirectAdmin, cPanel, etc.)

- **WORDPRESS_DB_USER**: Database username
  - Format varies by host: `username_dbname` or `dbuser`
  - Must have `SELECT` permissions on WordPress tables

- **WORDPRESS_DB_PASSWORD**: Database password
  - Set when creating database user
  - Can be reset in hosting control panel

- **WORDPRESS_DB_NAME**: WordPress database name
  - Examples: `username_wp`, `backroomco_db`
  - Shown in hosting control panel database list

- **WORDPRESS_TABLE_PREFIX**: WordPress table prefix
  - Default: `wp_`
  - Check `wp-config.php` for custom prefixes

## 🎯 FooEvents Product Detection Setup

The system automatically detects different types of FooEvents products. Understanding this is crucial for proper operation:

### Product Types Supported

#### Normal FooEvents (Single Events)
- **Characteristics**: Single date/time, WooCommerce inventory tracking
- **Detection**: `manage_stock=True` OR synthetic booking patterns
- **Inventory Method**: WooCommerce `stock_quantity` field
- **Examples**: Special guest shows, one-off events

#### FooEvents Bookings (Multi-Slot Products)  
- **Characteristics**: Multiple time slots, multiple dates, complex booking metadata
- **Detection**: Real booking structure with nested or flat configurations
- **Inventory Method**: FooEvents booking metadata updates
- **Examples**: Weekly recurring shows (Monday Night, Wednesday Night)

#### Edge Cases (Hybrid Products)
- **Characteristics**: Booking metadata present but WooCommerce stock management enabled
- **Detection**: Fallback safety mechanism triggers
- **Inventory Method**: WooCommerce inventory (prevents corruption)
- **Safety**: Prevents database corruption from wrong detection

### Testing Product Detection

```powershell
# Start backend server
cd backend
python run_dev.py

# In another PowerShell window, test detection
$testUrl = "http://localhost:8000/woocommerce/debug/product/31907"
Invoke-RestMethod -Uri $testUrl -Method GET | ConvertTo-Json -Depth 3
```

Expected response shows:
- `product_name`: Name of the product
- `manage_stock`: Whether WooCommerce manages inventory
- `is_real_bookings`: Detection result (true/false)
- `detection_reason`: Why this classification was chosen

## 🔍 Obtaining Required Credentials

### Eventbrite API Token

1. **Log into Eventbrite** (organizer account)
2. **Go to Account Settings** → **Developer Links** → **API Keys**
3. **Create Private Token**:
   - Application Name: "BRCC Event Management"
   - Description: "Internal capacity management system"
4. **Copy the token** (long alphanumeric string)
5. **Paste into .env file**: `PRIVATE_TOKEN=your_token_here`

### WooCommerce API Credentials

1. **Log into WordPress Admin** (admin account)
2. **Navigate to**: WooCommerce → Settings → Advanced → REST API
3. **Click "Add Key"**:
   - Description: "BRCC Event Management System"
   - User: Select admin user
   - Permissions: "Read/Write"
4. **Copy both keys**:
   - Consumer Key: `ck_...`
   - Consumer Secret: `cs_...`
5. **Add to .env file**

### WordPress Database Access

#### For DirectAdmin Hosting

1. **Log into DirectAdmin Control Panel**
2. **Navigate to**: Databases → MySQL Management
3. **Find WordPress Database**:
   - Look for database containing WordPress site
   - Note the exact database name
4. **Get Connection Details**:
   - **Host**: Look for "MySQL Hostname" (NOT localhost)
   - **Username**: Database user (format varies)
   - **Password**: Reset if unknown
5. **Enable Remote Access**:
   - Add your IP address to "Remote Access Hosts"
   - OR use `%` to allow from any IP
6. **Test Connection**:
   ```powershell
   # If you have MySQL client installed
   mysql -h your_host -u your_user -p your_database
   ```

#### For cPanel Hosting

1. **Log into cPanel**
2. **Navigate to**: Databases → MySQL Databases
3. **Note database details** and follow similar steps as DirectAdmin
4. **Enable Remote Access**: Look for "Remote MySQL" section

#### For Other Hosting Providers

1. **Contact hosting support** for:
   - Database hostname/IP address
   - Remote access configuration
   - User permissions setup
2. **Request**: Read-only access to WordPress database tables

## 🧪 Development Environment Testing

### 1. Test Backend Setup

```powershell
# Navigate to backend
cd backend

# Test basic startup
python run_dev.py

# Should see:
# INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
# INFO:     Started reloader process
```

### 2. Test API Endpoints

```powershell
# Open new PowerShell window
# Test health check
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET

# Test configuration
Invoke-RestMethod -Uri "http://localhost:8000/config" -Method GET

# Test WooCommerce products
Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/products" -Method GET
```

### 3. Test Database Connection

```powershell
# Test WordPress database status
Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/wordpress-db-status" -Method GET

# Expected responses:
# SUCCESS: {"status": "connected", "details": {...}}
# FAILURE: {"status": "error", "error": "connection details"}
```

### 4. Test Frontend Setup

```powershell
# Navigate to frontend
cd frontend

# Start development server
npm run dev

# Should see:
# VITE v4.x.x  ready in xxx ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

### 5. Integration Test

1. **Backend running**: `http://localhost:8000`
2. **Frontend running**: `http://localhost:5173`
3. **Open browser**: Navigate to frontend URL
4. **Check dashboard**: Should show system status and API connections

## 🔧 Troubleshooting Common Issues

### Python/Backend Issues

#### "ModuleNotFoundError"
```powershell
# Ensure you're in the backend directory
cd backend

# Reinstall requirements
pip install -r requirements.txt

# If using virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### "Port already in use"
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use different port
python run_dev.py --port 8001
```

### Database Connection Issues

#### "Access denied for user"
1. **Verify credentials** in `.env` file
2. **Check database host** (NOT localhost for remote)
3. **Enable remote access** in hosting control panel
4. **Contact hosting support** if needed

#### "Can't connect to MySQL server"
1. **Verify hostname/IP** is correct
2. **Check port** (usually 3306)
3. **Test network connectivity**:
   ```powershell
   Test-NetConnection -ComputerName your_db_host -Port 3306
   ```

#### "Database does not exist"
1. **Verify database name** exactly matches
2. **Check user permissions** for database access
3. **Confirm WordPress installation** is in specified database

### WooCommerce API Issues

#### "Consumer key/secret invalid"
1. **Regenerate API keys** in WordPress admin
2. **Verify permissions** are set to "Read/Write"
3. **Check URL format** (must include https://)

#### "REST API not found"
1. **Verify WooCommerce** is installed and activated
2. **Check permalink structure** in WordPress admin
3. **Test API directly**:
   ```powershell
   $uri = "https://your-site.com/wp-json/wc/v3/products"
   Invoke-RestMethod -Uri $uri -Method GET -Headers @{Authorization="Basic base64(key:secret)"}
   ```

### Frontend Issues

#### "npm install fails"
```powershell
# Clear npm cache
npm cache clean --force

# Use different registry if needed
npm install --registry https://registry.npmjs.org/

# Check Node.js version
node --version  # Should be 16+
```

#### "Module not found" in browser
1. **Restart dev server**: `Ctrl+C` then `npm run dev`
2. **Clear browser cache**: Hard refresh (`Ctrl+Shift+R`)
3. **Check browser console** for specific error details

## 🚀 Production Deployment Setup

### Environment Variables for Production

Create separate production `.env` file:

```env
# Production Environment Variables
PRIVATE_TOKEN=prod_eventbrite_token
WOOCOMMERCE_CONSUMER_KEY=ck_prod_key
WOOCOMMERCE_CONSUMER_SECRET=cs_prod_secret
WOOCOMMERCE_API_URL=https://backroomcomedyclub.com

# Production Database (read-only user recommended)
WORDPRESS_DB_HOST=prod_db_host
WORDPRESS_DB_USER=readonly_user
WORDPRESS_DB_PASSWORD=secure_password
WORDPRESS_DB_NAME=production_db

# Production Settings
DEBUG=false
LOG_LEVEL=info
```

### Production Build Commands

```powershell
# Build frontend for production
cd frontend
npm run build

# Test production build locally
npm run preview

# Copy built files (if serving from backend)
Copy-Item -Recurse .\dist\* ..\backend\static\

# Run production backend
cd ..\backend
python run_dev.py --prod
```

### Security Considerations

#### File Permissions
```powershell
# Secure .env file on Windows
icacls backend\.env /grant:r "$env:USERNAME:(R)" /inheritance:r
```

#### Database Security
- **Use read-only database user** for production
- **Limit IP access** to production server only
- **Enable SSL/TLS** for database connections
- **Regular password rotation**

#### API Security
- **Separate API keys** for production
- **Monitor API usage** and set rate limits
- **Regular credential rotation**
- **HTTPS only** for all API communications

## 📋 Development Workflow

### Daily Development Routine

```powershell
# Terminal 1: Backend
cd backend
python run_dev.py

# Terminal 2: Frontend  
cd frontend
npm run dev

# Development URLs:
# Backend API: http://localhost:8000
# Frontend: http://localhost:5173
# API Docs: http://localhost:8000/docs
```

### Testing Workflow

```powershell
# Test backend health
Invoke-RestMethod -Uri "http://localhost:8000/health"

# Test specific product detection
Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/debug/product/31907"

# Test inventory update
$body = @{
    product_id = 31907
    slot = "event_31907"
    date = "2024-11-20"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/inventory/increment" -Method POST -Body $body -ContentType "application/json"
```

### Backup and Recovery

```powershell
# Backup .env files
Copy-Item backend\.env backend\.env.backup

# Backup database before testing
# (Contact hosting provider for database backup procedures)

# Test environment recovery
git stash  # Save local changes
git pull   # Get latest code
# Restore .env file and test
```

## 🔐 Security Best Practices

### Credential Management
- **Never commit `.env` files** to version control
- **Use separate credentials** for development/production
- **Regular rotation** of all API keys and passwords
- **Secure storage** of production credentials

### Access Control
- **Database**: Read-only user for application
- **WooCommerce**: Specific API user with minimal permissions
- **Eventbrite**: Dedicated token for this application only

### Network Security
- **HTTPS only** for all external communications
- **Database SSL** for production connections
- **IP restrictions** where possible
- **VPN access** for sensitive operations

This comprehensive setup guide ensures a secure, reliable, and maintainable development environment for the BRCC Event Management System using Windows PowerShell workflows. 