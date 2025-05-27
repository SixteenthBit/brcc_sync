"""
WooCommerce API integration module for FooEvents.
Fetches product data and extracts FooEvents booking information.
"""

import os
import requests
import json
from typing import Dict, Any, Optional, List, Union
from dotenv import load_dotenv
from datetime import datetime, timezone
import base64
import logging
from wordpress_db import WordPressDBClient, WordPressDBError

# Load environment variables from the project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

class WooCommerceAPIError(Exception):
    """Custom exception for WooCommerce API errors"""
    pass

class WooCommerceClient:
    def __init__(self):
        self.consumer_key = os.getenv('WOOCOMMERCE_CONSUMER_KEY')
        self.consumer_secret = os.getenv('WOOCOMMERCE_CONSUMER_SECRET')
        self.api_url = os.getenv('WOOCOMMERCE_API_URL', 'https://backroomcomedyclub.com')
        
        if not self.consumer_key or not self.consumer_secret:
            raise WooCommerceAPIError('WooCommerce credentials not found in environment variables.')
        
        # Remove trailing slash from API URL
        self.api_url = self.api_url.rstrip('/')
        self.base_url = f"{self.api_url}/wp-json/wc/v3"
        
        # Create basic auth header
        credentials = f"{self.consumer_key}:{self.consumer_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        self.headers = {
            'Authorization': f'Basic {encoded_credentials}',
            'Content-Type': 'application/json'
        }
        
        # Cache file path
        self.cache_file = os.path.join(os.path.dirname(__file__), 'woocommerce_cache.json')
        
        # Product IDs from the reference list (all 18 products)
        self.product_ids = [
            37273, 37271, 37268, 37294, 30897, 37388, 31907, 13918, 37291, 35549, 
            6410, 11192, 4157, 4156, 4154, 4061, 4060, 3986
        ]
        
        # WordPress database client for getting actual ticket sales
        self.wp_db = None
        self.wp_db_available = False
        self._init_wordpress_db()

    def _init_wordpress_db(self):
        """Initialize WordPress database connection"""
        try:
            self.wp_db = WordPressDBClient()
            self.wp_db_available = self.wp_db.test_connection()
            if self.wp_db_available:
                logging.info("WordPress database connection established")
            else:
                logging.warning("WordPress database connection test failed")
        except WordPressDBError as e:
            logging.warning(f"WordPress database not available: {e}")
            self.wp_db_available = False
        except Exception as e:
            logging.error(f"Unexpected error initializing WordPress database: {e}")
            self.wp_db_available = False

    async def get_product_data(self, product_id: int) -> Dict[str, Any]:
        """
        Fetches product data for a specific product ID.
        
        Args:
            product_id: The WooCommerce product ID
            
        Returns:
            The product data
            
        Raises:
            WooCommerceAPIError: If the API request fails
        """
        try:
            url = f"{self.base_url}/products/{product_id}"
            
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            
            if 'code' in data and data.get('code') == 'woocommerce_rest_product_invalid_id':
                raise WooCommerceAPIError(f"Product ID {product_id} not found")
            
            return data
            
        except requests.RequestException as e:
            raise WooCommerceAPIError(f"Failed to get product data for ID {product_id}: {str(e)}")

    def extract_fooevents_data(self, product: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Extracts FooEvents booking data from product meta_data.
        
        Args:
            product: The product data from WooCommerce API
            
        Returns:
            Parsed FooEvents booking data or None if not found
        """
        product_id = product.get('id', 'Unknown')
        product_name = product.get('name', 'Unknown Product')
        
        if not product or not product.get('meta_data'):
            logging.warning(f"Product {product_id} ({product_name}): No product data or meta_data found")
            return None
        
        # Check if there are existing tickets and what type they are
        has_slot_metadata = False
        if self.wp_db_available:
            try:
                total_tickets = self.wp_db.get_total_tickets_sold_for_product(product_id)
                if total_tickets and total_tickets > 0:
                    # Check if any tickets have slot/date metadata
                    has_slot_metadata = self.wp_db.has_tickets_with_slot_metadata(product_id)
                    if has_slot_metadata:
                        logging.info(f"Product {product_id} ({product_name}): Found {total_tickets} tickets with slot/date metadata - using FooEvents Bookings")
                    else:
                        logging.info(f"Product {product_id} ({product_name}): Found {total_tickets} tickets without slot/date metadata - using normal FooEvents")
            except Exception as e:
                logging.warning(f"Could not check ticket type for product {product_id}: {e}")
        
        # If tickets have slot/date metadata, use FooEvents Bookings configuration
        if has_slot_metadata:
            fooevents_meta = None
            for meta in product['meta_data']:
                if meta.get('key') == 'fooevents_bookings_options_serialized':
                    fooevents_meta = meta
                    break
            
            if fooevents_meta and fooevents_meta.get('value'):
                try:
                    # The value might be a JSON string or already parsed
                    booking_data = fooevents_meta['value']
                    if isinstance(booking_data, str):
                        booking_data = json.loads(booking_data)
                    
                    if booking_data and len(booking_data) > 0:
                        logging.info(f"Product {product_id} ({product_name}): Using FooEvents Bookings configuration with {len(booking_data)} slots")
                        return booking_data
                    
                except (json.JSONDecodeError, TypeError) as e:
                    logging.error(f"Product {product_id} ({product_name}): Error parsing FooEvents Bookings data - {e}")
        
        # If tickets exist but don't have slot metadata, treat as normal FooEvents
        # If no tickets exist yet, try FooEvents Bookings first, then normal FooEvents
        if not has_slot_metadata:
            total_tickets = 0
            if self.wp_db_available:
                try:
                    total_tickets = self.wp_db.get_total_tickets_sold_for_product(product_id) or 0
                except Exception:
                    total_tickets = 0
            
            if total_tickets > 0:
                # Tickets exist but don't have slot metadata - definitely normal FooEvents
                logging.info(f"Product {product_id} ({product_name}): {total_tickets} tickets without slot metadata - treating as normal FooEvents")
            else:
                # No tickets sold yet - try FooEvents Bookings first
                fooevents_meta = None
                for meta in product['meta_data']:
                    if meta.get('key') == 'fooevents_bookings_options_serialized':
                        fooevents_meta = meta
                        break
                
                if fooevents_meta and fooevents_meta.get('value'):
                    try:
                        # The value might be a JSON string or already parsed
                        booking_data = fooevents_meta['value']
                        if isinstance(booking_data, str):
                            booking_data = json.loads(booking_data)
                        
                        if booking_data and len(booking_data) > 0:
                            logging.info(f"Product {product_id} ({product_name}): Using FooEvents Bookings configuration with {len(booking_data)} slots (no tickets sold yet)")
                            return booking_data
                        
                    except (json.JSONDecodeError, TypeError) as e:
                        logging.error(f"Product {product_id} ({product_name}): Error parsing FooEvents Bookings data - {e}")
        
        # If tickets indicate normal FooEvents or no FooEvents Bookings data, check for normal FooEvents metadata
        event_meta_fields = {}
        for meta in product['meta_data']:
            key = meta.get('key', '')
            if key.startswith('WooCommerceEvents'):
                event_meta_fields[key] = meta.get('value')
        
        is_normal_fooevent = event_meta_fields.get('WooCommerceEventsEvent') == 'Event'
        
        if is_normal_fooevent:
            # This is a normal FooEvents product, create a synthetic booking structure
            event_date = event_meta_fields.get('WooCommerceEventsDate', '')
            event_hour = event_meta_fields.get('WooCommerceEventsHour', '00')
            event_minutes = event_meta_fields.get('WooCommerceEventsMinutes', '00')
            event_period = event_meta_fields.get('WooCommerceEventsPeriod', '')
            
            # Get stock from WooCommerce product data
            stock_quantity = product.get('stock_quantity')
            if stock_quantity is None:
                # For products not managing stock, assume unlimited or check manage_stock
                manage_stock = product.get('manage_stock', False)
                if not manage_stock:
                    stock_quantity = 999  # Assume high availability for non-managed stock
                else:
                    stock_quantity = 0
            
            # Create a synthetic slot structure for normal events
            synthetic_slot_id = f"event_{product_id}"
            synthetic_date_id = f"date_{product_id}"
            
            synthetic_data = {
                synthetic_slot_id: {
                    'label': f"{product_name} Show",
                    'hour': event_hour,
                    'minute': event_minutes,
                    'period': event_period,
                    'add_time': 'enabled',
                    f'{synthetic_date_id}_add_date': event_date,
                    f'{synthetic_date_id}_stock': str(stock_quantity)
                }
            }
            
            logging.info(f"Product {product_id} ({product_name}): Using normal FooEvents configuration")
            return synthetic_data
        
        logging.warning(f"Product {product_id} ({product_name}): No FooEvents data found (neither Bookings nor normal Event)")
        return None

    def format_booking_slots(self, product: Dict[str, Any], booking_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Formats FooEvents booking data into a structured format.
        
        Args:
            product: The product data
            booking_data: The parsed FooEvents booking data
            
        Returns:
            List of formatted booking slots with dates and inventory
        """
        formatted_slots = []
        product_id = product.get('id')
        product_name = product.get('name', 'Unknown Product')
        
        for slot_id, slot_data in booking_data.items():
            slot_label = slot_data.get('label', 'Unnamed Slot')
            
            # Build time string from hour, minute, period
            hour = slot_data.get('hour', '00')
            minute = slot_data.get('minute', '00')
            period = slot_data.get('period', '')
            
            if period:
                slot_time = f"{hour}:{minute} {period}"
            else:
                # Convert 24-hour to 12-hour format if no period specified
                try:
                    hour_int = int(hour)
                    
                    # Check if we can infer am/pm from the slot label
                    slot_label_lower = slot_label.lower()
                    if 'pm' in slot_label_lower or 'p.m.' in slot_label_lower:
                        # Label indicates PM
                        if hour_int == 12:
                            slot_time = f"12:{minute} p.m."
                        elif hour_int < 12:
                            slot_time = f"{hour}:{minute} p.m."
                        else:
                            slot_time = f"{hour_int - 12:02d}:{minute} p.m."
                    elif 'am' in slot_label_lower or 'a.m.' in slot_label_lower:
                        # Label indicates AM
                        if hour_int == 0:
                            slot_time = f"12:{minute} a.m."
                        elif hour_int <= 12:
                            slot_time = f"{hour}:{minute} a.m."
                        else:
                            slot_time = f"{hour_int - 12:02d}:{minute} a.m."
                    else:
                        # No clear indicator, use standard 24-hour conversion
                        if hour_int == 0:
                            slot_time = f"12:{minute} a.m."
                        elif hour_int < 12:
                            slot_time = f"{hour}:{minute} a.m."
                        elif hour_int == 12:
                            slot_time = f"12:{minute} p.m."
                        else:
                            slot_time = f"{hour_int - 12:02d}:{minute} p.m."
                except (ValueError, TypeError):
                    slot_time = slot_data.get('unformatted_time', 'N/A')
            
            # Extract dates and stock information - handle both data structures
            dates = []
            add_date = slot_data.get('add_date', {})
            
            if isinstance(add_date, dict) and add_date:
                # Format 1: Nested add_date structure (like Monday Night product)
                for date_id, date_info in add_date.items():
                    if isinstance(date_info, dict):
                        date_str = date_info.get('date', 'Unknown Date')
                        stock = date_info.get('stock', 0)
                        
                        # Convert stock to integer if it's a string
                        try:
                            available = int(stock) if stock != '' else 0
                        except (ValueError, TypeError):
                            available = 0
                        
                        # Get actual ticket sales data from WordPress database
                        total_capacity, tickets_sold = self._get_accurate_capacity_data(
                            product_id, slot_label, date_str, available
                        )
                        
                        dates.append({
                            'date_id': date_id,
                            'date': date_str,
                            'stock': available,  # Keep for backward compatibility
                            'available': available,
                            'total_capacity': total_capacity,
                            'tickets_sold': tickets_sold
                        })
            else:
                # Format 2: Flat structure with {id}_add_date and {id}_stock fields (like Mike Rita product)
                date_entries = {}
                
                # Find all date and stock entries
                for key, value in slot_data.items():
                    if key.endswith('_add_date'):
                        date_id = key.replace('_add_date', '')
                        date_entries[date_id] = {'date': value}
                    elif key.endswith('_stock'):
                        date_id = key.replace('_stock', '')
                        if date_id not in date_entries:
                            date_entries[date_id] = {}
                        date_entries[date_id]['stock'] = value
                
                # Process the collected date entries
                for date_id, date_info in date_entries.items():
                    if 'date' in date_info:
                        date_str = date_info.get('date', 'Unknown Date')
                        stock = date_info.get('stock', 0)
                        
                        # Convert stock to integer if it's a string
                        try:
                            available = int(stock) if stock != '' else 0
                        except (ValueError, TypeError):
                            available = 0
                        
                        # Get actual ticket sales data from WordPress database
                        total_capacity, tickets_sold = self._get_accurate_capacity_data(
                            product_id, slot_label, date_str, available
                        )
                        
                        dates.append({
                            'date_id': date_id,
                            'date': date_str,
                            'stock': available,  # Keep for backward compatibility
                            'available': available,
                            'total_capacity': total_capacity,
                            'tickets_sold': tickets_sold
                        })
            
            # Sort dates chronologically
            dates.sort(key=lambda x: self._parse_date(x['date']))
            
            formatted_slots.append({
                'product_id': product_id,
                'product_name': product_name,
                'slot_id': slot_id,
                'slot_label': slot_label,
                'slot_time': slot_time,
                'dates': dates,
                'total_dates': len(dates)
            })
        
        return formatted_slots

    def _get_accurate_capacity_data(self, product_id: int, slot_label: str, date_str: str, available: int) -> tuple[Union[int, str], Union[int, str]]:
        """
        Get accurate capacity and tickets sold data.
        
        Args:
            product_id: WooCommerce product ID
            slot_label: Slot label (e.g., "Sunday 6pm")
            date_str: Date string (e.g., "January 15, 2024")
            available: Available tickets from WooCommerce stock
            
        Returns:
            Tuple of (total_capacity, tickets_sold) - may contain error strings if DB unavailable
        """
        if not self.wp_db_available:
            # Database not available - return error indicators
            return "❌ DB Error", "❌ DB Error"
        
        try:
            # First, check what type of tickets exist for this product
            total_tickets_for_product = self.wp_db.get_total_tickets_sold_for_product(product_id)
            
            if total_tickets_for_product is None:
                return "❌ DB Error", "❌ DB Error"
            
            if total_tickets_for_product == 0:
                # No tickets sold yet - use booking configuration if available
                tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str)
                total_capacity = self.wp_db.get_product_total_capacity(product_id, slot_label, date_str)
                
                if tickets_sold is None or total_capacity is None:
                    return "❌ DB Error", "❌ DB Error"
                
                return total_capacity, tickets_sold
            
            # Check if any tickets for this product have slot/date metadata
            has_slot_metadata = self.wp_db.has_tickets_with_slot_metadata(product_id)
            
            if has_slot_metadata:
                # This is a FooEvents Bookings product - get slot-specific data
                tickets_with_slot_metadata = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str)
                
                if tickets_with_slot_metadata is not None:
                    logging.info(f"Product {product_id} is a FooEvents Bookings product with {tickets_with_slot_metadata} tickets sold for slot '{slot_label}', date '{date_str}'")
                    
                    total_capacity = self.wp_db.get_product_total_capacity(product_id, slot_label, date_str)
                    if total_capacity is None:
                        return "❌ DB Error", "❌ DB Error"
                    
                    return total_capacity, tickets_with_slot_metadata
                else:
                    return "❌ DB Error", "❌ DB Error"
            else:
                # This is a normal FooEvents product - tickets don't have slot/date metadata
                logging.info(f"Product {product_id} is a normal FooEvents product with {total_tickets_for_product} tickets sold (no slot/date metadata)")
                
                # For normal FooEvents products, calculate capacity as stock + tickets sold
                estimated_capacity = available + total_tickets_for_product
                
                return estimated_capacity, total_tickets_for_product
            
        except WordPressDBError as e:
            logging.error(f"WordPress database error getting capacity data: {e}")
            return "❌ DB Error", "❌ DB Error"
        except Exception as e:
            logging.error(f"Unexpected error getting capacity data: {e}")
            return "❌ DB Error", "❌ DB Error"

    def _parse_date(self, date_str: str) -> datetime:
        """
        Parse date string to datetime object for sorting.
        
        Args:
            date_str: Date string in format "Month DD, YYYY"
            
        Returns:
            datetime object
        """
        try:
            return datetime.strptime(date_str, "%B %d, %Y")
        except ValueError:
            # Return a very old date if parsing fails
            return datetime(1970, 1, 1)

    async def discover_fooevents_products(self) -> List[int]:
        """
        Discover all FooEvents products from WooCommerce that are currently in stock.
        
        Returns:
            List of product IDs that have FooEvents data and are in stock
        """
        print("🔍 Discovering FooEvents products...")
        discovered_products = []
        page = 1
        
        while True:
            print(f"Scanning WooCommerce products page {page}...")
            
            try:
                # Get products from WooCommerce API with pagination
                url = f"{self.base_url}/products"
                params = {
                    'page': page,
                    'per_page': 100,
                    'status': 'publish'
                }
                
                response = requests.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                products = response.json()
                
                if not products:
                    break
                
                for product in products:
                    product_id = product.get('id')
                    product_name = product.get('name', 'Unknown Product')
                    
                    # Check if this product has FooEvents metadata
                    has_fooevents = False
                    meta_data = product.get('meta_data', [])
                    
                    for meta in meta_data:
                        key = meta.get('key', '')
                        if (key == 'fooevents_bookings_options_serialized' or 
                            key.startswith('WooCommerceEvents')):
                            has_fooevents = True
                            break
                    
                    if has_fooevents:
                        # Check WooCommerce stock status (the right way)
                        stock_status = product.get('stock_status', 'outofstock')
                        if stock_status == 'instock':
                            discovered_products.append(product_id)
                            print(f"  ✅ Found in-stock FooEvents product: {product_name} (ID: {product_id})")
                        else:
                            print(f"  ❌ Skipped out-of-stock FooEvents product: {product_name} (ID: {product_id}) - Status: {stock_status}")
                
                page += 1
                
            except requests.RequestException as e:
                print(f"Error scanning page {page}: {e}")
                break
        
        print(f"🔍 Discovery complete: Found {len(discovered_products)} active FooEvents products")
        return discovered_products
    async def get_all_fooevents_products(self, use_cache: bool = True, use_discovery: bool = True) -> Dict[str, Any]:
        """
        Gets all FooEvents products with their booking data.
        
        Args:
            use_cache: Whether to use cached data if available
            use_discovery: Whether to use dynamic discovery instead of hardcoded list
            
        Returns:
            Dictionary with all products and their booking slots
        """
        # Try to load from cache first if use_cache is True
        if use_cache:
            cached_data = self._load_cached_products()
            if cached_data:
                print(f"Loaded {len(cached_data['products'])} products from cache (last updated: {cached_data.get('last_updated', 'unknown')})")
                return cached_data
        
        # Determine which products to process
        if use_discovery:
            product_ids = await self.discover_fooevents_products()
        else:
            product_ids = self.product_ids
        
        print(f"Fetching fresh data from WooCommerce API for {len(product_ids)} products...")
        
        all_products = []
        failed_products = []
        total_slots = 0
        total_dates = 0
        
        for product_id in product_ids:
            try:
                # Fetch product data
                product_data = await self.get_product_data(product_id)
                product_name = product_data.get('name', 'Unknown Product')
                
                # Extract FooEvents booking data
                booking_data = self.extract_fooevents_data(product_data)
                
                if booking_data:
                    # Format the booking slots
                    formatted_slots = self.format_booking_slots(product_data, booking_data)
                    
                    if formatted_slots and len(formatted_slots) > 0:
                        # Calculate totals
                        for slot in formatted_slots:
                            total_slots += 1
                            total_dates += len(slot['dates'])
                        
                        all_products.append({
                            'product_id': product_id,
                            'product_name': product_name,
                            'product_price': product_data.get('price', '0'),
                            'total_sales': product_data.get('total_sales', 0),
                            'slots': formatted_slots,
                            'slot_count': len(formatted_slots)
                        })
                        
                        print(f"  ✅ {product_name} ({product_id}): {len(formatted_slots)} slots")
                    else:
                        failed_products.append({
                            'product_id': product_id,
                            'product_name': product_name,
                            'error': 'No valid slots after formatting'
                        })
                        print(f"  ❌ {product_name} ({product_id}): No valid slots after formatting")
                else:
                    failed_products.append({
                        'product_id': product_id,
                        'product_name': product_name,
                        'error': 'No FooEvents data found'
                    })
                    print(f"  ❌ {product_name} ({product_id}): No FooEvents data found")
                    
            except WooCommerceAPIError as e:
                failed_products.append({
                    'product_id': product_id,
                    'product_name': 'Unknown',
                    'error': str(e)
                })
                print(f"  ❌ Product {product_id}: API Error - {e}")
                continue
            except Exception as e:
                failed_products.append({
                    'product_id': product_id,
                    'product_name': 'Unknown',
                    'error': f"Unexpected error: {str(e)}"
                })
                print(f"  ❌ Product {product_id}: Unexpected Error - {e}")
                continue
        
        # Sort products using custom logic (weekly shows first, then by earliest date)
        all_products.sort(key=self._get_product_sort_key)
        
        result = {
            'products': all_products,
            'failed_products': failed_products,
            'total_products': len(all_products),
            'failed_count': len(failed_products),
            'total_slots': total_slots,
            'total_dates': total_dates,
            'last_updated': datetime.now(timezone.utc).isoformat(),
            'cache_source': 'api'
        }
        
        # Save to cache
        self._save_cached_products(result)
        
        print(f"✅ Successfully processed {len(all_products)} products with {total_slots} slots and {total_dates} dates")
        if failed_products:
            print(f"❌ Failed to process {len(failed_products)} products:")
            for failed in failed_products:
                print(f"   - {failed['product_name']} ({failed['product_id']}): {failed['error']}")
        
        return result

    def _load_cached_products(self) -> Optional[Dict[str, Any]]:
        """Load products data from cache file if it exists and is recent"""
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                
                # Check if cache is less than 999 hours old
                last_updated = cached_data.get('last_updated')
                if last_updated:
                    cache_time = datetime.fromisoformat(last_updated)
                    now = datetime.now(timezone.utc)
                    age_hours = (now - cache_time).total_seconds() / 3600
                    
                    if age_hours < 999:  # Cache is fresh
                        cached_data['cache_source'] = 'cache'
                        cached_data['cache_age_minutes'] = int((now - cache_time).total_seconds() / 60)
                        return cached_data
                    else:
                        print(f"WooCommerce cache is {age_hours:.1f} hours old, fetching fresh data...")
                
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            print(f"Error loading WooCommerce cache: {e}")
        
        return None

    def _save_cached_products(self, data: Dict[str, Any]) -> None:
        """Save products data to cache file"""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Cached WooCommerce products data to {self.cache_file}")
        except Exception as e:
            print(f"Error saving WooCommerce cache: {e}")

    def get_cache_info(self) -> Dict[str, Any]:
        """Get information about the current WooCommerce cache"""
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
                        'products_count': cached_data.get('total_products', 0),
                        'slots_count': cached_data.get('total_slots', 0),
                        'dates_count': cached_data.get('total_dates', 0)
                    }
            except Exception as e:
                return {
                    'has_cache': False,
                    'error': str(e)
                }
        
        return {
            'has_cache': False
        }

    def get_wordpress_db_status(self) -> Dict[str, Any]:
        """Get WordPress database connection status"""
        if self.wp_db:
            return self.wp_db.get_database_status()
        else:
            return {
                'connected': False,
                'error': 'WordPress database client not initialized'
            }

    async def get_product_inventory(self, product_id: int, slot_id: str = None, date_id: str = None) -> Dict[str, Any]:
        """
        Get inventory information for a specific product, slot, and date.
        
        Args:
            product_id: The WooCommerce product ID
            slot_id: Optional specific slot ID
            date_id: Optional specific date ID
            
        Returns:
            Inventory information
        """
        try:
            product_data = await self.get_product_data(product_id)
            booking_data = self.extract_fooevents_data(product_data)
            
            if not booking_data:
                raise WooCommerceAPIError(f"No FooEvents data found for product {product_id}")
            
            if slot_id and slot_id in booking_data:
                slot_data = booking_data[slot_id]
                add_date = slot_data.get('add_date', {})
                
                if date_id and date_id in add_date:
                    date_info = add_date[date_id]
                    stock = date_info.get('stock', 0)
                    
                    try:
                        available = int(stock) if stock != '' else 0
                    except (ValueError, TypeError):
                        available = 0
                    
                    # Get accurate capacity data from WordPress database
                    total_capacity, tickets_sold = self._get_accurate_capacity_data(
                        product_id, slot_data.get('label'), date_info.get('date'), available
                    )
                    
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'date_id': date_id,
                        'date': date_info.get('date'),
                        'stock': available,
                        'available': available,
                        'total_capacity': total_capacity,
                        'tickets_sold': tickets_sold
                    }
                else:
                    # Return all dates for the slot
                    dates = []
                    for did, date_info in add_date.items():
                        stock = date_info.get('stock', 0)
                        try:
                            available = int(stock) if stock != '' else 0
                        except (ValueError, TypeError):
                            available = 0
                        
                        # Get accurate capacity data from WordPress database
                        total_capacity, tickets_sold = self._get_accurate_capacity_data(
                            product_id, slot_data.get('label'), date_info.get('date'), available
                        )
                        
                        dates.append({
                            'date_id': did,
                            'date': date_info.get('date'),
                            'stock': available,
                            'available': available,
                            'total_capacity': total_capacity,
                            'tickets_sold': tickets_sold
                        })
                    
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'dates': dates
                    }
            else:
                # Return all slots and dates
                formatted_slots = self.format_booking_slots(product_data, booking_data)
                return {
                    'product_id': product_id,
                    'product_name': product_data.get('name'),
                    'slots': formatted_slots
                }
                
        except Exception as e:
            raise WooCommerceAPIError(f"Failed to get inventory for product {product_id}: {str(e)}")

    def _is_real_bookings_product(self, product_data: Dict[str, Any]) -> bool:
        """
        Determine if this is a real FooEvents Bookings product or a normal FooEvents product.
        
        Key principle: If a product uses WooCommerce inventory tracking (manage_stock=True), 
        it's a single event regardless of booking metadata.
        
        Args:
            product_data: The raw WooCommerce product data
            
        Returns:
            True if this is a real FooEvents Bookings product, False if it's normal FooEvents
        """
        product_id = product_data.get('id')
        
        # FALLBACK PRINCIPLE: If product uses WooCommerce stock management, it's a single event
        manage_stock = product_data.get('manage_stock', False)
        stock_quantity = product_data.get('stock_quantity')
        
        if manage_stock and stock_quantity is not None:
            # This product uses WooCommerce inventory tracking - it's a single event
            logging.info(f"Product {product_id}: Uses WooCommerce stock management - treating as normal FooEvents")
            return False
        
        # Check if the product has valid booking metadata
        for meta in product_data.get('meta_data', []):
            if meta.get('key') == 'fooevents_bookings_options_serialized':
                value = meta.get('value')
                if value:
                    try:
                        # Parse the booking data
                        if isinstance(value, str):
                            booking_data = json.loads(value)
                        else:
                            booking_data = value
                        
                        if booking_data and len(booking_data) > 0:
                            # Check if this looks like synthetic data we created
                            first_slot_key = list(booking_data.keys())[0]
                            first_slot = booking_data[first_slot_key]
                            
                            # Synthetic slots have pattern: event_{product_id}
                            # Synthetic dates have pattern: date_{product_id}_add_date and date_{product_id}_stock
                            is_synthetic_slot = first_slot_key == f"event_{product_id}"
                            
                            if is_synthetic_slot:
                                # Check if it has synthetic date pattern
                                expected_date_key = f"date_{product_id}_add_date"
                                expected_stock_key = f"date_{product_id}_stock"
                                
                                has_synthetic_dates = (
                                    expected_date_key in first_slot and 
                                    expected_stock_key in first_slot
                                )
                                
                                if has_synthetic_dates:
                                    # This is synthetic booking data created for a normal FooEvents product
                                    logging.info(f"Product {product_id}: Detected synthetic booking data - treating as normal FooEvents")
                                    return False
                            
                            # Check if it has real nested add_date structure (genuine bookings)
                            has_nested_add_date = 'add_date' in first_slot and first_slot['add_date']
                            if has_nested_add_date:
                                logging.info(f"Product {product_id}: Detected nested add_date structure - treating as real FooEvents Bookings")
                                return True
                            
                            # Check if it has non-synthetic flat structure
                            has_flat_dates = any(k.endswith('_add_date') for k in first_slot.keys())
                            if has_flat_dates and not is_synthetic_slot:
                                # IMPORTANT: This could be a single event with real booking metadata
                                # The fallback check above should have caught WooCommerce-managed products
                                logging.info(f"Product {product_id}: Detected non-synthetic flat structure (no WooCommerce stock management) - treating as real FooEvents Bookings")
                                return True
                            
                            # If we have booking data but it's not clearly synthetic or real, err on the side of real bookings
                            logging.warning(f"Product {product_id}: Ambiguous booking data (no WooCommerce stock management) - treating as real FooEvents Bookings")
                            return True
                            
                    except (json.JSONDecodeError, TypeError):
                        pass
        
        # If no valid booking data, it's a normal FooEvents product
        return False

    async def increment_woocommerce_inventory(self, product_id: int, slot_id: str = None, date_id: str = None) -> Dict[str, Any]:
        """
        Increment WooCommerce inventory by 1 for a specific product/slot/date.
        
        Args:
            product_id: The WooCommerce product ID
            slot_id: The slot ID (required for FooEvents Bookings)
            date_id: The date ID (required for FooEvents Bookings)
            
        Returns:
            Dict with old_stock, new_stock, and updated inventory data
        """
        try:
            product_data = await self.get_product_data(product_id)
            booking_data = self.extract_fooevents_data(product_data)
            
            if not booking_data:
                raise WooCommerceAPIError(f"No FooEvents data found for product {product_id}")
            
            if not slot_id or not date_id:
                raise WooCommerceAPIError(f"Both slot_id and date_id are required for inventory management")
            
            if slot_id not in booking_data:
                raise WooCommerceAPIError(f"Slot {slot_id} not found in product {product_id}")
            
            slot_data = booking_data[slot_id]
            
            # Determine the actual event type by checking the original product metadata
            is_real_bookings_product = self._is_real_bookings_product(product_data)
            
            if is_real_bookings_product:
                # This is a real FooEvents Bookings product - update booking metadata
                add_date = slot_data.get('add_date', {})
                is_nested_structure = isinstance(add_date, dict) and add_date
                
                if is_nested_structure:
                    # Handle FooEvents Bookings product (nested structure)
                    if date_id not in add_date:
                        raise WooCommerceAPIError(f"Date {date_id} not found in slot {slot_id} for product {product_id}")
                    
                    date_info = add_date[date_id]
                    old_stock = date_info.get('stock', '0')
                    
                    try:
                        old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError):
                        old_stock_int = 0
                    
                    new_stock_int = old_stock_int + 1
                    date_info['stock'] = str(new_stock_int)
                    
                    # Update the product with modified booking data
                    await self._update_product_booking_data(product_id, booking_data)
                    
                    # Calculate new total capacity after inventory change
                    slot_label = slot_data.get('label')
                    date_str = date_info.get('date')
                    if slot_label and date_str:
                        # Get tickets sold (should be unchanged)
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (tickets_sold or 0)
                    else:
                        new_total_capacity = new_stock_int
                    
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'date_id': date_id,
                        'date': date_info.get('date'),
                        'old_stock': old_stock_int,
                        'new_stock': new_stock_int,
                        'stock': new_stock_int,
                        'available': new_stock_int,
                        'total_capacity': new_total_capacity,
                        'tickets_sold': tickets_sold or 0
                    }
                else:
                    # Handle FooEvents Bookings product (flat structure)
                    stock_key = f'{date_id}_stock'
                    date_key = f'{date_id}_add_date'
                    
                    if stock_key not in slot_data:
                        raise WooCommerceAPIError(f"Stock field {stock_key} not found in slot {slot_id} for product {product_id}")
                    
                    old_stock = slot_data[stock_key]
                    
                    try:
                        old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError):
                        old_stock_int = 0
                    
                    new_stock_int = old_stock_int + 1
                    slot_data[stock_key] = str(new_stock_int)
                    
                    # Update the product with modified booking data
                    await self._update_product_booking_data(product_id, booking_data)
                    
                    # Calculate new total capacity after inventory change
                    slot_label = slot_data.get('label')
                    date_str = slot_data.get(date_key, 'Unknown Date')
                    if slot_label and date_str != 'Unknown Date':
                        # Get tickets sold (should be unchanged)
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (tickets_sold or 0)
                    else:
                        # For normal FooEvents, use total tickets sold for the product
                        total_tickets_sold = self.wp_db.get_total_tickets_sold_for_product(product_id) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (total_tickets_sold or 0)
                    
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'date_id': date_id,
                        'date': slot_data.get(date_key, 'Unknown Date'),
                        'old_stock': old_stock_int,
                        'new_stock': new_stock_int,
                        'stock': new_stock_int,
                        'available': new_stock_int,
                        'total_capacity': new_total_capacity,
                        'tickets_sold': tickets_sold if 'tickets_sold' in locals() else total_tickets_sold or 0
                    }
            else:
                # This is a normal FooEvents product (including ones with null booking metadata)
                # We need to update the WooCommerce stock_quantity field instead of booking metadata
                old_stock_quantity = product_data.get('stock_quantity', 0)
                
                try:
                    old_stock_int = int(old_stock_quantity) if old_stock_quantity is not None else 0
                except (ValueError, TypeError):
                    old_stock_int = 0
                
                new_stock_int = old_stock_int + 1
                
                # Update the WooCommerce stock_quantity field
                await self._update_product_stock_quantity(product_id, new_stock_int)
                
                # Get event info from synthetic slot data for response
                slot_label = slot_data.get('label')
                date_key = f'{date_id}_add_date'
                date_str = slot_data.get(date_key, 'Unknown Date')
                
                # Calculate new total capacity after inventory change
                if self.wp_db_available:
                    total_tickets_sold = self.wp_db.get_total_tickets_sold_for_product(product_id) or 0
                    new_total_capacity = new_stock_int + total_tickets_sold
                else:
                    total_tickets_sold = 0
                    new_total_capacity = new_stock_int
                
                return {
                    'product_id': product_id,
                    'product_name': product_data.get('name'),
                    'slot_id': slot_id,
                    'slot_label': slot_label,
                    'date_id': date_id,
                    'date': date_str,
                    'old_stock': old_stock_int,
                    'new_stock': new_stock_int,
                    'stock': new_stock_int,
                    'available': new_stock_int,
                    'total_capacity': new_total_capacity,
                    'tickets_sold': total_tickets_sold
                }
                
        except Exception as e:
            raise WooCommerceAPIError(f"Failed to increment inventory for product {product_id}: {str(e)}")

    async def decrement_woocommerce_inventory(self, product_id: int, slot_id: str = None, date_id: str = None) -> Dict[str, Any]:
        """
        Decrement WooCommerce inventory by 1 for a specific product/slot/date.
        
        Args:
            product_id: The WooCommerce product ID
            slot_id: The slot ID (required for FooEvents Bookings)
            date_id: The date ID (required for FooEvents Bookings)
            
        Returns:
            Dict with old_stock, new_stock, and updated inventory data
        """
        try:
            product_data = await self.get_product_data(product_id)
            booking_data = self.extract_fooevents_data(product_data)
            
            if not booking_data:
                raise WooCommerceAPIError(f"No FooEvents data found for product {product_id}")
            
            if not slot_id or not date_id:
                raise WooCommerceAPIError(f"Both slot_id and date_id are required for inventory management")
            
            if slot_id not in booking_data:
                raise WooCommerceAPIError(f"Slot {slot_id} not found in product {product_id}")
            
            slot_data = booking_data[slot_id]
            
            # Determine the actual event type by checking the original product metadata
            is_real_bookings_product = self._is_real_bookings_product(product_data)
            
            if is_real_bookings_product:
                # This is a real FooEvents Bookings product - update booking metadata
                add_date = slot_data.get('add_date', {})
                is_nested_structure = isinstance(add_date, dict) and add_date
                
                if is_nested_structure:
                    # Handle FooEvents Bookings product (nested structure)
                    if date_id not in add_date:
                        raise WooCommerceAPIError(f"Date {date_id} not found in slot {slot_id} for product {product_id}")
                    
                    date_info = add_date[date_id]
                    old_stock = date_info.get('stock', '0')
                    
                    try:
                        old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError):
                        old_stock_int = 0
                    
                    if old_stock_int <= 0:
                        raise WooCommerceAPIError(f"Cannot decrement inventory below 0 (current: {old_stock_int})")
                    
                    new_stock_int = old_stock_int - 1
                    date_info['stock'] = str(new_stock_int)
                    
                    # Update the product with modified booking data
                    await self._update_product_booking_data(product_id, booking_data)
                    
                    # Calculate new total capacity after inventory change
                    slot_label = slot_data.get('label')
                    date_str = date_info.get('date')
                    if slot_label and date_str:
                        # Get tickets sold (should be unchanged)
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (tickets_sold or 0)
                    else:
                        new_total_capacity = new_stock_int
                    
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'date_id': date_id,
                        'date': date_info.get('date'),
                        'old_stock': old_stock_int,
                        'new_stock': new_stock_int,
                        'stock': new_stock_int,
                        'available': new_stock_int,
                        'total_capacity': new_total_capacity,
                        'tickets_sold': tickets_sold or 0
                    }
                else:
                    # Handle FooEvents Bookings product (flat structure)
                    stock_key = f'{date_id}_stock'
                    date_key = f'{date_id}_add_date'
                    
                    if stock_key not in slot_data:
                        raise WooCommerceAPIError(f"Stock field {stock_key} not found in slot {slot_id} for product {product_id}")
                    
                    old_stock = slot_data[stock_key]
                    
                    try:
                        old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError):
                        old_stock_int = 0
                    
                    if old_stock_int <= 0:
                        raise WooCommerceAPIError(f"Cannot decrement inventory below 0 (current: {old_stock_int})")
                    
                    new_stock_int = old_stock_int - 1
                    slot_data[stock_key] = str(new_stock_int)
                    
                    # Update the product with modified booking data
                    await self._update_product_booking_data(product_id, booking_data)
                    
                    # Calculate new total capacity after inventory change
                    slot_label = slot_data.get('label')
                    date_str = slot_data.get(date_key, 'Unknown Date')
                    if slot_label and date_str != 'Unknown Date':
                        # Get tickets sold (should be unchanged)
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (tickets_sold or 0)
                    else:
                        # For normal FooEvents, use total tickets sold for the product
                        total_tickets_sold = self.wp_db.get_total_tickets_sold_for_product(product_id) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (total_tickets_sold or 0)
                    
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'date_id': date_id,
                        'date': slot_data.get(date_key, 'Unknown Date'),
                        'old_stock': old_stock_int,
                        'new_stock': new_stock_int,
                        'stock': new_stock_int,
                        'available': new_stock_int,
                        'total_capacity': new_total_capacity,
                        'tickets_sold': tickets_sold if 'tickets_sold' in locals() else total_tickets_sold or 0
                    }
            else:
                # This is a normal FooEvents product (including ones with null booking metadata)
                # We need to update the WooCommerce stock_quantity field instead of booking metadata
                old_stock_quantity = product_data.get('stock_quantity', 0)
                
                try:
                    old_stock_int = int(old_stock_quantity) if old_stock_quantity is not None else 0
                except (ValueError, TypeError):
                    old_stock_int = 0
                
                if old_stock_int <= 0:
                    raise WooCommerceAPIError(f"Cannot decrement inventory below 0 (current: {old_stock_int})")
                
                new_stock_int = old_stock_int - 1
                
                # Update the WooCommerce stock_quantity field
                await self._update_product_stock_quantity(product_id, new_stock_int)
                
                # Get event info from synthetic slot data for response
                slot_label = slot_data.get('label')
                date_key = f'{date_id}_add_date'
                date_str = slot_data.get(date_key, 'Unknown Date')
                
                # Calculate new total capacity after inventory change
                if self.wp_db_available:
                    total_tickets_sold = self.wp_db.get_total_tickets_sold_for_product(product_id) or 0
                    new_total_capacity = new_stock_int + total_tickets_sold
                else:
                    total_tickets_sold = 0
                    new_total_capacity = new_stock_int
                
                return {
                    'product_id': product_id,
                    'product_name': product_data.get('name'),
                    'slot_id': slot_id,
                    'slot_label': slot_label,
                    'date_id': date_id,
                    'date': date_str,
                    'old_stock': old_stock_int,
                    'new_stock': new_stock_int,
                    'stock': new_stock_int,
                    'available': new_stock_int,
                    'total_capacity': new_total_capacity,
                    'tickets_sold': total_tickets_sold
                }
                
        except Exception as e:
            raise WooCommerceAPIError(f"Failed to decrement inventory for product {product_id}: {str(e)}")

    async def _update_product_booking_data(self, product_id: int, booking_data: Dict[str, Any]) -> None:
        """
        Update a product's FooEvents booking data via WooCommerce API.
        
        Args:
            product_id: The WooCommerce product ID
            booking_data: The modified booking data
        """
        try:
            # CRITICAL: Convert booking_data to JSON string to prevent database corruption
            # WordPress expects 'fooevents_bookings_options_serialized' to be a JSON string, not an object
            booking_json_string = json.dumps(booking_data)
            
            # Prepare the update data - only update the booking meta field
            update_data = {
                'meta_data': [
                    {
                        'key': 'fooevents_bookings_options_serialized',
                        'value': booking_json_string  # Send as JSON string, not dict!
                    }
                ]
            }
            
            # Use URL parameters for authentication instead of headers for PUT requests
            # This often works better with WooCommerce API for write operations
            url = f"{self.base_url}/products/{product_id}"
            params = {
                'consumer_key': self.consumer_key,
                'consumer_secret': self.consumer_secret
            }
            
            # Use minimal headers for PUT request
            put_headers = {
                'Content-Type': 'application/json'
            }
            
            response = requests.put(url, headers=put_headers, params=params, json=update_data)
            response.raise_for_status()
            
            logging.info(f"Successfully updated booking data for product {product_id}")
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to update booking data for product {product_id}: {e}")
            raise WooCommerceAPIError(f"Failed to update booking data: {str(e)}")

    async def _update_product_stock_quantity(self, product_id: int, new_stock: int) -> None:
        """
        Update a product's stock_quantity via WooCommerce API.
        
        Args:
            product_id: The WooCommerce product ID
            new_stock: The new stock quantity
        """
        try:
            # Prepare the update data - only update the stock_quantity field
            update_data = {
                'stock_quantity': new_stock,
                'manage_stock': True  # Ensure stock management is enabled
            }
            
            # Use URL parameters for authentication instead of headers for PUT requests
            # This often works better with WooCommerce API for write operations
            url = f"{self.base_url}/products/{product_id}"
            params = {
                'consumer_key': self.consumer_key,
                'consumer_secret': self.consumer_secret
            }
            
            # Use minimal headers for PUT request
            put_headers = {
                'Content-Type': 'application/json'
            }
            
            response = requests.put(url, headers=put_headers, params=params, json=update_data)
            response.raise_for_status()
            
            logging.info(f"Successfully updated stock quantity for product {product_id} to {new_stock}")
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to update stock quantity for product {product_id}: {e}")
            raise WooCommerceAPIError(f"Failed to update stock quantity: {str(e)}")

    def _get_product_sort_key(self, product: Dict[str, Any]) -> tuple:
        """
        Generate sort key for products to prioritize weekly shows in day order,
        then sort remaining products by earliest date.
        """
        product_name = product.get('product_name', '').lower()
        
        # Check if this is a weekly show and get day of week (1=Monday, 7=Sunday)
        day_of_week = self._get_day_of_week(product_name)
        
        if day_of_week > 0:  # This is a weekly show
            # Get show time for same-day sorting (8PM before 10PM)
            show_time = self._get_show_time(product_name)
            # Return tuple: (0 for weekly shows, day_of_week, show_time)
            return (0, day_of_week, show_time)
        else:
            # Not a weekly show - sort by earliest date
            earliest_date = self._get_earliest_product_date(product)
            # Return tuple: (1 for non-weekly shows, earliest_date, 0)
            return (1, earliest_date, 0)
    
    def _get_day_of_week(self, title: str) -> int:
        """
        Extract day of week from product title.
        Returns 1-7 for Monday-Sunday, 0 if not a weekly show.
        """
        title_lower = title.lower()
        
        # Special case: Feedback is the Monday show (but it's not in WooCommerce based on the reference)
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
        Extract show time from product title for same-day sorting.
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
    
    def _get_earliest_product_date(self, product: Dict[str, Any]) -> str:
        """
        Get the earliest date from all slots in a product for sorting non-weekly shows.
        Returns ISO date string, with fallback to product name if no dates available.
        """
        slots = product.get('slots', [])
        if not slots:
            # Fallback: use product name for consistent sorting
            return product.get('product_name', 'zzz_unknown')
        
        earliest_date = None
        for slot in slots:
            dates = slot.get('dates', [])
            for date_info in dates:
                date_str = date_info.get('date')
                if date_str:
                    try:
                        # Parse the date and keep track of the earliest
                        parsed_date = self._parse_date(date_str)
                        if earliest_date is None or parsed_date < earliest_date:
                            earliest_date = parsed_date
                    except (ValueError, AttributeError):
                        continue
        
        if earliest_date:
            return earliest_date.isoformat()
        else:
            # Fallback: use product name for consistent sorting
            return product.get('product_name', 'zzz_unknown')

    async def set_woocommerce_inventory(self, product_id: int, slot_id: str = None, date_id: str = None, new_stock: int = 0) -> Dict[str, Any]:
        """
        Set WooCommerce inventory to a specific value for a product/slot/date.
        Args:
            product_id: The WooCommerce product ID
            slot_id: The slot ID (required for FooEvents Bookings)
            date_id: The date ID (required for FooEvents Bookings)
            new_stock: The new stock value to set
        Returns:
            Dict with old_stock, new_stock, and updated inventory data
        """
        try:
            product_data = await self.get_product_data(product_id)
            booking_data = self.extract_fooevents_data(product_data)
            if not booking_data:
                raise WooCommerceAPIError(f"No FooEvents data found for product {product_id}")
            if not slot_id or not date_id:
                raise WooCommerceAPIError(f"Both slot_id and date_id are required for inventory management")
            if slot_id not in booking_data:
                raise WooCommerceAPIError(f"Slot {slot_id} not found in product {product_id}")
            slot_data = booking_data[slot_id]
            is_real_bookings_product = self._is_real_bookings_product(product_data)
            if is_real_bookings_product:
                add_date = slot_data.get('add_date', {})
                is_nested_structure = isinstance(add_date, dict) and add_date
                if is_nested_structure:
                    if date_id not in add_date:
                        raise WooCommerceAPIError(f"Date {date_id} not found in slot {slot_id} for product {product_id}")
                    date_info = add_date[date_id]
                    old_stock = date_info.get('stock', '0')
                    try:
                        old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError):
                        old_stock_int = 0
                    new_stock_int = int(new_stock)
                    date_info['stock'] = str(new_stock_int)
                    await self._update_product_booking_data(product_id, booking_data)
                    slot_label = slot_data.get('label')
                    date_str = date_info.get('date')
                    if slot_label and date_str:
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (tickets_sold or 0)
                    else:
                        new_total_capacity = new_stock_int
                        tickets_sold = 0
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'date_id': date_id,
                        'date': date_info.get('date'),
                        'old_stock': old_stock_int,
                        'new_stock': new_stock_int,
                        'stock': new_stock_int,
                        'available': new_stock_int,
                        'total_capacity': new_total_capacity,
                        'tickets_sold': tickets_sold or 0
                    }
                else:
                    stock_key = f'{date_id}_stock'
                    date_key = f'{date_id}_add_date'
                    if stock_key not in slot_data:
                        raise WooCommerceAPIError(f"Stock field {stock_key} not found in slot {slot_id} for product {product_id}")
                    old_stock = slot_data[stock_key]
                    try:
                        old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError):
                        old_stock_int = 0
                    new_stock_int = int(new_stock)
                    slot_data[stock_key] = str(new_stock_int)
                    await self._update_product_booking_data(product_id, booking_data)
                    slot_label = slot_data.get('label')
                    date_str = slot_data.get(date_key, 'Unknown Date')
                    if slot_label and date_str != 'Unknown Date':
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (tickets_sold or 0)
                    else:
                        total_tickets_sold = self.wp_db.get_total_tickets_sold_for_product(product_id) if self.wp_db_available else 0
                        new_total_capacity = new_stock_int + (total_tickets_sold or 0)
                        tickets_sold = total_tickets_sold
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'date_id': date_id,
                        'date': slot_data.get(date_key, 'Unknown Date'),
                        'old_stock': old_stock_int,
                        'new_stock': new_stock_int,
                        'stock': new_stock_int,
                        'available': new_stock_int,
                        'total_capacity': new_total_capacity,
                        'tickets_sold': tickets_sold if 'tickets_sold' in locals() else total_tickets_sold or 0
                    }
            else:
                old_stock_quantity = product_data.get('stock_quantity', 0)
                try:
                    old_stock_int = int(old_stock_quantity) if old_stock_quantity is not None else 0
                except (ValueError, TypeError):
                    old_stock_int = 0
                new_stock_int = int(new_stock)
                await self._update_product_stock_quantity(product_id, new_stock_int)
                slot_label = slot_data.get('label')
                date_key = f'{date_id}_add_date'
                date_str = slot_data.get(date_key, 'Unknown Date')
                if self.wp_db_available:
                    total_tickets_sold = self.wp_db.get_total_tickets_sold_for_product(product_id) or 0
                    new_total_capacity = new_stock_int + total_tickets_sold
                else:
                    total_tickets_sold = 0
                    new_total_capacity = new_stock_int
                return {
                    'product_id': product_id,
                    'product_name': product_data.get('name'),
                    'slot_id': slot_id,
                    'slot_label': slot_label,
                    'date_id': date_id,
                    'date': date_str,
                    'old_stock': old_stock_int,
                    'new_stock': new_stock_int,
                    'stock': new_stock_int,
                    'available': new_stock_int,
                    'total_capacity': new_total_capacity,
                    'tickets_sold': total_tickets_sold
                }
        except Exception as e:
            raise WooCommerceAPIError(f"Failed to set inventory for product {product_id}: {str(e)}") 