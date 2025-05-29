# Design Documentation

## 🎨 Architecture Overview

The Backroom Comedy Club Event Management System is designed as a **production-ready dashboard application** that unifies Eventbrite and WooCommerce FooEvents inventory management with **intelligent product detection**, **database safety mechanisms**, and **robust error handling**. The architecture prioritizes **data accuracy**, **database integrity**, **cross-platform compatibility**, and **production reliability**.

## 🏗️ System Design Philosophy

### Core Principles

#### 1. Database Integrity First
- **Zero Tolerance for Corruption**: Any operation that could corrupt the WordPress database is prevented
- **JSON Safety**: All database updates use proper JSON serialization to prevent PHP errors
- **Rollback Mechanisms**: Automatic rollback on failed operations
- **Validation Layers**: Multiple validation checks before any database modification

#### 2. Intelligent Product Detection
- **Multi-Layer Detection**: Complex algorithm to differentiate between FooEvents product types
- **Fallback Safety**: Default to safe operations when detection is uncertain
- **Edge Case Handling**: Robust handling of hybrid and misconfigured products
- **Production Testing**: Extensive testing against real-world product configurations

#### 3. Explicit User Control
- **Manual Cache Refresh**: No automatic operations that could surprise users
- **Deliberate Actions**: All capacity changes require explicit user confirmation
- **Transparent Operations**: Clear feedback on what the system is doing
- **Error Recovery**: Clear paths to recover from any error state

#### 4. Cross-Platform Consistency
- **Unified Interface**: Consistent UI patterns across Eventbrite and WooCommerce
- **Shared State Management**: Centralized event selection and comparison
- **Platform Abstraction**: Hide platform differences from users
- **Seamless Workflows**: Natural transitions between platforms

## 🔄 FooEvents Detection Architecture

### The Challenge

WordPress FooEvents products come in multiple configurations that require different inventory management approaches:

1. **Normal FooEvents**: Single events using WooCommerce inventory tracking
2. **FooEvents Bookings**: Multi-slot events using complex booking metadata
3. **Hybrid Products**: Products with booking metadata but WooCommerce stock management

**Critical Importance**: Wrong detection leads to database corruption, causing website downtime and lost revenue. The system employs a multi-layered approach in `extract_fooevents_data` to determine the nature of a FooEvents product.

### `extract_fooevents_data` - Detection Algorithm Design

The primary goal is to correctly identify if a product uses complex booking metadata from `fooevents_bookings_options_serialized` (FBOS) or if it should be treated as a single event (potentially using WooCommerce's main stock or simpler event flags).

```mermaid
graph TD
    A[Start extract_fooevents_data] --> B{Product has meta_data?};
    B -- No --> Z[Return None];
    B -- Yes --> C{Attempt to parse fooevents_bookings_options_serialized (FBOS)};
    C -- Parse Error --> D[Log Error, FBOS unusable];
    C -- Success --> E{Is parsed FBOS data valid AND complex/multi-slot?};
    E -- Yes --> F[Return parsed FBOS data (prioritized for complex bookings)];
    E -- No (FBOS missing, empty, simple, or synthetic) --> G{manage_stock is True AND stock_quantity exists?};
    D --> G; %% Error in parsing FBOS also leads to checking other indicators
    G -- Yes --> H[Generate synthetic data using product stock_quantity];
    H --> I[Return synthetic data];
    G -- No --> J{WooCommerceEventsEvent meta == 'Event'?};
    J -- Yes --> K[Generate synthetic data (stock derived/defaulted in helper)];
    K --> I;
    J -- No --> L{FBOS was parsed earlier (but not complex) AND matches known synthetic pattern?};
    L -- Yes --> M[Generate synthetic data based on FBOS content (stock derived/defaulted in helper)];
    M --> I;
    L -- No --> Z;
```
**Key Logic Points for `extract_fooevents_data`:**
1.  **Prioritize Complex FBOS**: If `fooevents_bookings_options_serialized` is present, parsable, and indicates a complex multi-slot/date structure, this raw booking data is returned directly. This allows downstream functions like `format_booking_slots` to handle the detailed interpretation.
2.  **Fallback to Single Event Indicators**: If complex FBOS data isn't found or applicable:
    *   Product-level `manage_stock: true` (with `stock_quantity`) triggers synthetic single-event data generation.
    *   An explicit `WooCommerceEventsEvent: Event` meta flag also triggers synthetic single-event data.
    *   If FBOS was parsed but only matched a simple synthetic pattern (and wasn't complex), it's treated as a synthetic single event.
3.  **Synthetic Data Generation**: The `_generate_synthetic_data` helper attempts to find the most relevant stock figure for single events, whether from `stock_quantity` or by inspecting simple FBOS structures if present.

### Product Type Examples & Detection Logic

#### Normal FooEvents (Single Events)
```json
{
  "detection_triggers": [
    "manage_stock: true",
    "stock_quantity: not null",
    "synthetic_pattern: event_{product_id}"
  ],
  "inventory_method": "WooCommerce stock_quantity field",
  "example_products": [
    "Robyn: Saturday Night at the Backroom",
    "Special guest performances",
    "One-off comedy shows"
  ],
  "characteristics": {
    "single_date": true,
    "simple_structure": true,
    "wp_inventory": true
  }
}
```

#### FooEvents Bookings (Multi-Slot Products)
```json
{
  "detection_triggers": [
    "manage_stock: false",
    "nested_add_date_structure",
    "multiple_slots",
    "real_date_patterns"
  ],
  "inventory_method": "FooEvents booking metadata",
  "example_products": [
    "Monday Night at Backroom Comedy Club",
    "Wednesday Night at Backroom Comedy Club",
    "Recurring weekly shows"
  ],
  "characteristics": {
    "multiple_dates": true,
    "multiple_slots": true,
    "complex_metadata": true
  }
}
```

#### Edge Cases (Hybrid Products)
```json
{
  "detection_triggers": [
    "has_booking_metadata: true",
    "manage_stock: true (fallback trigger)"
  ],
  "inventory_method": "WooCommerce stock_quantity (safety fallback)",
  "example_products": [
    "Products misconfigured in WordPress",
    "Legacy products with mixed settings"
  ],
  "safety_mechanism": "Prevents database corruption by using WC inventory"
}
```

## 🛡️ Database Safety Architecture

### JSON Corruption Prevention

**The Problem**: Python dictionaries sent to WordPress cause fatal `json_decode()` errors:
```
json_decode(): Argument #1 ($json) must be of type string, array given
```

**The Solution**: Multi-layer JSON safety:

```python
def _update_product_booking_data(self, product_id: int, booking_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update FooEvents booking data with guaranteed JSON safety
    """
    # CRITICAL: Convert Python dict to JSON string
    json_safe_data = json.dumps(booking_data)
    
    # Validate JSON before sending
    try:
        json.loads(json_safe_data)  # Verify it can be parsed
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON data structure")
    
    update_data = {
        'meta_data': [
            {
                'key': 'fooevents_bookings_options_serialized',
                'value': json_safe_data  # JSON string, not Python dict
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
    """
    Production-ready database client with connection pooling and retry logic
    """
    
    def __init__(self):
        self.connection_pool = queue.Queue(maxsize=5)
        self.max_retries = 3
        self.timeout = 10
        self.pool_initialized = False
    
    def get_connection(self):
        """Get database connection with exponential backoff retry"""
        for attempt in range(self.max_retries):
            try:
                return pymysql.connect(
                    host=self.host,
                    port=self.port,
                    user=self.user,
                    password=self.password,
                    database=self.database,
                    connect_timeout=self.timeout,
                    charset='utf8mb4',
                    autocommit=False  # Explicit transaction control
                )
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise DatabaseConnectionError(f"Failed after {self.max_retries} attempts: {e}")
                time.sleep(2 ** attempt)  # Exponential backoff
```

### Inventory Update Safety

```python
async def safe_inventory_update(product_id: int, slot: str, date: str, action: str):
    """
    Inventory update with automatic rollback on failure
    """
    # Create checkpoint before any changes
    checkpoint = await create_inventory_checkpoint(product_id, slot, date)
    
    try:
        # Detect product type with multi-layer validation
        product_data = await get_product_data(product_id)
        is_bookings = _is_real_bookings_product(product_data)
        
        if is_bookings:
            result = await update_booking_metadata(product_id, slot, date, action)
        else:
            result = await update_woocommerce_stock(product_id, action)
        
        # Validate the update was successful
        if not result.get('success'):
            await restore_inventory_checkpoint(checkpoint)
            raise InventoryUpdateError(result.get('error'))
        
        return result
        
    except Exception as e:
        # Automatic rollback on any failure
        await restore_inventory_checkpoint(checkpoint)
        raise e
```

## 🔄 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Production-Ready Frontend (React + TypeScript)       │
├─────────────┬─────────────────┬─────────────────┬─────────────────────────────┤
│   Sidebar   │    Dashboard    │ ComparisonView  │       EventManager          │
│ (Navigation)│  (System Status)│ (Event Compare) │  (Eventbrite/WooCommerce)  │
└─────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
                                         │
                                  ┌──────┴──────┐
                                  │  FastAPI    │
                                  │  Server     │
                                  │ (Production │
                                  │   Ready)    │
                                  └──────┬──────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
      ┌───────▼────────┐         ┌───────▼────────┐         ┌──────▼──────┐
      │ Eventbrite API │         │ WooCommerce    │         │ WordPress   │
      │ (Capacity Mgmt)│         │ API + FooEvents│         │ Database    │
      │                │         │ Detection      │         │ (Real-time  │
      │ • Persistent   │         │                │         │  Queries)   │
      │   Cache        │         │ • Multi-layer  │         │             │
      │ • Manual Sync  │         │   Detection    │         │ • Connection│
      │ • Error        │         │ • JSON Safety  │         │   Pooling   │
      │   Recovery     │         │ • Database     │         │ • Retry     │
      │                │         │   Safety       │         │   Logic     │
      └────────────────┘         │ • Inventory    │         │ • Error     │
                                 │   Management   │         │   Handling  │
                                 └────────────────┘         └─────────────┘
```

## 📁 Production-Ready Architecture

### Backend Services

| Service | Purpose | Safety Features | Production Considerations |
|---------|---------|-----------------|--------------------------|
| **FastAPI Server** | API endpoints and business logic | • Input validation<br>• Error handling<br>• Request logging | • ASGI server (Uvicorn)<br>• Health checks<br>• Monitoring endpoints |
| **Eventbrite Client** | Event capacity management | • Rate limiting<br>• Retry logic<br>• Cache management | • Persistent cache<br>• Manual refresh<br>• Error recovery |
| **WooCommerce Client** | Product detection and inventory | • Multi-layer detection<br>• JSON safety<br>• Rollback mechanisms | • Database safety<br>• Transaction management<br>• Audit logging |
| **WordPress Database** | Real ticket sales data | • Connection pooling<br>• Query timeout<br>• Retry logic | • Read-only access<br>• Connection limits<br>• Performance monitoring |

### Frontend Components

| Component | Responsibility | Error Handling | User Experience |
|-----------|---------------|----------------|-----------------|
| **App.tsx** | State management and routing | • Global error boundary<br>• Fallback UI<br>• Recovery actions | • Sidebar navigation<br>• Responsive design<br>• Mobile support |
| **Dashboard.tsx** | System overview and status | • API health checks<br>• Service status<br>• Error indicators | • Status cards<br>• Quick actions<br>• Selected events |
| **ComparisonView.tsx** | Event comparison and analysis | • Per-event error states<br>• Loading indicators<br>• Retry options | • Side-by-side cards<br>• Capacity visualization<br>• Summary stats |

## 🎯 Windows PowerShell Development Architecture

### Development Environment Design

**Design Decision**: Native Windows PowerShell support for development workflows

**Rationale**:
- Comedy club staff primarily use Windows systems
- PowerShell provides robust scripting capabilities
- Native Windows compatibility reduces setup complexity
- Professional tooling integration (VS Code, Windows Terminal)

### Development Workflow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Windows PowerShell Development                       │
├─────────────────────────┬───────────────────────────────────────────────────┤
│     Terminal 1          │               Terminal 2                          │
│   Backend (Python)     │           Frontend (Node.js)                      │
│                         │                                                   │
│ cd backend              │ cd frontend                                       │
│ python run_dev.py       │ npm run dev                                       │
│                         │                                                   │
│ • FastAPI server        │ • Vite dev server                                 │
│ • Hot reload            │ • Hot module replacement                          │
│ • Debug endpoints       │ • TypeScript compilation                          │
│ • Database connections  │ • Proxy to backend                                │
└─────────────────────────┴───────────────────────────────────────────────────┘
                                    │
                            ┌───────▼────────┐
                            │  Integration   │
                            │    Testing     │
                            │                │
                            │ PowerShell     │
                            │ Test Scripts   │
                            └────────────────┘
```

### PowerShell Integration Features

#### Environment Setup
```powershell
# Streamlined setup process
git clone https://github.com/your-repo/brcc_sync.git
cd brcc_sync

# Backend setup
cd backend
pip install -r requirements.txt

# Frontend setup (new terminal)
cd frontend
npm install
```

#### Development Commands
```powershell
# Start development environment
cd backend ; python run_dev.py    # Terminal 1
cd frontend ; npm run dev          # Terminal 2

# Testing commands
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET
Invoke-RestMethod -Uri "http://localhost:8000/woocommerce/products" -Method GET

# Production build
cd frontend ; npm run build
cd ..\backend ; python run_dev.py --prod
```

#### Background Job Support
```powershell
# Optional: Run backend as background job
Start-Job -ScriptBlock { cd backend; python run_dev.py } -Name "BackendDev"

# Monitor job status
Get-Job
Receive-Job -Name "BackendDev"
```

## 🔧 Technical Design Decisions

### Database Integration Strategy

**Decision**: Direct WordPress database access for ticket data

**Rationale**:
- WooCommerce API doesn't provide real ticket sales
- FooEvents stores data in custom WordPress tables
- Real-time accuracy is critical for capacity management
- Direct queries eliminate API limitations

**Implementation**:
```python
class WordPressDB: # Simplified example
    def get_tickets_sold_for_date(self, product_id: int, slot_label: str, date_str: str) -> int:
        """Get real ticket sales from WordPress database for a specific slot and date."""
        # ... (actual query as in woocommerce.py)
        pass
    
    def get_total_tickets_sold_for_product(self, product_id: int) -> int:
        """Get total tickets sold for a product (typically for non-booking, single events)."""
        # ... (query to sum up sales for a product ID)
        pass
```

### Stock Interpretation in `format_booking_slots`

After `extract_fooevents_data` provides the `booking_data`, the `format_booking_slots` method is responsible for interpreting it to determine available stock for each date/slot. A key refinement addresses scenarios where FooEvents might store stock in multiple ways for the same date:
*   **Priority for Override Stock**: When processing a specific date (`date_id`) within a slot's data (`slot_data`):
    1.  The system first checks if an "override" stock field exists directly within `slot_data` matching the pattern `f"{date_id}_stock"` (e.g., `ykgzuyosxegmwqyuospt_stock`).
    2.  If this field is found, its value is considered the authoritative `stock_from_booking_options` for that date.
    3.  If not found, the system falls back to using the stock value nested within the `add_date` structure (i.e., `slot_data['add_date'][date_id]['stock']`).
*   **Rationale**: This ensures that if FooEvents provides a more specific, potentially overriding stock value at the slot-date level (like `ykgzuyosxegmwqyuospt_stock: "0"`), it takes precedence over a more general nested stock value. This aligns with observed behavior where the flatter `DATEID_stock` field reflects the true availability seen in the WordPress admin for certain complex booking products.
*   The `stock_from_booking_options` (derived using this priority) is then used by `_get_accurate_capacity_data` to calculate final `available`, `total_capacity`, and `tickets_sold` figures.

### Cache Management Strategy

**Decision**: User-controlled cache with no auto-expiry

**Rationale**:
- Predictable performance (no unexpected delays)
- User controls data freshness
- Reduces API rate limiting
- Clear separation of cached vs. real-time data

**Implementation**:
```python
class CacheManager:
    def __init__(self):
        self.cache = {}
        self.persistent = True  # Never auto-expire
    
    def get_with_manual_refresh(self, key: str, fetch_func: Callable, use_cache: bool = True):
        """Get data with explicit cache control"""
        if use_cache and key in self.cache:
            return self.cache[key]
        
        # User explicitly requested fresh data
        data = fetch_func()
        self.cache[key] = data
        return data
```

### Error Handling Strategy

**Decision**: Graceful degradation with transparent error reporting

**Rationale**:
- System remains functional even with partial failures
- Users see clear error states instead of confusing data
- Recovery paths are always available
- Production reliability is maintained

**Implementation**:
```typescript
// Frontend error handling
const InventoryDisplay: React.FC = ({ productId, slot, date }) => {
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchTicketData(productId, slot, date)
      .then(setTicketData)
      .catch(err => {
        setError('❌ DB Error');
        // System remains functional, just shows error instead of wrong data
      });
  }, [productId, slot, date]);
  
  if (error) {
    return <span className="error-indicator">{error}</span>;
  }
  
  return <span>{ticketData?.soldCount || 'Loading...'}</span>;
};
```

### Authentication Strategy

**Decision**: Dual authentication for WooCommerce API

**Rationale**:
- Read operations use HTTP Basic Auth (simpler)
- Write operations require URL parameters (WooCommerce requirement)
- Reduces complexity while meeting API requirements
- Maintains security for sensitive operations

**Implementation**:
```python
def wc_api_request(self, endpoint: str, method: str = 'GET', data: dict = None, auth_in_url: bool = False):
    """Dual authentication strategy for WooCommerce API"""
    if auth_in_url:
        # URL parameters for write operations
        params = {
            'consumer_key': self.consumer_key,
            'consumer_secret': self.consumer_secret
        }
        auth = None
    else:
        # HTTP Basic Auth for read operations
        params = {}
        auth = (self.consumer_key, self.consumer_secret)
    
    return requests.request(method, url, params=params, auth=auth, json=data)
```

## 📊 Performance Design

### Caching Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Caching Strategy                               │
├─────────────────────────┬───────────────────────────────────────────────────┤
│      Eventbrite Data    │                WooCommerce Data                   │
│                         │                                                   │
│ • Persistent cache      │ • Persistent cache                                │
│ • Manual refresh only   │ • Manual refresh only                             │
│ • Series/events static  │ • Product structure static                        │
│ • User controls sync    │ • User controls sync                              │
└─────────────────────────┴───────────────────────────────────────────────────┘
                                    │
                            ┌───────▼────────┐
                            │  Real-Time     │
                            │  Data Layer    │
                            │                │
                            │ • Ticket sales │
                            │ • Capacity     │
                            │ • Inventory    │
                            │ • No caching   │
                            └────────────────┘
```

### Database Query Optimization

```python
class QueryOptimizer:
    def get_ticket_sales_batch(self, products: List[Tuple[int, str, str]]) -> Dict[str, int]:
        """Batch query for multiple products to reduce database load"""
        if not products:
            return {}
        
        # Build parameterized query for multiple products
        placeholders = ', '.join(['(%s, %s, %s)'] * len(products))
        query = f"""
        SELECT 
            CONCAT(opal.product_id, '|', opal.addon_value, '|', 
                   JSON_EXTRACT(opal.addon_value, '$.BookingDate')) as key,
            COUNT(*) as ticket_count
        FROM wp_wc_order_product_addons_lookup opal
        JOIN wp_wc_orders o ON opal.order_id = o.id
        WHERE (opal.product_id, opal.addon_name, JSON_EXTRACT(opal.addon_value, '$.BookingDate')) 
        IN ({placeholders})
        AND o.status IN ('wc-processing', 'wc-completed')
        GROUP BY key
        """
        
        params = [item for product in products for item in product]
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                results = cursor.fetchall()
                return {row['key']: row['ticket_count'] for row in results}
```

## 🔒 Security Design

### Environment Variable Security
- All sensitive credentials in `.env` file
- File permissions restricted on Windows
- No credentials in code or version control
- Separate development/production configurations

### Database Security
- Read-only database user for application
- Connection limits and timeouts
- IP-based access restrictions
- Encrypted connections in production

### API Security
- Rate limiting on external API calls
- Input validation on all endpoints
- CORS configuration for development
- Request logging for audit trails

## 🚀 Production Deployment Design

### Health Monitoring
```python
@app.get("/health")
async def comprehensive_health_check():
    """Production-ready health check endpoint"""
    checks = {
        "api_server": "healthy",
        "eventbrite_api": await check_eventbrite_connection(),
        "woocommerce_api": await check_woocommerce_connection(), 
        "wordpress_db": await check_database_connection(),
        "cache_status": get_cache_health(),
        "disk_space": check_disk_space(),
        "memory_usage": get_memory_usage()
    }
    
    overall_health = "healthy" if all(
        status == "healthy" for status in checks.values()
    ) else "degraded"
    
    return {
        "status": overall_health,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks
    }
```

### Error Recovery Design
- Automatic rollback on failed operations
- Database transaction management
- Checkpoint/restore mechanisms
- User-initiated recovery actions

### Monitoring and Alerting
- Health check endpoints for external monitoring
- Structured logging for analysis
- Performance metrics collection
- Error reporting and alerting

This design documentation provides the architectural foundation for maintaining and extending the BRCC Event Management System with confidence in production environments, ensuring database safety, user experience, and operational reliability. 