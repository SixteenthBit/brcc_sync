# Design Documentation

## 🎨 Architecture Overview

The Backroom Comedy Club Event Management System is designed as a **dual-platform integration** that unifies Eventbrite and WooCommerce FooEvents management into a single dashboard. The architecture prioritizes **data accuracy**, **real-time updates**, and **graceful error handling**.

## 🏗️ Design Stack

### Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React | 19.1.0 | Component-based UI framework |
| **Build Tool** | Vite | 6.3.5 | Fast development and build tooling |
| **Language** | TypeScript | 5.8.3 | Type-safe JavaScript development |
| **Backend** | FastAPI | 0.104.1 | High-performance Python API framework |
| **Server** | Uvicorn | 0.24.0 | ASGI server for FastAPI |
| **Database** | PyMySQL | 1.1.0 | WordPress MySQL integration |
| **HTTP Client** | Requests | 2.31.0 | External API communication |

### External Integrations

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **Eventbrite API** | Event series and capacity management | REST API with OAuth token |
| **WooCommerce API** | Product and inventory data | REST API with consumer key/secret |
| **WordPress Database** | Real ticket sales data | Direct MySQL connection |

## 🎯 Design Principles

### 1. Data Accuracy First
- **Direct Database Access**: Query WordPress database for real ticket sales instead of calculated estimates
- **Error Transparency**: Show clear error indicators when data is unavailable rather than incorrect calculations
- **Real-time Queries**: No caching for critical ticket sales data

### 2. Graceful Degradation
- **Fallback Strategies**: System continues to function when individual components fail
- **Clear Error States**: Users understand when and why features are unavailable
- **Progressive Enhancement**: Core functionality works even with limited connectivity

### 3. Unified Experience
- **Single Dashboard**: Manage both platforms from one interface
- **Consistent UI**: Similar patterns for both Eventbrite and WooCommerce sections
- **Shared State**: Coordinated selection between different event types

### 4. Developer Experience
- **Hot Reload**: Fast development iteration
- **Type Safety**: TypeScript prevents runtime errors
- **Debug Tools**: Comprehensive debugging endpoints
- **Clear Separation**: Modular architecture with clear responsibilities

## 🔄 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                     │
├─────────────────┬─────────────────┬─────────────────────────┤
│  SeriesViewer   │ WooCommerceViewer│    CapacityManager     │
│  (Eventbrite)   │  (WooCommerce)   │   (Unified Control)    │
└─────────────────┴─────────────────┴─────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │   API Layer │
                    │  (FastAPI)  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌───────▼────────┐ ┌──────▼──────┐
│ Eventbrite API │ │ WooCommerce API│ │ WordPress DB│
│   (External)   │ │   (External)   │ │  (Direct)   │
└────────────────┘ └────────────────┘ └─────────────┘
```

## 📁 Key Files and Dependencies

### Core Application Files

| File | Dependencies | Dependents | Key Responsibilities |
|------|-------------|------------|---------------------|
| **`frontend/src/App.tsx`** | React components | `main.tsx` | • State management<br>• Component coordination<br>• Event selection logic |
| **`backend/app.py`** | All backend modules | None | • API endpoint definitions<br>• Request/response handling<br>• CORS configuration |
| **`backend/woocommerce.py`** | `wordpress_db.py` | `app.py` | • FooEvents data parsing<br>• Event type detection<br>• Capacity calculations |
| **`backend/wordpress_db.py`** | PyMySQL | `woocommerce.py` | • Database connection management<br>• Ticket sales queries<br>• Error handling |

### Component Architecture

| Component | Dependencies | Purpose | Key Features |
|-----------|-------------|---------|--------------|
| **`SeriesViewer.tsx`** | `api.ts` | Eventbrite event browser | • Series listing<br>• Event occurrence selection<br>• Cache status display |
| **`WooCommerceViewer.tsx`** | `api.ts` | WooCommerce event browser | • Product listing<br>• Slot/date selection<br>• Real-time ticket data |
| **`CapacityManager.tsx`** | `api.ts` | Unified capacity control | • Dual-platform support<br>• Capacity increment/decrement<br>• Error state handling |

### Data Flow Architecture

```
User Interaction
       │
       ▼
Component State Update
       │
       ▼
API Request (api.ts)
       │
       ▼
FastAPI Endpoint (app.py)
       │
       ▼
┌──────────────┬──────────────┐
│              │              │
▼              ▼              ▼
Eventbrite     WooCommerce    WordPress
API Client     API Client     Database
│              │              │
▼              ▼              ▼
External       External       Direct
API Call       API Call       MySQL Query
│              │              │
▼              ▼              ▼
Response ◄─────┴──────────────┘
       │
       ▼
Frontend Update
```

## 🎨 UI/UX Design Decisions

### Layout Strategy
- **Three-Panel Layout**: Series viewer, WooCommerce viewer, capacity manager
- **Responsive Design**: Adapts to different screen sizes
- **Visual Hierarchy**: Clear separation between different event types

### State Management
- **Centralized State**: App.tsx manages selection state
- **Mutual Exclusion**: Selecting Eventbrite clears WooCommerce selection and vice versa
- **Clear Indicators**: Visual feedback for selected items

### Error Handling
- **Inline Errors**: Show "❌ DB Error" directly in data fields
- **Status Indicators**: Color-coded status for different system states
- **Graceful Fallbacks**: System remains functional even with partial failures

## 🔧 Technical Design Decisions

### Database Integration Strategy

**Decision**: Direct WordPress database access instead of WooCommerce API for ticket sales

**Rationale**:
- WooCommerce API doesn't provide actual ticket sales data
- FooEvents stores ticket data in custom post types
- Direct database access provides real-time accuracy
- Eliminates incorrect calculated estimates

**Implementation**:
```python
# Check ticket type first
has_slot_metadata = wp_db.has_tickets_with_slot_metadata(product_id)

if has_slot_metadata:
    # FooEvents Bookings - use slot-specific queries
    tickets_sold = wp_db.get_tickets_sold_for_date(product_id, slot, date)
else:
    # Normal FooEvents - use product-level queries
    tickets_sold = wp_db.get_total_tickets_sold_for_product(product_id)
```

### Event Type Detection

**Decision**: Automatic detection based on existing ticket metadata

**Rationale**:
- Products can have both FooEvents Bookings and normal FooEvents configuration
- Existing tickets indicate which system was actually used
- Prevents incorrect data display

**Implementation**:
1. Query existing tickets for product
2. Check if tickets have slot/date metadata
3. Use appropriate configuration based on findings

### Caching Strategy

**Decision**: Selective caching with different policies

**Rationale**:
- API data changes infrequently (1-hour cache)
- Ticket sales data must be real-time (no cache)
- Balance performance with accuracy

**Implementation**:
| Data Type | Cache Duration | Reason |
|-----------|----------------|--------|
| Eventbrite Series | 1 hour | Series data rarely changes |
| WooCommerce Products | 1 hour | Product configuration stable |
| Ticket Sales | No cache | Must be real-time accurate |

### Error Handling Philosophy

**Decision**: Explicit error states instead of silent failures

**Rationale**:
- Users need to know when data is unreliable
- Silent failures lead to incorrect business decisions
- Clear errors enable proper troubleshooting

**Implementation**:
- Return "❌ DB Error" strings for display
- Maintain type safety with `Union[int, str]` types
- Provide debug endpoints for troubleshooting

## 🔐 Security Design

### Credential Management
- **Environment Variables**: All sensitive data in `.env` files
- **No Hardcoded Secrets**: Zero credentials in source code
- **Separation of Concerns**: Different credentials for different services

### Database Access
- **Read-Only Recommended**: Database user should have minimal permissions
- **IP Restrictions**: Limit database access by IP when possible
- **Connection Security**: Use SSL for production database connections

### API Security
- **CORS Configuration**: Restrict origins to known development/production URLs
- **Input Validation**: Validate all user inputs
- **Rate Limiting**: Consider implementing for production use

## 🚀 Scalability Considerations

### Current Limitations
1. **Database Connections**: Creates new connection per request
2. **No Connection Pooling**: Could benefit from connection reuse
3. **Single-threaded**: No async database operations
4. **No Caching for DB**: Real-time queries for every request

### Future Improvements
1. **Connection Pooling**: Implement database connection pool
2. **Async Database**: Use async MySQL driver
3. **Batch Queries**: Optimize multiple product requests
4. **Read Replicas**: Use read replicas for scaling
5. **CDN Integration**: Cache static assets
6. **Load Balancing**: Multiple backend instances

## 📊 Monitoring and Observability

### Current Logging
- **FastAPI Logs**: Request/response logging
- **Database Errors**: Connection and query error logging
- **API Errors**: External API failure logging

### Recommended Additions
- **Performance Metrics**: Response time tracking
- **Error Rates**: Monitor error frequency
- **Database Performance**: Query execution time
- **User Analytics**: Feature usage tracking

## 🔄 Development Workflow Design

### Hot Reload Strategy
- **Backend**: Uvicorn auto-reload for Python files
- **Frontend**: Vite HMR for React components
- **Database**: No restart needed for schema changes

### Debug Tools
- **API Documentation**: Auto-generated with FastAPI
- **Debug Endpoints**: Comprehensive debugging routes
- **Error Responses**: Detailed error information in development

### Testing Strategy
- **Manual Testing**: Debug endpoints for backend testing
- **Browser DevTools**: Frontend state inspection
- **API Testing**: Direct curl commands for API validation

This design prioritizes **reliability**, **accuracy**, and **developer experience** while maintaining the flexibility to handle the complex requirements of dual-platform event management. 