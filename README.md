# Backroom Comedy Club - Event Management System

A comprehensive React + Python dashboard application for managing **Eventbrite** and **WooCommerce FooEvents** ticket inventory from a unified interface. Built specifically for Backroom Comedy Club to handle complex event management across multiple platforms with robust inventory tracking and real-time capacity updates.

## 🎭 Overview

This application provides unified management for two distinct event platforms:

- **Eventbrite**: Special events, one-off shows, and ticketed performances
- **WooCommerce + FooEvents**: Regular weekly shows, recurring events, and WordPress-integrated ticketing

### Key Problems Solved

1. **Accurate Ticket Sales Data**: Direct WordPress database integration for real ticket counts vs. estimates
2. **Complex FooEvents Detection**: Intelligent differentiation between single events and multi-slot booking products
3. **Unified Inventory Management**: Cross-platform capacity management with proper database handling
4. **Real-time Updates**: Live inventory adjustments without database corruption risks
5. **Production-Ready Reliability**: Robust error handling and fallback detection mechanisms

## ✨ Features 

### Modern Dashboard Interface
- 📱 **Responsive Sidebar Navigation**: Collapsible sidebar with mobile-responsive design
- 🎛️ **System Status Dashboard**: Real-time API connection status and cache information
- ⚖️ **Event Comparison**: Select up to 4 events from either platform for side-by-side analysis
- 🔄 **Manual Cache Control**: User-controlled data refresh (no auto-refresh)

### Eventbrite Integration
- 🎫 **Capacity Adjustment**: Ticket class capacity viewing and modification (via Comparison View for Eventbrite)
- 📊 **Series Management**: Browse all event series with on-sale events
- ➕ **Increment/Decrement**: Precise capacity adjustments by 1 ticket
- 🔄 **Live Status**: Real-time updates with comprehensive error handling

### WooCommerce FooEvents Integration

#### Smart Product Detection
The system automatically detects and handles three types of FooEvents products:

1. **Normal FooEvents (Single Events)**:
   - Products using WooCommerce inventory tracking (`manage_stock=True`)
   - Single event with one date/time
   - Inventory updates modify WooCommerce `stock_quantity` field
   - Examples: Robyn show, special guest performances

2. **FooEvents Bookings (Multi-Slot Products)**:
   - Products with multiple time slots or dates
   - Complex booking metadata structure
   - Inventory updates modify FooEvents booking metadata
   - Examples: Monday Night, Wednesday Night recurring shows

3. **Edge Cases (Hybrid Products)**:
   - Products with booking metadata but using WooCommerce stock management
   - Automatically detected via fallback logic based on `manage_stock` setting
   - Prevents database corruption from incorrect inventory updates

#### Detection Logic (Robust & Production-Ready)
```
1. PRIMARY CHECK: WooCommerce Stock Management
   If manage_stock=True AND stock_quantity exists
   → Normal FooEvents (use WooCommerce inventory)

2. SYNTHETIC PATTERN DETECTION:
   If slot_id = "event_{product_id}" AND date_id = "date_{product_id}"
   → Normal FooEvents (synthetic booking data)

3. REAL BOOKINGS DETECTION:
   If has nested add_date structure OR non-synthetic flat structure
   → FooEvents Bookings (use booking metadata)

4. FALLBACK:
   Default to FooEvents Bookings for safety
```

#### Database Safety Features
- **JSON String Conversion**: All booking metadata updates use `json.dumps()` to prevent corruption
- **WordPress Database Integration**: Direct MySQL connection for accurate ticket counts
- **Error Recovery**: Comprehensive error handling with database repair capabilities
- **Dual Authentication**: URL parameter auth for WooCommerce write operations

### Technical Features
- 📱 **Mobile-First Design**: Responsive interface with progressive enhancement
- 🔒 **Secure API Integration**: Official APIs with proper authentication
- ⚡ **High Performance**: Vite + FastAPI with intelligent caching
- 🔧 **Debug & Monitoring**: Comprehensive debugging tools and health checks
- 💾 **Persistent Caching**: User-controlled cache refresh for optimal performance

## 🏗️ Architecture

### Backend Stack
- **FastAPI**: High-performance Python web framework
- **MySQL Integration**: Direct WordPress database access for ticket data
- **Multi-API Client**: Eventbrite and WooCommerce API integrations
- **Smart Caching**: Persistent cache with manual refresh controls

### Frontend Stack
- **React + TypeScript**: Modern component-based UI
- **Vite**: Fast development and build tooling
- **CSS Modules**: Scoped styling with responsive design
- **State Management**: Centralized event selection and comparison

### Database Integration
- **WordPress MySQL**: Direct database queries for accurate ticket counts
- **FooEvents Tables**: Complex queries across multiple WooCommerce tables
- **Connection Pooling**: Efficient database connection management
- **Error Handling**: Graceful fallbacks when database unavailable

## 📁 Project Structure

```
brcc_sync/
├── backend/
│   ├── app.py                 # FastAPI application with all endpoints
│   ├── eventbrite.py          # Eventbrite API client
│   ├── woocommerce.py         # WooCommerce API client with FooEvents detection
│   ├── wordpress_db.py        # WordPress database client
│   ├── run_dev.py            # Development server launcher
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx         # System status dashboard
│   │   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   │   ├── ComparisonView.tsx    # Event comparison interface
│   │   │   ├── SeriesViewer.tsx      # Eventbrite series browser
│   │   │   └── WooCommerceViewer.tsx # WooCommerce events browser
│   │   ├── App.tsx            # Root component
│   │   └── api.ts             # API client with TypeScript interfaces
│   └── package.json           # Node.js dependencies
├── ENVIRONMENT_SETUP.md       # Detailed setup instructions
├── DEVELOPMENT.md             # Technical development guide
├── DESIGN.md                  # Architecture and design decisions
└── README.md                  # This file
```

## 🚀 Quick Start (Windows PowerShell)

### Prerequisites

- Python 3.8+
- Node.js 16+
- Git for Windows
- PowerShell 5.1+ (Windows 10/11 default)

### 1. Clone and Setup

```powershell
# Clone the repository
git clone https://github.com/your-repo/brcc_sync.git
cd brcc_sync
```

### 2. Backend Setup

```powershell
# Navigate to backend
cd backend

# Install Python dependencies
pip install -r requirements.txt
```

Create `.env` file in the `backend` directory:
```env
# Eventbrite
PRIVATE_TOKEN=your_eventbrite_private_token

# WooCommerce
WOOCOMMERCE_CONSUMER_KEY=ck_your_woocommerce_key
WOOCOMMERCE_CONSUMER_SECRET=cs_your_woocommerce_secret
WOOCOMMERCE_API_URL=https://backroomcomedyclub.com

# WordPress Database (for accurate ticket sales)
WORDPRESS_DB_HOST=your_server_ip
WORDPRESS_DB_PORT=3306
WORDPRESS_DB_USER=your_db_username
WORDPRESS_DB_PASSWORD=your_db_password
WORDPRESS_DB_NAME=your_db_name
WORDPRESS_TABLE_PREFIX=wp_
```

### 3. Frontend Setup

Open a new PowerShell window:
```powershell
# Navigate to frontend
cd frontend

# Install Node.js dependencies
npm install
```

### 4. Development Workflow

#### Starting the Development Environment

**Terminal 1 - Backend:**
```powershell
cd backend
python run_dev.py
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

#### Production Build

```powershell
# Build frontend for production
cd frontend
npm run build

# Run production backend
cd ..\backend
python run_dev.py --prod
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🎯 Usage Guide

### FooEvents Product Management

#### Understanding Product Types

**Normal FooEvents (Single Events):**
- ✅ Uses WooCommerce inventory tracking
- ✅ Single date and time
- ✅ Stock managed via `stock_quantity` field
- ✅ Examples: Special guest shows, one-off events

**FooEvents Bookings (Multi-Slot Products):**
- ✅ Multiple time slots (e.g., 8pm & 10pm)
- ✅ Multiple dates per slot
- ✅ Stock managed via FooEvents booking metadata
- ✅ Examples: Weekly recurring shows

#### Inventory Management

**For Normal FooEvents:**
1. Increment/decrement updates WooCommerce `stock_quantity`
2. Total capacity = current stock + tickets sold
3. Changes are immediately visible in WordPress admin
4. No booking metadata is modified

**For FooEvents Bookings:**
1. Increment/decrement updates specific slot/date in booking metadata
2. Complex nested or flat structure handling
3. JSON-safe updates prevent database corruption
4. Changes visible in FooEvents booking interface

#### Edge Case Handling

The system handles complex scenarios:
- Products with booking metadata but using WooCommerce stock management
- Products with synthetic booking data vs. real booking configurations
- Database connection failures with graceful fallbacks
- Mixed inventory systems within the same product catalog

### Dashboard Navigation

1. **Sidebar Navigation**: 
   - Click hamburger menu to expand/collapse
   - Mobile-responsive overlay on small screens
   - Persistent selection state across navigation

2. **Event Selection**:
   - Click any event/product to add to comparison selection
   - Maximum 4 events for optimal comparison view
   - Cross-platform selection (mix Eventbrite + WooCommerce)

3. **Capacity Management**:
   - Use +/- buttons within the Comparison View for precise Eventbrite inventory adjustments
   - Real-time validation and error feedback
   - Immediate UI updates with backend confirmation

4. **Data Refresh**:
   - Manual "Sync" buttons for cache control
   - No automatic refresh to prevent interruptions
   - Cache status indicators show data freshness

### Troubleshooting Common Issues

#### Database Connection Issues
- Check WordPress database credentials in `.env`
- Verify network connectivity to database server
- Look for "❌ DB Error" indicators in the UI

#### WooCommerce API Issues
- Verify API credentials and permissions
- Check if WooCommerce REST API is enabled
- Ensure proper SSL certificate for HTTPS endpoints

#### FooEvents Detection Issues
- Check product configuration in WordPress admin
- Verify `manage_stock` setting matches intended behavior
- Use browser dev tools to inspect API responses for debugging

## 🔧 Development

### Project Philosophy

This system prioritizes **data accuracy** and **production reliability** over convenience features. The architecture ensures:

- **Database Integrity**: No automatic operations that could corrupt data
- **Explicit User Control**: Manual cache refresh and deliberate action confirmations  
- **Robust Error Handling**: Graceful degradation when external services fail
- **Cross-Platform Consistency**: Unified interface despite different backend systems

### FooEvents Detection Deep Dive

The core challenge this system solves is automatically determining whether a WooCommerce product should use:
1. **WooCommerce native inventory** (`stock_quantity` field)
2. **FooEvents booking metadata** (complex nested JSON structures)

This distinction is critical because:
- Wrong detection → Database corruption
- Database corruption → Website downtime
- Website downtime → Lost ticket sales

The detection algorithm uses multiple validation layers with fallback mechanisms to ensure 100% reliability in production.

For detailed technical documentation, see:
- `DEVELOPMENT.md` - Technical implementation details
- `DESIGN.md` - Architecture decisions and trade-offs
- `ENVIRONMENT_SETUP.md` - Complete setup instructions

## 🚀 Production Deployment

This application is production-ready with the following considerations:

- **Database Safety**: All update operations use proper JSON serialization
- **Error Recovery**: Comprehensive error handling with user feedback
- **Performance**: Efficient caching and database connection management
- **Security**: Proper API authentication and input validation
- **Monitoring**: Health check endpoints and detailed logging

For production deployment instructions, see `ENVIRONMENT_SETUP.md`.

## 📄 License

This project is proprietary software developed specifically for Backroom Comedy Club.

## 🤝 Support

For technical support or feature requests, contact the development team.