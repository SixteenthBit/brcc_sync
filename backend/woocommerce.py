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
        Prioritizes fooevents_bookings_options_serialized for complex/multi-slot events.
        Falls back to manage_stock, then WooCommerceEventsEvent flag for single/synthetic events.
        """
        product_id = product.get('id', 'Unknown')
        product_name = product.get('name', 'Unknown Product')

        if not product or not product.get('meta_data'):
            logging.warning(f"Product {product_id} ({product_name}): No product data or meta_data found")
            return None

        meta_data = product.get('meta_data', [])

        # Helper to generate synthetic data for single events
        def _generate_synthetic_data(p_id, p_name, p_meta_data, p_stock_quantity=None):
            _event_meta_fields = {m.get('key'): m.get('value') for m in p_meta_data if m.get('key', '').startswith('WooCommerceEvents')}
            _event_date = _event_meta_fields.get('WooCommerceEventsDate', '')
            _event_hour = _event_meta_fields.get('WooCommerceEventsHour', '00')
            _event_minutes = _event_meta_fields.get('WooCommerceEventsMinutes', '00')
            _event_period = _event_meta_fields.get('WooCommerceEventsPeriod', '')
            
            _stock_to_use = p_stock_quantity if p_stock_quantity is not None else 999

            if p_stock_quantity is None: # Try to derive stock if not directly provided (e.g., from WC stock_quantity)
                _fbos_meta_for_synthetic_helper = next((m for m in p_meta_data if m.get('key') == 'fooevents_bookings_options_serialized'), None)
                if _fbos_meta_for_synthetic_helper and _fbos_meta_for_synthetic_helper.get('value'):
                    try:
                        _bdata_val_check = _fbos_meta_for_synthetic_helper['value']
                        if isinstance(_bdata_val_check, str): _bdata_val_check = json.loads(_bdata_val_check)
                        
                        if _bdata_val_check and len(_bdata_val_check) == 1:
                            _first_slot_key = list(_bdata_val_check.keys())[0]
                            _first_slot_data = _bdata_val_check[_first_slot_key]
                            if isinstance(_first_slot_data, dict):
                                if f"date_{p_id}_stock" in _first_slot_data:
                                    _stock_to_use = int(_first_slot_data[f"date_{p_id}_stock"] or 0)
                                elif 'add_date' in _first_slot_data and isinstance(_first_slot_data['add_date'], dict) and len(_first_slot_data['add_date']) == 1:
                                    _date_detail_key = list(_first_slot_data['add_date'].keys())[0]
                                    _date_detail_val = _first_slot_data['add_date'][_date_detail_key]
                                    if isinstance(_date_detail_val, dict) and 'stock' in _date_detail_val:
                                        _stock_to_use = int(_date_detail_val['stock'] or 0)
                                elif not _first_slot_key.startswith(f"event_") and len([k for k in _first_slot_data if k.endswith('_add_date')]) == 1:
                                    _stock_keys = [k for k in _first_slot_data if k.endswith('_stock')]
                                    if _stock_keys: _stock_to_use = int(_first_slot_data[_stock_keys[0]] or 0)
                    except Exception:
                        logging.debug(f"Product {p_id} ({p_name}): Synthetic helper could not determine stock from FBOS, using default/WC stock.")
                        pass
            
            _synthetic_slot_id = f"event_{p_id}"
            _synthetic_date_id = f"date_{p_id}"
            logging.debug(f"Product {p_id} ({p_name}): Generating synthetic data with stock: {_stock_to_use}")
            return {
                _synthetic_slot_id: {
                    'label': f"{p_name} Show", 'hour': _event_hour, 'minute': _event_minutes,
                    'period': _event_period, 'add_time': 'enabled',
                    f'{_synthetic_date_id}_add_date': _event_date, f'{_synthetic_date_id}_stock': str(_stock_to_use)
                }
            }

        # --- Start of refactored logic ---

        # 1. Prioritize fooevents_bookings_options_serialized (FBOS) for complex/multi-slot data
        fooevents_meta = next((meta for meta in meta_data if meta.get('key') == 'fooevents_bookings_options_serialized'), None)
        parsed_fbos_for_later_synthetic_check = None

        if fooevents_meta and fooevents_meta.get('value'):
            try:
                booking_data_raw = fooevents_meta['value']
                booking_data_parsed = json.loads(booking_data_raw) if isinstance(booking_data_raw, str) else booking_data_raw

                if booking_data_parsed and len(booking_data_parsed) > 0:
                    is_complex_booking = False
                    if len(booking_data_parsed) > 1:
                        is_complex_booking = True
                    elif len(booking_data_parsed) == 1:
                        first_slot_key = list(booking_data_parsed.keys())[0]
                        if not first_slot_key.startswith(f"event_{product_id}"):
                            first_slot_data = booking_data_parsed[first_slot_key]
                            if isinstance(first_slot_data, dict):
                                if ('add_date' in first_slot_data and isinstance(first_slot_data['add_date'], dict) and len(first_slot_data['add_date']) > 1) or \
                                   (len([k for k in first_slot_data if k.endswith('_add_date')]) > 1):
                                    is_complex_booking = True
                    
                    if is_complex_booking:
                        logging.info(f"Product {product_id} ({product_name}): Detected complex booking structure in FBOS. Prioritizing this data.")
                        return booking_data_parsed
                    else:
                        # Parsed FBOS, but not complex. Store for potential synthetic check later.
                        parsed_fbos_for_later_synthetic_check = booking_data_parsed
                        logging.debug(f"Product {product_id} ({product_name}): FBOS parsed but not complex. Will check other indicators.")
                else: # FBOS was empty
                    logging.debug(f"Product {product_id} ({product_name}): FBOS meta found but value is empty or not structured.")

            except (json.JSONDecodeError, TypeError) as e:
                logging.error(f"Product {product_id} ({product_name}): Error parsing FBOS - {e}. Proceeding to other checks.")
                # Error in parsing, so FBOS cannot be used directly or for later synthetic check.
                parsed_fbos_for_later_synthetic_check = None
        else:
            logging.debug(f"Product {product_id} ({product_name}): No FBOS meta found or value is empty.")


        # 2. Fallback: Check for standard WooCommerce stock management
        manage_stock = product.get('manage_stock', False)
        stock_quantity_val = product.get('stock_quantity')
        if manage_stock and stock_quantity_val is not None:
            logging.info(f"Product {product_id} ({product_name}): Uses WooCommerce stock management (manage_stock=True). Generating synthetic single event data.")
            return _generate_synthetic_data(product_id, product_name, meta_data, stock_quantity_val)

        # 3. Fallback: Check for 'WooCommerceEventsEvent' == 'Event' (explicit single event flag)
        event_meta_fields = {meta.get('key'): meta.get('value') for meta in meta_data if meta.get('key', '').startswith('WooCommerceEvents')}
        is_explicit_single_event = event_meta_fields.get('WooCommerceEventsEvent') == 'Event'
        if is_explicit_single_event:
            logging.info(f"Product {product_id} ({product_name}): Flagged as 'WooCommerceEventsEvent: Event'. Generating synthetic single event data.")
            return _generate_synthetic_data(product_id, product_name, meta_data, None) # Stock derived/defaulted in helper

        # 4. Fallback: Check if FBOS was parsed earlier (but wasn't complex) and matches a synthetic pattern
        if parsed_fbos_for_later_synthetic_check:
            # This implies FBOS was successfully parsed in step 1 but wasn't deemed complex.
            # Now check if this simple FBOS structure matches our known synthetic pattern.
            if len(parsed_fbos_for_later_synthetic_check) == 1:
                _first_slot_key = list(parsed_fbos_for_later_synthetic_check.keys())[0]
                if _first_slot_key == f"event_{product_id}":
                    logging.warning(f"Product {product_id} ({product_name}): FBOS data (parsed but not complex) matches synthetic pattern. Generating synthetic data using FBOS content for stock.")
                    # Pass meta_data so _generate_synthetic_data can re-parse FBOS if needed for stock, or use its internal logic
                    return _generate_synthetic_data(product_id, product_name, meta_data, None)
        
        # 5. Final fallback: No definitive indicators found
        logging.warning(f"Product {product_id} ({product_name}): No definitive FooEvents data found after all checks. Cannot determine event structure.")
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
                        
                        # Log available keys in slot_data and the specific key we're looking for
                        logging.debug(f"Product {product_id}, Slot '{slot_label}', DateID '{date_id}': Checking for override stock. slot_data keys: {list(slot_data.keys())}. Target key: '{date_id}_stock'")
                        
                        # Prioritize DATEID_stock from slot_data if it exists
                        override_stock_str = slot_data.get(f"{date_id}_stock")
                        
                        if override_stock_str is not None:
                            stock_from_booking_options_str = override_stock_str
                            logging.debug(f"Product {product_id}, Slot '{slot_label}', Date '{date_str}', DateID '{date_id}': Using override stock '{override_stock_str}' from slot_data.{date_id}_stock")
                        else:
                            stock_from_booking_options_str = date_info.get('stock', '0')
                            logging.debug(f"Product {product_id}, Slot '{slot_label}', Date '{date_str}', DateID '{date_id}': Using nested stock '{stock_from_booking_options_str}' from add_date.{date_id}.stock. Override key '{date_id}_stock' not found in slot_data.")

                        try:
                            stock_from_booking_options = int(stock_from_booking_options_str) if stock_from_booking_options_str != '' else 0
                        except (ValueError, TypeError):
                            stock_from_booking_options = 0
                        
                        # Call refactored _get_accurate_capacity_data
                        returned_stock_from_booking, db_tickets_sold = self._get_accurate_capacity_data(
                            product_id, slot_label, date_str, stock_from_booking_options
                        )

                        actual_tickets_sold = db_tickets_sold
                        actual_available_stock = returned_stock_from_booking # This is FooEvents' view of available

                        if isinstance(returned_stock_from_booking, int) and isinstance(db_tickets_sold, int):
                            actual_total_capacity = returned_stock_from_booking + db_tickets_sold
                        else:
                            actual_total_capacity = "Error" # If either is an error, capacity is error
                            if not isinstance(returned_stock_from_booking, int): # If booking stock itself is error
                                actual_available_stock = "Error"

                        dates.append({
                            'date_id': date_id,
                            'date': date_str,
                            'stock': stock_from_booking_options, # This now reflects the prioritized stock
                            'available': actual_available_stock,
                            'total_capacity': actual_total_capacity,
                            'tickets_sold': actual_tickets_sold
                        })
            else:
                # Format 2: Flat structure (e.g., synthetic events or events without nested add_date)
                # This part should inherently use slot_data[DATEID_stock] if it's the primary way stock is stored for these.
                date_entries = {}
                
                for key, value in slot_data.items():
                    if key.endswith('_add_date'):
                        date_id = key.replace('_add_date', '')
                        if date_id not in date_entries: date_entries[date_id] = {}
                        date_entries[date_id]['date'] = value
                    elif key.endswith('_stock'):
                        date_id = key.replace('_stock', '')
                        if date_id not in date_entries: date_entries[date_id] = {}
                        date_entries[date_id]['stock'] = value
                        # Ensure we capture this stock, as it's the primary source for flat structures
                
                for date_id, date_info_flat in date_entries.items():
                    if 'date' in date_info_flat:
                        date_str = date_info_flat.get('date', 'Unknown Date')
                        # For flat structure, date_info_flat['stock'] is the authoritative stock from slot_data
                        stock_from_booking_options_str = date_info_flat.get('stock', '0')
                        logging.debug(f"Product {product_id}, Slot '{slot_label}', Date '{date_str}': Using flat stock '{stock_from_booking_options_str}' from slot_data.{date_id}_stock")
                        
                        try:
                            stock_from_booking_options = int(stock_from_booking_options_str) if stock_from_booking_options_str != '' else 0
                        except (ValueError, TypeError):
                            stock_from_booking_options = 0
                        
                        returned_stock_from_booking, db_tickets_sold = self._get_accurate_capacity_data(
                            product_id, slot_label, date_str, stock_from_booking_options
                        )

                        actual_tickets_sold = db_tickets_sold
                        actual_available_stock = returned_stock_from_booking

                        if isinstance(returned_stock_from_booking, int) and isinstance(db_tickets_sold, int):
                            actual_total_capacity = returned_stock_from_booking + db_tickets_sold
                        else:
                            actual_total_capacity = "Error"
                            if not isinstance(returned_stock_from_booking, int):
                                actual_available_stock = "Error"
                                
                        dates.append({
                            'date_id': date_id,
                            'date': date_str,
                            'stock': stock_from_booking_options, # This is the prioritized stock
                            'available': actual_available_stock,
                            'total_capacity': actual_total_capacity,
                            'tickets_sold': actual_tickets_sold
                        })
            
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

    def _get_accurate_capacity_data(self, product_id: int, slot_label: str, date_str: str, stock_from_booking_options: int) -> tuple[Union[int, str], Union[int, str]]:
        """
        Gets tickets_sold from DB. The 'stock_from_booking_options' is what FooEvents considers available.
        
        Args:
            product_id: WooCommerce product ID
            slot_label: Slot label (e.g., "Sunday 6pm")
            date_str: Date string (e.g., "January 15, 2024")
            stock_from_booking_options: Stock value directly from fooevents_bookings_options_serialized for the slot/date.
                                         This is the value FooEvents considers "available".
            
        Returns:
            Tuple of (stock_from_booking_options, tickets_sold_from_db).
            The first element is essentially passed through.
            tickets_sold_from_db can be "DB Error" string if issues occur.
        """
        if not self.wp_db_available:
            logging.warning(f"DB not available for product {product_id}, slot '{slot_label}', date '{date_str}'")
            # Pass through stock_from_booking_options even if DB is down, as it's still a piece of info.
            return stock_from_booking_options, "DB Error"
        
        tickets_sold_from_db = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str)
        
        if tickets_sold_from_db is None or not isinstance(tickets_sold_from_db, int):
            logging.warning(f"Could not determine tickets sold via DB for product {product_id}, slot '{slot_label}', date '{date_str}'. Received: {tickets_sold_from_db}")
            return stock_from_booking_options, "DB Error"

        logging.info(f"Product {product_id}, Slot '{slot_label}', Date '{date_str}': BookingStock(Available)={stock_from_booking_options}, SoldDB={tickets_sold_from_db}")
        return stock_from_booking_options, tickets_sold_from_db

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
                
                if date_id and date_id in add_date: # This check is for nested structure
                    date_info = add_date[date_id]
                    stock = date_info.get('stock', 0)
                    
                    try:
                        available = int(stock) if stock != '' else 0
                    except (ValueError, TypeError):
                        available = 0
                    
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
                elif date_id and f"{date_id}_add_date" in slot_data: # Check for flat structure
                    date_str = slot_data.get(f"{date_id}_add_date")
                    stock = slot_data.get(f"{date_id}_stock", 0)
                    try:
                        available = int(stock) if stock != '' else 0
                    except (ValueError, TypeError):
                        available = 0
                    
                    total_capacity, tickets_sold = self._get_accurate_capacity_data(
                        product_id, slot_data.get('label'), date_str, available
                    )
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'date_id': date_id,
                        'date': date_str,
                        'stock': available,
                        'available': available,
                        'total_capacity': total_capacity,
                        'tickets_sold': tickets_sold
                    }
                else: # Return all dates for the slot if date_id not specified or not found
                    dates = []
                    if isinstance(add_date, dict) and add_date: # Nested
                        for did, d_info in add_date.items():
                            _stock = d_info.get('stock', 0)
                            try: _avail = int(_stock) if _stock != '' else 0
                            except: _avail = 0
                            _tc, _ts = self._get_accurate_capacity_data(product_id, slot_data.get('label'), d_info.get('date'), _avail)
                            dates.append({'date_id': did, 'date': d_info.get('date'), 'stock': _avail, 'available': _avail, 'total_capacity': _tc, 'tickets_sold': _ts})
                    else: # Flat
                        date_entries_inv = {}
                        for k, v_val in slot_data.items():
                            if k.endswith('_add_date'): date_entries_inv[k.replace('_add_date', '')] = {'date': v_val}
                            elif k.endswith('_stock'):
                                _d_id = k.replace('_stock', '')
                                if _d_id not in date_entries_inv: date_entries_inv[_d_id] = {}
                                date_entries_inv[_d_id]['stock'] = v_val
                        for did, d_info in date_entries_inv.items():
                            if 'date' in d_info:
                                _stock = d_info.get('stock',0)
                                try: _avail = int(_stock) if _stock != '' else 0
                                except: _avail = 0
                                _tc, _ts = self._get_accurate_capacity_data(product_id, slot_data.get('label'), d_info.get('date'), _avail)
                                dates.append({'date_id': did, 'date': d_info.get('date'), 'stock': _avail, 'available': _avail, 'total_capacity': _tc, 'tickets_sold': _ts})
                    
                    return {
                        'product_id': product_id,
                        'product_name': product_data.get('name'),
                        'slot_id': slot_id,
                        'slot_label': slot_data.get('label'),
                        'dates': dates
                    }
            else: # Return all slots and dates if slot_id not specified
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
            logging.info(f"Product {product_id} ({product_data.get('name')}): Uses WooCommerce stock management - treating as normal FooEvents")
            return False

        # NEW SECONDARY CHECK: Prioritize WooCommerceEventsEvent metadata if present
        meta_data = product_data.get('meta_data', [])
        woo_events_event_meta = next((meta for meta in meta_data if meta.get('key') == 'WooCommerceEventsEvent'), None)
        if woo_events_event_meta and woo_events_event_meta.get('value') == 'Event':
            logging.info(f"Product {product_id} ({product_data.get('name')}): Has 'WooCommerceEventsEvent: Event' metadata - treating as normal FooEvents")
            return False
        
        # TERTIARY CHECK: Analyze fooevents_bookings_options_serialized if not caught by above checks
        fooevents_booking_meta = next((meta for meta in meta_data if meta.get('key') == 'fooevents_bookings_options_serialized'), None)
        
        if fooevents_booking_meta:
            value = fooevents_booking_meta.get('value')
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
                        
                        is_synthetic_slot = first_slot_key == f"event_{product_id}"
                        
                        if is_synthetic_slot:
                            expected_date_key = f"date_{product_id}_add_date"
                            expected_stock_key = f"date_{product_id}_stock"
                            has_synthetic_dates = (
                                isinstance(first_slot, dict) and # Ensure first_slot is a dict
                                expected_date_key in first_slot and
                                expected_stock_key in first_slot
                            )
                            if has_synthetic_dates:
                                logging.info(f"Product {product_id} ({product_data.get('name')}): Detected synthetic booking data - treating as normal FooEvents")
                                return False
                        
                        # Check if it has real nested add_date structure (genuine bookings)
                        # Ensure first_slot is a dict before checking 'add_date'
                        if isinstance(first_slot, dict) and 'add_date' in first_slot and first_slot['add_date']:
                            logging.info(f"Product {product_id} ({product_data.get('name')}): Detected nested add_date structure - treating as real FooEvents Bookings")
                            return True
                        
                        # Check if it has non-synthetic flat structure
                        # Ensure first_slot is a dict before checking keys
                        if isinstance(first_slot, dict):
                            has_flat_dates = any(k.endswith('_add_date') for k in first_slot.keys())
                            if has_flat_dates and not is_synthetic_slot:
                                logging.info(f"Product {product_id} ({product_data.get('name')}): Detected non-synthetic flat structure - treating as real FooEvents Bookings")
                                return True
                        
                        # FALLBACK for booking_data: If booking data exists but doesn't match above, and wasn't caught by earlier checks,
                        # assume it's a real booking if it's not empty.
                        logging.warning(f"Product {product_id} ({product_data.get('name')}): Has booking data not matching known single/synthetic patterns - treating as real FooEvents Bookings by default")
                        return True
                        
                except (json.JSONDecodeError, TypeError) as e:
                    logging.error(f"Product {product_id} ({product_data.get('name')}): Error parsing fooevents_bookings_options_serialized - {e}. Treating as normal FooEvents as a precaution.")
                    return False # If booking data is malformed, safer to assume normal event
        
        # FINAL FALLBACK: If no manage_stock, no WooCommerceEventsEvent='Event', and no (or unparseable) booking_options_serialized,
        # it's most likely a simple product or misconfigured. Treat as normal FooEvents.
        logging.info(f"Product {product_id} ({product_data.get('name')}): No definitive booking indicators - treating as normal FooEvents by default")
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
                # If it's a single (synthetic) event, slot_id and date_id might be derived
                if f"event_{product_id}" in booking_data and f"date_{product_id}" in date_id: # Check if it's our synthetic structure
                    pass # Allow to proceed
                else:
                    raise WooCommerceAPIError(f"Both slot_id and date_id are required for inventory management of multi-slot/date events")
            
            if slot_id not in booking_data:
                raise WooCommerceAPIError(f"Slot {slot_id} not found in product {product_id}")
            
            slot_data = booking_data[slot_id]
            
            is_real_bookings_product = self._is_real_bookings_product(product_data)
            
            if is_real_bookings_product:
                # This is a real FooEvents Bookings product - update booking metadata
                add_date = slot_data.get('add_date', {})
                is_nested_structure = isinstance(add_date, dict) and add_date
                
                if is_nested_structure:
                    if date_id not in add_date:
                        raise WooCommerceAPIError(f"Date {date_id} not found in slot {slot_id} for product {product_id}")
                    
                    date_info = add_date[date_id]
                    old_stock = date_info.get('stock', '0')
                    
                    try: old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError): old_stock_int = 0
                    
                    new_stock_int = old_stock_int + 1
                    date_info['stock'] = str(new_stock_int)
                    
                    await self._update_product_booking_data(product_id, booking_data)
                    
                    slot_label = slot_data.get('label')
                    date_str = date_info.get('date')
                    tickets_sold = 0
                    if slot_label and date_str and self.wp_db_available:
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) or 0
                    new_total_capacity = new_stock_int + tickets_sold
                    
                    return {
                        'product_id': product_id, 'product_name': product_data.get('name'),
                        'slot_id': slot_id, 'slot_label': slot_label,
                        'date_id': date_id, 'date': date_str,
                        'old_stock': old_stock_int, 'new_stock': new_stock_int,
                        'stock': new_stock_int, 'available': new_stock_int,
                        'total_capacity': new_total_capacity, 'tickets_sold': tickets_sold
                    }
                else: # Flat structure for real bookings
                    stock_key = f'{date_id}_stock'
                    date_key = f'{date_id}_add_date'
                    
                    if stock_key not in slot_data:
                        raise WooCommerceAPIError(f"Stock field {stock_key} not found in slot {slot_id} for product {product_id}")
                    
                    old_stock = slot_data[stock_key]
                    try: old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError): old_stock_int = 0
                    
                    new_stock_int = old_stock_int + 1
                    slot_data[stock_key] = str(new_stock_int)
                    
                    await self._update_product_booking_data(product_id, booking_data)

                    slot_label = slot_data.get('label')
                    date_str = slot_data.get(date_key, 'Unknown Date')
                    tickets_sold = 0
                    if slot_label and date_str != 'Unknown Date' and self.wp_db_available:
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) or 0
                    new_total_capacity = new_stock_int + tickets_sold
                    
                    return {
                        'product_id': product_id, 'product_name': product_data.get('name'),
                        'slot_id': slot_id, 'slot_label': slot_label,
                        'date_id': date_id, 'date': date_str,
                        'old_stock': old_stock_int, 'new_stock': new_stock_int,
                        'stock': new_stock_int, 'available': new_stock_int,
                        'total_capacity': new_total_capacity, 'tickets_sold': tickets_sold
                    }
            else: # Normal FooEvents product (synthetic or WC stock managed)
                old_stock_quantity = product_data.get('stock_quantity')
                if old_stock_quantity is None: # Not WC stock managed, use synthetic stock
                    old_stock_quantity = slot_data.get(f"{date_id}_stock", '0') # date_id here is synthetic like "date_PRODUCTID"

                try: old_stock_int = int(old_stock_quantity) if old_stock_quantity is not None and old_stock_quantity != '' else 0
                except (ValueError, TypeError): old_stock_int = 0
                
                new_stock_int = old_stock_int + 1
                
                if product_data.get('manage_stock', False) and product_data.get('stock_quantity') is not None:
                    await self._update_product_stock_quantity(product_id, new_stock_int)
                else: # Update synthetic booking data
                    slot_data[f"{date_id}_stock"] = str(new_stock_int)
                    await self._update_product_booking_data(product_id, booking_data)

                slot_label = slot_data.get('label')
                date_str = slot_data.get(f"{date_id}_add_date", 'Unknown Date')
                total_tickets_sold = 0
                if self.wp_db_available:
                    total_tickets_sold = self.wp_db.get_total_tickets_sold_for_product(product_id) or 0
                new_total_capacity = new_stock_int + total_tickets_sold
                
                return {
                    'product_id': product_id, 'product_name': product_data.get('name'),
                    'slot_id': slot_id, 'slot_label': slot_label,
                    'date_id': date_id, 'date': date_str,
                    'old_stock': old_stock_int, 'new_stock': new_stock_int,
                    'stock': new_stock_int, 'available': new_stock_int,
                    'total_capacity': new_total_capacity, 'tickets_sold': total_tickets_sold
                }
                
        except Exception as e:
            raise WooCommerceAPIError(f"Failed to increment inventory for product {product_id}: {str(e)}")

    async def decrement_woocommerce_inventory(self, product_id: int, slot_id: str = None, date_id: str = None) -> Dict[str, Any]:
        """
        Decrement WooCommerce inventory by 1 for a specific product/slot/date.
        """
        try:
            product_data = await self.get_product_data(product_id)
            booking_data = self.extract_fooevents_data(product_data)
            
            if not booking_data:
                raise WooCommerceAPIError(f"No FooEvents data found for product {product_id}")

            if not slot_id or not date_id:
                if f"event_{product_id}" in booking_data and f"date_{product_id}" in date_id:
                    pass
                else:
                    raise WooCommerceAPIError(f"Both slot_id and date_id are required for inventory management of multi-slot/date events")

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
                    try: old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError): old_stock_int = 0
                    if old_stock_int <= 0: raise WooCommerceAPIError(f"Cannot decrement inventory below 0 (current: {old_stock_int})")
                    new_stock_int = old_stock_int - 1
                    date_info['stock'] = str(new_stock_int)
                    await self._update_product_booking_data(product_id, booking_data)
                    
                    slot_label = slot_data.get('label')
                    date_str = date_info.get('date')
                    tickets_sold = 0
                    if slot_label and date_str and self.wp_db_available:
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) or 0
                    new_total_capacity = new_stock_int + tickets_sold
                    return {
                        'product_id': product_id, 'product_name': product_data.get('name'),
                        'slot_id': slot_id, 'slot_label': slot_label,
                        'date_id': date_id, 'date': date_str,
                        'old_stock': old_stock_int, 'new_stock': new_stock_int,
                        'stock': new_stock_int, 'available': new_stock_int,
                        'total_capacity': new_total_capacity, 'tickets_sold': tickets_sold
                    }
                else: # Flat structure for real bookings
                    stock_key = f'{date_id}_stock'
                    date_key = f'{date_id}_add_date'
                    if stock_key not in slot_data:
                        raise WooCommerceAPIError(f"Stock field {stock_key} not found in slot {slot_id} for product {product_id}")
                    old_stock = slot_data[stock_key]
                    try: old_stock_int = int(old_stock) if old_stock != '' else 0
                    except (ValueError, TypeError): old_stock_int = 0
                    if old_stock_int <= 0: raise WooCommerceAPIError(f"Cannot decrement inventory below 0 (current: {old_stock_int})")
                    new_stock_int = old_stock_int - 1
                    slot_data[stock_key] = str(new_stock_int)
                    await self._update_product_booking_data(product_id, booking_data)

                    slot_label = slot_data.get('label')
                    date_str = slot_data.get(date_key, 'Unknown Date')
                    tickets_sold = 0
                    if slot_label and date_str != 'Unknown Date' and self.wp_db_available:
                        tickets_sold = self.wp_db.get_tickets_sold_for_date(product_id, slot_label, date_str) or 0
                    new_total_capacity = new_stock_int + tickets_sold
                    return {
                        'product_id': product_id, 'product_name': product_data.get('name'),
                        'slot_id': slot_id, 'slot_label': slot_label,
                        'date_id': date_id, 'date': date_str,
                        'old_stock': old_stock_int, 'new_stock': new_stock_int,
                        'stock': new_stock_int, 'available': new_stock_int,
                        'total_capacity': new_total_capacity, 'tickets_sold': tickets_sold
                    }
            else: # Normal FooEvents product
                old_stock_quantity = product_data.get('stock_quantity')
                if old_stock_quantity is None:
                    old_stock_quantity = slot_data.get(f"{date_id}_stock", '0')

                try: old_stock_int = int(old_stock_quantity) if old_stock_quantity is not None and old_stock_quantity != '' else 0
                except (ValueError, TypeError): old_stock_int = 0
                if old_stock_int <= 0: raise WooCommerceAPIError(f"Cannot decrement inventory below 0 (current: {old_stock_int})")
                new_stock_int = old_stock_int - 1
                
                if product_data.get('manage_stock', False) and product_data.get('stock_quantity') is not None:
                    await self._update_product_stock_quantity(product_id, new_stock_int)
                else:
                    slot_data[f"{date_id}_stock"] = str(new_stock_int)
                    await self._update_product_booking_data(product_id, booking_data)

                slot_label = slot_data.get('label')
                date_str = slot_data.get(f"{date_id}_add_date", 'Unknown Date')
                total_tickets_sold = 0
                if self.wp_db_available:
                    total_tickets_sold = self.wp_db.get_total_tickets_sold_for_product(product_id) or 0
                new_total_capacity = new_stock_int + total_tickets_sold
                return {
                    'product_id': product_id, 'product_name': product_data.get('name'),
                    'slot_id': slot_id, 'slot_label': slot_label,
                    'date_id': date_id, 'date': date_str,
                    'old_stock': old_stock_int, 'new_stock': new_stock_int,
                    'stock': new_stock_int, 'available': new_stock_int,
                    'total_capacity': new_total_capacity, 'tickets_sold': total_tickets_sold
                }
        except Exception as e:
            raise WooCommerceAPIError(f"Failed to decrement inventory for product {product_id}: {str(e)}")

    async def _update_product_booking_data(self, product_id: int, booking_data: Dict[str, Any]) -> None:
        """
        Update a product's FooEvents booking data via WooCommerce API.
        """
        try:
            booking_json_string = json.dumps(booking_data)
            update_data = {'meta_data': [{'key': 'fooevents_bookings_options_serialized', 'value': booking_json_string}]}
            url = f"{self.base_url}/products/{product_id}"
            params = {'consumer_key': self.consumer_key, 'consumer_secret': self.consumer_secret}
            put_headers = {'Content-Type': 'application/json'}
            response = requests.put(url, headers=put_headers, params=params, json=update_data)
            response.raise_for_status()
            logging.info(f"Successfully updated booking data for product {product_id}")
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to update booking data for product {product_id}: {e}")
            raise WooCommerceAPIError(f"Failed to update booking data: {str(e)}")

    async def _update_product_stock_quantity(self, product_id: int, new_stock: int) -> None:
        """
        Update a product's stock_quantity via WooCommerce API.
        """
        try:
            update_data = {'stock_quantity': new_stock, 'manage_stock': True}
            url = f"{self.base_url}/products/{product_id}"
            params = {'consumer_key': self.consumer_key, 'consumer_secret': self.consumer_secret}
            put_headers = {'Content-Type': 'application/json'}
            response = requests.put(url, headers=put_headers, params=params, json=update_data)
            response.raise_for_status()
            logging.info(f"Successfully updated stock quantity for product {product_id} to {new_stock}")
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to update stock quantity for product {product_id}: {e}")
            raise WooCommerceAPIError(f"Failed to update stock quantity: {str(e)}")

    def _get_product_sort_key(self, product: Dict[str, Any]) -> tuple:
        product_name = product.get('product_name', '').lower()
        day_of_week = self._get_day_of_week(product_name)
        if day_of_week > 0:
            show_time = self._get_show_time(product_name)
            return (0, day_of_week, show_time)
        else:
            earliest_date = self._get_earliest_product_date(product)
            return (1, earliest_date, 0)
    
    def _get_day_of_week(self, title: str) -> int:
        title_lower = title.lower()
        if 'feedback' in title_lower and 'open mic' in title_lower: return 1
        if 'monday' in title_lower: return 1
        elif 'tuesday' in title_lower: return 2
        elif 'wednesday' in title_lower: return 3
        elif 'thursday' in title_lower: return 4
        elif 'friday' in title_lower: return 5
        elif 'saturday' in title_lower: return 6
        elif 'sunday' in title_lower: return 7
        return 0
    
    def _get_show_time(self, title: str) -> int:
        title_lower = title.lower()
        if '8pm' in title_lower or '8 pm' in title_lower: return 8
        elif '10pm' in title_lower or '10 pm' in title_lower: return 10
        import re
        time_match = re.search(r'(\d{1,2})\s*pm', title_lower)
        if time_match: return int(time_match.group(1))
        return 0
    
    def _get_earliest_product_date(self, product: Dict[str, Any]) -> str:
        slots = product.get('slots', [])
        if not slots: return product.get('product_name', 'zzz_unknown')
        earliest_date = None
        for slot in slots:
            dates = slot.get('dates', [])
            for date_info in dates:
                date_str = date_info.get('date')
                if date_str:
                    try:
                        parsed_date = self._parse_date(date_str)
                        if earliest_date is None or parsed_date < earliest_date:
                            earliest_date = parsed_date
                    except (ValueError, AttributeError): continue
        if earliest_date: return earliest_date.isoformat()
        else: return product.get('product_name', 'zzz_unknown')

    async def set_woocommerce_inventory(self, product_id: int, slot_id: str = None, date_id: str = None, new_stock: int = 0) -> Dict[str, Any]:
        try:
            product_data = await self.get_product_data(product_id)
            booking_data = self.extract_fooevents_data(product_data)
            if not booking_data: raise WooCommerceAPIError(f"No FooEvents data found for product {product_id}")
            if not slot_id or not date_id:
                if f"event_{product_id}" in booking_data and f"date_{product_id}" in date_id: pass
                else: raise WooCommerceAPIError(f"Both slot_id and date_id are required for inventory management")
            if slot_id not in booking_data: raise WooCommerceAPIError(f"Slot {slot_id} not found in product {product_id}")
            
            slot_data = booking_data[slot_id]
            is_real_bookings_product = self._is_real_bookings_product(product_data)
            
            old_stock_int = 0
            if is_real_bookings_product:
                add_date = slot_data.get('add_date', {})
                is_nested_structure = isinstance(add_date, dict) and add_date
                if is_nested_structure:
                    if date_id not in add_date: raise WooCommerceAPIError(f"Date {date_id} not found in slot {slot_id}")
                    date_info = add_date[date_id]
                    old_stock = date_info.get('stock', '0')
                    try: old_stock_int = int(old_stock) if old_stock != '' else 0
                    except: old_stock_int = 0
                    date_info['stock'] = str(new_stock)
                else: # Flat structure
                    stock_key = f'{date_id}_stock'
                    if stock_key not in slot_data: raise WooCommerceAPIError(f"Stock field {stock_key} not found")
                    old_stock = slot_data[stock_key]
                    try: old_stock_int = int(old_stock) if old_stock != '' else 0
                    except: old_stock_int = 0
                    slot_data[stock_key] = str(new_stock)
                await self._update_product_booking_data(product_id, booking_data)
            else: # Normal FooEvents (synthetic or WC stock)
                old_stock_quantity = product_data.get('stock_quantity')
                if old_stock_quantity is None: # Not WC stock managed, use synthetic stock
                     old_stock_quantity = slot_data.get(f"{date_id}_stock", '0')
                try: old_stock_int = int(old_stock_quantity) if old_stock_quantity is not None and old_stock_quantity != '' else 0
                except: old_stock_int = 0

                if product_data.get('manage_stock', False) and product_data.get('stock_quantity') is not None:
                    await self._update_product_stock_quantity(product_id, new_stock)
                else: # Update synthetic booking data
                    slot_data[f"{date_id}_stock"] = str(new_stock)
                    await self._update_product_booking_data(product_id, booking_data)

            # Common return structure preparation
            final_product_data = await self.get_product_data(product_id) # Re-fetch to confirm changes
            final_booking_data = self.extract_fooevents_data(final_product_data)
            final_slot_data = final_booking_data.get(slot_id, {})
            final_date_info = {}
            final_date_str = "Unknown Date"

            if is_real_bookings_product: # This was determined based on initial product_data, not final_product_data
                _add_date = final_slot_data.get('add_date', {})
                if isinstance(_add_date, dict) and date_id in _add_date: # Nested
                    final_date_info = _add_date[date_id]
                    final_date_str = final_date_info.get('date', 'Unknown Date')
                elif f"{date_id}_add_date" in final_slot_data: # Flat
                    final_date_str = final_slot_data.get(f"{date_id}_add_date", 'Unknown Date')
                    final_date_info = {'stock': final_slot_data.get(f"{date_id}_stock", '0')}
            else: # Synthetic
                final_date_str = final_slot_data.get(f"{date_id}_add_date", 'Unknown Date')
                final_date_info = {'stock': final_slot_data.get(f"{date_id}_stock", '0')}

            current_available_stock = 0
            try: current_available_stock = int(final_date_info.get('stock', '0'))
            except: pass

            tickets_sold_val = 0
            total_capacity_val = current_available_stock # Default capacity to current stock
            if self.wp_db_available:
                # Use the label from final_slot_data for accuracy if it exists
                _slot_label_for_db = final_slot_data.get('label', slot_data.get('label')) 
                _tc, _ts = self._get_accurate_capacity_data(product_id, _slot_label_for_db, final_date_str, current_available_stock)
                if isinstance(_ts, int): tickets_sold_val = _ts
                if isinstance(_tc, int): total_capacity_val = _tc
                # If _tc is DB error string, total_capacity_val remains current_available_stock + tickets_sold_val (if _ts is int)
                elif not isinstance(_tc, int) and isinstance(_ts, int): # TC is error, TS is number
                    total_capacity_val = current_available_stock + tickets_sold_val
                elif not isinstance(_tc, int) and not isinstance(_ts, int): # Both error
                     total_capacity_val = current_available_stock # Best guess

            return {
                'product_id': product_id, 'product_name': final_product_data.get('name'),
                'slot_id': slot_id, 'slot_label': final_slot_data.get('label'),
                'date_id': date_id, 'date': final_date_str,
                'old_stock': old_stock_int, 'new_stock': new_stock, # new_stock is the target value
                'stock': current_available_stock, # current actual stock after update
                'available': current_available_stock,
                'total_capacity': total_capacity_val,
                'tickets_sold': tickets_sold_val
            }
        except Exception as e:
            raise WooCommerceAPIError(f"Failed to set inventory for product {product_id}: {str(e)}")