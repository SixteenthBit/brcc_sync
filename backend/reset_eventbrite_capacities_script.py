#!/usr/bin/env python3
"""
Emergency script to reset Eventbrite event capacities.

Sets the capacity of the first ticket class AND the overall event capacity
to 55 for all ON-SALE events.

It will skip updating an event's ticket class if setting capacity to 55
would be less than the number of tickets already sold for that class.
The overall event capacity update will also be skipped if the ticket class
update is skipped for this reason.

Usage:
python reset_eventbrite_capacities_script.py
python reset_eventbrite_capacities_script.py --dry-run
"""
import os
import sys
import asyncio
import logging
from typing import Dict, Any, Optional, List

# Adjust path to import from parent directory (backend)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eventbrite import EventbriteClient, EventbriteAPIError

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

TARGET_CAPACITY = 55

async def get_event_details_for_overall_capacity(eb_client: EventbriteClient, event_id: str) -> Optional[Dict[str, Any]]:
    """Helper to fetch basic event details, primarily for current overall capacity."""
    try:
        url = f"{eb_client.base_url}/events/{event_id}/"
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


async def reset_capacities(dry_run: bool = False):
    logger.info(f"--- Starting Eventbrite Capacity Reset ---")
    if dry_run:
        logger.info("*** DRY RUN MODE ENABLED: No actual changes will be made. ***")

    try:
        eb_client = EventbriteClient()
    except EventbriteAPIError as e:
        logger.error(f"Failed to initialize EventbriteClient: {e}")
        return

    try:
        series_data_response = await eb_client.get_organization_series(use_cache=False)
        all_series = series_data_response.get('series', [])
        if not all_series:
            logger.info("No series found. Ensure Eventbrite API is reachable and series exist.")
            return

        logger.info(f"Fetched {len(all_series)} series. Processing on-sale events...")
        processed_event_occurrence_ids = set()

        for series in all_series:
            series_name = series.get('series_name', 'Unknown Series')
            events_in_series = series.get('events', [])
            logger.info(f"\nProcessing Series: '{series_name}' (ID: {series.get('series_id')}) with {len(events_in_series)} occurrences.")

            for event_occurrence in events_in_series:
                occurrence_id = event_occurrence.get('occurrence_id')
                event_name_for_log = f"{series_name} (Occurrence)" 
                
                if not occurrence_id:
                    logger.warning(f"Skipping occurrence in series '{series_name}' due to missing occurrence_id.")
                    continue

                if occurrence_id in processed_event_occurrence_ids:
                    logger.debug(f"Skipping already processed occurrence ID: {occurrence_id} for event '{event_name_for_log}'")
                    continue
                
                processed_event_occurrence_ids.add(occurrence_id)
                logger.info(f"  Processing Event Occurrence: '{event_name_for_log}' (ID: {occurrence_id})")

                try:
                    ticket_classes_data = await eb_client.get_all_ticket_classes(occurrence_id)
                    ticket_classes = ticket_classes_data.get('ticket_classes', [])

                    if not ticket_classes:
                        logger.warning(f"    No ticket classes found for event occurrence ID {occurrence_id}.")
                        continue

                    target_ticket_class = ticket_classes[0]
                    ticket_class_id = target_ticket_class.get('id')
                    ticket_class_name = target_ticket_class.get('name', 'Unknown Ticket Class')
                    
                    if not ticket_class_id:
                        logger.error(f"    Could not find ID for the first ticket class of event {occurrence_id}.")
                        continue

                    detailed_tc = await eb_client.get_ticket_class_details(occurrence_id, ticket_class_id)
                    
                    current_tc_capacity = detailed_tc.get('capacity')
                    quantity_sold = detailed_tc.get('quantity_sold', 0)

                    if not isinstance(current_tc_capacity, int):
                        logger.warning(f"    Current ticket class capacity for TC ID {ticket_class_id} is not an integer ({current_tc_capacity}). Skipping update for this ticket class.")
                        continue
                    
                    current_tc_available = current_tc_capacity - quantity_sold
                    new_tc_available = TARGET_CAPACITY - quantity_sold

                    logger.info(f"    Ticket Class: '{ticket_class_name}' (ID: {ticket_class_id})")
                    logger.info(f"      Current TC Capacity: {current_tc_capacity}, Sold: {quantity_sold}, Available: {current_tc_available}")

                    if TARGET_CAPACITY < quantity_sold:
                        logger.error(f"      CANNOT UPDATE TICKET CLASS: Target capacity {TARGET_CAPACITY} is less than tickets sold {quantity_sold} for TC ID {ticket_class_id}, Event ID {occurrence_id}. Skipping.")
                        continue # Skip both ticket class and event level update for this one
                    
                    ticket_class_updated_successfully = False
                    if current_tc_capacity == TARGET_CAPACITY:
                        logger.info(f"      Ticket class capacity is already {TARGET_CAPACITY}. No update needed for TC ID {ticket_class_id}.")
                        ticket_class_updated_successfully = True # Treat as success for event level update
                    elif not dry_run:
                        logger.info(f"      Attempting to set ticket class capacity to {TARGET_CAPACITY} (new available: {new_tc_available})...")
                        await eb_client.update_ticket_class_capacity(occurrence_id, ticket_class_id, TARGET_CAPACITY)
                        logger.info(f"      SUCCESS: Ticket class capacity set to {TARGET_CAPACITY} for TC ID {ticket_class_id}.")
                        ticket_class_updated_successfully = True
                    else:
                        logger.info(f"      DRY RUN: Would set ticket class capacity from {current_tc_capacity} to {TARGET_CAPACITY} (new available: {new_tc_available}) for TC ID {ticket_class_id}.")
                        ticket_class_updated_successfully = True # Simulate success for dry run event level

                    # Now handle overall event capacity if ticket class was (or would be) handled
                    if ticket_class_updated_successfully:
                        event_details_for_overall = await get_event_details_for_overall_capacity(eb_client, occurrence_id)
                        current_event_overall_capacity = event_details_for_overall.get('capacity') if event_details_for_overall else "Unknown"

                        logger.info(f"      Overall Event (ID: {occurrence_id}) Current Capacity: {current_event_overall_capacity}")

                        if not isinstance(current_event_overall_capacity, int) and current_event_overall_capacity != "Unknown":
                             logger.warning(f"      Current overall event capacity for Event ID {occurrence_id} is not an integer ({current_event_overall_capacity}). Skipping overall update.")
                        elif current_event_overall_capacity == TARGET_CAPACITY:
                            logger.info(f"      Overall event capacity is already {TARGET_CAPACITY}. No update needed for Event ID {occurrence_id}.")
                        elif not dry_run:
                            logger.info(f"      Attempting to set overall event capacity to {TARGET_CAPACITY}...")
                            await eb_client.update_event_overall_capacity(occurrence_id, TARGET_CAPACITY)
                            logger.info(f"      SUCCESS: Overall event capacity set to {TARGET_CAPACITY} for Event ID {occurrence_id}.")
                        else:
                            logger.info(f"      DRY RUN: Would set overall event capacity from {current_event_overall_capacity} to {TARGET_CAPACITY} for Event ID {occurrence_id}.")
                    else:
                        logger.info(f"      Skipping overall event capacity update for Event ID {occurrence_id} because ticket class update was skipped or failed.")


                except EventbriteAPIError as e:
                    logger.error(f"    Eventbrite API Error processing event occurrence {occurrence_id} ('{event_name_for_log}'): {e}")
                except Exception as e:
                    logger.error(f"    Unexpected error processing event occurrence {occurrence_id} ('{event_name_for_log}'): {e}", exc_info=True)
            
    except EventbriteAPIError as e:
        logger.error(f"Failed to retrieve organization series: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred during script execution: {e}", exc_info=True)
    finally:
        logger.info(f"--- Eventbrite Capacity Reset Finished ---")

if __name__ == "__main__":
    is_dry_run = "--dry-run" in sys.argv
    # Need to import requests for the helper function if it's not already global
    # This is a bit of a hack due to script structure, ideally EventbriteClient handles all requests.
    import requests 
    asyncio.run(reset_capacities(dry_run=is_dry_run))