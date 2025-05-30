#!/usr/bin/env python3
"""
Emergency script to reset Eventbrite capacities for a specific date and day.

Sets the capacity of the first ticket class AND the overall event capacity
to 55 for ON-SALE events matching "Thursday" in the series name and
occurring on TARGET_DATE_STR.

Includes delays to mitigate API rate limiting.

It will skip updating an event if setting capacity to 55
would be less than the number of tickets already sold.

Usage:
python set_thursday_may29_capacity.py
python set_thursday_may29_capacity.py --dry-run
"""
import os
import sys
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

# Adjust path to import from parent directory (backend)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eventbrite import EventbriteClient, EventbriteAPIError

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

TARGET_CAPACITY = 55
TARGET_DATE_STR = "2025-05-29" # For Thursday, May 29, 2025
TARGET_DAY_KEYWORD = "thursday" # Case-insensitive check in series name
API_CALL_DELAY_SECONDS = 0.5 # Delay before most individual API calls
EVENT_PROCESSING_DELAY_SECONDS = 1.0 # Delay before processing each new event occurrence

async def get_event_details_for_overall_capacity(eb_client: EventbriteClient, event_id: str) -> Optional[Dict[str, Any]]:
    """Helper to fetch basic event details, primarily for current overall capacity."""
    try:
        await asyncio.sleep(API_CALL_DELAY_SECONDS) # Add delay
        url = f"{eb_client.base_url}/events/{event_id}/"
        # This should ideally use an async HTTP client if EventbriteClient is fully async.
        # For now, assuming EventbriteClient's own methods might have sync calls internally or this is acceptable.
        import requests 
        response = requests.get(url, headers=eb_client.headers)
        response.raise_for_status()
        data = response.json()
        if 'error' in data:
            logger.error(f"Error fetching event details for {event_id}: {data['error'].get('error_description')}")
            return None
        return data
    except Exception as e:
        logger.error(f"Exception fetching event details for {event_id}: {e}")
        return None

async def set_specific_date_capacities(dry_run: bool = False):
    logger.info(f"--- Starting Eventbrite Capacity Reset for {TARGET_DAY_KEYWORD.capitalize()} {TARGET_DATE_STR} ---")
    if dry_run:
        logger.info("*** DRY RUN MODE ENABLED: No actual changes will be made. ***")

    try:
        eb_client = EventbriteClient()
    except EventbriteAPIError as e:
        logger.error(f"Failed to initialize EventbriteClient: {e}")
        return

    updated_count = 0
    skipped_count = 0
    error_count = 0

    try:
        logger.info(f"Waiting {API_CALL_DELAY_SECONDS}s before fetching series data...")
        await asyncio.sleep(API_CALL_DELAY_SECONDS)
        series_data_response = await eb_client.get_organization_series(use_cache=False)
        all_series = series_data_response.get('series', [])
        if not all_series:
            logger.info("No series found.")
            return

        logger.info(f"Fetched {len(all_series)} series. Filtering for '{TARGET_DAY_KEYWORD.capitalize()}' on {TARGET_DATE_STR}...")

        for series in all_series:
            series_name = series.get('series_name', 'Unknown Series')
            
            if TARGET_DAY_KEYWORD not in series_name.lower():
                continue

            logger.info(f"\nChecking Series: '{series_name}' (ID: {series.get('series_id')})")
            events_in_series = series.get('events', [])

            for event_occurrence in events_in_series:
                occurrence_id = event_occurrence.get('occurrence_id')
                start_date_local = event_occurrence.get('start_date', '')
                
                if not occurrence_id:
                    logger.warning(f"  Skipping occurrence in series '{series_name}' due to missing occurrence_id.")
                    continue

                if not start_date_local.startswith(TARGET_DATE_STR):
                    continue
                
                logger.info(f"  Waiting {EVENT_PROCESSING_DELAY_SECONDS}s before processing next event occurrence...")
                await asyncio.sleep(EVENT_PROCESSING_DELAY_SECONDS)

                event_name_for_log = f"{series_name} (Occurrence {occurrence_id})"
                logger.info(f"  MATCH FOUND: Processing Event: '{event_name_for_log}'")

                try:
                    await asyncio.sleep(API_CALL_DELAY_SECONDS)
                    ticket_classes_data = await eb_client.get_all_ticket_classes(occurrence_id)
                    ticket_classes = ticket_classes_data.get('ticket_classes', [])

                    if not ticket_classes:
                        logger.warning(f"    No ticket classes found for event occurrence ID {occurrence_id}.")
                        error_count +=1
                        continue

                    target_ticket_class = ticket_classes[0]
                    ticket_class_id = target_ticket_class.get('id')
                    ticket_class_name = target_ticket_class.get('name', 'Unknown Ticket Class')
                    
                    if not ticket_class_id:
                        logger.error(f"    Could not find ID for the first ticket class of event {occurrence_id}.")
                        error_count += 1
                        continue
                    
                    await asyncio.sleep(API_CALL_DELAY_SECONDS)
                    detailed_tc = await eb_client.get_ticket_class_details(occurrence_id, ticket_class_id)
                    current_tc_capacity = detailed_tc.get('capacity')
                    quantity_sold = detailed_tc.get('quantity_sold', 0)

                    if not isinstance(current_tc_capacity, int):
                        logger.warning(f"    Current ticket class capacity for TC ID {ticket_class_id} (Event {occurrence_id}) is not an integer: '{current_tc_capacity}'. Skipping.")
                        skipped_count += 1
                        continue
                    
                    current_tc_available = current_tc_capacity - quantity_sold
                    new_tc_available_if_updated = TARGET_CAPACITY - quantity_sold

                    logger.info(f"    Ticket Class: '{ticket_class_name}' (ID: {ticket_class_id})")
                    logger.info(f"      Current TC Capacity: {current_tc_capacity}, Sold: {quantity_sold}, Available: {current_tc_available}")

                    if TARGET_CAPACITY < quantity_sold:
                        logger.error(f"      CANNOT UPDATE TICKET CLASS: Target capacity {TARGET_CAPACITY} is less than tickets sold {quantity_sold}. Skipping Event ID {occurrence_id}.")
                        skipped_count += 1
                        continue
                    
                    if current_tc_capacity == TARGET_CAPACITY:
                        logger.info(f"      Ticket class capacity is already {TARGET_CAPACITY}. No TC update needed.")
                    elif not dry_run:
                        logger.info(f"      Attempting to set ticket class capacity to {TARGET_CAPACITY} (new available: {new_tc_available_if_updated})...")
                        await asyncio.sleep(API_CALL_DELAY_SECONDS)
                        await eb_client.update_ticket_class_capacity(occurrence_id, ticket_class_id, TARGET_CAPACITY)
                        logger.info(f"      SUCCESS: Ticket class capacity set to {TARGET_CAPACITY}.")
                        updated_count +=1
                    else:
                        logger.info(f"      DRY RUN: Would set ticket class capacity from {current_tc_capacity} to {TARGET_CAPACITY} (new available: {new_tc_available_if_updated}).")
                        # No actual update, but count as an "action" for dry run summary
                        if current_tc_capacity != TARGET_CAPACITY : updated_count +=1


                    # Update Overall Event Capacity
                    event_details_for_overall = await get_event_details_for_overall_capacity(eb_client, occurrence_id) # Already has internal delay
                    current_event_overall_capacity = event_details_for_overall.get('capacity') if event_details_for_overall else "Unknown"
                    
                    logger.info(f"      Overall Event (ID: {occurrence_id}) Current Capacity: {current_event_overall_capacity}")

                    if not isinstance(current_event_overall_capacity, int) and current_event_overall_capacity != "Unknown":
                        logger.warning(f"      Current overall event capacity for Event ID {occurrence_id} is not an integer ({current_event_overall_capacity}). Skipping overall update.")
                    elif current_event_overall_capacity == TARGET_CAPACITY:
                        logger.info(f"      Overall event capacity is already {TARGET_CAPACITY}. No overall event update needed.")
                    elif not dry_run:
                        logger.info(f"      Attempting to set overall event capacity to {TARGET_CAPACITY}...")
                        await asyncio.sleep(API_CALL_DELAY_SECONDS)
                        await eb_client.update_event_overall_capacity(occurrence_id, TARGET_CAPACITY)
                        logger.info(f"      SUCCESS: Overall event capacity set to {TARGET_CAPACITY}.")
                        # updated_count already handled by TC logic or its dry run equivalent
                    else:
                        logger.info(f"      DRY RUN: Would set overall event capacity from {current_event_overall_capacity} to {TARGET_CAPACITY}.")
                        # updated_count already handled

                except EventbriteAPIError as e:
                    logger.error(f"    Eventbrite API Error processing event occurrence {occurrence_id}: {e}")
                    error_count += 1
                except Exception as e:
                    logger.error(f"    Unexpected error processing event occurrence {occurrence_id}: {e}", exc_info=True)
                    error_count += 1
            
    except EventbriteAPIError as e:
        logger.error(f"Failed to retrieve organization series: {e}")
        error_count += 1
    except Exception as e:
        logger.error(f"An unexpected error occurred during script execution: {e}", exc_info=True)
        error_count += 1
    finally:
        logger.info(f"\n--- Eventbrite Capacity Reset for {TARGET_DAY_KEYWORD.capitalize()} {TARGET_DATE_STR} Finished ---")
        if dry_run:
            logger.info(f"Dry Run Summary: Events that would be processed/changed: {updated_count}, Skipped (e.g. sold out, already target): {skipped_count}, Errors: {error_count}")
        else:
            logger.info(f"Actual Run Summary: Events updated: {updated_count}, Skipped: {skipped_count}, Errors: {error_count}")

if __name__ == "__main__":
    is_dry_run = "--dry-run" in sys.argv
    asyncio.run(set_specific_date_capacities(dry_run=is_dry_run))