"""
Event Mapping System for Backroom Comedy Club
Handles three-tier mapping: manual fallback → programmatic → user override
"""

from typing import List, Dict, Optional, Union
from dataclasses import dataclass
from datetime import datetime
import re
import json
import os

@dataclass
class EventMapping:
    id: str
    name: str
    woocommerce_product_id: str
    eventbrite_series_ids: List[str]
    mapping_source: str  # 'manual_fallback' | 'programmatic' | 'user_override'
    is_active: bool
    last_updated: str

@dataclass
class UnmappedEvent:
    id: str
    platform: str  # 'woocommerce' | 'eventbrite'
    name: str
    product_id: Optional[str] = None
    series_id: Optional[str] = None
    reason: str = 'no_match_found'  # 'no_match_found' | 'event_removed' | 'user_unmapped'

class EventMappingManager:
    def __init__(self):
        self.manual_mappings = self._get_manual_fallback_mappings()
        self.user_overrides = self._load_user_overrides()
    
    def _get_manual_fallback_mappings(self) -> List[EventMapping]:
        """
        Manual fallback mappings based on event title analysis
        These are the baseline mappings that always exist
        """
        mappings = [
            # Weekly Regular Shows - Multi-slot mappings
            EventMapping(
                id="wed_night",
                name="Wednesday Night Comedy",
                woocommerce_product_id="3986",  # Wednesday Night at Backroom Comedy Club
                eventbrite_series_ids=[
                    "448735799857",  # 8PM Wednesdays - Pro Hilarious Stand-up
                    "769799319487"   # 10 PM Wednesdays - Pro Hilarious Stand-up Comedy
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="thu_night",
                name="Thursday Night Comedy",
                woocommerce_product_id="4060",  # Thursday Night at Backroom Comedy Club
                eventbrite_series_ids=[
                    "430277871697",  # 8PM Thursday - Pro Hilarious Stand-up Comedy Vibes
                    "769805277307"   # 10PM Thursday - Hilarious Stand-up Comedy Vibes
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="fri_night",
                name="Friday Night Comedy",
                woocommerce_product_id="4061",  # Friday Night at Backroom Comedy Club
                eventbrite_series_ids=[
                    "694505453507",  # 8PM Friday Pro & Hilarious Stand-up
                    "769813120767"   # 10PM Friday | Pro Hilarious Late-Night Comedy
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="sat_night",
                name="Saturday Night Comedy",
                woocommerce_product_id="4154",  # Saturday Night at Backroom Comedy Club
                eventbrite_series_ids=[
                    "436240616427",  # 8PM Saturdays - Pro & Hilarious Stand up Comedy
                    "769789610447"   # 10PM Saturdays Pro Hilarious Stand-up Comedy
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="sun_night",
                name="Sunday Night Comedy",
                woocommerce_product_id="4157",  # Sunday Night at Backroom Comedy Club
                eventbrite_series_ids=[
                    "436368649377",  # 8PM Sundays The Made Up Show
                    "623888215447"   # 10PM Industry Nights
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            
            # Special Events - One-to-one mappings
            EventMapping(
                id="robyn_jason",
                name="Robyn & Jason The Gillerans",
                woocommerce_product_id="31907",  # Robyn & Jason The Gillerans live @ Backroom Comedy Club
                eventbrite_series_ids=[
                    "1341477809239"  # Robyn & Jason The Gillerans live @ Backroom Comedy Club
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="mike_rita",
                name="Mike Rita - Big In Little Portugal",
                woocommerce_product_id="37388",  # Mike Rita - Big In Little Portugal
                eventbrite_series_ids=[
                    "1368836570029"  # Mike Rita - Big In Little Portugal
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="stef_dag",
                name="Stef Dag @ Backroom Comedy Club",
                woocommerce_product_id="13918",  # Stef Dag @ Backroom Comedy Club
                eventbrite_series_ids=[
                    "1302257640659"  # Stef Dag @ Backroom Comedy
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="back_from_sask",
                name="Back From Sask | Variety Comedy Show",
                woocommerce_product_id="37291",  # Back From Sask | Variety Comedy Show Vanessa Prevost & Genevieve Robinson
                eventbrite_series_ids=[
                    "1363337712799"  # Back From Sask | Variety Comedy Show Vanessa Prevost & Genevieve Robinson
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="overalls_comedy",
                name="Overalls Comedy w/ Vanessa Prevost",
                woocommerce_product_id="37294",  # Overalls Comedy w/ Vanessa Prevost
                eventbrite_series_ids=[
                    "1363374151789"  # Overalls Comedy w/ Vanessa Prevost
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="alvin_kuai",
                name="Alvin Kuai @ Backroom Comedy Club",
                woocommerce_product_id="30897",  # Alvin Kuai @ Backroom Comedy Club
                eventbrite_series_ids=[
                    "1260225060079"  # Alvin Kuai @ Backroom Comedy Club
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="chris_robinson",
                name="Chris Robinson Headlines Backroom Comedy Club",
                woocommerce_product_id="37268",  # Chris Robinson Headlines Backroom Comedy Club
                eventbrite_series_ids=[
                    "1362381833739"  # Chris Robinson Headlines Backroom Comedy Club
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="anthony_nik",
                name="Anthony Pappaly & Nik Oka Live",
                woocommerce_product_id="37271",  # Anthony Pappaly & Nik Oka Live @ Backroom Comedy Club
                eventbrite_series_ids=[
                    "1362387039309"  # Anthony Pappaly & Nik Oka live @ Backroom Comedy Club
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="ali_sultan",
                name="Ali Sultan @ Backroom Comedy Club",
                woocommerce_product_id="37273",  # Ali Sultan @ Backroom Comedy Club
                eventbrite_series_ids=[
                    "1362389596959"  # Ali Sultan live @ Backroom Comedy Club
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            ),
            EventMapping(
                id="perspective_comedy",
                name="20-20 Perspective Comedy Show",
                woocommerce_product_id="6410",  # 20-20 Perspective Comedy Show
                eventbrite_series_ids=[
                    "1131348316269"  # 20-20 Perspective Comedy Show
                ],
                mapping_source="manual_fallback",
                is_active=True,
                last_updated=datetime.now().isoformat()
            )
        ]
        return mappings
    
    def _load_user_overrides(self) -> Dict[str, EventMapping]:
        """Load user override mappings from file"""
        try:
            if os.path.exists('user_mappings.json'):
                with open('user_mappings.json', 'r') as f:
                    data = json.load(f)
                    return {
                        mapping['id']: EventMapping(**mapping) 
                        for mapping in data
                    }
        except Exception as e:
            print(f"Error loading user overrides: {e}")
        return {}
    
    def _save_user_overrides(self):
        """Save user override mappings to file"""
        try:
            data = [
                {
                    'id': mapping.id,
                    'name': mapping.name,
                    'woocommerce_product_id': mapping.woocommerce_product_id,
                    'eventbrite_series_ids': mapping.eventbrite_series_ids,
                    'mapping_source': mapping.mapping_source,
                    'is_active': mapping.is_active,
                    'last_updated': mapping.last_updated
                }
                for mapping in self.user_overrides.values()
            ]
            with open('user_mappings.json', 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving user overrides: {e}")
    
    def get_programmatic_mappings(self, woocommerce_products: List[Dict], eventbrite_series: List[Dict]) -> List[EventMapping]:
        """
        Generate programmatic mappings using algorithms that would produce 
        the same results as the manual mappings
        """
        programmatic_mappings = []
        
        for product in woocommerce_products:
            # Skip if already manually mapped
            if any(m.woocommerce_product_id == str(product['product_id']) for m in self.manual_mappings):
                continue
            
            product_name = product.get('product_name', '').lower()
            matched_series = []
            
            # Day-of-week matching for regular shows
            day_patterns = {
                'wednesday': ['wednesday', 'wed'],
                'thursday': ['thursday', 'thu'],
                'friday': ['friday', 'fri'],
                'saturday': ['saturday', 'sat'],
                'sunday': ['sunday', 'sun']
            }
            
            for day, patterns in day_patterns.items():
                if any(pattern in product_name for pattern in patterns):
                    # Find matching Eventbrite series for this day
                    for series in eventbrite_series:
                        series_name = series.get('series_name', '').lower()
                        if any(pattern in series_name for pattern in patterns):
                            matched_series.append(str(series['series_id']))
            
            # Exact name matching for special events
            if not matched_series:
                for series in eventbrite_series:
                    series_name = series.get('series_name', '').lower()
                    
                    # Extract key words from both names
                    product_words = self._extract_key_words(product_name)
                    series_words = self._extract_key_words(series_name)
                    
                    # Check for significant overlap
                    overlap = len(product_words.intersection(series_words))
                    if overlap >= 2:  # At least 2 key words match
                        matched_series.append(str(series['series_id']))
            
            if matched_series:
                programmatic_mappings.append(EventMapping(
                    id=f"prog_{product['product_id']}",
                    name=product.get('product_name', ''),
                    woocommerce_product_id=str(product['product_id']),
                    eventbrite_series_ids=matched_series,
                    mapping_source="programmatic",
                    is_active=True,
                    last_updated=datetime.now().isoformat()
                ))
        
        return programmatic_mappings
    
    def _extract_key_words(self, text: str) -> set:
        """Extract meaningful words from event name for matching"""
        # Remove common words and punctuation
        stop_words = {
            'at', 'the', 'and', 'or', 'in', 'on', 'with', 'by', 'for', 'to', 'of', 'a', 'an',
            'backroom', 'comedy', 'club', 'show', 'live', 'night', 'pro', 'hilarious',
            'stand-up', 'standup', 'stand', 'up', '@', '|', '-', '&', 'pm', 'am'
        }
        
        # Clean and split text
        cleaned = re.sub(r'[^\w\s]', ' ', text.lower())
        words = set(cleaned.split())
        
        # Remove stop words and short words
        return {word for word in words if len(word) > 2 and word not in stop_words}
    
    def get_all_mappings(self, woocommerce_products: List[Dict] = None, eventbrite_series: List[Dict] = None) -> List[EventMapping]:
        """Get all mappings in priority order: user overrides → manual fallback → programmatic"""
        all_mappings = []
        
        # Start with user overrides
        all_mappings.extend(self.user_overrides.values())
        
        # Add manual fallback mappings (if not overridden)
        for manual_mapping in self.manual_mappings:
            if manual_mapping.id not in self.user_overrides:
                all_mappings.append(manual_mapping)
        
        # Add programmatic mappings (if data provided and not already mapped)
        if woocommerce_products and eventbrite_series:
            programmatic = self.get_programmatic_mappings(woocommerce_products, eventbrite_series)
            mapped_product_ids = {m.woocommerce_product_id for m in all_mappings}
            
            for prog_mapping in programmatic:
                if prog_mapping.woocommerce_product_id not in mapped_product_ids:
                    all_mappings.append(prog_mapping)
        
        return all_mappings
    
    def get_unmapped_events(self, woocommerce_products: List[Dict], eventbrite_series: List[Dict]) -> List[UnmappedEvent]:
        """Get events that couldn't be mapped"""
        unmapped = []
        all_mappings = self.get_all_mappings(woocommerce_products, eventbrite_series)
        
        # Check for unmapped WooCommerce products
        mapped_product_ids = {m.woocommerce_product_id for m in all_mappings if m.is_active}
        for product in woocommerce_products:
            if str(product['product_id']) not in mapped_product_ids:
                unmapped.append(UnmappedEvent(
                    id=f"wc_{product['product_id']}",
                    platform="woocommerce",
                    name=product.get('product_name', ''),
                    product_id=str(product['product_id']),
                    reason="no_match_found"
                ))
        
        # Check for unmapped Eventbrite series
        mapped_series_ids = set()
        for mapping in all_mappings:
            if mapping.is_active:
                mapped_series_ids.update(mapping.eventbrite_series_ids)
        
        for series in eventbrite_series:
            if str(series['series_id']) not in mapped_series_ids:
                unmapped.append(UnmappedEvent(
                    id=f"eb_{series['series_id']}",
                    platform="eventbrite",
                    name=series.get('series_name', ''),
                    series_id=str(series['series_id']),
                    reason="no_match_found"
                ))
        
        return unmapped
    
    def create_user_mapping(self, woocommerce_product_id: str, eventbrite_series_ids: List[str], name: str) -> EventMapping:
        """Create a new user override mapping"""
        mapping = EventMapping(
            id=f"user_{woocommerce_product_id}_{int(datetime.now().timestamp())}",
            name=name,
            woocommerce_product_id=woocommerce_product_id,
            eventbrite_series_ids=eventbrite_series_ids,
            mapping_source="user_override",
            is_active=True,
            last_updated=datetime.now().isoformat()
        )
        
        self.user_overrides[mapping.id] = mapping
        self._save_user_overrides()
        return mapping
    
    def update_mapping(self, mapping_id: str, **kwargs) -> Optional[EventMapping]:
        """Update an existing mapping"""
        # Check user overrides first
        if mapping_id in self.user_overrides:
            mapping = self.user_overrides[mapping_id]
            for key, value in kwargs.items():
                if hasattr(mapping, key):
                    setattr(mapping, key, value)
            mapping.last_updated = datetime.now().isoformat()
            self._save_user_overrides()
            return mapping
        
        # For manual mappings, create a user override
        manual_mapping = next((m for m in self.manual_mappings if m.id == mapping_id), None)
        if manual_mapping:
            new_mapping = EventMapping(
                id=f"user_override_{mapping_id}",
                name=kwargs.get('name', manual_mapping.name),
                woocommerce_product_id=kwargs.get('woocommerce_product_id', manual_mapping.woocommerce_product_id),
                eventbrite_series_ids=kwargs.get('eventbrite_series_ids', manual_mapping.eventbrite_series_ids),
                mapping_source="user_override",
                is_active=kwargs.get('is_active', manual_mapping.is_active),
                last_updated=datetime.now().isoformat()
            )
            self.user_overrides[new_mapping.id] = new_mapping
            self._save_user_overrides()
            return new_mapping
        
        return None
    
    def delete_mapping(self, mapping_id: str) -> bool:
        """Delete a user override mapping"""
        if mapping_id in self.user_overrides:
            del self.user_overrides[mapping_id]
            self._save_user_overrides()
            return True
        return False
    
    def get_mapping_by_id(self, mapping_id: str) -> Optional[EventMapping]:
        """Get a specific mapping by ID"""
        # Check user overrides first
        if mapping_id in self.user_overrides:
            return self.user_overrides[mapping_id]
        
        # Check manual mappings
        return next((m for m in self.manual_mappings if m.id == mapping_id), None) 