"""
FastAPI backend for Eventbrite Capacity Manager and WooCommerce FooEvents
"""

import os
from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from eventbrite import EventbriteClient, EventbriteAPIError
from woocommerce import WooCommerceClient, WooCommerceAPIError
from event_mappings import EventMappingManager, EventMapping, UnmappedEvent
import logging
import traceback # Import traceback for more detailed logging if needed, though exc_info=True should suffice

app = FastAPI(title="Eventbrite Capacity Manager & WooCommerce FooEvents", version="1.0.0")

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
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

class WooCommerceInventoryRequest(BaseModel):
    product_id: int
    slot_id: Optional[str] = None
    date_id: Optional[str] = None

class CapacityResponse(BaseModel):
    success: bool
    message: str
    data: dict

# Mapping-related Pydantic models
class CreateMappingRequest(BaseModel):
    woocommerce_product_id: str
    eventbrite_series_ids: List[str]
    name: str

class UpdateMappingRequest(BaseModel):
    name: Optional[str] = None
    woocommerce_product_id: Optional[str] = None
    eventbrite_series_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None

class SendToCompareRequest(BaseModel):
    mapping_id: str

class SetWooCommerceInventoryRequest(BaseModel):
    product_id: int
    slot_id: Optional[str] = None
    date_id: Optional[str] = None
    new_stock: int

class SetEventbriteCapacityRequest(BaseModel):
    event_id: str
    ticket_class_id: str
    new_capacity: int

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

@app.post("/capacity/set")
async def set_eventbrite_capacity(request: SetEventbriteCapacityRequest):
    """Set Eventbrite ticket class capacity to a specific value for an event/ticket class"""
    try:
        logging.info(f"[SET CAPACITY] event_id={request.event_id}, ticket_class_id={request.ticket_class_id}, new_capacity={request.new_capacity}")
        if request.new_capacity < 0:
            logging.error("Capacity must be non-negative")
            raise HTTPException(status_code=400, detail="Capacity must be non-negative")
        client = EventbriteClient()
        ticket_class = await client.get_ticket_class_details(request.event_id, request.ticket_class_id)
        if not ticket_class:
            logging.error("Ticket class not found")
            raise HTTPException(status_code=404, detail="Ticket class not found")
        current_capacity = ticket_class.get('capacity')
        if not isinstance(current_capacity, int):
            logging.error(f"Current capacity is not a number: {current_capacity}")
            raise HTTPException(status_code=400, detail="Current capacity is not a number")
        tickets_sold = ticket_class.get("quantity_sold", 0)
        if request.new_capacity < tickets_sold:
            logging.error(f"Cannot set below tickets sold ({tickets_sold})")
            raise HTTPException(status_code=400, detail=f"Cannot set below tickets sold ({tickets_sold})")
        # Set capacity
        try:
            result = await client.update_ticket_class_capacity(request.event_id, request.ticket_class_id, request.new_capacity)
        except Exception as e:
            logging.error(f"Error updating capacity: {e}")
            raise HTTPException(status_code=500, detail=f"Error updating capacity: {e}")
        if not result:
            logging.error(f"Update failed: {result}")
            raise HTTPException(status_code=500, detail=f"Update failed: {result}")
        # Get updated ticket class details
        updated_ticket_class = await client.get_ticket_class_details(request.event_id, request.ticket_class_id)
        new_capacity = updated_ticket_class.get('capacity')
        quantity_sold = updated_ticket_class.get('quantity_sold', 0)
        available = new_capacity - quantity_sold if new_capacity is not None else None
        logging.info(f"[SET CAPACITY SUCCESS] old_capacity={current_capacity}, new_capacity={new_capacity}")
        return {
            "success": True,
            "message": f"Capacity set to {request.new_capacity}",
            "data": {
                "old_capacity": current_capacity,
                "new_capacity": new_capacity,
                "quantity_sold": quantity_sold,
                "available": available,
                "ticket_class_name": ticket_class.get('name'),
                "ticket_class_id": ticket_class.get('id'),
                "event_id": request.event_id,
                "api_response": result
            }
        }
    except HTTPException as e:
        raise
    except Exception as e:
        logging.error(f"Unhandled error in /capacity/set: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/series/refresh")
async def refresh_organization_series():
    """Force refresh of event series data from Eventbrite API"""
    try:
        client = EventbriteClient()
        result = await client.refresh_organization_series()
        
        return CapacityResponse(
            success=True,
            message=f"Successfully refreshed {result['total_series_count']} series with {result['total_events_on_sale']} events on sale from Eventbrite API",
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

@app.post("/woocommerce/products/refresh")
async def refresh_woocommerce_products():
    """Force refresh of WooCommerce products data from API"""
    try:
        client = WooCommerceClient()
        # Corrected method call: get_all_fooevents_products with use_cache=False
        result = await client.get_all_fooevents_products(use_cache=False, use_discovery=True)
        
        return CapacityResponse(
            success=True,
            message=f"Successfully refreshed {result['total_products']} products with {result['total_slots']} slots and {result['total_dates']} dates from WooCommerce API",
            data=result
        )
    except WooCommerceAPIError as e:
        logging.error(f"WooCommerceAPIError in /woocommerce/products/refresh: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e: # Generic exception handler
        logging.error(f"Unhandled exception in /woocommerce/products/refresh: {e}", exc_info=True) # Log the full traceback
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

@app.post("/woocommerce/inventory/increment")
async def increment_woocommerce_inventory(request: WooCommerceInventoryRequest):
    """Increment WooCommerce inventory by 1"""
    try:
        client = WooCommerceClient()
        result = await client.increment_woocommerce_inventory(
            request.product_id, 
            request.slot_id, 
            request.date_id
        )
        
        return CapacityResponse(
            success=True,
            message=f"Successfully incremented inventory from {result.get('old_stock_available', 'N/A')} to {result.get('new_stock_available', 'N/A')}",
            data=result
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/woocommerce/inventory/decrement")
async def decrement_woocommerce_inventory(request: WooCommerceInventoryRequest):
    """Decrement WooCommerce inventory by 1"""
    try:
        client = WooCommerceClient()
        result = await client.decrement_woocommerce_inventory(
            request.product_id, 
            request.slot_id, 
            request.date_id
        )
        
        return CapacityResponse(
            success=True,
            message=f"Successfully decremented inventory from {result.get('old_stock_available', 'N/A')} to {result.get('new_stock_available', 'N/A')}",
            data=result
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
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
        
        woo_commerce_events_event_value = None
        if product_data.get('meta_data'):
            for meta_item in product_data['meta_data']:
                if meta_item.get('key') == 'WooCommerceEventsEvent':
                    woo_commerce_events_event_value = meta_item.get('value')
                    break
        
        return {
            "product_id": product_id,
            "product_name": product_data.get('name'),
            "has_meta_data": bool(product_data.get('meta_data')),
            "meta_data_count": len(product_data.get('meta_data', [])),
            "WooCommerceEventsEvent_value": woo_commerce_events_event_value, # Added this line
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

@app.post("/woocommerce/inventory/set")
async def set_woocommerce_inventory(request: SetWooCommerceInventoryRequest):
    """Set WooCommerce inventory to a specific value for a product/slot/date"""
    try:
        client = WooCommerceClient()
        # Get current inventory info for validation
        current_info = await client.get_product_inventory(request.product_id, request.slot_id, request.date_id)
        tickets_sold = 0
        if 'tickets_sold' in current_info:
            try:
                tickets_sold = int(current_info['tickets_sold'])
            except Exception:
                tickets_sold = 0
        if request.new_stock < 0:
            raise HTTPException(status_code=400, detail="New stock must be non-negative")
        if request.new_stock < tickets_sold:
            raise HTTPException(status_code=400, detail=f"New stock ({request.new_stock}) cannot be less than tickets sold ({tickets_sold})")
        # Reuse update logic from increment/decrement
        result = await client.set_woocommerce_inventory(request.product_id, request.slot_id, request.date_id, request.new_stock)
        return CapacityResponse(
            success=True,
            message=f"Successfully set inventory to {request.new_stock}",
            data=result
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/woocommerce/refresh")
async def refresh_woocommerce(
    product_id: int = Query(..., description="WooCommerce product ID"),
    slot_id: Optional[str] = Query(None, description="Slot ID (optional)"),
    date_id: Optional[str] = Query(None, description="Date ID (optional)")
):
    """
    Force refresh of WooCommerce product/slot/date from API (not cache).
    Returns the same structure as the existing product/slot/date endpoints.
    """
    try:
        client = WooCommerceClient()
        # Always use fresh API data
        product_data = await client.get_product_data(product_id)
        booking_data = client.extract_fooevents_data(product_data)
        if not booking_data:
            raise WooCommerceAPIError(f"No FooEvents data found for product {product_id}")
        formatted_slots = client.format_booking_slots(product_data, booking_data)
        # Filter slots/dates if needed
        if slot_id:
            filtered_slots = [s for s in formatted_slots if s['slot_id'] == slot_id]
            if date_id and filtered_slots:
                for slot in filtered_slots:
                    slot['dates'] = [d for d in slot['dates'] if d['date_id'] == date_id]
            formatted_slots = filtered_slots
        product_result = {
            'product_id': product_id,
            'product_name': product_data.get('name'),
            'product_price': product_data.get('price', '0'),
            'total_sales': product_data.get('total_sales', 0),
            'slots': formatted_slots,
            'slot_count': len(formatted_slots)
        }
        return CapacityResponse(
            success=True,
            message=f"Refreshed product {product_id}",
            data={
                'products': [product_result],
                'total_products': 1,
                'total_slots': len(formatted_slots),
                'total_dates': sum(len(s['dates']) for s in formatted_slots)
            }
        )
    except WooCommerceAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Event Mapping endpoints

@app.get("/mappings")
async def get_all_mappings():
    """Get all event mappings (manual fallback, programmatic, and user overrides) and unmapped events"""
    try:
        mapping_manager = EventMappingManager()
        
        # Get data from both platforms for programmatic matching
        eventbrite_client = EventbriteClient()
        woocommerce_client = WooCommerceClient()
        
        # Get series and products data
        series_result = await eventbrite_client.get_organization_series(use_cache=True)
        products_result = await woocommerce_client.get_all_fooevents_products(use_cache=True)
        
        series_data = series_result.get('series', [])
        products_data = products_result.get('products', [])
        
        # Get all mappings and unmapped events
        all_mappings = mapping_manager.get_all_mappings(products_data, series_data)
        unmapped_events = mapping_manager.get_unmapped_events(products_data, series_data)
        
        # Convert to dict format for JSON response
        mappings_data = [
            {
                'id': mapping.id,
                'name': mapping.name,
                'woocommerce_product_id': mapping.woocommerce_product_id,
                'eventbrite_series_ids': mapping.eventbrite_series_ids,
                'mapping_source': mapping.mapping_source,
                'is_active': mapping.is_active,
                'last_updated': mapping.last_updated
            }
            for mapping in all_mappings
        ]
        
        unmapped_data = [
            {
                'id': event.id,
                'platform': event.platform,
                'name': event.name,
                'product_id': event.product_id,
                'series_id': event.series_id,
                'reason': event.reason
            }
            for event in unmapped_events
        ]
        
        return CapacityResponse(
            success=True,
            message=f"Retrieved {len(mappings_data)} mappings and {len(unmapped_data)} unmapped events",
            data={
                'mappings': mappings_data,
                'unmapped_events': unmapped_data,
                'summary': {
                    'total_mappings': len(mappings_data),
                    'manual_fallback_count': len([m for m in mappings_data if m['mapping_source'] == 'manual_fallback']),
                    'programmatic_count': len([m for m in mappings_data if m['mapping_source'] == 'programmatic']),
                    'user_override_count': len([m for m in mappings_data if m['mapping_source'] == 'user_override']),
                    'total_unmapped': len(unmapped_data),
                    'unmapped_woocommerce': len([e for e in unmapped_data if e['platform'] == 'woocommerce']),
                    'unmapped_eventbrite': len([e for e in unmapped_data if e['platform'] == 'eventbrite'])
                }
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/mappings/{mapping_id}")
async def get_mapping(mapping_id: str):
    """Get a specific mapping by ID"""
    try:
        mapping_manager = EventMappingManager()
        mapping = mapping_manager.get_mapping_by_id(mapping_id)
        
        if not mapping:
            raise HTTPException(status_code=404, detail=f"Mapping with ID {mapping_id} not found")
        
        mapping_data = {
            'id': mapping.id,
            'name': mapping.name,
            'woocommerce_product_id': mapping.woocommerce_product_id,
            'eventbrite_series_ids': mapping.eventbrite_series_ids,
            'mapping_source': mapping.mapping_source,
            'is_active': mapping.is_active,
            'last_updated': mapping.last_updated
        }
        
        return CapacityResponse(
            success=True,
            message=f"Retrieved mapping {mapping_id}",
            data=mapping_data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/mappings")
async def create_mapping(request: CreateMappingRequest):
    """Create a new user override mapping"""
    try:
        mapping_manager = EventMappingManager()
        
        mapping = mapping_manager.create_user_mapping(
            woocommerce_product_id=request.woocommerce_product_id,
            eventbrite_series_ids=request.eventbrite_series_ids,
            name=request.name
        )
        
        mapping_data = {
            'id': mapping.id,
            'name': mapping.name,
            'woocommerce_product_id': mapping.woocommerce_product_id,
            'eventbrite_series_ids': mapping.eventbrite_series_ids,
            'mapping_source': mapping.mapping_source,
            'is_active': mapping.is_active,
            'last_updated': mapping.last_updated
        }
        
        return CapacityResponse(
            success=True,
            message=f"Created new mapping {mapping.id}",
            data=mapping_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.put("/mappings/{mapping_id}")
async def update_mapping(mapping_id: str, request: UpdateMappingRequest):
    """Update an existing mapping"""
    try:
        mapping_manager = EventMappingManager()
        
        # Convert request to dict, excluding None values
        update_data = {k: v for k, v in request.dict().items() if v is not None}
        
        mapping = mapping_manager.update_mapping(mapping_id, **update_data)
        
        if not mapping:
            raise HTTPException(status_code=404, detail=f"Mapping with ID {mapping_id} not found")
        
        mapping_data = {
            'id': mapping.id,
            'name': mapping.name,
            'woocommerce_product_id': mapping.woocommerce_product_id,
            'eventbrite_series_ids': mapping.eventbrite_series_ids,
            'mapping_source': mapping.mapping_source,
            'is_active': mapping.is_active,
            'last_updated': mapping.last_updated
        }
        
        return CapacityResponse(
            success=True,
            message=f"Updated mapping {mapping_id}",
            data=mapping_data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.delete("/mappings/{mapping_id}")
async def delete_mapping(mapping_id: str):
    """Delete a user override mapping"""
    try:
        mapping_manager = EventMappingManager()
        
        success = mapping_manager.delete_mapping(mapping_id)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"User override mapping with ID {mapping_id} not found")
        
        return CapacityResponse(
            success=True,
            message=f"Deleted mapping {mapping_id}",
            data={'deleted_mapping_id': mapping_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/mappings/{mapping_id}/send-to-compare")
async def send_mapping_to_compare(mapping_id: str):
    """Prepare a mapping group for the comparison view"""
    try:
        mapping_manager = EventMappingManager()
        mapping = mapping_manager.get_mapping_by_id(mapping_id)
        
        if not mapping:
            raise HTTPException(status_code=404, detail=f"Mapping with ID {mapping_id} not found")
        
        # Get detailed data for comparison
        eventbrite_client = EventbriteClient()
        woocommerce_client = WooCommerceClient()
        
        # Get full WooCommerce product data
        wc_full_product = await woocommerce_client.get_product_inventory(int(mapping.woocommerce_product_id))
        
        # Get Eventbrite series data
        eb_series_data = []
        for series_id in mapping.eventbrite_series_ids:
            try:
                # Get from the cached series data
                series_result = await eventbrite_client.get_organization_series(use_cache=True)
                series_list = series_result.get('series', [])
                series_data = next((s for s in series_list if str(s['series_id']) == series_id), None)
                if series_data:
                    eb_series_data.append(series_data)
            except Exception as e:
                print(f"Error getting series {series_id}: {e}")
        
        # Select WooCommerce slot/date combinations to match number of Eventbrite series
        num_eventbrite_series = len(eb_series_data)
        selected_wc_combinations = []
        
        if wc_full_product and 'slots' in wc_full_product:
            slots = wc_full_product['slots']
            
            if num_eventbrite_series == 1:
                # Single mapping - select first slot, first date
                if slots and len(slots) > 0:
                    slot = slots[0]
                    if slot.get('dates') and len(slot['dates']) > 0:
                        # Sort dates by date string and pick first upcoming
                        dates = slot['dates']
                        dates_sorted = sorted(dates, key=lambda d: woocommerce_client._parse_date(d.get('date', '')))
                        
                        selected_wc_combinations.append({
                            'product_id': wc_full_product['product_id'],
                            'product_name': wc_full_product['product_name'],
                            'slot_id': slot['slot_id'],
                            'slot_label': slot['slot_label'],
                            'slot_time': slot['slot_time'],
                            'date_id': dates_sorted[0]['date_id'],
                            'date': dates_sorted[0]['date'],
                            'stock': dates_sorted[0]['stock'],
                            'available': dates_sorted[0]['available'],
                            'total_capacity': dates_sorted[0]['total_capacity'],
                            'tickets_sold': dates_sorted[0]['tickets_sold']
                        })
            elif num_eventbrite_series > 1:
                # Multiple mappings - select first occurrence from multiple slots to match count
                slots_with_dates = []
                for slot in slots:
                    if slot.get('dates') and len(slot['dates']) > 0:
                        # Sort dates by date string and pick first upcoming for each slot
                        dates = slot['dates']
                        dates_sorted = sorted(dates, key=lambda d: woocommerce_client._parse_date(d.get('date', '')))
                        slots_with_dates.append((slot, dates_sorted[0]))
                
                # Sort slots by time if possible (8pm before 10pm)
                def extract_slot_hour(slot_time):
                    """Extract hour from slot time for sorting"""
                    if not slot_time:
                        return 99
                    slot_time_lower = slot_time.lower()
                    if '8' in slot_time_lower and 'pm' in slot_time_lower:
                        return 8
                    elif '10' in slot_time_lower and 'pm' in slot_time_lower:
                        return 10
                    # Try to extract number
                    import re
                    match = re.search(r'(\d{1,2})', slot_time_lower)
                    if match:
                        return int(match.group(1))
                    return 99
                
                slots_with_dates.sort(key=lambda x: extract_slot_hour(x[0].get('slot_time', '')))
                
                # Select up to num_eventbrite_series combinations
                for i in range(min(num_eventbrite_series, len(slots_with_dates))):
                    slot, first_date = slots_with_dates[i]
                    selected_wc_combinations.append({
                        'product_id': wc_full_product['product_id'],
                        'product_name': wc_full_product['product_name'],
                        'slot_id': slot['slot_id'],
                        'slot_label': slot['slot_label'],
                        'slot_time': slot['slot_time'],
                        'date_id': first_date['date_id'],
                        'date': first_date['date'],
                        'stock': first_date['stock'],
                        'available': first_date['available'],
                        'total_capacity': first_date['total_capacity'],
                        'tickets_sold': first_date['tickets_sold']
                    })
        
        comparison_data = {
            'mapping_id': mapping_id,
            'mapping_name': mapping.name,
            'woocommerce_combinations': selected_wc_combinations,
            'eventbrite_series': eb_series_data,
            'comparison_ready': True
        }
        
        return CapacityResponse(
            success=True,
            message=f"Prepared mapping {mapping_id} for comparison with {len(selected_wc_combinations)} WooCommerce combinations and {len(eb_series_data)} Eventbrite series",
            data=comparison_data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 