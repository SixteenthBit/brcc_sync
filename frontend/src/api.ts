/**
 * API utility for communicating with the FastAPI backend
 */

// Use environment variable for API base URL, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Debug logging for API configuration
console.log('🔍 API Configuration Debug:');
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('Final API_BASE_URL:', API_BASE_URL);
console.log('Environment:', import.meta.env.MODE);
console.log('================================');

export interface CapacityData {
  capacity: number;
  quantity_sold: number;
  quantity_total: number;
  available: number;
  ticket_class_name: string;
  ticket_class_id: string;
  event_id: string;
}

export interface CapacityResponse {
  success: boolean;
  message: string;
  data: CapacityData;
}

export interface CapacityUpdateData extends CapacityData {
  old_capacity: number;
  new_capacity: number;
}

export interface CapacityUpdateResponse {
  success: boolean;
  message: string;
  data: CapacityUpdateData;
}

export interface ConfigData {
  default_event_id: string;
  default_ticket_class_id: string;
  has_private_token: boolean;
  has_woocommerce_credentials: boolean;
  has_wordpress_db_credentials: boolean;
}

export interface TicketClass {
  id: string;
  name: string;
  capacity: number;
  quantity_sold: number;
  quantity_total: number;
  cost: string;
}

export interface TicketClassesData {
  event_id: string;
  ticket_classes: TicketClass[];
  total_count: number;
}

export interface TicketClassesResponse {
  success: boolean;
  message: string;
  data: TicketClassesData;
}

export interface EventOccurrence {
  occurrence_id: string;
  start_date: string;
  url: string;
}

export interface EventSeries {
  series_id: string;
  series_name: string;
  event_count: number;
  events: EventOccurrence[];
}

export interface OrganizationSeriesData {
  organization_id: string;
  series: EventSeries[];
  total_series_count: number;
  total_events_on_sale: number;
  last_updated?: string;
  cache_source?: 'api' | 'cache';
  cache_age_minutes?: number;
}

export interface OrganizationSeriesResponse {
  success: boolean;
  message: string;
  data: OrganizationSeriesData;
}

export interface CacheInfo {
  has_cache: boolean;
  last_updated?: string;
  age_minutes?: number;
  series_count?: number;
  events_count?: number;
  error?: string;
}

export interface CacheInfoResponse {
  success: boolean;
  message: string;
  data: CacheInfo;
}

// WooCommerce / FooEvents interfaces
export interface WooCommerceDate {
  date_id: string;
  date: string;
  stock: number;
  available: number;
  total_capacity: number | string; // Can be number or error string like "❌ DB Error"
  tickets_sold: number | string;   // Can be number or error string like "❌ DB Error"
}

export interface WooCommerceSlot {
  product_id: number;
  product_name: string;
  slot_id: string;
  slot_label: string;
  slot_time: string;
  dates: WooCommerceDate[];
  total_dates: number;
}

export interface WooCommerceProduct {
  product_id: number;
  product_name: string;
  product_price: string;
  total_sales: number;
  slots: WooCommerceSlot[];
  slot_count: number;
}

export interface WooCommerceProductsData {
  products: WooCommerceProduct[];
  total_products: number;
  total_slots: number;
  total_dates: number;
  last_updated?: string;
  cache_source?: 'api' | 'cache';
  cache_age_minutes?: number;
}

export interface WooCommerceProductsResponse {
  success: boolean;
  message: string;
  data: WooCommerceProductsData;
}

export interface WooCommerceCacheInfo {
  has_cache: boolean;
  last_updated?: string;
  age_minutes?: number;
  products_count?: number;
  slots_count?: number;
  dates_count?: number;
  error?: string;
}

export interface WooCommerceCacheInfoResponse {
  success: boolean;
  message: string;
  data: WooCommerceCacheInfo;
}

// Event Mapping interfaces
export interface EventMapping {
  id: string;
  name: string;
  woocommerce_product_id: string;
  eventbrite_series_ids: string[];
  mapping_source: 'manual_fallback' | 'programmatic' | 'user_override';
  is_active: boolean;
  last_updated: string;
}

export interface UnmappedEvent {
  id: string;
  platform: 'woocommerce' | 'eventbrite';
  name: string;
  product_id?: string;
  series_id?: string;
  reason: 'no_match_found' | 'event_removed' | 'user_unmapped';
}

export interface MappingSummary {
  total_mappings: number;
  manual_fallback_count: number;
  programmatic_count: number;
  user_override_count: number;
  total_unmapped: number;
  unmapped_woocommerce: number;
  unmapped_eventbrite: number;
}

export interface MappingsData {
  mappings: EventMapping[];
  unmapped_events: UnmappedEvent[];
  summary: MappingSummary;
}

export interface MappingsResponse {
  success: boolean;
  message: string;
  data: MappingsData;
}

export interface MappingResponse {
  success: boolean;
  message: string;
  data: EventMapping;
}

export interface CreateMappingRequest {
  woocommerce_product_id: string;
  eventbrite_series_ids: string[];
  name: string;
}

export interface UpdateMappingRequest {
  name?: string;
  woocommerce_product_id?: string;
  eventbrite_series_ids?: string[];
  is_active?: boolean;
}

// Interface for the individual WooCommerce items in the comparison group
export interface WooCommerceCombination {
  product_id: number;
  product_name: string;
  slot_id: string;
  slot_label: string;
  slot_time: string;
  date_id: string;
  date: string;
  stock: number | string;
  available: number | string;
  total_capacity: number | string;
  tickets_sold: number | string;
  price?: string;
  product_price?: string; // Fallback if price not directly on combination
}

export interface ComparisonGroupData {
  mapping_id: string;
  mapping_name: string;
  woocommerce_combinations: WooCommerceCombination[]; // Changed from woocommerce_product
  eventbrite_series: EventSeries[]; // Use existing EventSeries type
  comparison_ready: boolean;
}

export interface ComparisonGroupResponse {
  success: boolean;
  message: string;
  data: ComparisonGroupData;
}

class ApiError extends Error {
  public status?: number;
  
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const fullUrl = `${API_BASE_URL}${url}`;
  
  // Debug logging
  console.log('🔍 API Request Debug:');
  console.log('Making request to:', fullUrl);
  console.log('Method:', options.method || 'GET');
  console.log('Headers:', options.headers);
  console.log('Body:', options.body);
  
  try {
    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    console.log('🔍 Response Debug:');
    console.log('Status:', response.status);
    console.log('StatusText:', response.statusText);
    console.log('OK:', response.ok);
    console.log('URL:', response.url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('🔍 API Error Response:', errorData);
      throw new ApiError(errorData.detail || `HTTP ${response.status}`, response.status);
    }

    const data = await response.json();
    console.log('🔍 Success Response:', data);
    return data;
  } catch (error) {
    console.error('🔍 Fetch Error Details:');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const api = {
  // Get current capacity
  async getCurrentCapacity(eventId?: string, ticketClassId?: string): Promise<CapacityResponse> {
    const params = new URLSearchParams();
    if (eventId) params.append('event_id', eventId);
    if (ticketClassId) params.append('ticket_class_id', ticketClassId);
    
    const queryString = params.toString();
    const url = `/capacity${queryString ? `?${queryString}` : ''}`;
    
    return makeRequest<CapacityResponse>(url);
  },

  // Increment capacity
  async incrementCapacity(eventId?: string, ticketClassId?: string): Promise<CapacityUpdateResponse> {
    return makeRequest<CapacityUpdateResponse>('/capacity/increment', {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        ticket_class_id: ticketClassId,
      }),
    });
  },

  // Decrement capacity
  async decrementCapacity(eventId?: string, ticketClassId?: string): Promise<CapacityUpdateResponse> {
    return makeRequest<CapacityUpdateResponse>('/capacity/decrement', {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        ticket_class_id: ticketClassId,
      }),
    });
  },

  // Get ticket classes for an event
  async getTicketClasses(eventId: string): Promise<TicketClassesResponse> {
    return makeRequest<TicketClassesResponse>(`/events/${eventId}/ticket-classes`);
  },

  // Get organization series (uses cache by default)
  async getOrganizationSeries(): Promise<OrganizationSeriesResponse> {
    return makeRequest<OrganizationSeriesResponse>('/series');
  },

  // Refresh organization series (force refresh from API)
  async refreshOrganizationSeries(): Promise<OrganizationSeriesResponse> {
    return makeRequest<OrganizationSeriesResponse>('/series/refresh', {
      method: 'POST',
    });
  },

  // Get cache information
  async getCacheInfo(): Promise<CacheInfoResponse> {
    return makeRequest<CacheInfoResponse>('/series/cache-info');
  },

  // Get configuration
  async getConfig(): Promise<ConfigData> {
    return makeRequest<ConfigData>('/config');
  },

  // Health check
  async healthCheck(): Promise<{ message: string }> {
    return makeRequest<{ message: string }>('/');
  },

  // WooCommerce / FooEvents methods

  // Get WooCommerce products (uses cache by default)
  async getWooCommerceProducts(): Promise<WooCommerceProductsResponse> {
    return makeRequest<WooCommerceProductsResponse>('/woocommerce/products');
  },

  // Refresh WooCommerce products (force refresh from API)
  async refreshWooCommerceProducts(): Promise<WooCommerceProductsResponse> {
    return makeRequest<WooCommerceProductsResponse>('/woocommerce/products/refresh', {
      method: 'POST',
    });
  },

  // Get WooCommerce cache information
  async getWooCommerceCacheInfo(): Promise<WooCommerceCacheInfoResponse> {
    return makeRequest<WooCommerceCacheInfoResponse>('/woocommerce/products/cache-info');
  },

  // Get specific WooCommerce product
  async getWooCommerceProduct(productId: number): Promise<WooCommerceProductsResponse> {
    return makeRequest<WooCommerceProductsResponse>(`/woocommerce/products/${productId}`);
  },

  // Get specific slot from WooCommerce product
  async getWooCommerceProductSlot(productId: number, slotId: string): Promise<WooCommerceProductsResponse> {
    return makeRequest<WooCommerceProductsResponse>(`/woocommerce/products/${productId}/slots/${slotId}`);
  },

  // Get specific date from WooCommerce product slot
  async getWooCommerceProductDate(productId: number, slotId: string, dateId: string): Promise<WooCommerceProductsResponse> {
    return makeRequest<WooCommerceProductsResponse>(`/woocommerce/products/${productId}/slots/${slotId}/dates/${dateId}`);
  },

  // Get WordPress database status
  async getWordPressDBStatus(): Promise<any> {
    return makeRequest<any>('/woocommerce/wordpress-db-status');
  },

  // Increment WooCommerce inventory
  async incrementWooCommerceInventory(productId: number, slotId?: string, dateId?: string): Promise<CapacityUpdateResponse> {
    return makeRequest<CapacityUpdateResponse>('/woocommerce/inventory/increment', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        slot_id: slotId,
        date_id: dateId,
      }),
    });
  },

  // Decrement WooCommerce inventory
  async decrementWooCommerceInventory(productId: number, slotId?: string, dateId?: string): Promise<CapacityUpdateResponse> {
    return makeRequest<CapacityUpdateResponse>('/woocommerce/inventory/decrement', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        slot_id: slotId,
        date_id: dateId,
      }),
    });
  },

  // Set WooCommerce inventory to a specific value
  async setWooCommerceInventory(productId: number, slotId: string, dateId: string, newStock: number): Promise<CapacityUpdateResponse> {
    return makeRequest<CapacityUpdateResponse>('/woocommerce/inventory/set', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        slot_id: slotId,
        date_id: dateId,
        new_stock: newStock,
      }),
    });
  },

  // Set Eventbrite capacity to a specific value
  async setEventbriteCapacity(eventId: string, ticketClassId: string, newCapacity: number): Promise<CapacityUpdateResponse> {
    return makeRequest<CapacityUpdateResponse>('/capacity/set', {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        ticket_class_id: ticketClassId,
        new_capacity: newCapacity,
      }),
    });
  },

  // Event Mapping methods

  // Get all mappings and unmapped events
  async getMappings(): Promise<MappingsResponse> {
    return makeRequest<MappingsResponse>('/mappings');
  },

  // Get specific mapping by ID
  async getMapping(mappingId: string): Promise<MappingResponse> {
    return makeRequest<MappingResponse>(`/mappings/${mappingId}`);
  },

  // Create new user mapping
  async createMapping(request: CreateMappingRequest): Promise<MappingResponse> {
    return makeRequest<MappingResponse>('/mappings', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Update existing mapping
  async updateMapping(mappingId: string, request: UpdateMappingRequest): Promise<MappingResponse> {
    return makeRequest<MappingResponse>(`/mappings/${mappingId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  // Delete mapping
  async deleteMapping(mappingId: string): Promise<{ success: boolean; message: string; data: { deleted_mapping_id: string } }> {
    return makeRequest<{ success: boolean; message: string; data: { deleted_mapping_id: string } }>(`/mappings/${mappingId}`, {
      method: 'DELETE',
    });
  },

  // Send mapping to comparison view
  async sendMappingToCompare(mappingId: string): Promise<ComparisonGroupResponse> {
    return makeRequest<ComparisonGroupResponse>(`/mappings/${mappingId}/send-to-compare`, {
      method: 'POST',
    });
  },

  // Refresh WooCommerce product/slot/date (force fresh from API)
  async refreshWooCommerce(productId: number, slotId?: string, dateId?: string): Promise<WooCommerceProductsResponse> {
    const params = new URLSearchParams();
    params.append('product_id', String(productId));
    if (slotId) params.append('slot_id', slotId);
    if (dateId) params.append('date_id', dateId);
    return makeRequest<WooCommerceProductsResponse>(`/woocommerce/refresh?${params.toString()}`);
  },
};

export { ApiError };