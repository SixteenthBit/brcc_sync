# Backroom Comedy Club - Event Management System

A comprehensive React + Python web application for managing both **Eventbrite** and **WooCommerce FooEvents** ticket capacity from a unified dashboard. This system provides real-time ticket sales data, capacity management, and accurate inventory tracking for comedy club events.

## 🎭 Overview

This application was built specifically for **Backroom Comedy Club** to solve critical issues with ticket capacity management across two platforms:

- **Eventbrite**: For special events and one-off shows
- **WooCommerce + FooEvents**: For regular weekly shows and recurring events

### Key Problems Solved

1. **Accurate Ticket Sales Data**: Integrates directly with WordPress database to get real ticket sales instead of calculated estimates
2. **Dual Platform Management**: Single dashboard for both Eventbrite and WooCommerce events
3. **Real-time Capacity Updates**: Live inventory management with proper error handling
4. **Mixed Event Types**: Handles both FooEvents Bookings (multi-slot) and normal FooEvents (single show) configurations

## ✨ Features

### Eventbrite Integration
- 🎫 **Real-time Capacity Management**: View and modify Eventbrite ticket class capacity
- 📊 **Series Management**: Browse all event series with on-sale events
- ➕ **Increment/Decrement**: Easily adjust capacity by 1
- 🔄 **Live Updates**: Real-time status updates and error handling

### WooCommerce FooEvents Integration
- 🎪 **Multi-Platform Support**: Handles both FooEvents Bookings and normal FooEvents
- 📅 **Slot Management**: Multiple time slots per event (8pm, 10pm shows)
- 📈 **Accurate Sales Data**: Direct WordPress database integration for real ticket counts
- 🔍 **Smart Detection**: Automatically detects event type based on existing ticket metadata
- ❌ **Error Handling**: Clear error indicators when database unavailable

### Technical Features
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔒 **Secure**: Uses official APIs with proper authentication
- ⚡ **Fast**: Built with Vite and FastAPI for optimal performance
- 💾 **Caching**: Intelligent caching system for improved performance
- 🔧 **Debug Tools**: Comprehensive debugging endpoints for troubleshooting

## 🏗️ Architecture

- **Backend**: Python FastAPI server with multi-platform API integration
- **Frontend**: React TypeScript app built with Vite
- **Database**: Direct WordPress MySQL integration for accurate ticket data
- **APIs**: RESTful endpoints for capacity management and data retrieval

## 📁 Project Structure

```
brcc_sync/
├── backend/
│   ├── app.py              # FastAPI application with all endpoints
│   ├── eventbrite.py       # Eventbrite API client
│   ├── woocommerce.py      # WooCommerce API client
│   ├── wordpress_db.py     # WordPress database client
│   ├── run_dev.py          # Development server launcher
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CapacityManager.tsx    # Unified capacity management
│   │   │   ├── SeriesViewer.tsx       # Eventbrite series browser
│   │   │   └── WooCommerceViewer.tsx  # WooCommerce events browser
│   │   ├── api.ts          # API client
│   │   └── App.tsx         # Root component
│   └── package.json        # Node.js dependencies
├── references_docs/        # FooEvents plugin documentation
├── ENVIRONMENT_SETUP.md    # Detailed setup instructions
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- Eventbrite Private Token
- WooCommerce API credentials
- WordPress database access (for accurate ticket data)

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` file with your credentials:
```env
# Eventbrite
PRIVATE_TOKEN=your_eventbrite_private_token

# WooCommerce
WOOCOMMERCE_CONSUMER_KEY=your_woocommerce_key
WOOCOMMERCE_CONSUMER_SECRET=your_woocommerce_secret
WOOCOMMERCE_API_URL=https://backroomcomedyclub.com

# WordPress Database (for accurate ticket sales)
WORDPRESS_DB_HOST=your_server_ip
WORDPRESS_DB_PORT=3306
WORDPRESS_DB_USER=your_db_username
WORDPRESS_DB_PASSWORD=your_db_password
WORDPRESS_DB_NAME=your_db_name
WORDPRESS_TABLE_PREFIX=wp_
```

Start the backend:
```bash
python run_dev.py
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🎯 Usage

### Managing Eventbrite Events

1. **Browse Series**: View all event series in the left panel
2. **Select Event**: Click on any event occurrence to select it
3. **Manage Capacity**: Use the capacity manager to increment/decrement tickets

### Managing WooCommerce Events

1. **Browse Products**: View all FooEvents products in the right panel
2. **Select Date/Slot**: Click on any specific date and time slot
3. **View Real Data**: See accurate ticket sales from WordPress database
4. **Monitor Status**: Error indicators show when database is unavailable

### Key Features

- **Automatic Detection**: System automatically detects FooEvents Bookings vs normal FooEvents
- **Real Ticket Data**: Shows actual tickets sold from WordPress database
- **Error Handling**: Clear indicators when systems are unavailable
- **Unified Interface**: Manage both platforms from single dashboard

## 🔧 Configuration

### Event Types Supported

1. **FooEvents Bookings**: Multi-slot events (8pm Show, 10pm Show)
   - Used for: Weekly shows (Sunday Night, Monday Night, etc.)
   - Features: Multiple time slots, date ranges, booking configuration

2. **Normal FooEvents**: Single show events
   - Used for: Special events (Robyn & Jason, Mike Rita, etc.)
   - Features: Single date/time, simpler configuration

### Database Integration

The system uses direct WordPress database access to get accurate ticket sales:
- **With Database**: Shows real tickets sold and calculated total capacity
- **Without Database**: Shows error indicators instead of incorrect estimates

## 📊 API Endpoints

### Eventbrite
- `GET /capacity` - Get current capacity
- `POST /capacity/increment` - Increase capacity by 1
- `POST /capacity/decrement` - Decrease capacity by 1
- `GET /series` - Get all event series
- `GET /events/{event_id}/ticket-classes` - Get ticket classes

### WooCommerce
- `GET /woocommerce/products` - Get all FooEvents products
- `POST /woocommerce/products/sync` - Force refresh from API
- `GET /woocommerce/products/{product_id}` - Get specific product
- `GET /woocommerce/wordpress-db-status` - Check database status

### Debug & Monitoring
- `GET /config` - Get current configuration
- `GET /woocommerce/debug/product/{product_id}` - Debug product data
- `GET /woocommerce/debug/wordpress-tickets/{product_id}` - Debug ticket data

## 🔒 Security

- Environment variables for all sensitive credentials
- No credentials stored in code
- Secure API authentication
- Database connection with proper error handling

## 🛠️ Development

### Backend Development
```bash
cd backend
python run_dev.py  # Auto-reload enabled
```

### Frontend Development
```bash
cd frontend
npm run dev  # Hot module replacement
```

### Testing Database Integration
```bash
# Check WordPress database status
curl http://localhost:8000/woocommerce/wordpress-db-status

# Debug specific product
curl http://localhost:8000/woocommerce/debug/product/31907
```

## 📈 Current Status

✅ **Fully Functional**
- Eventbrite capacity management
- WooCommerce product browsing
- WordPress database integration
- Real ticket sales data
- Error handling and fallbacks
- Dual event type support (Bookings + Normal FooEvents)

📊 **Live Data**
- 17 WooCommerce products
- 34 time slots
- 500+ event dates
- Real-time ticket sales from WordPress database

## 🆘 Troubleshooting

See `ENVIRONMENT_SETUP.md` for detailed setup instructions including:
- DirectAdmin database configuration
- Remote database access setup
- Environment variable configuration
- Common issues and solutions

## 📚 Documentation

- `DEVELOPMENT.md` - Technical details and file dependencies
- `DESIGN.md` - Architecture and design decisions
- `ENVIRONMENT_SETUP.md` - Detailed setup instructions
- `references_docs/` - FooEvents plugin documentation