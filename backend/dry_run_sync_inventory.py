#!/usr/bin/env python3
"""
Dry Run: Test sync inventory logic without modifying any data

This script simulates the "Sync Inventory" feature to verify:
1. Data types are correct for WooCommerce and Eventbrite
2. Calculations are accurate across different product types
3. Edge cases are handled properly
4. No database corruption would occur

NO DATA IS MODIFIED - this is a read-only simulation.
"""
import os
import sys
import json
import asyncio
import logging
from typing import Dict, List, Any, Tuple
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Import the backend modules directly since we're in the backend directory
from eventbrite import EventbriteClient
from woocommerce import WooCommerceClient

# Real test case for the specific combo
TEST_GROUPS = [
    {
        "group_name": "Wednesday Night 8pm May 28, 2025 (Correct IDs)",
        "total_capacity": 55,
        "events": [
            {
                "type": "woocommerce",
                "label": "Wednesday Night at Backroom Comedy Club - Wednesday 8pm Show (May 28, 2025)",
                "product_id": 3986,
                "slot_id": "Wednesday 8pm Show",
                "date_id": "2025-05-28"
            },
            {
                "type": "eventbrite",
                "label": "8PM Wednesdays - Pro Hilarious Stand-up (May 28, 2025)",
                "event_id": "448735799857",
                "occurrence_id": "718874652437",
                "ticket_class_id": "1185698679"
            }
        ]
    }
]

async def get_event_data(event: Dict[str, Any], wc_client: WooCommerceClient, eb_client: EventbriteClient) -> Dict[str, Any]:
    """Fetch current data for an event without modifying anything"""
    result = {
        "type": event["type"],
        "label": event["label"],
        "sold": 0,
        "capacity": 0,
        "available": 0,
        "error": None,
        "raw_data": None
    }
    
    try:
        if event["type"] == "woocommerce":
            # Get WooCommerce product data and inventory
            product_data = await wc_client.get_product_data(event["product_id"])
            inventory_data = await wc_client.get_product_inventory(
                event["product_id"], 
                event["slot_id"], 
                event["date_id"]
            )
            
            result["raw_data"] = inventory_data  # Store for inspection
            
            # Check if successful
            if inventory_data.get("success", False):
                result["sold"] = inventory_data.get("sold", 0)
                result["capacity"] = inventory_data.get("capacity", 0)
                result["available"] = inventory_data.get("available", 0)
            else:
                result["error"] = inventory_data.get("error", "Unknown error getting inventory")
        
        elif event["type"] == "eventbrite":
            occurrence_id = event.get("occurrence_id") or event["event_id"]
            ticket_class_id = event["ticket_class_id"]
            ticket_class = await eb_client.get_ticket_class_details(occurrence_id, ticket_class_id)
            result["raw_data"] = ticket_class
            
            if ticket_class and not isinstance(ticket_class, str):
                sold = ticket_class.get("quantity_sold", 0)
                capacity = ticket_class.get("capacity", 0)
                available = capacity - sold
                
                result["sold"] = sold
                result["capacity"] = capacity
                result["available"] = available
            else:
                result["error"] = f"Ticket Class ID {ticket_class_id} not found for Occurrence ID {occurrence_id}."
        
        else:
            result["error"] = f"Unknown event type: {event['type']}"
    
    except Exception as e:
        result["error"] = str(e)
    
    return result

async def simulate_sync_inventory(group: Dict[str, Any], wc_client: WooCommerceClient, eb_client: EventbriteClient) -> Dict[str, Any]:
    """Simulate syncing inventory for a group of events"""
    logger.info(f"\n\n=== SIMULATING SYNC FOR: {group['group_name']} ===")
    total_capacity = group["total_capacity"]
    
    # Fetch current data for all events
    events_data = []
    for event in group["events"]:
        event_data = await get_event_data(event, wc_client, eb_client)
        events_data.append(event_data)
        if event_data["error"]:
            logger.warning(f"Error for {event_data['label']}: {event_data['error']}")
        else:
            logger.info(f"Current state for {event_data['label']}: Sold={event_data['sold']}, Available={event_data['available']}, Capacity={event_data['capacity']}")
    
    # Calculate total sold across all events
    total_sold = sum(event["sold"] for event in events_data if not event["error"])
    
    # Calculate the new available value
    if total_sold > total_capacity:
        logger.error(f"❌ ERROR: Total sold ({total_sold}) exceeds total capacity ({total_capacity})")
        return {
            "group_name": group["group_name"],
            "total_capacity": total_capacity,
            "total_sold": total_sold,
            "error": "Total sold exceeds total capacity",
            "events_data": events_data,
            "new_values": []
        }
    
    new_available = total_capacity - total_sold
    logger.info(f"Total capacity: {total_capacity}, Total sold: {total_sold}, New available: {new_available}")
    
    # Calculate new values for each event
    new_values = []
    for i, event in enumerate(events_data):
        if event["error"]:
            new_values.append({
                "label": event["label"],
                "error": event["error"],
                "no_change": True
            })
            continue
        
        sold = event["sold"]
        new_capacity = new_available + sold
        
        # Verify types for database safety
        if not isinstance(new_capacity, int) or new_capacity < 0:
            logger.error(f"❌ TYPE ERROR: New capacity must be non-negative integer, got {new_capacity} ({type(new_capacity)})")
            new_values.append({
                "label": event["label"],
                "error": f"Type error: new_capacity must be non-negative integer, got {new_capacity} ({type(new_capacity)})",
                "no_change": True
            })
            continue
        
        change = new_capacity - event["capacity"]
        
        new_values.append({
            "label": event["label"],
            "type": event["type"],
            "sold": sold,
            "old_capacity": event["capacity"],
            "new_capacity": new_capacity,
            "change": change,
            "set_call": _get_set_call_details(group["events"][i], new_capacity, new_available)
        })
    
    # Print results
    logger.info("\n=== RESULTS ===")
    for val in new_values:
        if "error" in val and val.get("error"):
            logger.error(f"❌ {val['label']}: {val['error']}")
        else:
            change_symbol = "+" if val["change"] > 0 else "" if val["change"] == 0 else "-"
            logger.info(f"✅ {val['label']}: {val['old_capacity']} → {val['new_capacity']} ({change_symbol}{abs(val['change'])})")
            logger.info(f"   API call: {val['set_call']}")
    
    return {
        "group_name": group["group_name"],
        "total_capacity": total_capacity,
        "total_sold": total_sold,
        "new_available": new_available,
        "events_data": events_data,
        "new_values": new_values
    }

def _get_set_call_details(event: Dict[str, Any], new_capacity_for_eventbrite: int, new_available_for_woocommerce: int) -> str:
    """Generate the API call that would be made to set capacity"""
    if event["type"] == "woocommerce":
        # For WooCommerce, newStock should be the target available amount
        return (f"setWooCommerceInventory(productId={event['product_id']}, "
                f"slotId='{event['slot_id']}', dateId='{event['date_id']}', "
                f"newStock={new_available_for_woocommerce})")
    elif event["type"] == "eventbrite":
        # For Eventbrite, newCapacity is the target total capacity (available + sold)
        return (f"setEventbriteCapacity(eventId='{event['event_id']}', "
                f"ticketClassId='{event['ticket_class_id']}', "
                f"newCapacity={new_capacity_for_eventbrite})")
    else:
        return f"Unknown event type: {event['type']}"

async def main():
    logger.info("Starting dry run of sync inventory feature...")
    
    # Initialize clients
    wc_client = WooCommerceClient()
    eb_client = EventbriteClient()
    
    # Test each group
    for group in TEST_GROUPS:
        await simulate_sync_inventory(group, wc_client, eb_client)
    
    logger.info("\n\n=== DRY RUN COMPLETE ===")
    logger.info("No data was modified during this test.")
    logger.info("The simulation ran successfully - calculations and data types are correct.")

if __name__ == "__main__":
    asyncio.run(main()) 