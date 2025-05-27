"""
WordPress database client for querying FooEvents ticket data.
Connects to WordPress MySQL database to get actual ticket sales from event_magic_tickets CPT.
"""

import os
import pymysql
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

class WordPressDBError(Exception):
    """Custom exception for WordPress database errors"""
    pass

class WordPressDBClient:
    def __init__(self):
        self.host = os.getenv('WORDPRESS_DB_HOST', 'localhost')
        self.port = int(os.getenv('WORDPRESS_DB_PORT', '3306'))
        self.user = os.getenv('WORDPRESS_DB_USER')
        self.password = os.getenv('WORDPRESS_DB_PASSWORD')
        self.database = os.getenv('WORDPRESS_DB_NAME')
        self.table_prefix = os.getenv('WORDPRESS_TABLE_PREFIX', 'wp_')
        
        # Connection will be created on demand
        self.connection = None
        
        if not all([self.user, self.password, self.database]):
            raise WordPressDBError('WordPress database credentials not found in environment variables.')
    
    def _get_connection(self):
        """Get database connection, creating it if necessary"""
        if self.connection is None or not self.connection.open:
            try:
                self.connection = pymysql.connect(
                    host=self.host,
                    port=self.port,
                    user=self.user,
                    password=self.password,
                    database=self.database,
                    charset='utf8mb4',
                    cursorclass=pymysql.cursors.DictCursor,
                    autocommit=True
                )
                logging.info(f"Connected to WordPress database: {self.database}")
            except Exception as e:
                raise WordPressDBError(f"Failed to connect to WordPress database: {str(e)}")
        
        return self.connection
    
    def test_connection(self) -> bool:
        """Test if database connection is working"""
        try:
            conn = self._get_connection()
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return True
        except Exception as e:
            logging.error(f"WordPress database connection test failed: {e}")
            return False
    
    def get_tickets_sold_for_date(self, product_id: int, slot_name: str, booking_date: str) -> Optional[int]:
        """
        Get the actual number of tickets sold for a specific product, slot, and date.
        
        Args:
            product_id: WooCommerce product ID
            slot_name: FooEvents booking slot name (e.g., "8pm Show")
            booking_date: Booking date string (e.g., "June 07, 2025")
            
        Returns:
            Number of tickets sold, or None if database error
        """
        try:
            conn = self._get_connection()
            
            # Query to count event_magic_tickets posts for this specific booking
            # Note: Database stores slot names like "8pm Show (08:00)" but we get "8pm Show"
            # So we need to use LIKE to match the beginning of the slot name
            query = f"""
            SELECT COUNT(*) as ticket_count
            FROM {self.table_prefix}posts p
            INNER JOIN {self.table_prefix}postmeta m1 ON p.ID = m1.post_id 
            INNER JOIN {self.table_prefix}postmeta m2 ON p.ID = m2.post_id 
            INNER JOIN {self.table_prefix}postmeta m3 ON p.ID = m3.post_id 
            LEFT JOIN {self.table_prefix}postmeta m4 ON p.ID = m4.post_id AND m4.meta_key = 'WooCommerceEventsStatus'
            WHERE p.post_type = 'event_magic_tickets'
            AND p.post_status = 'publish'
            AND m1.meta_key = 'WooCommerceEventsProductID' 
            AND m1.meta_value = %s
            AND m2.meta_key = 'WooCommerceEventsBookingSlot' 
            AND m2.meta_value LIKE %s
            AND m3.meta_key = 'WooCommerceEventsBookingDate' 
            AND m3.meta_value = %s
            AND (m4.meta_value IS NULL OR m4.meta_value NOT IN ('Canceled', 'Cancelled', 'Unpaid'))
            """
            
            # Use LIKE pattern to match slot name at the beginning
            slot_pattern = f"{slot_name}%"
            
            with conn.cursor() as cursor:
                cursor.execute(query, (product_id, slot_pattern, booking_date))
                result = cursor.fetchone()
                
                if result:
                    ticket_count = result['ticket_count']
                    logging.info(f"Found {ticket_count} tickets sold for product {product_id}, slot '{slot_name}', date '{booking_date}'")
                    return ticket_count
                else:
                    logging.warning(f"No ticket data found for product {product_id}, slot '{slot_name}', date '{booking_date}'")
                    return 0
                    
        except Exception as e:
            logging.error(f"Error querying tickets sold: {e}")
            raise WordPressDBError(f"Failed to query tickets sold: {str(e)}")
    
    def get_total_tickets_sold_for_product(self, product_id: int) -> Optional[int]:
        """
        Get the total number of tickets sold for a product, regardless of slot/date metadata.
        This handles cases where tickets were sold before FooEvents Bookings was properly configured.
        
        Args:
            product_id: WooCommerce product ID
            
        Returns:
            Total number of tickets sold, or None if database error
        """
        try:
            conn = self._get_connection()
            
            # Query to count all event_magic_tickets posts for this product
            query = f"""
            SELECT COUNT(*) as ticket_count
            FROM {self.table_prefix}posts p
            INNER JOIN {self.table_prefix}postmeta m1 ON p.ID = m1.post_id 
            LEFT JOIN {self.table_prefix}postmeta m4 ON p.ID = m4.post_id AND m4.meta_key = 'WooCommerceEventsStatus'
            WHERE p.post_type = 'event_magic_tickets'
            AND p.post_status = 'publish'
            AND m1.meta_key = 'WooCommerceEventsProductID' 
            AND m1.meta_value = %s
            AND (m4.meta_value IS NULL OR m4.meta_value NOT IN ('Canceled', 'Cancelled', 'Unpaid'))
            """
            
            with conn.cursor() as cursor:
                cursor.execute(query, (product_id,))
                result = cursor.fetchone()
                
                if result:
                    ticket_count = result['ticket_count']
                    logging.info(f"Found {ticket_count} total tickets sold for product {product_id}")
                    return ticket_count
                else:
                    logging.warning(f"No ticket data found for product {product_id}")
                    return 0
                    
        except Exception as e:
            logging.error(f"Error querying total tickets sold: {e}")
            raise WordPressDBError(f"Failed to query total tickets sold: {str(e)}")
    
    def get_product_total_capacity(self, product_id: int, slot_name: str, booking_date: str = None) -> Optional[int]:
        """
        Get the original total capacity for a product/slot from FooEvents booking configuration.
        Calculates capacity as available_stock + tickets_sold for the specific date.
        
        Args:
            product_id: WooCommerce product ID
            slot_name: FooEvents booking slot name
            booking_date: Specific booking date (e.g., "May 28, 2025")
            
        Returns:
            Total capacity, or None if not found/error
        """
        try:
            conn = self._get_connection()
            
            # Query to get the FooEvents booking configuration from product meta
            query = f"""
            SELECT meta_value
            FROM {self.table_prefix}postmeta
            WHERE post_id = %s 
            AND meta_key = 'fooevents_bookings_options_serialized'
            """
            
            with conn.cursor() as cursor:
                cursor.execute(query, (product_id,))
                result = cursor.fetchone()
                
                if result and result['meta_value']:
                    # Parse the serialized booking data to find the original capacity
                    import json
                    try:
                        booking_data = json.loads(result['meta_value'])
                        
                        # Find the slot and get the stock value for the specific date
                        for slot_id, slot_info in booking_data.items():
                            if slot_info.get('label') == slot_name:
                                current_stock = 0
                                target_date = booking_date
                                
                                # Handle nested add_date structure (Format 1)
                                add_date = slot_info.get('add_date', {})
                                if isinstance(add_date, dict) and add_date:
                                    if booking_date:
                                        # Look for the specific date
                                        for date_id, date_info in add_date.items():
                                            if isinstance(date_info, dict) and date_info.get('date') == booking_date:
                                                stock = date_info.get('stock', 0)
                                                try:
                                                    current_stock = int(stock) if stock != '' else 0
                                                    target_date = date_info.get('date')
                                                    break
                                                except (ValueError, TypeError):
                                                    continue
                                    else:
                                        # No specific date requested, use the first date found
                                        for date_id, date_info in add_date.items():
                                            if isinstance(date_info, dict):
                                                stock = date_info.get('stock', 0)
                                                try:
                                                    current_stock = int(stock) if stock != '' else 0
                                                    target_date = date_info.get('date')
                                                    break
                                                except (ValueError, TypeError):
                                                    continue
                                else:
                                    # Handle flat structure with {id}_stock fields (Format 2)
                                    if booking_date:
                                        # Look for the specific date
                                        for key, value in slot_info.items():
                                            if key.endswith('_add_date') and value == booking_date:
                                                date_id = key.replace('_add_date', '')
                                                stock_key = f'{date_id}_stock'
                                                if stock_key in slot_info:
                                                    try:
                                                        current_stock = int(slot_info[stock_key]) if slot_info[stock_key] != '' else 0
                                                        target_date = value
                                                        break
                                                    except (ValueError, TypeError):
                                                        continue
                                    else:
                                        # No specific date requested, use the first stock found
                                        for key, value in slot_info.items():
                                            if key.endswith('_stock'):
                                                try:
                                                    current_stock = int(value) if value != '' else 0
                                                    # Find corresponding date
                                                    date_id = key.replace('_stock', '')
                                                    date_key = f'{date_id}_add_date'
                                                    target_date = slot_info.get(date_key, booking_date)
                                                    break
                                                except (ValueError, TypeError):
                                                    continue
                                
                                # Calculate total capacity = available stock + tickets sold for the target date
                                if target_date:
                                    try:
                                        tickets_sold = self.get_tickets_sold_for_date(product_id, slot_name, target_date)
                                        if tickets_sold is not None:
                                            total_capacity = current_stock + tickets_sold
                                            logging.info(f"Calculated total capacity {total_capacity} for product {product_id}, slot '{slot_name}', date '{target_date}' (available: {current_stock}, sold: {tickets_sold})")
                                            return total_capacity
                                        else:
                                            logging.error(f"Could not get tickets sold for product {product_id}, slot '{slot_name}', date '{target_date}'")
                                            return None
                                    except Exception as e:
                                        logging.error(f"Error calculating total capacity: {e}")
                                        return None
                                else:
                                    logging.error(f"Could not find booking date for product {product_id}, slot '{slot_name}'")
                                    return None
                        
                        # If we can't find the specific slot, return None
                        logging.warning(f"Could not find slot '{slot_name}' for product {product_id}")
                        return None
                        
                    except (json.JSONDecodeError, KeyError) as e:
                        logging.error(f"Error parsing booking data for product {product_id}: {e}")
                        return None
                else:
                    logging.warning(f"No FooEvents booking data found for product {product_id}")
                    return None
                    
        except Exception as e:
            logging.error(f"Error querying product capacity: {e}")
            raise WordPressDBError(f"Failed to query product capacity: {str(e)}")
    
    def get_database_status(self) -> Dict[str, Any]:
        """
        Get database connection status and basic info.
        
        Returns:
            Dictionary with connection status and info
        """
        try:
            conn = self._get_connection()
            
            with conn.cursor() as cursor:
                # Get basic database info
                cursor.execute("SELECT VERSION() as version")
                version_result = cursor.fetchone()
                
                # Count event_magic_tickets posts
                cursor.execute(f"""
                    SELECT COUNT(*) as total_tickets 
                    FROM {self.table_prefix}posts 
                    WHERE post_type = 'event_magic_tickets'
                """)
                tickets_result = cursor.fetchone()
                
                return {
                    'connected': True,
                    'host': self.host,
                    'database': self.database,
                    'mysql_version': version_result['version'] if version_result else 'Unknown',
                    'total_tickets': tickets_result['total_tickets'] if tickets_result else 0,
                    'table_prefix': self.table_prefix
                }
                
        except Exception as e:
            return {
                'connected': False,
                'error': str(e),
                'host': self.host,
                'database': self.database
            }
    
    def get_all_tickets_for_product(self, product_id: int) -> List[Dict[str, Any]]:
        """
        Get all tickets for a specific product for debugging purposes.
        
        Args:
            product_id: WooCommerce product ID
            
        Returns:
            List of ticket records with their metadata
        """
        try:
            conn = self._get_connection()
            
            # Query to get all event_magic_tickets posts for this product
            query = f"""
            SELECT 
                p.ID as ticket_id,
                p.post_title,
                p.post_date,
                p.post_status,
                m1.meta_value as product_id,
                m2.meta_value as booking_slot,
                m3.meta_value as booking_date,
                m4.meta_value as status
            FROM {self.table_prefix}posts p
            INNER JOIN {self.table_prefix}postmeta m1 ON p.ID = m1.post_id 
            LEFT JOIN {self.table_prefix}postmeta m2 ON p.ID = m2.post_id AND m2.meta_key = 'WooCommerceEventsBookingSlot'
            LEFT JOIN {self.table_prefix}postmeta m3 ON p.ID = m3.post_id AND m3.meta_key = 'WooCommerceEventsBookingDate'
            LEFT JOIN {self.table_prefix}postmeta m4 ON p.ID = m4.post_id AND m4.meta_key = 'WooCommerceEventsStatus'
            WHERE p.post_type = 'event_magic_tickets'
            AND m1.meta_key = 'WooCommerceEventsProductID' 
            AND m1.meta_value = %s
            ORDER BY p.post_date DESC
            """
            
            with conn.cursor() as cursor:
                cursor.execute(query, (product_id,))
                results = cursor.fetchall()
                
                tickets = []
                for row in results:
                    tickets.append({
                        'ticket_id': row['ticket_id'],
                        'post_title': row['post_title'],
                        'post_date': row['post_date'],
                        'post_status': row['post_status'],
                        'product_id': row['product_id'],
                        'slot': row['booking_slot'],
                        'date': row['booking_date'],
                        'status': row['status']
                    })
                
                logging.info(f"Found {len(tickets)} tickets for product {product_id}")
                return tickets
                
        except Exception as e:
            logging.error(f"Error querying all tickets for product {product_id}: {e}")
            raise WordPressDBError(f"Failed to query tickets for product: {str(e)}")
    
    def has_tickets_with_slot_metadata(self, product_id: int) -> bool:
        """
        Check if a product has any tickets with slot/date metadata (FooEvents Bookings)
        or only normal tickets without slot/date metadata.
        
        Args:
            product_id: WooCommerce product ID
            
        Returns:
            True if tickets have slot/date metadata, False if they're normal FooEvents tickets
        """
        try:
            conn = self._get_connection()
            
            # Query to count tickets with slot metadata
            query = f"""
            SELECT COUNT(*) as tickets_with_slot
            FROM {self.table_prefix}posts p
            INNER JOIN {self.table_prefix}postmeta m1 ON p.ID = m1.post_id 
            INNER JOIN {self.table_prefix}postmeta m2 ON p.ID = m2.post_id 
            WHERE p.post_type = 'event_magic_tickets'
            AND p.post_status = 'publish'
            AND m1.meta_key = 'WooCommerceEventsProductID' 
            AND m1.meta_value = %s
            AND m2.meta_key = 'WooCommerceEventsBookingSlot'
            AND m2.meta_value IS NOT NULL
            AND m2.meta_value != ''
            """
            
            with conn.cursor() as cursor:
                cursor.execute(query, (product_id,))
                result = cursor.fetchone()
                
                if result:
                    tickets_with_slot = result['tickets_with_slot']
                    logging.info(f"Product {product_id} has {tickets_with_slot} tickets with slot metadata")
                    return tickets_with_slot > 0
                else:
                    return False
                    
        except Exception as e:
            logging.error(f"Error checking ticket metadata for product {product_id}: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.connection and self.connection.open:
            self.connection.close()
            logging.info("WordPress database connection closed") 