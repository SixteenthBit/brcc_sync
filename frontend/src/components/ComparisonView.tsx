import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api';
import type { SelectedEvent } from '../App';
import type { EventOccurrence, EventSeries, WooCommerceProduct, WooCommerceSlot, WooCommerceDate, TicketClass } from '../api';
import './ComparisonView.css';

interface ComparisonViewProps {
  selectedEvents: SelectedEvent[];
  onEventSelect: (event: SelectedEvent) => void;
  onClearSelections: () => void;
  replaceSelectedEvent: (oldEvent: SelectedEvent, newEvent: SelectedEvent) => void;
}

interface EventDetails {
  id: string;
  type: 'eventbrite' | 'woocommerce';
  name: string;
  // Eventbrite specific
  occurrence?: EventOccurrence;
  series?: EventSeries;
  ticketClass?: TicketClass;
  // WooCommerce specific
  product?: WooCommerceProduct;
  slot?: WooCommerceSlot;
  date?: WooCommerceDate;
  // Common details
  capacity?: number;
  sold?: number;
  available?: number;
  price?: string;
  startDate?: string;
  url?: string;
  status?: 'loading' | 'loaded' | 'error';
  error?: string;
  // Capacity management state
  capacityLoading?: boolean;
  capacityError?: string;
  lastUpdate?: string;
  // WooCommerce inventory management state
  inventoryLoading?: boolean;
  inventoryError?: string;
}

interface DataState {
  eventbriteSeries: EventSeries[];
  woocommerceProducts: WooCommerceProduct[];
  loading: boolean;
  error: string | null;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({
  selectedEvents,
  onEventSelect,
  onClearSelections,
  replaceSelectedEvent
}) => {
  const [eventDetails, setEventDetails] = useState<Record<string, EventDetails>>({});
  const [dataState, setDataState] = useState<DataState>({
    eventbriteSeries: [],
    woocommerceProducts: [],
    loading: false,
    error: null
  });
  const [setInputs, setSetInputs] = useState<Record<string, string>>({});
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const [totalCapacity, setTotalCapacity] = useState<number>(55);
  // Only for cross-service inventory sync
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Load event details when selections change
  useEffect(() => {
    if (selectedEvents.length > 0) {
      loadEventDetails();
    }
  }, [selectedEvents]);

  const loadData = async () => {
    setDataState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [seriesResponse, productsResponse] = await Promise.all([
        api.getOrganizationSeries(),
        api.getWooCommerceProducts()
      ]);

      setDataState(prev => ({
        ...prev,
        eventbriteSeries: seriesResponse.data.series || [],
        woocommerceProducts: productsResponse.data.products || [],
        loading: false
      }));
    } catch (err) {
      setDataState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof ApiError ? err.message : 'Failed to load events'
      }));
    }
  };

  const loadEventDetails = async () => {
    const newDetails: Record<string, EventDetails> = {};

    for (const event of selectedEvents) {
      const key = `${event.type}-${event.id}`;

      newDetails[key] = {
        id: event.id,
        type: event.type,
        name: event.name,
        status: 'loading'
      };

      try {
        if (event.type === 'eventbrite') {
          if (event.details?.occurrence_id) {
            try {
              const ticketClassesResponse = await api.getTicketClasses(event.details.occurrence_id);
              
              if (ticketClassesResponse.data.ticket_classes.length > 0) {
                const firstTicketClass = ticketClassesResponse.data.ticket_classes[0];
                const capacityResponse = await api.getCurrentCapacity(event.details.occurrence_id, firstTicketClass.id);
                
                newDetails[key] = {
                  ...newDetails[key],
                  occurrence: event.details,
                  ticketClass: firstTicketClass,
                  capacity: capacityResponse.data.capacity,
                  sold: capacityResponse.data.quantity_sold,
                  available: capacityResponse.data.available,
                  startDate: event.details.start_date,
                  url: event.details.url,
                  status: 'loaded',
                  capacityLoading: false,
                  lastUpdate: new Date().toISOString()
                };
              } else {
                newDetails[key] = {
                  ...newDetails[key],
                  occurrence: event.details,
                  startDate: event.details.start_date,
                  url: event.details.url,
                  status: 'loaded',
                  error: 'No ticket classes found'
                };
              }
            } catch (capacityErr) {
              newDetails[key] = {
                ...newDetails[key],
                occurrence: event.details,
                startDate: event.details.start_date,
                url: event.details.url,
                status: 'loaded',
                error: 'Capacity data unavailable'
              };
            }
          } else {
            newDetails[key] = {
              ...newDetails[key],
              status: 'error',
              error: 'Missing occurrence details'
            };
          }
        } else if (event.type === 'woocommerce') {
          if (event.details && event.details.productName) {
            newDetails[key] = {
              ...newDetails[key],
              capacity: event.details.capacity,
              sold: event.details.sold,
              available: event.details.available,
              price: event.details.price,
              startDate: event.details.date,
              status: 'loaded'
            };
          } else {
            newDetails[key] = {
              ...newDetails[key],
              status: 'error',
              error: 'Missing WooCommerce event details'
            };
          }
        }
      } catch (err) {
        newDetails[key] = {
          ...newDetails[key],
          status: 'error',
          error: err instanceof ApiError ? err.message : 'Failed to load event details'
        };
      }
    }

    setEventDetails(newDetails);
  };

  // Handle changing an event to a different series/occurrence (Eventbrite)
  const handleEventbriteChange = (currentEvent: SelectedEvent, newSeriesId: string, newOccurrenceId: string) => {
    const series = dataState.eventbriteSeries.find(s => s.series_id === newSeriesId);
    const occurrence = series?.events.find(e => e.occurrence_id === newOccurrenceId);
    
    if (series && occurrence) {
      const newEvent: SelectedEvent = {
        type: 'eventbrite',
        id: occurrence.occurrence_id,
        name: `${series.series_name} (${formatDate(occurrence.start_date)})`,
        details: occurrence
      };
      // Replace old event with new one
      replaceSelectedEvent(currentEvent, newEvent);
    }
  };

  // Handle changing WooCommerce product/slot/date
  const handleWooCommerceChange = (currentEvent: SelectedEvent, productId?: number, slotId?: string, dateId?: string) => {
    if (!productId || !slotId || !dateId) return;
    const product = dataState.woocommerceProducts.find(p => p.product_id === productId);
    const slot = product?.slots.find(s => s.slot_id === slotId);
    const date = slot?.dates.find(d => d.date_id === dateId);
    if (product && slot && date) {
      const newEvent: SelectedEvent = {
        type: 'woocommerce',
        id: `${productId}-${slotId}-${dateId}`,
        name: `${product.product_name} - ${slot.slot_label} (${date.date})`,
        details: {
          productId: productId,
          productName: product.product_name,
          slotId: slotId,
          slotLabel: slot.slot_label,
          slotTime: slot.slot_time,
          dateId: date.date_id,
          date: date.date,
          stock: date.stock,
          available: date.available,
          capacity: date.total_capacity,
          sold: date.tickets_sold,
          price: product.product_price || '0'
        }
      };
      // Replace old event with new one
      replaceSelectedEvent(currentEvent, newEvent);
    }
  };

  // Add new event
  const handleAddNewEvent = (type: 'eventbrite' | 'woocommerce', seriesId?: string, occurrenceId?: string, productId?: number, slotId?: string, dateId?: string) => {
    if (type === 'eventbrite' && seriesId && occurrenceId) {
      const series = dataState.eventbriteSeries.find(s => s.series_id === seriesId);
      const occurrence = series?.events.find(e => e.occurrence_id === occurrenceId);
      if (series && occurrence) {
        const newEvent: SelectedEvent = {
          type: 'eventbrite',
          id: occurrence.occurrence_id,
          name: `${series.series_name} (${formatDate(occurrence.start_date)})`,
          details: { ...occurrence, series_id: series.series_id }
        };
        onEventSelect(newEvent);
      }
    } else if (type === 'woocommerce' && productId && slotId && dateId) {
      const product = dataState.woocommerceProducts.find(p => p.product_id === productId);
      const slot = product?.slots.find(s => s.slot_id === slotId);
      const date = slot?.dates.find(d => d.date_id === dateId);
      if (product && slot && date) {
        const newEvent: SelectedEvent = {
          type: 'woocommerce',
          id: `${productId}-${slotId}-${dateId}`,
          name: `${product.product_name} - ${slot.slot_label} (${date.date})`,
          details: {
            productId: productId,
            productName: product.product_name,
            slotId: slotId,
            slotLabel: slot.slot_label,
            slotTime: slot.slot_time,
            dateId: date.date_id,
            date: date.date,
            stock: date.stock,
            available: date.available,
            capacity: date.total_capacity,
            sold: date.tickets_sold,
            price: product.product_price || '0'
          }
        };
        onEventSelect(newEvent);
      }
    }
  };

  const handleCapacityIncrement = async (eventKey: string, eventDetails: EventDetails) => {
    if (!eventDetails.occurrence?.occurrence_id || !eventDetails.ticketClass?.id) return;

    setEventDetails(prev => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], capacityLoading: true, capacityError: undefined }
    }));

    try {
      await api.incrementCapacity(eventDetails.occurrence.occurrence_id, eventDetails.ticketClass.id);
      
      // Refresh capacity data
      const capacityResponse = await api.getCurrentCapacity(
        eventDetails.occurrence.occurrence_id, 
        eventDetails.ticketClass.id
      );

      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          capacity: capacityResponse.data.capacity,
          sold: capacityResponse.data.quantity_sold,
          available: capacityResponse.data.available,
          capacityLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
    } catch (err) {
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          capacityLoading: false,
          capacityError: err instanceof ApiError ? err.message : 'Failed to increment capacity'
        }
      }));
    }
  };

  const handleCapacityDecrement = async (eventKey: string, eventDetails: EventDetails) => {
    if (!eventDetails.occurrence?.occurrence_id || !eventDetails.ticketClass?.id) return;

    setEventDetails(prev => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], capacityLoading: true, capacityError: undefined }
    }));

    try {
      await api.decrementCapacity(eventDetails.occurrence.occurrence_id, eventDetails.ticketClass.id);
      
      // Refresh capacity data
      const capacityResponse = await api.getCurrentCapacity(
        eventDetails.occurrence.occurrence_id, 
        eventDetails.ticketClass.id
      );

      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          capacity: capacityResponse.data.capacity,
          sold: capacityResponse.data.quantity_sold,
          available: capacityResponse.data.available,
          capacityLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
    } catch (err) {
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          capacityLoading: false,
          capacityError: err instanceof ApiError ? err.message : 'Failed to decrement capacity'
        }
      }));
    }
  };

  const handleInventoryIncrement = async (eventKey: string, _eventDetails: EventDetails, event: SelectedEvent) => {
    const currentData = getEventCurrentData(event);
    
    // Validate required data for WooCommerce events
    if (!currentData.currentProductId || !currentData.currentSlotId || !currentData.currentDateId) {
      console.error('Missing required WooCommerce data for inventory increment');
      return;
    }
    
    setEventDetails(prev => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], inventoryLoading: true, inventoryError: undefined }
    }));

    try {
      const result = await api.incrementWooCommerceInventory(
        currentData.currentProductId, 
        currentData.currentSlotId, 
        currentData.currentDateId
      );
      
      // Update with response data from the increment operation
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          available: (result.data as any).new_stock,
          capacity: (result.data as any).total_capacity,
          sold: (result.data as any).tickets_sold,
          inventoryLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
    } catch (err) {
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          inventoryLoading: false,
          inventoryError: err instanceof ApiError ? err.message : 'Failed to increment inventory'
        }
      }));
    }
  };

  const handleInventoryDecrement = async (eventKey: string, _eventDetails: EventDetails, event: SelectedEvent) => {
    const currentData = getEventCurrentData(event);
    
    // Validate required data for WooCommerce events
    if (!currentData.currentProductId || !currentData.currentSlotId || !currentData.currentDateId) {
      console.error('Missing required WooCommerce data for inventory decrement');
      return;
    }
    
    setEventDetails(prev => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], inventoryLoading: true, inventoryError: undefined }
    }));

    try {
      const result = await api.decrementWooCommerceInventory(
        currentData.currentProductId, 
        currentData.currentSlotId, 
        currentData.currentDateId
      );
      
      // Update with response data from the decrement operation
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          available: (result.data as any).new_stock,
          capacity: (result.data as any).total_capacity,
          sold: (result.data as any).tickets_sold,
          inventoryLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
    } catch (err) {
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          inventoryLoading: false,
          inventoryError: err instanceof ApiError ? err.message : 'Failed to decrement inventory'
        }
      }));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price?: string) => {
    if (!price) return 'Free';
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;
    return `$${numPrice.toFixed(2)}`;
  };

  const getCapacityStatus = (capacity?: number, sold?: number) => {
    if (capacity === undefined || sold === undefined) {
      return { status: 'unknown', percentage: 0 };
    }
    
    const percentage = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
    let status = 'low';
    
    if (percentage >= 95) status = 'critical';
    else if (percentage >= 80) status = 'high';
    else if (percentage >= 50) status = 'medium';
    
    return { status, percentage };
  };

  const getEventCurrentData = (event: SelectedEvent) => {
    if (event.type === 'eventbrite') {
      const currentSeries = dataState.eventbriteSeries.find(s => 
        s.events.some(e => e.occurrence_id === (event.details?.occurrence_id || event.id))
      );
      return {
        currentSeriesId: currentSeries?.series_id || '',
        currentOccurrenceId: event.details?.occurrence_id || event.id
      };
    } else {
      // Prefer details, fallback to parsing id
      const productId = event.details?.productId ?? (() => {
        const parts = event.id.split('-');
        return parseInt(parts[0]) || 0;
      })();
      const slotId = event.details?.slotId ?? (() => {
        const parts = event.id.split('-');
        return parts[1] || '';
      })();
      const dateId = event.details?.dateId ?? (() => {
        const parts = event.id.split('-');
        return parts[2] || '';
      })();
      return {
        currentProductId: productId,
        currentSlotId: slotId,
        currentDateId: dateId
      };
    }
  };

  const truncateText = (text: string, maxLength: number = 25) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

    // New Event Row Component
  const NewEventRow: React.FC = () => {
    const [newEventType, setNewEventType] = useState<'eventbrite' | 'woocommerce'>('eventbrite');
    const [newSeriesId, setNewSeriesId] = useState('');
    const [newOccurrenceId, setNewOccurrenceId] = useState('');
    const [newProductId, setNewProductId] = useState('');
    const [newSlotId, setNewSlotId] = useState('');
    const [newDateId, setNewDateId] = useState('');

    const resetForm = () => {
      setNewSeriesId('');
      setNewOccurrenceId('');
      setNewProductId('');
      setNewSlotId('');
      setNewDateId('');
    };

    const handleAdd = () => {
      if (selectedEvents.length >= 10) {
        return; // Don't add if at maximum
      }
      
      if (newEventType === 'eventbrite' && newSeriesId && newOccurrenceId) {
        handleAddNewEvent('eventbrite', newSeriesId, newOccurrenceId);
        resetForm();
      } else if (newEventType === 'woocommerce' && newProductId && newSlotId && newDateId) {
        handleAddNewEvent('woocommerce', undefined, undefined, parseInt(newProductId), newSlotId, newDateId);
        resetForm();
      }
    };

    const selectedSeries = dataState.eventbriteSeries.find(s => s.series_id === newSeriesId);
    const selectedProduct = dataState.woocommerceProducts.find(p => p.product_id === parseInt(newProductId));
    const selectedSlot = selectedProduct?.slots.find(s => s.slot_id === newSlotId);
    const isAtMaximum = selectedEvents.length >= 10;

    // In NewEventRow, show a spinner in the Add button if any new event is loading
    const isAnyNewEventLoading = Object.values(eventDetails).some(d => d.status === 'loading');

    return (
      <tr className={`add-event-row ${isAtMaximum ? 'disabled' : ''}`}>
        <td className="col-platform">
          {isAtMaximum ? (
            <span className="max-reached">MAX</span>
          ) : (
            <select 
              className="platform-select"
              value={newEventType} 
              onChange={(e) => {
                setNewEventType(e.target.value as 'eventbrite' | 'woocommerce');
                resetForm();
              }}
            >
              <option value="eventbrite">🎭 EB</option>
              <option value="woocommerce">🛒 WC</option>
            </select>
          )}
        </td>

        <td className="col-name">
          {isAtMaximum ? (
            <span className="max-message">Maximum 10 events reached. Remove an event to add more.</span>
          ) : newEventType === 'eventbrite' ? (
            <select 
              className="event-dropdown"
              value={newSeriesId} 
              onChange={(e) => {
                setNewSeriesId(e.target.value);
                setNewOccurrenceId('');
              }}
            >
              <option value="">Select series...</option>
              {dataState.eventbriteSeries.map(series => (
                <option key={series.series_id} value={series.series_id}>
                  {series.series_name}
                </option>
              ))}
            </select>
          ) : (
            <select 
              className="event-dropdown"
              value={newProductId} 
              onChange={(e) => {
                setNewProductId(e.target.value);
                setNewSlotId('');
                setNewDateId('');
              }}
            >
              <option value="">Select product...</option>
              {dataState.woocommerceProducts.map(product => (
                <option key={product.product_id} value={product.product_id}>
                  {product.product_name}
                </option>
              ))}
            </select>
          )}
          {newEventType === 'eventbrite' && selectedSeries && (
            <span className="inline-spinner"><Spinner size="tiny" /></span>
          )}
          {newEventType === 'woocommerce' && selectedProduct && (
            <span className="inline-spinner"><Spinner size="tiny" /></span>
          )}
        </td>

        <td className="col-slot">
          {isAtMaximum ? (
            <span className="unavailable">-</span>
          ) : newEventType === 'woocommerce' && selectedProduct ? (
            <select 
              className="slot-dropdown"
              value={newSlotId} 
              onChange={(e) => {
                setNewSlotId(e.target.value);
                setNewDateId('');
              }}
            >
              <option value="">Select slot...</option>
              {selectedProduct.slots.map(slot => (
                <option key={slot.slot_id} value={slot.slot_id}>
                  {slot.slot_label}
                </option>
              ))}
            </select>
          ) : (
            <span className="unavailable">-</span>
          )}
        </td>

        <td className="col-date">
          {isAtMaximum ? (
            <span className="unavailable">-</span>
          ) : newEventType === 'eventbrite' && selectedSeries ? (
            <select 
              className="date-dropdown"
              value={newOccurrenceId} 
              onChange={(e) => setNewOccurrenceId(e.target.value)}
            >
              <option value="">Select date...</option>
              {selectedSeries.events
                .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                .map(occurrence => (
                <option key={occurrence.occurrence_id} value={occurrence.occurrence_id}>
                  {formatDate(occurrence.start_date)}
                </option>
              ))}
            </select>
          ) : newEventType === 'woocommerce' && selectedSlot ? (
            <select 
              className="date-dropdown"
              value={newDateId} 
              onChange={(e) => setNewDateId(e.target.value)}
            >
              <option value="">Select date...</option>
              {selectedSlot.dates
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(date => (
                <option key={date.date_id} value={date.date_id}>
                  {formatDate(date.date)}
                </option>
              ))}
            </select>
          ) : (
            <span className="unavailable">-</span>
          )}
        </td>

        <td className="col-capacity">-</td>
        <td className="col-sold">-</td>
        <td className="col-available">-</td>
        <td className="col-percentage">-</td>
        <td className="col-price">-</td>
        <td className="col-controls">-</td>

        <td className="col-actions">
          <button 
            className="btn-action btn-add"
            onClick={handleAdd}
            disabled={
              isAtMaximum ||
              (newEventType === 'eventbrite' && (!newSeriesId || !newOccurrenceId)) ||
              (newEventType === 'woocommerce' && (!newProductId || !newSlotId || !newDateId)) ||
              isAnyNewEventLoading
            }
            title={isAtMaximum ? "Maximum 10 events reached" : "Add event to comparison"}
          >
            {isAnyNewEventLoading ? <Spinner size="tiny" /> : (isAtMaximum ? '✕' : '+')}
          </button>
        </td>
      </tr>
    );
  };

  // Add set handlers for WooCommerce and Eventbrite
  const handleSetWooCommerce = async (eventKey: string, event: SelectedEvent, details: EventDetails) => {
    const value = setInputs[eventKey];
    if (!value) return;
    const newStock = parseInt(value, 10);
    if (isNaN(newStock) || newStock < 0) {
      setSetErrors(prev => ({ ...prev, [eventKey]: 'Enter a non-negative number' }));
      return;
    }
    const currentData = getEventCurrentData(event);
    const ticketsSold = typeof details.sold === 'number' ? details.sold : 0;
    if (newStock < ticketsSold) {
      setSetErrors(prev => ({ ...prev, [eventKey]: `Cannot set below tickets sold (${ticketsSold})` }));
      return;
    }
    setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], inventoryLoading: true, inventoryError: undefined } }));
    setSetErrors(prev => ({ ...prev, [eventKey]: '' }));
    try {
      const result = await api.setWooCommerceInventory(currentData.currentProductId, currentData.currentSlotId, currentData.currentDateId, newStock);
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          available: (result.data as any).new_stock,
          capacity: (result.data as any).total_capacity,
          sold: (result.data as any).tickets_sold,
          inventoryLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
      setSetInputs(prev => ({ ...prev, [eventKey]: '' }));
    } catch (err) {
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          inventoryLoading: false,
          inventoryError: err instanceof ApiError ? err.message : 'Failed to set inventory'
        }
      }));
      setSetErrors(prev => ({ ...prev, [eventKey]: err instanceof ApiError ? err.message : 'Failed to set inventory' }));
    }
  };

  const handleSetEventbrite = async (eventKey: string, details: EventDetails) => {
    const value = setInputs[eventKey];
    if (!value) return;
    const newCapacity = parseInt(value, 10);
    if (isNaN(newCapacity) || newCapacity < 0) {
      setSetErrors(prev => ({ ...prev, [eventKey]: 'Enter a non-negative number' }));
      return;
    }
    const ticketsSold = typeof details.sold === 'number' ? details.sold : 0;
    if (newCapacity < ticketsSold) {
      setSetErrors(prev => ({ ...prev, [eventKey]: `Cannot set below tickets sold (${ticketsSold})` }));
      return;
    }
    setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], capacityLoading: true, capacityError: undefined } }));
    setSetErrors(prev => ({ ...prev, [eventKey]: '' }));
    try {
      const result = await api.setEventbriteCapacity(details.occurrence?.occurrence_id!, details.ticketClass?.id!, newCapacity);
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          capacity: (result.data as any).new_capacity,
          sold: (result.data as any).quantity_sold,
          available: (result.data as any).available,
          capacityLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
      setSetInputs(prev => ({ ...prev, [eventKey]: '' }));
    } catch (err) {
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          capacityLoading: false,
          capacityError: err instanceof ApiError ? err.message : 'Failed to set capacity'
        }
      }));
      setSetErrors(prev => ({ ...prev, [eventKey]: err instanceof ApiError ? err.message : 'Failed to set capacity' }));
    }
  };

  // Add this function to refresh event data after updates
  const refreshEventDetails = async (event: SelectedEvent) => {
    const key = `${event.type}-${event.id}`;
    setEventDetails(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        status: 'loading',
        error: undefined,
      },
    }));
    try {
      if (event.type === 'eventbrite') {
        if (event.details?.occurrence_id) {
          const ticketClassesResponse = await api.getTicketClasses(event.details.occurrence_id);
          if (ticketClassesResponse.data.ticket_classes.length > 0) {
            const firstTicketClass = ticketClassesResponse.data.ticket_classes[0];
            const capacityResponse = await api.getCurrentCapacity(event.details.occurrence_id, firstTicketClass.id);
            setEventDetails(prev => ({
              ...prev,
              [key]: {
                ...prev[key],
                occurrence: event.details,
                ticketClass: firstTicketClass,
                capacity: capacityResponse.data.capacity,
                sold: capacityResponse.data.quantity_sold,
                available: capacityResponse.data.available,
                startDate: event.details.start_date,
                url: event.details.url,
                status: 'loaded',
                capacityLoading: false,
                lastUpdate: new Date().toISOString(),
                error: undefined,
              },
            }));
          } else {
            setEventDetails(prev => ({
              ...prev,
              [key]: {
                ...prev[key],
                occurrence: event.details,
                startDate: event.details.start_date,
                url: event.details.url,
                status: 'loaded',
                error: 'No ticket classes found',
              },
            }));
          }
        } else {
          setEventDetails(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              status: 'error',
              error: 'Missing occurrence details',
            },
          }));
        }
      } else if (event.type === 'woocommerce') {
        // Fetch latest data from backend for this product/slot/date (always fresh)
        const currentData = getEventCurrentData(event);
        const response = await api.refreshWooCommerce(currentData.currentProductId, currentData.currentSlotId, currentData.currentDateId);
        const product = response.data.products[0];
        const slot = product.slots.find(s => s.slot_id === currentData.currentSlotId);
        const date = slot?.dates.find(d => d.date_id === currentData.currentDateId);
        if (product && slot && date) {
          setEventDetails(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              product,
              slot,
              date,
              capacity: typeof date.total_capacity === 'number' ? date.total_capacity : undefined,
              sold: typeof date.tickets_sold === 'number' ? date.tickets_sold : undefined,
              available: date.available,
              price: product.product_price,
              startDate: date.date,
              status: 'loaded',
              error: undefined,
            },
          }));
        } else {
          setEventDetails(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              status: 'error',
              error: 'Missing WooCommerce event details',
            },
          }));
        }
      }
    } catch (err) {
      setEventDetails(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: 'error',
          error: err instanceof ApiError ? err.message : 'Failed to refresh event',
        },
      }));
    }
  };

  // 2. Add slot-level refresh for WooCommerce (refresh all dates for that slot)
  const refreshWooCommerceSlot = async (event: SelectedEvent) => {
    if (event.type !== 'woocommerce') return;
    const currentData = getEventCurrentData(event);
    // Fetch latest slot data from backend (always fresh)
    const response = await api.refreshWooCommerce(currentData.currentProductId, currentData.currentSlotId);
    const product = response.data.products[0];
    const slot = product.slots.find(s => s.slot_id === currentData.currentSlotId);
    if (!product || !slot) return;
    // For each date in the slot, refresh the event details for that date
    for (const date of slot.dates) {
      const slotEvent: SelectedEvent = {
        ...event,
        details: {
          ...event.details,
          productId: product.product_id,
          slotId: slot.slot_id,
          dateId: date.date_id,
        },
        id: `${product.product_id}-${slot.slot_id}-${date.date_id}`,
      };
      // Use the same backend refresh logic
      await refreshEventDetails(slotEvent);
    }
  };

  const handleSyncInventory = async () => {
    if (!totalCapacity || totalCapacity < 0) {
      setSyncError('Total capacity must be a positive number');
      return;
    }

    // Step 0: Calculate new available before confirmation
    let totalSold = 0;
    const eventsWithSold = selectedEvents.map(event => {
      const key = `${event.type}-${event.id}`;
      const details = eventDetails[key];
      const sold = details?.sold ?? 0;
      totalSold += sold;
      return { ...event, sold };
    });
    if (totalCapacity < totalSold) {
      setSyncError(`Error: Total capacity (${totalCapacity}) is less than total tickets sold (${totalSold})`);
      setSyncLoading(false);
      return;
    }
    const availableLeft = totalCapacity - totalSold;

    // Confirmation dialog
    const confirmMsg = `All events will be changed so that ${availableLeft} tickets are available for each. Are you sure you want to continue?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setSyncLoading(true);
    setSyncError('');
    const results: {success: boolean, message: string, event: SelectedEvent, changed?: boolean}[] = [];
    try {
      for (const event of eventsWithSold) {
        const key = `${event.type}-${event.id}`;
        const details = eventDetails[key];
        let changed = false;
        if (event.type === 'woocommerce') {
          // Use the same logic as handleSetWooCommerce
          const productId = details?.product?.product_id ?? event.details?.productId;
          const slotId = details?.slot?.slot_id ?? event.details?.slotId;
          const dateId = details?.date?.date_id ?? event.details?.dateId;
          if (!productId || !slotId || !dateId) {
            results.push({ success: false, message: `Missing WooCommerce IDs for ${event.name}`, event });
            continue;
          }
          try {
            const response = await api.setWooCommerceInventory(productId, slotId, dateId, availableLeft);
            changed = (details?.available !== undefined && details.available !== availableLeft);
            results.push({
              success: response.success,
              message: response.success 
                ? `Set WooCommerce available for ${event.name} to ${availableLeft}`
                : `Failed to set WooCommerce inventory: ${response.message || 'Unknown error'}`,
              event,
              changed
            });
          } catch (err) {
            results.push({ success: false, message: `Error syncing ${event.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, event });
          }
        } else if (event.type === 'eventbrite') {
          // Use the same logic as handleSetEventbrite
          const occurrenceId = details?.occurrence?.occurrence_id ?? event.details?.occurrence_id;
          const ticketClassId = details?.ticketClass?.id ?? event.details?.ticket_class_id;
          const sold = details?.sold ?? 0;
          if (!occurrenceId || !ticketClassId) {
            results.push({ success: false, message: `Missing Eventbrite IDs for ${event.name}`, event });
            continue;
          }
          try {
            const response = await api.setEventbriteCapacity(occurrenceId, ticketClassId, sold + availableLeft);
            changed = (details?.available !== undefined && details.available !== availableLeft);
            results.push({
              success: response.success,
              message: response.success 
                ? `Set Eventbrite capacity for ${event.name} to ${sold + availableLeft}`
                : `Failed to set Eventbrite capacity: ${response.message || 'Unknown error'}`,
              event,
              changed
            });
          } catch (err) {
            results.push({ success: false, message: `Error syncing ${event.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, event });
          }
        }
      }
      // Step 5: Refresh data after all updates
      // Refresh all WooCommerce events using the always-fresh endpoint
      for (const event of selectedEvents) {
        if (event.type === 'woocommerce') {
          await refreshEventDetails(event);
        }
      }
      // Refresh all Eventbrite events as well (optional, for consistency)
      for (const event of selectedEvents) {
        if (event.type === 'eventbrite') {
          await refreshEventDetails(event);
        }
      }
      // Display results summary
      const successCount = results.filter(r => r.success).length;
      const changedCount = results.filter(r => r.changed).length;
      if (successCount === results.length && changedCount > 0) {
        setSyncSuccess(true);
        setSyncError('');
      } else if (successCount > 0 && changedCount > 0) {
        setSyncSuccess(true);
        setSyncError(results.filter(r => !r.success).map(r => r.message).join('. '));
      } else if (changedCount === 0) {
        setSyncSuccess(false);
        setSyncError('No changes were made. All events already had the target quantity.');
      } else {
        setSyncSuccess(false);
        setSyncError(`Failed to sync any events. ${results.map(r => r.message).join('. ')}`);
      }
    } catch (err) {
      setSyncSuccess(false);
      setSyncError(`Error syncing inventory: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // Add this helper for a spinner
  const Spinner: React.FC<{size?: 'tiny' | 'small' | 'medium'}> = ({ size = 'small' }) => (
    <span className={`spinner spinner-${size}`}></span>
  );

  if (dataState.loading) {
    return (
      <div className="comparison-view">
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading event data...</span>
        </div>
      </div>
    );
  }

  if (dataState.error) {
    return (
      <div className="comparison-view">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <span>{dataState.error}</span>
          <button className="btn btn-outline" onClick={loadData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="comparison-view">
      {/* Sync Inventory Controls (cross-service) */}
      <div className="sync-inventory-bar">
        <label htmlFor="total-capacity-input">Total Capacity:</label>
        <input
          id="total-capacity-input"
          type="number"
          min={0}
          value={totalCapacity}
          onChange={e => setTotalCapacity(Number(e.target.value))}
          disabled={syncLoading}
          className="total-capacity-input"
        />
        <button
          className="btn btn-primary sync-inventory-btn"
          onClick={handleSyncInventory}
          disabled={syncLoading || selectedEvents.length < 2}
          title={selectedEvents.length < 2 ? 'Select at least 2 events to sync' : 'Sync inventory across all compared events'}
        >
          {syncLoading ? <><Spinner size="tiny" /> Syncing...</> : 'Sync Inventory'}
        </button>
        {syncError && <span className="sync-error">{syncError}</span>}
        {syncSuccess && <span className="sync-success">Inventory synced!</span>}
      </div>
      {/* Compact Header */}
      <div className="comparison-header">
        <div className="header-info">
          <h1>Compare Events</h1>
          {selectedEvents.length > 0 && (
            <p>Comparing {selectedEvents.length} of 10 event{selectedEvents.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="header-actions">
          {selectedEvents.length > 0 && (
            <button className="btn btn-secondary" onClick={onClearSelections}>
              Clear All ({selectedEvents.length})
            </button>
          )}
        </div>
      </div>

      <div className="comparison-container-full">
        {/* Comparison Table */}
        <div className="comparison-table-panel">
          <div className="comparison-table-container">
            {/* Summary Stats */}
            {selectedEvents.length > 0 && (
              <div className="summary-bar">
                <div className="summary-stats">
                  <div className="summary-stat">
                    <span className="stat-value">{selectedEvents.length}</span>
                    <span className="stat-label">Events</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-value">
                      {Object.values(eventDetails)
                        .filter(d => d.capacity !== undefined)
                        .reduce((sum, d) => sum + (d.capacity || 0), 0)}
                    </span>
                    <span className="stat-label">Total Capacity</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-value">
                      {Object.values(eventDetails)
                        .filter(d => d.sold !== undefined)
                        .reduce((sum, d) => sum + (d.sold || 0), 0)}
                    </span>
                    <span className="stat-label">Total Sold</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-value">
                      {Object.values(eventDetails)
                        .filter(d => d.available !== undefined)
                        .reduce((sum, d) => sum + (d.available || 0), 0)}
                    </span>
                    <span className="stat-label">Available</span>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Table */}
            <div className="comparison-table-wrapper">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th className="col-platform">Platform</th>
                    <th className="col-name">Event Name</th>
                    <th className="col-slot">Slot</th>
                    <th className="col-date">Date</th>
                    <th className="col-capacity">Capacity</th>
                    <th className="col-sold">Sold</th>
                    <th className="col-available">Available</th>
                    <th className="col-percentage">% Sold</th>
                    <th className="col-price">Price</th>
                    <th className="col-controls">Controls</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvents.map((event) => {
                    const key = `${event.type}-${event.id}`;
                    const details = eventDetails[key];
                    
                    if (!details) return null;

                    const capacityStatus = getCapacityStatus(details.capacity, details.sold);
                    const currentData = getEventCurrentData(event);

                    return (
                      <tr key={key} className={`event-row event-row-${event.type}`}>
                        {/* Platform */}
                        <td className="col-platform">
                          <div className="platform-badge">
                            <span className="platform-icon">
                              {event.type === 'eventbrite' ? '🎭' : '🛒'}
                            </span>
                            <span className="platform-name">
                              {event.type === 'eventbrite' ? 'EB' : 'WC'}
                            </span>
                            {details.status === 'loading' && <Spinner size="tiny" />}
                          </div>
                        </td>

                        {/* Event Name (Dropdown) */}
                        <td className="col-name">
                          {event.type === 'eventbrite' ? (
                            <select
                              className="event-dropdown"
                              value={currentData.currentSeriesId || ''}
                              onChange={(e) => {
                                const newSeriesId = e.target.value;
                                const series = dataState.eventbriteSeries.find(s => s.series_id === newSeriesId);
                                const firstOccurrence = series?.events[0]?.occurrence_id;
                                if (newSeriesId && firstOccurrence) {
                                  handleEventbriteChange(event, newSeriesId, firstOccurrence);
                                }
                              }}
                            >
                              {dataState.eventbriteSeries.map(series => (
                                <option key={series.series_id} value={series.series_id}>
                                  {truncateText(series.series_name)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              className="event-dropdown"
                              value={currentData.currentProductId || ''}
                              onChange={(e) => {
                                const newProductId = parseInt(e.target.value);
                                const product = dataState.woocommerceProducts.find(p => p.product_id === newProductId);
                                const firstSlot = product?.slots[0]?.slot_id;
                                const firstDate = product?.slots[0]?.dates[0]?.date_id;
                                if (newProductId && firstSlot && firstDate) {
                                  handleWooCommerceChange(event, newProductId, firstSlot, firstDate);
                                }
                              }}
                            >
                              {dataState.woocommerceProducts.map(product => (
                                <option key={product.product_id} value={product.product_id}>
                                  {truncateText(product.product_name)}
                                </option>
                              ))}
                            </select>
                          )}
                          {details.status === 'loading' && (
                            <span className="inline-spinner"><Spinner size="tiny" /></span>
                          )}
                          {details.status === 'error' && (
                            <span className="error-indicator" title={details.error}>⚠️</span>
                          )}
                        </td>

                        {/* Slot (Dropdown for WooCommerce) */}
                        <td className="col-slot">
                          {event.type === 'woocommerce' ? (
                            (() => {
                              const product = dataState.woocommerceProducts.find(p => p.product_id === currentData.currentProductId);
                              return product ? (
                                <select
                                  className="slot-dropdown"
                                  value={currentData.currentSlotId || ''}
                                  onChange={(e) => {
                                    const newSlotId = e.target.value;
                                    const slot = product.slots.find(s => s.slot_id === newSlotId);
                                    const firstDate = slot?.dates[0]?.date_id;
                                    if (currentData.currentProductId && newSlotId && firstDate) {
                                      handleWooCommerceChange(event, currentData.currentProductId, newSlotId, firstDate);
                                    }
                                  }}
                                >
                                  {product.slots.map(slot => (
                                    <option key={slot.slot_id} value={slot.slot_id}>
                                      {slot.slot_label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="unavailable">-</span>
                              );
                            })()
                          ) : (
                            <span className="unavailable">-</span>
                          )}
                        </td>

                        {/* Date (Dropdown) */}
                        <td className="col-date">
                          {event.type === 'eventbrite' ? (
                            (() => {
                              const series = dataState.eventbriteSeries.find(s => s.series_id === currentData.currentSeriesId);
                              return series ? (
                                <select
                                  className="date-dropdown"
                                  value={currentData.currentOccurrenceId || ''}
                                  onChange={(e) => {
                                    if (e.target.value && currentData.currentSeriesId) {
                                      handleEventbriteChange(event, currentData.currentSeriesId, e.target.value);
                                    }
                                  }}
                                >
                                  {series.events
                                    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                                    .map(occurrence => (
                                    <option key={occurrence.occurrence_id} value={occurrence.occurrence_id}>
                                      {formatDate(occurrence.start_date)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="event-date">{formatDate(details.startDate)}</span>
                              );
                            })()
                          ) : (
                            (() => {
                              const product = dataState.woocommerceProducts.find(p => p.product_id === currentData.currentProductId);
                              const slot = product?.slots.find(s => s.slot_id === currentData.currentSlotId);
                              return slot ? (
                                <select
                                  className="date-dropdown"
                                  value={currentData.currentDateId || ''}
                                  onChange={(e) => {
                                    if (e.target.value && currentData.currentSlotId) {
                                      handleWooCommerceChange(event, currentData.currentProductId, currentData.currentSlotId, e.target.value);
                                    }
                                  }}
                                >
                                  {slot.dates
                                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                    .map(date => (
                                    <option key={date.date_id} value={date.date_id}>
                                      {formatDate(date.date)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="event-date">{formatDate(details.startDate)}</span>
                              );
                            })()
                          )}
                        </td>

                        {/* Capacity */}
                        <td className="col-capacity">
                          {details.capacity !== undefined ? (
                            <span className="capacity-value">{details.capacity}</span>
                          ) : (
                            <span className="unavailable">-</span>
                          )}
                        </td>

                        {/* Sold */}
                        <td className="col-sold">
                          {details.sold !== undefined ? (
                            <span className="sold-value">{details.sold}</span>
                          ) : (
                            <span className="unavailable">-</span>
                          )}
                        </td>

                        {/* Available */}
                        <td className="col-available">
                          {details.available !== undefined ? (
                            <span className="available-value">{details.available}</span>
                          ) : (
                            <span className="unavailable">-</span>
                          )}
                        </td>

                        {/* Percentage */}
                        <td className="col-percentage">
                          {details.capacity !== undefined && details.sold !== undefined ? (
                            <div className="percentage-cell">
                              <div className="progress-bar">
                                <div 
                                  className={`progress-fill progress-${capacityStatus.status}`}
                                  style={{ width: `${capacityStatus.percentage}%` }}
                                ></div>
                              </div>
                              <span className="percentage-text">{capacityStatus.percentage}%</span>
                            </div>
                          ) : (
                            <span className="unavailable">-</span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="col-price">
                          <span className="price-value">
                            {details.price ? formatPrice(details.price) : '-'}
                          </span>
                        </td>

                        {/* Controls (Capacity Management for Eventbrite, Inventory Management for WooCommerce) */}
                        <td className="col-controls">
                          {details.type === 'eventbrite' && details.ticketClass && details.status === 'loaded' ? (
                            <div className="capacity-controls-compact">
                              <button
                                className="btn-capacity-compact btn-decrement"
                                onClick={() => handleCapacityDecrement(key, details)}
                                disabled={details.capacityLoading || (details.capacity || 0) <= (details.sold || 0)}
                                title="Decrease capacity by 1"
                              >
                                {details.capacityLoading ? <div className="spinner-tiny"></div> : '−'}
                              </button>
                              <button
                                className="btn-capacity-compact btn-increment"
                                onClick={() => handleCapacityIncrement(key, details)}
                                disabled={details.capacityLoading}
                                title="Increase capacity by 1"
                              >
                                {details.capacityLoading ? <div className="spinner-tiny"></div> : '+'}
                              </button>
                            </div>
                          ) : details.type === 'woocommerce' && details.status === 'loaded' ? (
                            <div className="inventory-controls-compact">
                              <button
                                className="btn-inventory-compact btn-decrement"
                                onClick={() => handleInventoryDecrement(key, details, event)}
                                disabled={details.inventoryLoading || (details.available || 0) <= 0}
                                title="Decrease inventory by 1"
                              >
                                {details.inventoryLoading ? <div className="spinner-tiny"></div> : '−'}
                              </button>
                              <button
                                className="btn-inventory-compact btn-increment"
                                onClick={() => handleInventoryIncrement(key, details, event)}
                                disabled={details.inventoryLoading}
                                title="Increase inventory by 1"
                              >
                                {details.inventoryLoading ? <div className="spinner-tiny"></div> : '+'}
                              </button>
                            </div>
                          ) : (
                            <span className="no-controls">-</span>
                          )}
                          {details.type === 'woocommerce' && (
                            <input
                              type="number"
                              value={setInputs[key] || ''}
                              onChange={(e) => setSetInputs(prev => ({ ...prev, [key]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSetWooCommerce(key, event, details);
                                }
                              }}
                              disabled={details.inventoryLoading}
                              className="set-input"
                            />
                          )}
                          {details.type === 'eventbrite' && (
                            <input
                              type="number"
                              value={setInputs[key] || ''}
                              onChange={(e) => setSetInputs(prev => ({ ...prev, [key]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSetEventbrite(key, details);
                                }
                              }}
                              disabled={details.capacityLoading}
                              className="set-input"
                            />
                          )}
                          {setErrors[key] && (
                            <span className="error-message">{setErrors[key]}</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="col-actions">
                          <div className="action-buttons">
                            {details.url && (
                              <a 
                                href={details.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn-action btn-view"
                                title="View event"
                              >
                                👁️
                              </a>
                            )}
                            <button 
                              className="btn-action btn-refresh-date"
                              onClick={() => refreshEventDetails(event)}
                              title="Refresh just this date"
                            >
                              🔄 Date
                            </button>
                            {event.type === 'woocommerce' && (
                              <button
                                className="btn-action btn-refresh-slot"
                                onClick={() => refreshWooCommerceSlot(event)}
                                title="Refresh all dates for this slot"
                              >
                                🔄 Slot
                              </button>
                            )}
                            <button 
                              className="btn-action btn-remove"
                              onClick={() => onEventSelect(event)}
                              title="Remove from comparison"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Add New Event Row */}
                  <NewEventRow />
                </tbody>
              </table>
            </div>

            {/* Capacity and Inventory Errors Panel */}
            {Object.values(eventDetails).some(d => d.capacityError || d.inventoryError) && (
              <div className="capacity-errors-panel">
                <h4>Management Errors</h4>
                {Object.entries(eventDetails)
                  .filter(([_, details]) => details.capacityError || details.inventoryError)
                  .map(([key, details]) => (
                    <div key={key} className="capacity-error">
                      <span className="error-event">{truncateText(details.name, 30)}</span>
                      <span className="error-message">
                        {details.capacityError || details.inventoryError}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonView; 