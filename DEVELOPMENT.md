# Development Documentation

## 🔧 Technical Overview

This document provides detailed technical information about the Backroom Comedy Club Event Management System, including file dependencies, development workflows, and implementation details.

## 🏗️ Technology Stack

### Backend
- **Framework**: FastAPI 0.104.1
- **Server**: Uvicorn 0.24.0
- **Database**: PyMySQL 1.1.0 (WordPress MySQL integration)
- **HTTP Client**: Requests 2.31.0
- **Environment**: python-dotenv 1.0.0
- **File Upload**: python-multipart 0.0.6

### Frontend
- **Framework**: React 19.1.0
- **Build Tool**: Vite 6.3.5
- **Language**: TypeScript 5.8.3
- **Linting**: ESLint 9.25.0

### External APIs
- **Eventbrite API**: REST API for event management
- **WooCommerce API**: REST API for product management
- **WordPress Database**: Direct MySQL connection for ticket data

## 📁 File Dependencies

### Backend Dependencies

| File | Depends On | Depended By | Purpose |
|------|------------|-------------|---------|
| `app.py` | `eventbrite.py`, `woocommerce.py` | None | Main FastAPI application with all endpoints |
| `eventbrite.py` | `python-dotenv`, `requests` | `app.py` | Eventbrite API client and caching |
| `woocommerce.py` | `wordpress_db.py`, `python-dotenv`, `requests` | `app.py` | WooCommerce API client with FooEvents parsing |
| `wordpress_db.py` | `PyMySQL`, `python-dotenv` | `woocommerce.py` | WordPress database client for ticket data |
| `run_dev.py` | `uvicorn`, `app.py` | None | Development server launcher |
| `requirements.txt` | None | All Python files | Python package dependencies |

### Frontend Dependencies

| File | Depends On | Depended By | Purpose |
|------|------------|-------------|---------|
| `App.tsx` | `SeriesViewer.tsx`, `WooCommerceViewer.tsx`, `CapacityManager.tsx` | `main.tsx` | Root component with state management |
| `main.tsx` | `App.tsx`, `React`, `ReactDOM` | None | Application entry point |
| `api.ts` | None | All components | API client for backend communication |
| `SeriesViewer.tsx` | `api.ts`, `SeriesViewer.css` | `App.tsx` | Eventbrite series browser component |
| `WooCommerceViewer.tsx` | `api.ts`, `WooCommerceViewer.css` | `App.tsx` | WooCommerce events browser component |
| `CapacityManager.tsx` | `api.ts`, `CapacityManager.css` | `App.tsx` | Unified capacity management component |

### Configuration Dependencies

| File | Depends On | Depended By | Purpose |
|------|------------|-------------|---------|
| `.env` | None | `app.py`, `eventbrite.py`, `woocommerce.py`, `wordpress_db.py` | Environment variables |
| `package.json` | None | All frontend files | Node.js dependencies and scripts |
| `vite.config.ts` | `@vitejs/plugin-react` | Vite build process | Frontend build configuration |
| `tsconfig.json` | None | All TypeScript files | TypeScript compiler configuration |

## 🔄 Data Flow

### Eventbrite Flow
```
User Selection → SeriesViewer → App State → CapacityManager → API → Eventbrite API
```

### WooCommerce Flow
```
User Selection → WooCommerceViewer → App State → CapacityManager → API → WooCommerce API + WordPress DB
```

### Database Integration Flow
```
WooCommerce API → FooEvents Data → WordPress DB Query → Real Ticket Sales → Frontend Display
```

## 🎯 Key Implementation Details

### FooEvents Detection Logic

The system automatically detects event types using this logic:

1. **Check Existing Tickets**: Query WordPress database for tickets sold
2. **Analyze Metadata**: Check if tickets have `BookingSlot` and `BookingDate` metadata
3. **Event Type Decision**:
   - **Has slot metadata** → FooEvents Bookings (multi-slot)
   - **No slot metadata** → Normal FooEvents (single show)
   - **No tickets yet** → Try FooEvents Bookings first, fallback to normal

### Database Query Strategy

```python
# Check ticket type
has_slot_metadata = wp_db.has_tickets_with_slot_metadata(product_id)

if has_slot_metadata:
    # Use FooEvents Bookings configuration
    tickets_sold = wp_db.get_tickets_sold_for_date(product_id, slot, date)
else:
    # Use normal FooEvents configuration  
    tickets_sold = wp_db.get_total_tickets_sold_for_product(product_id)
```

### Error Handling Strategy

- **Database Unavailable**: Show "❌ DB Error" instead of incorrect calculations
- **API Failures**: Graceful degradation with error messages
- **Missing Data**: Clear indicators rather than empty states

## 🚀 Development Workflow

### Starting Development Environment

1. **Backend**:
   ```bash
   cd backend
   python run_dev.py
   ```
   - Auto-reload enabled
   - Runs on http://localhost:8000
   - API docs at http://localhost:8000/docs

2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   - Hot module replacement
   - Runs on http://localhost:5173
   - Proxy API calls to backend

### Development Tools

#### Backend Debugging
```bash
# Check WordPress database status
curl http://localhost:8000/woocommerce/wordpress-db-status

# Debug specific product
curl http://localhost:8000/woocommerce/debug/product/31907

# Debug WordPress tickets
curl http://localhost:8000/woocommerce/debug/wordpress-tickets/31907

# Force cache refresh
curl -X POST http://localhost:8000/woocommerce/products/sync?use_cache=false
```

#### Frontend Development
- React DevTools for component inspection
- Browser network tab for API monitoring
- Console logs for state debugging

### Code Organization

#### Backend Structure
```
backend/
├── app.py              # FastAPI routes and middleware
├── eventbrite.py       # Eventbrite API client + caching
├── woocommerce.py      # WooCommerce API + FooEvents parsing
├── wordpress_db.py     # WordPress database integration
└── run_dev.py          # Development server
```

#### Frontend Structure
```
frontend/src/
├── components/
│   ├── CapacityManager.tsx    # Unified capacity management
│   ├── SeriesViewer.tsx       # Eventbrite series browser  
│   └── WooCommerceViewer.tsx  # WooCommerce events browser
├── api.ts              # Backend API client
├── App.tsx             # Root component + state
└── main.tsx            # Application entry point
```

## 🔍 Testing & Debugging

### Backend Testing

#### Test Database Connection
```python
from wordpress_db import WordPressDBClient
client = WordPressDBClient()
status = client.get_database_status()
print(status)
```

#### Test Product Detection
```python
from woocommerce import WooCommerceClient
client = WooCommerceClient()
product = await client.get_product_data(31907)
fooevents_data = client.extract_fooevents_data(product)
```

### Frontend Testing

#### API Connection Test
```javascript
import { getConfig } from './api';
getConfig().then(config => console.log(config));
```

#### Component State Debugging
```javascript
// In React components
console.log('Current state:', { selectedEventId, selectedWooCommerceDate });
```

## 🐛 Common Issues & Solutions

### Database Connection Issues

**Problem**: "❌ DB Error" showing for all products
**Solution**: 
1. Check `.env` file has correct WordPress database credentials
2. Verify database server allows remote connections
3. Test connection with debug endpoint

### FooEvents Detection Issues

**Problem**: Products showing wrong event type
**Solution**:
1. Check debug endpoint for product metadata
2. Verify tickets exist in WordPress database
3. Check ticket metadata fields

### Cache Issues

**Problem**: Stale data showing in frontend
**Solution**:
1. Force cache refresh with sync endpoint
2. Check cache timestamps in debug info
3. Clear browser cache if needed

## 📊 Performance Considerations

### Caching Strategy
- **Eventbrite**: 1-hour cache for series data
- **WooCommerce**: 1-hour cache for product data
- **Database**: Real-time queries (no caching for accuracy)

### Optimization Opportunities
1. **Database Connection Pooling**: Currently creates new connections per request
2. **Batch Database Queries**: Could optimize multiple product queries
3. **Frontend State Management**: Could use React Context for complex state
4. **API Response Compression**: Could enable gzip compression

## 🔐 Security Considerations

### Environment Variables
- All sensitive credentials in `.env` file
- Never commit `.env` to version control
- Use different tokens for development/production

### Database Security
- Read-only database user recommended
- IP-based access restrictions
- Secure connection (SSL) recommended for production

### API Security
- CORS configured for development origins only
- Rate limiting not implemented (consider for production)
- Input validation on all endpoints

## 🚀 Deployment Considerations

### Backend Deployment
- Use production ASGI server (Gunicorn + Uvicorn)
- Set proper environment variables
- Configure database connection pooling
- Enable logging and monitoring

### Frontend Deployment
- Build with `npm run build`
- Serve static files with proper caching headers
- Configure API base URL for production
- Enable HTTPS

### Database Considerations
- Ensure WordPress database allows remote connections
- Use connection pooling for production
- Monitor database performance
- Consider read replicas for scaling 