/**
 * API utility for communicating with the FastAPI backend
 */

const API_BASE_URL = 'http://localhost:8000';

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

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new ApiError(errorData.detail || `HTTP ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
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

  // Sync organization series (force refresh from API)
  async syncOrganizationSeries(): Promise<OrganizationSeriesResponse> {
    return makeRequest<OrganizationSeriesResponse>('/series/sync', {
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

  // Sync WooCommerce products (force refresh from API)
  async syncWooCommerceProducts(): Promise<WooCommerceProductsResponse> {
    return makeRequest<WooCommerceProductsResponse>('/woocommerce/products/sync', {
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
};

export { ApiError }; 