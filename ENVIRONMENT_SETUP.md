# Environment Setup Guide

This document explains how to set up the required environment variables for the Eventbrite Capacity Manager and WooCommerce FooEvents integration.

## Required Environment Variables

Create a `.env` file in the project root directory (`brcc_sync/.env`) with the following variables:

```bash
# Eventbrite API Configuration
PRIVATE_TOKEN=your_eventbrite_private_token_here
DEFAULT_EVENT_ID=1219650199579
DEFAULT_TICKET_CLASS_ID=2183507083

# WooCommerce API Configuration
WOOCOMMERCE_CONSUMER_KEY=your_woocommerce_consumer_key_here
WOOCOMMERCE_CONSUMER_SECRET=your_woocommerce_consumer_secret_here
WOOCOMMERCE_API_URL=https://backroomcomedyclub.com

# WordPress Database Configuration (for accurate FooEvents ticket sales data)
WORDPRESS_DB_HOST=localhost
WORDPRESS_DB_PORT=3306
WORDPRESS_DB_USER=your_wordpress_db_username
WORDPRESS_DB_PASSWORD=your_wordpress_db_password
WORDPRESS_DB_NAME=your_wordpress_database_name
WORDPRESS_TABLE_PREFIX=wp_
```

## Variable Descriptions

### Eventbrite Configuration
- **PRIVATE_TOKEN**: Your Eventbrite API private token (required for Eventbrite features)
- **DEFAULT_EVENT_ID**: Default event ID to use when none specified
- **DEFAULT_TICKET_CLASS_ID**: Default ticket class ID to use when none specified

### WooCommerce Configuration
- **WOOCOMMERCE_CONSUMER_KEY**: WooCommerce REST API consumer key
- **WOOCOMMERCE_CONSUMER_SECRET**: WooCommerce REST API consumer secret
- **WOOCOMMERCE_API_URL**: Base URL of your WooCommerce site

### WordPress Database Configuration
- **WORDPRESS_DB_HOST**: MySQL database host (usually `localhost`)
- **WORDPRESS_DB_PORT**: MySQL database port (usually `3306`)
- **WORDPRESS_DB_USER**: MySQL username with read access to WordPress database
- **WORDPRESS_DB_PASSWORD**: MySQL password for the database user
- **WORDPRESS_DB_NAME**: Name of the WordPress database
- **WORDPRESS_TABLE_PREFIX**: WordPress table prefix (usually `wp_`)

## Important Notes

### WordPress Database Access
The WordPress database connection is **optional but recommended** for accurate ticket sales data. Without it:
- ✅ Available tickets will still be shown correctly (from WooCommerce stock)
- ❌ Total capacity and tickets sold will show "❌ DB Error" instead of actual numbers

With WordPress database access:
- ✅ All metrics show accurate real-time data
- ✅ Total capacity is retrieved from FooEvents configuration
- ✅ Tickets sold is counted from actual `event_magic_tickets` posts

### Security Considerations
- Never commit the `.env` file to version control
- Use read-only database credentials when possible
- Ensure the database user only has SELECT permissions on the WordPress database

## Setup Steps

1. **Create the .env file**:
   ```bash
   # In the project root directory (brcc_sync/)
   touch .env
   ```

2. **Add your credentials** to the `.env` file using the template above

3. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Test the setup**:
   ```bash
   cd backend
   python test_wordpress_integration.py
   ```

5. **Start the backend server**:
   ```bash
   cd backend
   python run_dev.py
   ```

## Troubleshooting

### "WordPress database credentials not found"
- Ensure all `WORDPRESS_DB_*` variables are set in your `.env` file
- Check that the `.env` file is in the project root, not in the `backend/` directory

### "ModuleNotFoundError: No module named 'pymysql'"
- Install the required dependency: `pip install PyMySQL==1.1.0`
- Or install all dependencies: `pip install -r requirements.txt`

### Database connection fails
- Verify database credentials are correct
- Ensure the MySQL server is running
- Check that the database user has SELECT permissions on the WordPress database
- Test connection manually: `mysql -h HOST -u USER -p DATABASE_NAME`

### WooCommerce API errors
- Verify consumer key and secret are correct
- Ensure the WooCommerce REST API is enabled
- Check that the API URL is correct (should include `https://`)

### Using Your Server IP Address
If phpMyAdmin shows `localhost` (which is common), you'll need to use your server's actual IP address:
- Find your server's IP address in DirectAdmin or from your hosting provider
- Use this IP address as your `WORDPRESS_DB_HOST`
- Example: `WORDPRESS_DB_HOST=104.152.168.209`

### Troubleshooting "Access Denied" Errors

If you get an error like `Access denied for user 'username'@'your_ip'`, follow these steps:

1. **Enable Remote Access in DirectAdmin**:
   - Go to "Databases" in DirectAdmin
   - Click on your database name
   - Look for "Access Hosts" or "Remote Access Hosts"
   - Add your IP address (`209.227.139.102` in your case) OR use `%` to allow from any IP
   - Save the changes

2. **Alternative: Contact Your Host**:
   - Some hosting providers disable remote MySQL access by default
   - Contact support and ask them to:
     - Enable remote MySQL access for your account
     - Add your IP address to the allowed hosts
     - Or enable access from any IP (`%`)

3. **Check Database User Permissions**:
   - The database user needs SELECT permissions on the WordPress database
   - In DirectAdmin, go to Databases → Click your database → Check user permissions

4. **Test Connection**:
   ```bash
   # Test from command line (if you have mysql client installed)
   mysql -h 104.152.168.209 -u backroomco_wp195 -p your_database_name
   ```

## Testing Without Database Access

If you don't have WordPress database access, the application will still work with limited functionality:

```bash
# Example .env without database credentials
PRIVATE_TOKEN=your_eventbrite_token
DEFAULT_EVENT_ID=1219650199579
DEFAULT_TICKET_CLASS_ID=2183507083
WOOCOMMERCE_CONSUMER_KEY=your_key
WOOCOMMERCE_CONSUMER_SECRET=your_secret
WOOCOMMERCE_API_URL=https://backroomcomedyclub.com
```

In this case:
- Available tickets will be shown correctly
- Total capacity and tickets sold will display "❌ DB Error"
- This is expected behavior and indicates the system is working correctly

## Finding Your MySQL Database Credentials

### DirectAdmin Hosting Control Panel

If your hosting provider uses DirectAdmin, follow these steps:

1. **Log into DirectAdmin** ✅ (You're already here!)

2. **Click on "Databases"**
   - From your DirectAdmin main menu, click on **"Databases"**
   - This will show you all your MySQL databases

3. **Find Your WordPress Database**
   - Look for a database that contains your WordPress site
   - Common names: `username_wp`, `username_wordpress`, or similar
   - Click on the database name to see details

4. **Get Database Connection Info**
   - **Database Name**: The name you see in the databases list
   - **Username**: Usually shown as `username_dbname` or similar
   - **Password**: If you don't know it, you can reset it
   - **Host**: Look for "MySQL Hostname" or "Database Server"
     - This is the KEY piece - it will NOT be `localhost`
     - Common formats: `mysql.yourdomain.com`, `db.yourdomain.com`, or an IP address

5. **Check for Remote Access**
   - Look for "Remote Access Hosts" or "Access Hosts" option
   - You may need to add your IP address or use `%` for any IP
   - Some hosts have this under a separate "Remote MySQL" section

6. **Alternative: Use phpMyAdmin**
   - You can also click **"phpMyAdmin"** from your main menu
   - The login screen will show you the server hostname
   - **Important**: If phpMyAdmin shows `localhost`, that won't work for remote connections
   - Instead, use your server's actual IP address for `WORDPRESS_DB_HOST`
   - This hostname is what you need for `WORDPRESS_DB_HOST`

## Alternative: Skip Database Integration

If you cannot get external MySQL access working, the application will still function correctly. It will:
- ✅ Show accurate available ticket counts from WooCommerce stock
- ❌ Display "❌ DB Error" for total capacity and tickets sold
- This is better than showing incorrect calculated values

## Testing Your Configuration

1. Set up your `.env` file with the credentials
2. Run the backend: `python main.py`
3. Check the logs for any connection errors
4. Visit `http://localhost:8000/woocommerce/wordpress-db-status` to verify database connectivity

## Getting Other API Credentials

// ... existing code ... 