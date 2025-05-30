"""
Eventbrite API integration module.
Adapted from decrement_eventbrite_inventory.js
"""

import os
import requests
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from datetime import datetime, timezone

# Load environment variables from the project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

class EventbriteAPIError(Exception):
    """Custom exception for Eventbrite API errors"""
    pass

class EventbriteClient:
    def __init__(self):
        self.private_token = os.getenv('PRIVATE_TOKEN')
        if not self.private_token:
            raise EventbriteAPIError('Eventbrite PRIVATE_TOKEN not found in environment variables.')
        
        self.base_url = 'https://www.eventbriteapi.com/v3'
        self.headers = {
            'Authorization': f'Bearer {self.private_token}',
            'Content-Type': 'application/json'
        }
        
        # Cache file path
        self.cache_file = os.path.join(os.path.dirname(__file__), 'series_cache.json')

    async def get_ticket_class_details(self, event_id: str, ticket_class_id: str) -> Dict[str, Any]:
        """
        Fetches details for a specific ticket class.
        
        Args:
            event_id: The ID of the event
            ticket_class_id: The ID of the ticket class to find
            
        Returns:
            The ticket class object
            
        Raises:
            EventbriteAPIError: If the ticket class is not found or API request fails
        """
        try:
            url = f"{self.base_url}/events/{event_id}/ticket_classes/"
            print(f"Fetching ticket classes for Event ID: {event_id}...")
            
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            
            if 'error' in data:
                raise EventbriteAPIError(f"Eventbrite API error while fetching ticket classes: {data['error'].get('error_description', 'Unknown error')}")
            
            ticket_classes = data.get('ticket_classes', [])
            target_ticket_class = next((tc for tc in ticket_classes if tc['id'] == ticket_class_id), None)
            
            if not target_ticket_class:
                raise EventbriteAPIError(f"Ticket Class ID {ticket_class_id} not found for Event ID {event_id}.")
            
            print(f"Found Ticket Class: {target_ticket_class['name']} (ID: {target_ticket_class['id']})")
            return target_ticket_class
            
        except requests.RequestException as e:
            raise EventbriteAPIError(f"Failed to get ticket class details: {str(e)}")

    async def update_ticket_class_capacity(self, event_id: str, ticket_class_id: str, new_capacity: int) -> Dict[str, Any]:
        """
        Updates the capacity of a specific ticket class.
        
        Args:
            event_id: The ID of the event
            ticket_class_id: The ID of the ticket class to update
            new_capacity: The new capacity to set
            
        Returns:
            The API response data
            
        Raises:
            EventbriteAPIError: If the API request fails
        """
        try:
            url = f"{self.base_url}/events/{event_id}/ticket_classes/{ticket_class_id}/"
            
            payload = {
                "ticket_class": {  # API expects the ticket class data nested under 'ticket_class'
                    "capacity": new_capacity
                }
            }
            
            print(f"Attempting to update capacity for Ticket Class ID {ticket_class_id} to {new_capacity}...")
            
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            
            if 'error' in data:
                raise EventbriteAPIError(f"Eventbrite API error while updating capacity: {data['error'].get('error_description', 'Unknown error')}")
            
            return data
            
        except requests.RequestException as e:
            raise EventbriteAPIError(f"Failed to update ticket class capacity: {str(e)}")

    async def increment_capacity(self, event_id: str, ticket_class_id: str) -> Dict[str, Any]:
        """
        Increments the capacity of a ticket class by 1.
        
        Args:
            event_id: The ID of the event
            ticket_class_id: The ID of the ticket class
            
        Returns:
            Dictionary with old_capacity, new_capacity, and API response
        """
        ticket_class = await self.get_ticket_class_details(event_id, ticket_class_id)
        current_capacity = ticket_class.get('capacity')
        
        if current_capacity is None:
            raise EventbriteAPIError(f"Could not determine current capacity for Ticket Class ID {ticket_class_id}. Capacity is None.")
        
        if not isinstance(current_capacity, int):
            raise EventbriteAPIError(f"Current capacity for Ticket Class ID {ticket_class_id} is not a number: {current_capacity}. Cannot increment.")
        
        new_capacity = current_capacity + 1
        print(f"Current capacity: {current_capacity}, New capacity: {new_capacity}")
        
        result = await self.update_ticket_class_capacity(event_id, ticket_class_id, new_capacity)
        
        # Get updated ticket class details to include current sold quantities
        updated_ticket_class = await self.get_ticket_class_details(event_id, ticket_class_id)
        quantity_sold = updated_ticket_class.get('quantity_sold', 0)
        available = new_capacity - quantity_sold if new_capacity is not None else None
        
        return {
            'old_capacity': current_capacity,
            'new_capacity': new_capacity,
            'quantity_sold': quantity_sold,
            'available': available,
            'ticket_class_name': ticket_class.get('name'),
            'ticket_class_id': ticket_class.get('id'),
            'event_id': event_id,
            'api_response': result
        }

    async def decrement_capacity(self, event_id: str, ticket_class_id: str) -> Dict[str, Any]:
        """
        Decrements the capacity of a ticket class by 1.
        
        Args:
            event_id: The ID of the event
            ticket_class_id: The ID of the ticket class
            
        Returns:
            Dictionary with old_capacity, new_capacity, and API response
        """
        ticket_class = await self.get_ticket_class_details(event_id, ticket_class_id)
        current_capacity = ticket_class.get('capacity')
        
        if current_capacity is None:
            raise EventbriteAPIError(f"Could not determine current capacity for Ticket Class ID {ticket_class_id}. Capacity is None.")
        
        if not isinstance(current_capacity, int):
            raise EventbriteAPIError(f"Current capacity for Ticket Class ID {ticket_class_id} is not a number: {current_capacity}. Cannot decrement.")
        
        if current_capacity <= 0:
            raise EventbriteAPIError(f"Ticket Class ID {ticket_class_id} already has 0 or less capacity ({current_capacity}). Cannot decrement further.")
        
        new_capacity = current_capacity - 1
        print(f"Current capacity: {current_capacity}, New capacity: {new_capacity}")
        
        result = await self.update_ticket_class_capacity(event_id, ticket_class_id, new_capacity)
        
        # Get updated ticket class details to include current sold quantities
        updated_ticket_class = await self.get_ticket_class_details(event_id, ticket_class_id)
        quantity_sold = updated_ticket_class.get('quantity_sold', 0)
        available = new_capacity - quantity_sold if new_capacity is not None else None
        
        return {
            'old_capacity': current_capacity,
            'new_capacity': new_capacity,
            'quantity_sold': quantity_sold,
            'available': available,
            'ticket_class_name': ticket_class.get('name'),
            'ticket_class_id': ticket_class.get('id'),
            'event_id': event_id,
            'api_response': result
        }

    async def get_current_capacity(self, event_id: str, ticket_class_id: str) -> Dict[str, Any]:
        """
        Gets the current capacity of a ticket class.
        
        Args:
            event_id: The ID of the event
            ticket_class_id: The ID of the ticket class
            
        Returns:
            Dictionary with current capacity, tickets sold, and ticket class info
        """
        ticket_class = await self.get_ticket_class_details(event_id, ticket_class_id)
        
        capacity = ticket_class.get('capacity')
        quantity_sold = ticket_class.get('quantity_sold', 0)
        quantity_total = ticket_class.get('quantity_total', 0)
        
        # Calculate available tickets
        available = capacity - quantity_sold if capacity is not None else None
        
        return {
            'capacity': capacity,
            'quantity_sold': quantity_sold,
            'quantity_total': quantity_total,
            'available': available,
            'ticket_class_name': ticket_class.get('name'),
            'ticket_class_id': ticket_class.get('id'),
            'event_id': event_id
        }

    async def update_event_overall_capacity(self, event_id: str, new_capacity: int) -> Dict[str, Any]:
        """
        Updates the overall capacity of a specific event.
        
        Args:
            event_id: The ID of the event to update
            new_capacity: The new overall capacity to set
            
        Returns:
            The API response data
            
        Raises:
            EventbriteAPIError: If the API request fails
        """
        try:
            url = f"{self.base_url}/events/{event_id}/" # Note: Endpoint for updating event itself
            
            payload = {
                "event": {
                    "capacity": new_capacity
                }
            }
            
            print(f"Attempting to update overall event capacity for Event ID {event_id} to {new_capacity}...")
            
            response = requests.post(url, json=payload, headers=self.headers) # POST to update
            response.raise_for_status()
            
            data = response.json()
            
            if 'error' in data:
                raise EventbriteAPIError(f"Eventbrite API error while updating overall event capacity: {data['error'].get('error_description', 'Unknown error')}")
            
            return data
            
        except requests.RequestException as e:
            raise EventbriteAPIError(f"Failed to update overall event capacity: {str(e)}")

    async def get_all_ticket_classes(self, event_id: str) -> Dict[str, Any]:
        """
        Gets all ticket classes for an event.
        
        Args:
            event_id: The ID of the event
            
        Returns:
            Dictionary with ticket classes list and event info
            
        Raises:
            EventbriteAPIError: If the API request fails
        """
        try:
            url = f"{self.base_url}/events/{event_id}/ticket_classes/"
            print(f"Fetching all ticket classes for Event ID: {event_id}...")
            
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            
            if 'error' in data:
                raise EventbriteAPIError(f"Eventbrite API error while fetching ticket classes: {data['error'].get('error_description', 'Unknown error')}")
            
            ticket_classes = data.get('ticket_classes', [])
            
            # Format ticket classes for frontend consumption
            formatted_classes = []
            for tc in ticket_classes:
                formatted_classes.append({
                    'id': tc.get('id'),
                    'name': tc.get('name'),
                    'capacity': tc.get('capacity'),
                    'quantity_sold': tc.get('quantity_sold', 0),
                    'quantity_total': tc.get('quantity_total', 0),
                    'cost': tc.get('cost', {}).get('display', 'Free') if tc.get('cost') else 'Free'
                })
            
            print(f"Found {len(formatted_classes)} ticket classes for Event ID {event_id}")
            return {
                'event_id': event_id,
                'ticket_classes': formatted_classes,
                'total_count': len(formatted_classes)
            }
            
        except requests.RequestException as e:
            raise EventbriteAPIError(f"Failed to get ticket classes: {str(e)}")

    async def get_organization_series(self, organization_id: str = '698566935713', use_cache: bool = True) -> Dict[str, Any]:
        """
        Gets all event series for an organization, filtering for events that are currently on sale.
        
        Args:
            organization_id: The ID of the organization (defaults to BRCC)
            use_cache: Whether to use cached data if available (defaults to True)
            
        Returns:
            Dictionary with unique series list
            
        Raises:
            EventbriteAPIError: If the API request fails
        """
        # Try to load from cache first if use_cache is True
        if use_cache:
            cached_data = self._load_cached_series()
            if cached_data:
                print(f"Loaded {cached_data['total_series_count']} series from cache (last updated: {cached_data.get('last_updated', 'unknown')})")
                return cached_data
        
        print(f"Fetching fresh data from Eventbrite API for Organization ID: {organization_id}...")
        
        try:
            url = f"{self.base_url}/organizations/{organization_id}/events/"
            params = {
                'status': 'live',
                'expand': 'category,subcategory,event_sales_status,ticket_availability,series_parent'
            }
            
            print(f"Fetching organization events for Organization ID: {organization_id}...")
            
            all_events = []
            continuation = None
            
            # Handle pagination
            while True:
                if continuation:
                    params['continuation'] = continuation
                
                response = requests.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                
                data = response.json()
                
                if 'error' in data:
                    raise EventbriteAPIError(f"Eventbrite API error while fetching organization events: {data['error'].get('error_description', 'Unknown error')}")
                
                events = data.get('events', [])
                all_events.extend(events)
                
                # Check for more pages
                pagination = data.get('pagination', {})
                if not pagination.get('has_more_items', False):
                    break
                continuation = pagination.get('continuation')
            
            print(f"Fetched {len(all_events)} total events")
            
            # Filter for events that are currently on sale
            print("Checking which events are currently on sale...")
            on_sale_events = []
            for i, event in enumerate(all_events):
                if (i + 1) % 100 == 0:  # Progress update every 100 events
                    print(f"  Processed {i + 1}/{len(all_events)} events...")
                
                if self._is_event_on_sale(event):
                    on_sale_events.append(event)
            
            print(f"Found {len(on_sale_events)} events currently on sale")
            
            # Group by series and extract unique series
            print("Grouping events by series...")
            series_map = {}
            for event in on_sale_events:
                event_name = event.get('name', {}).get('text', 'Unnamed Event')
                event_id = event.get('id', 'Unknown ID')
                
                # Extract series ID using same logic as reference script
                series_id = (
                    event.get('series_id') or 
                    (event.get('series_parent', {}).get('id') if event.get('series_parent') else None) or
                    event.get('id')  # Fallback to first occurrence ID
                )
                
                if event_name not in series_map:
                    print(f"  New series found: '{event_name}' (Series ID: {series_id})")
                    series_map[event_name] = {
                        'series_id': str(series_id),
                        'series_name': event_name,
                        'event_count': 0,
                        'events': []
                    }
                
                series_map[event_name]['event_count'] += 1
                series_map[event_name]['events'].append({
                    'occurrence_id': event.get('id'),
                    'start_date': event.get('start', {}).get('local'),
                    'url': event.get('url')
                })
                
                print(f"  Added occurrence {event_id} to series '{event_name}'")
            
            # Convert to list and apply custom sorting (weekly shows first, then by earliest date)
            series_list = list(series_map.values())
            series_list.sort(key=self._get_series_sort_key)
            
            result = {
                'organization_id': organization_id,
                'series': series_list,
                'total_series_count': len(series_list),
                'total_events_on_sale': len(on_sale_events),
                'last_updated': datetime.now(timezone.utc).isoformat(),
                'cache_source': 'api'
            }
            
            # Save to cache
            self._save_cached_series(result)
            
            print(f"Found {len(series_list)} unique series")
            return result
            
        except requests.RequestException as e:
            raise EventbriteAPIError(f"Failed to get organization series: {str(e)}")

    def _load_cached_series(self) -> Optional[Dict[str, Any]]:
        """Load series data from cache file if it exists"""
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                
                # Calculate cache age for display purposes
                last_updated = cached_data.get('last_updated')
                if last_updated:
                    cache_time = datetime.fromisoformat(last_updated)
                    now = datetime.now(timezone.utc)
                    cache_age_minutes = int((now - cache_time).total_seconds() / 60)
                    
                    cached_data['cache_source'] = 'cache'
                    cached_data['cache_age_minutes'] = cache_age_minutes
                    
                    print(f"Loaded Eventbrite cache ({cache_age_minutes} minutes old)")
                    return cached_data
                
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            print(f"Error loading Eventbrite cache: {e}")
        
        return None

    def _save_cached_series(self, data: Dict[str, Any]) -> None:
        """Save series data to cache file"""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Cached series data to {self.cache_file}")
        except Exception as e:
            print(f"Error saving cache: {e}")

    def get_cache_info(self) -> Dict[str, Any]:
        """Get information about the current cache"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                
                last_updated = cached_data.get('last_updated')
                if last_updated:
                    cache_time = datetime.fromisoformat(last_updated)
                    now = datetime.now(timezone.utc)
                    age_minutes = int((now - cache_time).total_seconds() / 60)
                    
                    return {
                        'has_cache': True,
                        'last_updated': last_updated,
                        'age_minutes': age_minutes,
                        'series_count': cached_data.get('total_series_count', 0),
                        'events_count': cached_data.get('total_events_on_sale', 0)
                    }
            except Exception as e:
                return {
                    'has_cache': False,
                    'error': str(e)
                }
        
        return {
            'has_cache': False
        }

    def _is_event_on_sale(self, event: Dict[str, Any]) -> bool:
        """
        Check if an event is currently on sale based on ticket availability.
        Uses same logic as the reference script.
        """
        event_name = event.get('name', {}).get('text', 'Unnamed Event')
        event_id = event.get('id', 'Unknown ID')
        
        ticket_availability = event.get('ticket_availability')
        if ticket_availability:
            # Check if not sold out
            if ticket_availability.get('is_sold_out') == False:
                # Check if sales are currently active
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)  # Use timezone-aware datetime
                
                start_sales = ticket_availability.get('start_sales_date')
                end_sales = ticket_availability.get('end_sales_date')
                
                # If start date exists, check if sales have started
                if start_sales:
                    try:
                        start_utc = start_sales.get('utc', '')
                        if start_utc:
                            # Handle both Z and +00:00 timezone formats
                            if start_utc.endswith('Z'):
                                start_utc = start_utc[:-1] + '+00:00'
                            start_date = datetime.fromisoformat(start_utc)
                            if now < start_date:
                                print(f"  Event {event_id} ({event_name[:50]}...): Sales haven't started yet")
                                return False
                    except (ValueError, AttributeError) as e:
                        print(f"  Event {event_id}: Error parsing start sales date: {e}")
                        return False
                
                # If end date exists, check if sales haven't ended
                if end_sales:
                    try:
                        end_utc = end_sales.get('utc', '')
                        if end_utc:
                            # Handle both Z and +00:00 timezone formats
                            if end_utc.endswith('Z'):
                                end_utc = end_utc[:-1] + '+00:00'
                            end_date = datetime.fromisoformat(end_utc)
                            if now > end_date:
                                print(f"  Event {event_id} ({event_name[:50]}...): Sales have ended")
                                return False
                    except (ValueError, AttributeError) as e:
                        print(f"  Event {event_id}: Error parsing end sales date: {e}")
                        return False
                
                print(f"  Event {event_id} ({event_name[:50]}...): ON SALE ✓")
                return True  # On sale and available
            else:
                print(f"  Event {event_id} ({event_name[:50]}...): Sold out")
        else:
            print(f"  Event {event_id} ({event_name[:50]}...): No ticket availability info")
        
        return False

    def _get_series_sort_key(self, series: Dict[str, Any]) -> tuple:
        """
        Generate sort key for series to prioritize weekly shows in day order,
        then sort remaining shows by earliest occurrence date.
        """
        series_name = series.get('series_name', '').lower()
        
        # Check if this is a weekly show and get day of week (1=Monday, 7=Sunday)
        day_of_week = self._get_day_of_week(series_name)
        
        if day_of_week > 0:  # This is a weekly show
            # Get show time for same-day sorting (8PM before 10PM)
            show_time = self._get_show_time(series_name)
            # Return tuple: (0 for weekly shows, day_of_week, show_time)
            return (0, day_of_week, show_time)
        else:
            # Not a weekly show - sort by earliest occurrence date
            earliest_date = self._get_earliest_occurrence_date(series)
            # Return tuple: (1 for non-weekly shows, earliest_date, 0)
            return (1, earliest_date, 0)
    
    def _get_day_of_week(self, title: str) -> int:
        """
        Extract day of week from event title.
        Returns 1-7 for Monday-Sunday, 0 if not a weekly show.
        """
        title_lower = title.lower()
        
        # Special case: Feedback is the Monday show
        if 'feedback' in title_lower and 'open mic' in title_lower:
            return 1  # Monday
        
        # Check for day names in title
        if 'monday' in title_lower:
            return 1
        elif 'tuesday' in title_lower:
            return 2
        elif 'wednesday' in title_lower:
            return 3
        elif 'thursday' in title_lower:
            return 4
        elif 'friday' in title_lower:
            return 5
        elif 'saturday' in title_lower:
            return 6
        elif 'sunday' in title_lower:
            return 7
        
        return 0  # Not a weekly show
    
    def _get_show_time(self, title: str) -> int:
        """
        Extract show time from event title for same-day sorting.
        Returns hour (8 or 10), with 8PM shows before 10PM shows.
        """
        title_lower = title.lower()
        
        if '8pm' in title_lower or '8 pm' in title_lower:
            return 8
        elif '10pm' in title_lower or '10 pm' in title_lower:
            return 10
        
        # Fallback: try to extract any time
        import re
        time_match = re.search(r'(\d{1,2})\s*pm', title_lower)
        if time_match:
            return int(time_match.group(1))
        
        return 0  # Unknown time - will be sorted last within the same day
    
    def _get_earliest_occurrence_date(self, series: Dict[str, Any]) -> str:
        """
        Get the earliest occurrence date from a series for sorting non-weekly shows.
        Returns ISO date string, with fallback to series name if no dates available.
        """
        events = series.get('events', [])
        if not events:
            # Fallback: use series name for consistent sorting
            return series.get('series_name', 'zzz_unknown')
        
        earliest_date = None
        for event in events:
            start_date = event.get('start_date')
            if start_date:
                try:
                    # Parse the date and keep track of the earliest
                    from datetime import datetime
                    parsed_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    if earliest_date is None or parsed_date < earliest_date:
                        earliest_date = parsed_date
                except (ValueError, AttributeError):
                    continue
        
        if earliest_date:
            return earliest_date.isoformat()
        else:
            # Fallback: use series name for consistent sorting
            return series.get('series_name', 'zzz_unknown') 