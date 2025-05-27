# Development Documentation

## 🔧 Technical Overview

This document provides comprehensive technical information about the Backroom Comedy Club Event Management System, including the FooEvents detection algorithms, database safety mechanisms, Windows PowerShell development workflows, and production-ready implementation details.

## 🏗️ Technology Stack

### Backend
- **Framework**: FastAPI (High-performance Python web framework)
- **Server**: Uvicorn (ASGI server with hot reload)
- **Database**: PyMySQL (WordPress MySQL integration)
- **HTTP Client**: aiohttp (Async HTTP client for API calls)
- **Environment**: python-dotenv (Environment variable management)
- **JSON Handling**: Built-in json module with safety validations

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite (Fast development and production builds)
- **Styling**: CSS Modules with responsive design
- **State Management**: React hooks with centralized selection state
- **HTTP Client**: Fetch API with TypeScript interfaces

### External Integrations
- **Eventbrite API**: REST API for event capacity management
- **WooCommerce API**: REST API for product and inventory management
- **WordPress Database**: Direct MySQL queries for accurate ticket data
- **FooEvents Plugin**: Complex booking metadata parsing and management

## 📁 Architecture and File Dependencies

### Backend Architecture

```
backend/
├── app.py                  # FastAPI application with all endpoints
├── eventbrite.py          # Eventbrite API client with caching
├── woocommerce.py         # WooCommerce API + FooEvents detection logic
├── wordpress_db.py        # WordPress database client
└── run_dev.py            # Development server launcher
```

#### Core Dependencies
- `app.py` → `eventbrite.py`, `woocommerce.py` (API integrations)
- `woocommerce.py` → `wordpress_db.py` (Database integration)
- All modules → `.env` (Configuration)

### Frontend Architecture

```
frontend/src/
├── App.tsx                # Root component with sidebar layout
├── api.ts                 # API client with TypeScript interfaces
├── components/
│   ├── Dashboard.tsx      # System status and overview
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── ComparisonView.tsx # Event comparison interface
│   ├── CapacityManager.tsx # Inventory management controls
│   ├── SeriesViewer.tsx   # Eventbrite event browser
│   └── WooCommerceViewer.tsx # WooCommerce product browser
└── [component].css        # Component-specific styles
```

#### Component Dependencies
- `App.tsx` → All components (Central layout and state)
- All components → `api.ts` (Backend communication)
- Components → Individual CSS files (Styling)

## 🎯 FooEvents Detection Algorithm (Production-Ready)

### The Core Challenge

The system must automatically determine whether a WooCommerce product should use:
1. **WooCommerce native inventory** (`stock_quantity` field)
2. **FooEvents booking metadata** (complex nested JSON structures)

**Critical Importance**: Wrong detection leads to database corruption, which causes website downtime and lost ticket sales.

### Detection Algorithm (Multi-Layer Validation)

```python
def _is_real_bookings_product(self, product_data: Dict[str, Any]) -> bool:
    """
    Multi-layer detection algorithm with fallback mechanisms
    """
    product_id = product_data.get('id')
    
    # LAYER 1: WooCommerce Stock Management Check
    # If manage_stock=True, this is likely a normal FooEvents product
    if product_data.get('manage_stock') and product_data.get('stock_quantity') is not None:
        return False  # Use WooCommerce inventory
    
    # LAYER 2: Booking Metadata Analysis
    for meta in product_data.get('meta_data', []):
        if meta.get('key') == 'fooevents_bookings_options_serialized':
            value = meta.get('value')
            if value:
                try:
                    booking_data = json.loads(value) if isinstance(value, str) else value
                    
                    # LAYER 3: Synthetic Pattern Detection
                    # Check for synthetic booking data (single events)
                    synthetic_patterns = [
                        f"event_{product_id}",  # Slot key pattern
                        f"date_{product_id}"    # Date key pattern
                    ]
                    
                    for slot_key, slot_data in booking_data.items():
                        if slot_key in synthetic_patterns:
                            return False  # Synthetic = Normal FooEvents
                        
                        # LAYER 4: Real Booking Structure Detection
                        if isinstance(slot_data, dict):
                            # Check for nested add_date structure (real bookings)
                            for date_key, date_data in slot_data.items():
                                if date_key.startswith('add_date') and isinstance(date_data, dict):
                                    return True  # Real FooEvents Bookings
                            
                            # Check for flat structure with real date keys
                            if any(key.startswith('date_') and not key.startswith(f'date_{product_id}') 
                                  for key in slot_data.keys()):
                                return True  # Real FooEvents Bookings
                
                except (json.JSONDecodeError, TypeError):
                    pass
    
    # LAYER 5: Fallback Safety
    # Default to FooEvents Bookings for safety (prevents inventory corruption)
    return True
```

### Product Type Examples

#### Normal FooEvents (Single Events)
```python
# Detection: manage_stock=True OR synthetic patterns
{
    "id": 31907,
    "name": "Robyn: Saturday Night at the Backroom",
    "manage_stock": True,
    "stock_quantity": 53,
    "booking_data": {
        "event_31907": {  # Synthetic pattern
            "date_31907_add_date": "...",
            "date_31907_stock": "50"
        }
    }
}
# Result: Use WooCommerce inventory (stock_quantity)
```

#### FooEvents Bookings (Multi-Slot Products)
```python
# Detection: Real booking structure with multiple slots/dates
{
    "id": 3986,
    "name": "Wednesday Night at Backroom Comedy Club",
    "manage_stock": False,
    "booking_data": {
        "8pm Show": {  # Real slot name
            "add_date_2024_11_20": {  # Nested structure
                "date": "2024-11-20",
                "stock": "30"
            },
            "add_date_2024_11_27": {
                "date": "2024-11-27", 
                "stock": "30"
            }
        },
        "10pm Show": {
            # ... more dates
        }
    }
}
# Result: Use FooEvents booking metadata
```

#### Edge Cases (Hybrid Products)
```python
# Detection: Has booking metadata BUT manage_stock=True
{
    "id": 37291,
    "name": "Back From Sask: Comedy Show",
    "manage_stock": True,  # Fallback trigger
    "stock_quantity": 45,
    "booking_data": {
        "8pm Show": {  # Real booking structure
            "date_123_add_date": "..."
        }
    }
}
# Result: Use WooCommerce inventory (fallback protection)
```

## 🛡️ Database Safety Mechanisms

### JSON Corruption Prevention

**Problem**: Python dictionaries sent to WordPress cause `json_decode()` errors.

**Solution**: All booking metadata updates use `json.dumps()`:

```python
def _update_product_booking_data(self, product_id: int, booking_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update FooEvents booking data with JSON safety
    """
    update_data = {
        'meta_data': [
            {
                'key': 'fooevents_bookings_options_serialized',
                'value': json.dumps(booking_data)  # CRITICAL: JSON string conversion
            }
        ]
    }
    
    return self.wc_api_request(
        f"products/{product_id}",
        method='PUT',
        data=update_data,
        auth_in_url=True  # Required for write operations
    )
```

### Database Connection Safety

```python
class WordPressDB:
    def __init__(self):
        self.connection_pool = None
        self.max_retries = 3
        self.timeout = 10
    
    def get_connection(self):
        """Safe connection with retry logic"""
        for attempt in range(self.max_retries):
            try:
                return pymysql.connect(
                    host=self.host,
                    port=self.port,
                    user=self.user,
                    password=self.password,
                    database=self.database,
                    connect_timeout=self.timeout,
                    charset='utf8mb4'
                )
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(2 ** attempt)  # Exponential backoff
```

## 🔄 Inventory Management Implementation

### WooCommerce Inventory Updates

```python
def increment_woocommerce_inventory(self, product_id: int, slot: str, date: str) -> Dict[str, Any]:
    """
    Increment inventory with product type detection
    """
    product_data = await self.get_product_data(product_id)
    
    if self._is_real_bookings_product(product_data):
        # FooEvents Bookings: Update booking metadata
        return self._increment_booking_metadata(product_id, slot, date)
    else:
        # Normal FooEvents: Update WooCommerce stock
        return self._increment_woocommerce_stock(product_id)

def _increment_woocommerce_stock(self, product_id: int) -> Dict[str, Any]:
    """
    Update WooCommerce stock_quantity field
    """
    product = self.wc_api_request(f"products/{product_id}")
    current_stock = product.get('stock_quantity', 0)
    new_stock = current_stock + 1
    
    return self.wc_api_request(
        f"products/{product_id}",
        method='PUT',
        data={'stock_quantity': new_stock},
        auth_in_url=True
    )

def _increment_booking_metadata(self, product_id: int, slot: str, date: str) -> Dict[str, Any]:
    """
    Update FooEvents booking metadata with JSON safety
    """
    product_data = await self.get_product_data(product_id)
    booking_data = self._get_booking_data(product_data)
    
    # Navigate nested/flat structure and increment
    if slot in booking_data:
        slot_data = booking_data[slot]
        date_key = self._find_date_key(slot_data, date)
        
        if date_key:
            if isinstance(slot_data[date_key], dict):
                # Nested structure
                current_stock = int(slot_data[date_key].get('stock', 0))
                slot_data[date_key]['stock'] = str(current_stock + 1)
            else:
                # Flat structure
                current_stock = int(slot_data.get(f"{date_key}_stock", 0))
                slot_data[f"{date_key}_stock"] = str(current_stock + 1)
    
    return self._update_product_booking_data(product_id, booking_data)
```

### Frontend Integration

```typescript
// TypeScript interfaces for type safety
interface WooCommerceInventoryRequest {
  product_id: number;
  slot: string;
  date: string;
}

interface WooCommerceInventoryResponse {
  success: boolean;
  product_id: number;
  action: 'increment' | 'decrement';
  new_capacity?: number;
  error?: string;
}

// Inventory management with optimistic updates
const handleInventoryChange = async (
  productId: number, 
  slot: string, 
  date: string, 
  action: 'increment' | 'decrement'
) => {
  // Optimistic UI update
  setLocalCapacity(prev => prev + (action === 'increment' ? 1 : -1));
  
  try {
    const response = await fetch(`/api/woocommerce/inventory/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, slot, date })
    });
    
    const result: WooCommerceInventoryResponse = await response.json();
    
    if (result.success) {
      // Confirm with actual value from backend
      setLocalCapacity(result.new_capacity || 0);
    } else {
      // Revert optimistic update on error
      setLocalCapacity(prev => prev - (action === 'increment' ? 1 : -1));
      showError(result.error);
    }
  } catch (error) {
    // Revert on network error
    setLocalCapacity(prev => prev - (action === 'increment' ? 1 : -1));
    showError('Network error');
  }
};
```

## 🚀 Development Workflow (Windows PowerShell)

### Initial Setup

```powershell
# Clone repository
git clone https://github.com/your-repo/brcc_sync.git
cd brcc_sync

# Backend setup
cd backend
pip install -r requirements.txt

# Create .env file (see README.md for template)
# Copy environment variables

# Frontend setup (new terminal)
cd frontend  
npm install
```

### Daily Development

#### Option 1: Two Terminal Windows

**Terminal 1 - Backend:**
```powershell
cd backend
python run_dev.py  # Cached data (fast startup)
# OR
python run_dev.py --sync  # Fresh data (slower startup)
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

#### Option 2: PowerShell Background Jobs

```powershell
# Start backend in background
Start-Job -ScriptBlock { 
    cd backend; python run_dev.py 
} -Name "BackendDev"

# Start frontend in current terminal
cd frontend
npm run dev

# Check job status
Get-Job
Receive-Job -Name "BackendDev"  # View backend output
```

### Testing and Debugging

#### Backend Testing
```powershell
# Test API endpoints
Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/products" -Method GET

# Test with parameters
$body = @{
    product_id = 31907
    slot = "event_31907"  
    date = "2024-11-20"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/inventory/increment" -Method POST -Body $body -ContentType "application/json"
```

#### Database Testing
```powershell
# Test database connection
Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/wordpress-db-status" -Method GET

# Debug specific product
Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/debug/product/31907" -Method GET
```

#### Frontend Testing
```powershell
# Build for production testing
cd frontend
npm run build

# Preview production build
npm run preview
```

### Production Deployment

```powershell
# Build frontend
cd frontend
npm run build

# Copy build files to static directory
Copy-Item -Recurse .\dist\* ..\backend\static\

# Run production backend
cd ..\backend
python run_dev.py --prod
```

## 🔍 Debugging and Monitoring

### Backend Debug Endpoints

```python
# Product detection debugging
@app.get("/woocommerce/debug/product/{product_id}")
async def debug_product_detection(product_id: int):
    """Debug product type detection"""
    product_data = await wc_client.get_product_data(product_id)
    
    return {
        "product_id": product_id,
        "product_name": product_data.get('name'),
        "manage_stock": product_data.get('manage_stock'),
        "stock_quantity": product_data.get('stock_quantity'),
        "is_real_bookings": wc_client._is_real_bookings_product(product_data),
        "booking_data": wc_client._get_booking_data(product_data),
        "detection_reason": wc_client._get_detection_reason(product_data)
    }

# Database health check
@app.get("/woocommerce/wordpress-db-status")
async def wordpress_db_status():
    """Check WordPress database connection"""
    try:
        status = wc_client.wp_db.get_connection_status()
        return {"status": "connected", "details": status}
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

### Frontend Error Handling

```typescript
// Comprehensive error handling
const InventoryControls: React.FC<Props> = ({ productId, slot, date }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleInventoryUpdate = async (action: 'increment' | 'decrement') => {
    setError(null);
    setIsLoading(true);
    
    try {
      const result = await updateInventory(productId, slot, date, action);
      
      if (!result.success) {
        setError(result.error || 'Update failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="inventory-controls">
      {error && <div className="error-message">{error}</div>}
      <button 
        onClick={() => handleInventoryUpdate('decrement')}
        disabled={isLoading}
      >
        -
      </button>
      <span>{capacity}</span>
      <button 
        onClick={() => handleInventoryUpdate('increment')}
        disabled={isLoading}
      >
        +
      </button>
    </div>
  );
};
```

## 📊 Performance Considerations

### Caching Strategy

```python
class WooCommerceClient:
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes for API calls
        self.persistent_cache = True  # Never auto-expire
    
    async def get_all_fooevents_products(self, use_cache=True):
        """Intelligent caching with manual refresh"""
        cache_key = "all_products"
        
        if use_cache and cache_key in self.cache:
            return self.cache[cache_key]
        
        # Fetch fresh data
        products = await self._fetch_all_products()
        self.cache[cache_key] = products
        
        return products
```

### Database Connection Pooling

```python
class WordPressDB:
    def __init__(self):
        self.connection_pool = queue.Queue(maxsize=5)
        self.pool_initialized = False
    
    def _initialize_pool(self):
        """Initialize connection pool on first use"""
        for _ in range(3):  # 3 connections in pool
            conn = self._create_connection()
            self.connection_pool.put(conn)
        self.pool_initialized = True
    
    def get_connection(self):
        """Get connection from pool with fallback"""
        if not self.pool_initialized:
            self._initialize_pool()
        
        try:
            return self.connection_pool.get_nowait()
        except queue.Empty:
            # Pool exhausted, create new connection
            return self._create_connection()
```

## 🔒 Security Considerations

### Environment Variable Security
```powershell
# Secure .env file setup
echo "PRIVATE_TOKEN=your_token_here" | Out-File -Encoding UTF8 .env
echo "WOOCOMMERCE_CONSUMER_KEY=ck_your_key" | Add-Content .env
echo "WOOCOMMERCE_CONSUMER_SECRET=cs_your_secret" | Add-Content .env

# Set file permissions (Windows)
icacls .env /grant:r "$env:USERNAME:(R)" /inheritance:r
```

### API Authentication
```python
# Dual authentication for WooCommerce
def wc_api_request(self, endpoint, method='GET', data=None, auth_in_url=False):
    """
    WooCommerce API request with dual auth support
    """
    if auth_in_url:
        # URL parameters for write operations (required)
        params = {
            'consumer_key': self.consumer_key,
            'consumer_secret': self.consumer_secret
        }
        headers = {'Content-Type': 'application/json'}
        auth = None
    else:
        # HTTP Basic Auth for read operations
        params = {}
        headers = {}
        auth = (self.consumer_key, self.consumer_secret)
    
    response = requests.request(
        method=method,
        url=f"{self.api_url}/wp-json/wc/v3/{endpoint}",
        params=params,
        headers=headers,
        auth=auth,
        json=data,
        timeout=30
    )
    
    return response.json()
```

## 📈 Production Readiness

### Health Checks
```python
@app.get("/health")
async def health_check():
    """Comprehensive health check"""
    checks = {
        "api_server": "healthy",
        "eventbrite_api": await check_eventbrite_connection(),
        "woocommerce_api": await check_woocommerce_connection(),
        "wordpress_db": await check_database_connection(),
        "cache_status": get_cache_status()
    }
    
    overall_health = "healthy" if all(
        status == "healthy" for status in checks.values()
    ) else "degraded"
    
    return {"status": overall_health, "checks": checks}
```

### Error Recovery
```python
async def safe_inventory_update(product_id, slot, date, action):
    """Inventory update with automatic rollback"""
    # Create checkpoint
    checkpoint = await create_inventory_checkpoint(product_id, slot, date)
    
    try:
        result = await update_inventory(product_id, slot, date, action)
        
        if not result.get('success'):
            # Rollback on failure
            await restore_inventory_checkpoint(checkpoint)
            raise InventoryUpdateError(result.get('error'))
        
        return result
        
    except Exception as e:
        # Automatic rollback on exception
        await restore_inventory_checkpoint(checkpoint)
        raise e
```

## 🧪 Testing Strategy

### Unit Testing
```python
import pytest
from unittest.mock import Mock, patch

class TestFooEventsDetection:
    def test_normal_fooevents_detection(self):
        """Test detection of normal FooEvents products"""
        product_data = {
            "id": 31907,
            "manage_stock": True,
            "stock_quantity": 53,
            "meta_data": [...]
        }
        
        client = WooCommerceClient()
        result = client._is_real_bookings_product(product_data)
        
        assert result == False  # Should be detected as normal FooEvents
    
    def test_bookings_product_detection(self):
        """Test detection of FooEvents Bookings products"""
        product_data = {
            "id": 3986,
            "manage_stock": False,
            "meta_data": [
                {
                    "key": "fooevents_bookings_options_serialized",
                    "value": json.dumps({
                        "8pm Show": {
                            "add_date_2024_11_20": {
                                "date": "2024-11-20",
                                "stock": "30"
                            }
                        }
                    })
                }
            ]
        }
        
        client = WooCommerceClient()
        result = client._is_real_bookings_product(product_data)
        
        assert result == True  # Should be detected as FooEvents Bookings
```

### Integration Testing
```powershell
# PowerShell integration test script
$baseUrl = "http://localhost:8000"

# Test product detection
$response = Invoke-RestMethod -Uri "$baseUrl/woocommerce/debug/product/31907"
if ($response.is_real_bookings -eq $false) {
    Write-Host "✅ Robyn correctly detected as Normal FooEvents"
} else {
    Write-Host "❌ Robyn detection failed"
    exit 1
}

# Test inventory update
$body = @{
    product_id = 31907
    slot = "event_31907"
    date = "2024-11-20"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$baseUrl/woocommerce/inventory/increment" -Method POST -Body $body -ContentType "application/json"

if ($response.success) {
    Write-Host "✅ Inventory increment successful"
} else {
    Write-Host "❌ Inventory increment failed: $($response.error)"
    exit 1
}

Write-Host "✅ All integration tests passed"
```

## 📚 Additional Resources

### FooEvents Plugin Documentation
- Located in `references_docs/` directory
- Contains official plugin documentation
- Includes booking metadata structure examples

### WordPress Database Schema
- WooCommerce product tables: `wp_posts`, `wp_postmeta`
- Order tables: `wp_wc_orders`, `wp_wc_order_meta`
- Custom ticket tables: `wp_wc_order_product_addons_lookup`

### API Reference
- **Eventbrite API**: https://www.eventbrite.com/platform/api
- **WooCommerce API**: https://woocommerce.github.io/woocommerce-rest-api-docs/
- **FastAPI Docs**: Auto-generated at `/docs` endpoint

This development documentation provides the technical foundation for maintaining and extending the BRCC Event Management System with confidence in production environments. 