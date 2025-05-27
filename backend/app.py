"""
FastAPI backend for Eventbrite Capacity Manager and WooCommerce FooEvents
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from eventbrite import EventbriteClient, EventbriteAPIError
from woocommerce import WooCommerceClient, WooCommerceAPIError

app = FastAPI(title="Eventbrite Capacity Manager & WooCommerce FooEvents", version="1.0.0")

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Default values from environment or hardcoded
DEFAULT_EVENT_ID = os.getenv('DEFAULT_EVENT_ID', '1219650199579')
DEFAULT_TICKET_CLASS_ID = os.getenv('DEFAULT_TICKET_CLASS_ID', '2183507083')

# Pydantic models for request/response
class CapacityRequest(BaseModel):
    event_id: Optional[str] = None
    ticket_class_id: Optional[str] = None

class CapacityResponse(BaseModel):
    success: bool
    message: str
    data: dict

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Eventbrite Capacity Manager API is running"}

@app.get("/capacity")
async def get_capacity(event_id: Optional[str] = None, ticket_class_id: Optional[str] = None):
    """Get current capacity for a ticket class"""
    try:
        # Use defaults if not provided
        event_id = event_id or DEFAULT_EVENT_ID
        ticket_class_id = ticket_class_id or DEFAULT_TICKET_CLASS_ID
        
        client = EventbriteClient()
        result = await client.get_current_capacity(event_id, ticket_class_id)
        
        return CapacityResponse(
            success=True,
            message="Successfully retrieved current capacity",
            data=result
        )
    except EventbriteAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/capacity/increment")
async def increment_capacity(request: CapacityRequest):
    """Increment capacity by 1"""
    try:
        # Use defaults if not provided
        event_id = request.event_id or DEFAULT_EVENT_ID
        ticket_class_id = request.ticket_class_id or DEFAULT_TICKET_CLASS_ID
        
        client = EventbriteClient()
        result = await client.increment_capacity(event_id, ticket_class_id)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully incremented capacity from {result['old_capacity']} to {result['new_capacity']}",
            data=result
        )
    except EventbriteAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/capacity/decrement")
async def decrement_capacity(request: CapacityRequest):
    """Decrement capacity by 1"""
    try:
        # Use defaults if not provided
        event_id = request.event_id or DEFAULT_EVENT_ID
        ticket_class_id = request.ticket_class_id or DEFAULT_TICKET_CLASS_ID
        
        client = EventbriteClient()
        result = await client.decrement_capacity(event_id, ticket_class_id)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully decremented capacity from {result['old_capacity']} to {result['new_capacity']}",
            data=result
        )
    except EventbriteAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/series")
async def get_organization_series():
    """Get all event series for the organization that are currently on sale (uses cache by default)"""
    try:
        client = EventbriteClient()
        result = await client.get_organization_series(use_cache=True)
        
        cache_source = result.get('cache_source', 'unknown')
        cache_age = result.get('cache_age_minutes', 0)
        
        message = f"Successfully retrieved {result['total_series_count']} series with {result['total_events_on_sale']} events on sale"
        if cache_source == 'cache':
            message += f" (from cache, {cache_age} minutes old)"
        else:
            message += " (fresh from API)"
        
        return CapacityResponse(
            success=True,
            message=message,
            data=result
        )
    except EventbriteAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/series/sync")
async def sync_organization_series():
    """Force refresh of event series data from Eventbrite API"""
    try:
        client = EventbriteClient()
        result = await client.get_organization_series(use_cache=False)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully synced {result['total_series_count']} series with {result['total_events_on_sale']} events on sale from Eventbrite API",
            data=result
        )
    except EventbriteAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/series/cache-info")
async def get_cache_info():
    """Get information about the current series cache"""
    try:
        client = EventbriteClient()
        cache_info = client.get_cache_info()
        
        return CapacityResponse(
            success=True,
            message="Cache information retrieved",
            data=cache_info
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/events/{event_id}/ticket-classes")
async def get_ticket_classes(event_id: str):
    """Get all ticket classes for a specific event"""
    try:
        client = EventbriteClient()
        result = await client.get_all_ticket_classes(event_id)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully retrieved {result['total_count']} ticket classes",
            data=result
        )
    except EventbriteAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/config")
async def get_config():
    """Get current configuration (event ID and ticket class ID)"""
    return {
        "default_event_id": DEFAULT_EVENT_ID,
        "default_ticket_class_id": DEFAULT_TICKET_CLASS_ID,
        "has_private_token": bool(os.getenv('PRIVATE_TOKEN')),
        "has_woocommerce_credentials": bool(os.getenv('WOOCOMMERCE_CONSUMER_KEY') and os.getenv('WOOCOMMERCE_CONSUMER_SECRET')),
        "has_wordpress_db_credentials": bool(os.getenv('WORDPRESS_DB_USER') and os.getenv('WORDPRESS_DB_PASSWORD') and os.getenv('WORDPRESS_DB_NAME'))
    }

# WooCommerce / FooEvents endpoints

@app.get("/woocommerce/products")
async def get_woocommerce_products():
    """Get all WooCommerce FooEvents products with their booking data (uses cache by default)"""
    try:
        client = WooCommerceClient()
        result = await client.get_all_fooevents_products(use_cache=True)
        
        cache_source = result.get('cache_source', 'unknown')
        cache_age = result.get('cache_age_minutes', 0)
        
        message = f"Successfully retrieved {result['total_products']} products with {result['total_slots']} slots and {result['total_dates']} dates"
        if cache_source == 'cache':
            message += f" (from cache, {cache_age} minutes old)"
        else:
            message += " (fresh from API)"
        
        return CapacityResponse(
            success=True,
            message=message,
            data=result
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/woocommerce/products/sync")
async def sync_woocommerce_products():
    """Force refresh of WooCommerce products data from API"""
    try:
        client = WooCommerceClient()
        result = await client.get_all_fooevents_products(use_cache=False)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully synced {result['total_products']} products with {result['total_slots']} slots and {result['total_dates']} dates from WooCommerce API",
            data=result
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/woocommerce/products/cache-info")
async def get_woocommerce_cache_info():
    """Get information about the current WooCommerce products cache"""
    try:
        client = WooCommerceClient()
        cache_info = client.get_cache_info()
        
        return CapacityResponse(
            success=True,
            message="WooCommerce cache information retrieved",
            data=cache_info
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/woocommerce/products/{product_id}")
async def get_woocommerce_product(product_id: int):
    """Get a specific WooCommerce product with its FooEvents booking data"""
    try:
        client = WooCommerceClient()
        result = await client.get_product_inventory(product_id)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully retrieved product {product_id} data",
            data=result
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/woocommerce/products/{product_id}/slots/{slot_id}")
async def get_woocommerce_product_slot(product_id: int, slot_id: str):
    """Get a specific slot from a WooCommerce product"""
    try:
        client = WooCommerceClient()
        result = await client.get_product_inventory(product_id, slot_id=slot_id)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully retrieved slot {slot_id} from product {product_id}",
            data=result
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/woocommerce/products/{product_id}/slots/{slot_id}/dates/{date_id}")
async def get_woocommerce_product_date(product_id: int, slot_id: str, date_id: str):
    """Get a specific date from a specific slot of a WooCommerce product"""
    try:
        client = WooCommerceClient()
        result = await client.get_product_inventory(product_id, slot_id=slot_id, date_id=date_id)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully retrieved date {date_id} from slot {slot_id} of product {product_id}",
            data=result
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/woocommerce/wordpress-db-status")
async def get_wordpress_db_status():
    """Get WordPress database connection status"""
    try:
        client = WooCommerceClient()
        db_status = client.get_wordpress_db_status()
        
        return CapacityResponse(
            success=True,
            message="WordPress database status retrieved",
            data=db_status
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/woocommerce/debug/product/{product_id}")
async def debug_product(product_id: int):
    """Debug endpoint to check a specific product's data and FooEvents parsing"""
    try:
        wc_client = WooCommerceClient()
        
        # Get raw product data
        product_data = await wc_client.get_product_data(product_id)
        
        # Try to extract FooEvents data
        fooevents_data = wc_client.extract_fooevents_data(product_data)
        
        # Try to format slots if FooEvents data exists
        formatted_slots = None
        debug_info = {}
        
        if fooevents_data:
            formatted_slots = wc_client.format_booking_slots(product_data, fooevents_data)
            
            # Add debug info for the first slot
            if fooevents_data:
                first_slot_id = list(fooevents_data.keys())[0]
                first_slot = fooevents_data[first_slot_id]
                debug_info = {
                    "first_slot_id": first_slot_id,
                    "first_slot_data": first_slot,
                    "has_add_date": "add_date" in first_slot,
                    "add_date_value": first_slot.get("add_date"),
                    "keys_ending_with_add_date": [k for k in first_slot.keys() if k.endswith("_add_date")],
                    "keys_ending_with_stock": [k for k in first_slot.keys() if k.endswith("_stock")]
                }
        
        return {
            "product_id": product_id,
            "product_name": product_data.get('name'),
            "has_meta_data": bool(product_data.get('meta_data')),
            "meta_data_count": len(product_data.get('meta_data', [])),
            "has_fooevents_data": bool(fooevents_data),
            "fooevents_slots_count": len(fooevents_data) if fooevents_data else 0,
            "formatted_slots_count": len(formatted_slots) if formatted_slots else 0,
            "fooevents_raw": fooevents_data,
            "formatted_slots": formatted_slots,
            "meta_data_keys": [meta.get('key') for meta in product_data.get('meta_data', [])],
            "debug_info": debug_info
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "product_id": product_id
        }

@app.get("/woocommerce/debug/wordpress-tickets/{product_id}")
async def debug_wordpress_tickets(product_id: int):
    """Debug endpoint to check WordPress database tickets for a specific product"""
    try:
        wc_client = WooCommerceClient()
        
        # Check if we have WordPress DB connection
        if not wc_client.wp_db_available or not wc_client.wp_db:
            return {
                "error": "WordPress database not available",
                "product_id": product_id
            }
        
        # Get all tickets for this product from WordPress database
        tickets = wc_client.wp_db.get_all_tickets_for_product(product_id)
        
        # Group tickets by slot and date for analysis
        ticket_analysis = {}
        for ticket in tickets:
            slot = ticket.get('slot', 'Unknown')
            date = ticket.get('date', 'Unknown')
            
            if slot not in ticket_analysis:
                ticket_analysis[slot] = {}
            if date not in ticket_analysis[slot]:
                ticket_analysis[slot][date] = []
            
            ticket_analysis[slot][date].append(ticket)
        
        return {
            "product_id": product_id,
            "total_tickets_found": len(tickets),
            "raw_tickets": tickets,
            "ticket_analysis": ticket_analysis,
            "unique_slots": list(set(t.get('slot', 'Unknown') for t in tickets)),
            "unique_dates": list(set(t.get('date', 'Unknown') for t in tickets))
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "product_id": product_id
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 