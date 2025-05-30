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
  mappingIdToLoad?: string | null;
  onMappingLoaded?: () => void;
}

interface EventDetails {
  id: string;
  type: 'eventbrite' | 'woocommerce';
  name: string;
  occurrence?: EventOccurrence;
  series?: EventSeries;
  ticketClass?: TicketClass;
  product?: WooCommerceProduct; 
  slot?: WooCommerceSlot;     
  date?: WooCommerceDate;     
  capacity?: number;
  sold?: number;
  available?: number;
  price?: string;
  startDate?: string;
  url?: string;
  status?: 'loading' | 'loaded' | 'error';
  error?: string;
  capacityLoading?: boolean;
  capacityError?: string;
  lastUpdate?: string;
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
  replaceSelectedEvent,
  mappingIdToLoad,
  onMappingLoaded
}) => {
  const [eventDetails, setEventDetails] = useState<Record<string, EventDetails>>({});
  const [isInitialMappingLoading, setIsInitialMappingLoading] = useState(false);
  const [initialMappingError, setInitialMappingError] = useState<string | null>(null);
  const [dataState, setDataState] = useState<DataState>({
    eventbriteSeries: [],
    woocommerceProducts: [],
    loading: false,
    error: null
  });
  const [setInputs, setSetInputs] = useState<Record<string, string>>({});
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const [totalCapacity, setTotalCapacity] = useState<number>(55);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedEvents.length > 0 && (dataState.woocommerceProducts.length > 0 || dataState.eventbriteSeries.length > 0)) {
      loadEventDetails();
    } else if (selectedEvents.length === 0 && !mappingIdToLoad) { // Only clear if not about to load a mapping
      setEventDetails({});
    }
  }, [selectedEvents, dataState.woocommerceProducts, dataState.eventbriteSeries, mappingIdToLoad]);

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

  useEffect(() => {
    if (mappingIdToLoad) {
      const fetchMappingData = async () => {
        setIsInitialMappingLoading(true);
        setInitialMappingError(null);
        try {
          const response = await api.sendMappingToCompare(mappingIdToLoad);
          const mappingData = response.data; // This is ComparisonGroupData
          const newSelectedEvents: SelectedEvent[] = [];

          // Process WooCommerce combinations data
          if (mappingData.woocommerce_combinations && Array.isArray(mappingData.woocommerce_combinations)) {
            mappingData.woocommerce_combinations.forEach((combination: any) => {
              // Each 'combination' is already a specific product-slot-date with details
              newSelectedEvents.push({
                type: 'woocommerce',
                id: `${combination.product_id}-${combination.slot_id}-${combination.date_id}`,
                name: `${combination.product_name} - ${combination.slot_label} (${combination.date})`,
                details: { // The combination itself contains all necessary details
                  productId: combination.product_id,
                  productName: combination.product_name,
                  slotId: combination.slot_id,
                  slotLabel: combination.slot_label,
                  slotTime: combination.slot_time,
                  dateId: combination.date_id,
                  date: combination.date,
                  stock: combination.stock,
                  available: combination.available,
                  capacity: combination.total_capacity, // Ensure this key matches backend
                  sold: combination.tickets_sold,     // Ensure this key matches backend
                  price: combination.price || (combination.product_price || '0') // Handle price if directly on combo or from product
                }
              });
            });
          }

          // Process Eventbrite series data
          if (mappingData.eventbrite_series && Array.isArray(mappingData.eventbrite_series)) {
            mappingData.eventbrite_series.forEach((series: EventSeries) => { // Cast for type safety
              const events = series.events || [];
              if (events.length > 0) {
                // Sort events by start date to pick the first upcoming/relevant one
                const sortedOccurrences = [...events].sort((a, b) =>
                  new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime()
                );
                const relevantOccurrence = sortedOccurrences[0]; // Or more sophisticated logic if needed

                newSelectedEvents.push({
                  type: 'eventbrite',
                  // Use occurrence_id if available, otherwise series_id as fallback
                  id: relevantOccurrence.occurrence_id || series.series_id,
                  name: `${series.series_name} (${new Date(relevantOccurrence.start_date).toLocaleDateString()})`,
                  details: {
                    ...relevantOccurrence, // Spread occurrence details
                    series_name: series.series_name, // Ensure series_name is present
                    series_id: series.series_id      // Ensure series_id is present
                  }
                });
              } else {
                // Fallback if a series has no occurrences listed (less likely for comparison but handle)
                newSelectedEvents.push({
                  type: 'eventbrite',
                  id: series.series_id,
                  name: series.series_name,
                  details: series // Pass the whole series as details
                });
              }
            });
          }
          
          if (onClearSelections) {
            onClearSelections(); // Clear previous selections in App state
          }
          newSelectedEvents.forEach(event => {
            if (onEventSelect) {
              onEventSelect(event); // Add new events to App state
            }
          });

          if (onMappingLoaded) {
            onMappingLoaded(); // Signal to App.tsx to clear the mappingIdToLoad
          }
        } catch (err) {
          console.error('Failed to load mapping details for comparison:', err);
          setInitialMappingError(err instanceof ApiError ? err.message : 'Failed to load mapping details');
        } finally {
          setIsInitialMappingLoading(false);
        }
      };

      fetchMappingData();
    }
  }, [mappingIdToLoad, onEventSelect, onClearSelections, onMappingLoaded, api]); // Added api to dependency array as it's used

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
          const existingDetail = eventDetails[key] || {};
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
                  lastUpdate: new Date().toISOString(),
                  error: undefined // Clear previous error on success
                };
              } else {
                newDetails[key] = {
                                    ...existingDetail, // Preserve old numeric data
                                    ...newDetails[key], // Apply new non-numeric data like name, id, type
                                    occurrence: event.details,
                                    startDate: event.details.start_date,
                                    url: event.details.url,
                                    status: 'error', // Set status to error
                                    error: 'No ticket classes found',
                                    capacityLoading: false,
                                    lastUpdate: new Date().toISOString()
                                };
              }
            } catch (capacityErr) {
              newDetails[key] = {
                                ...existingDetail, // Preserve old numeric data
                                ...newDetails[key],
                                occurrence: event.details,
                                startDate: event.details.start_date,
                                url: event.details.url,
                                status: 'error', // Set status to error
                                error: capacityErr instanceof ApiError ? capacityErr.message : 'Capacity data unavailable',
                                capacityLoading: false,
                                lastUpdate: new Date().toISOString()
                            };
            }
          } else {
            newDetails[key] = { ...newDetails[key], status: 'error', error: 'Missing occurrence details' };
          }
        } else if (event.type === 'woocommerce') {
          const currentIds = getEventCurrentData(event);
          const productFromMasterList = dataState.woocommerceProducts.find(p => p.product_id === currentIds.currentProductId);
          const slotFromMasterList = productFromMasterList?.slots.find(s => s.slot_id === currentIds.currentSlotId);
          const dateFromMasterList = slotFromMasterList?.dates.find(d => d.date_id === currentIds.currentDateId);
          console.log(`[loadEventDetails] WC Date for ${key} (from dataState):`, dateFromMasterList ? JSON.parse(JSON.stringify(dateFromMasterList)) : 'dateFromMasterList is null/undefined');

          if (productFromMasterList && slotFromMasterList && dateFromMasterList) {
            newDetails[key] = {
              ...newDetails[key],
              product: productFromMasterList,
              slot: slotFromMasterList,
              date: dateFromMasterList,
              capacity: typeof dateFromMasterList.total_capacity === 'number' ? dateFromMasterList.total_capacity : undefined,
              sold: typeof dateFromMasterList.tickets_sold === 'number' ? dateFromMasterList.tickets_sold : undefined,
              available: dateFromMasterList.available,
              price: productFromMasterList.product_price,
              startDate: dateFromMasterList.date,
              status: 'loaded',
              inventoryLoading: false,
              lastUpdate: new Date().toISOString(),
              error: undefined // Clear previous error
            };
          } else {
            const existingDetail = eventDetails[key] || {};
            if (event.details && event.details.productName) { // If some details were passed initially (e.g. from mapping)
                newDetails[key] = {
                    ...existingDetail, // Preserve old numeric data
                    ...newDetails[key],
                    // Update with what we have, but mark as error if master list lookup failed
                    capacity: existingDetail.capacity !== undefined ? existingDetail.capacity : event.details.capacity,
                    sold: existingDetail.sold !== undefined ? existingDetail.sold : event.details.sold,
                    available: existingDetail.available !== undefined ? existingDetail.available : event.details.available,
                    price: existingDetail.price !== undefined ? existingDetail.price : event.details.price,
                    startDate: existingDetail.startDate !== undefined ? existingDetail.startDate : event.details.date,
                    status: 'error', // Set status to error
                    error: !productFromMasterList ? 'Product not in master list' : !slotFromMasterList ? 'Slot not in master list' : 'Date not in master list',
                    inventoryLoading: false,
                    lastUpdate: new Date().toISOString()
                };
            } else { // No initial details and not found in master list
                newDetails[key] = { ...newDetails[key], status: 'error', error: 'WooCommerce event data not found in master list', inventoryLoading: false, lastUpdate: new Date().toISOString() };
            }
          }
        }
      } catch (err) {
        const existingDetail = eventDetails[key] || {};
        newDetails[key] = {
                            ...existingDetail, // Preserve old numeric data
                            ...newDetails[key], // Apply new non-numeric data
                            status: 'error',
                            error: err instanceof ApiError ? err.message : 'Failed to load event details',
                            capacityLoading: false, // Ensure loading flags are reset
                            inventoryLoading: false,
                            lastUpdate: new Date().toISOString()
                        };
      }
    }
    setEventDetails(newDetails);
  };

  const handleEventbriteChange = (currentEvent: SelectedEvent, newSeriesId: string, newOccurrenceId: string) => {
    const series = dataState.eventbriteSeries.find(s => s.series_id === newSeriesId);
    const occurrence = series?.events.find(e => e.occurrence_id === newOccurrenceId);
    if (series && occurrence) {
      const newEvent: SelectedEvent = { type: 'eventbrite', id: occurrence.occurrence_id, name: `${series.series_name} (${formatDate(occurrence.start_date)})`, details: occurrence };
      replaceSelectedEvent(currentEvent, newEvent);
    }
  };

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
          productId, productName: product.product_name, slotId, slotLabel: slot.slot_label, slotTime: slot.slot_time,
          dateId: date.date_id, date: date.date, stock: date.stock, available: date.available,
          capacity: date.total_capacity, sold: date.tickets_sold, price: product.product_price || '0'
        }
      };
      replaceSelectedEvent(currentEvent, newEvent);
    }
  };

  const handleAddNewEvent = (type: 'eventbrite' | 'woocommerce', seriesId?: string, occurrenceId?: string, productId?: number, slotId?: string, dateId?: string) => {
    if (type === 'eventbrite' && seriesId && occurrenceId) {
      const series = dataState.eventbriteSeries.find(s => s.series_id === seriesId);
      const occurrence = series?.events.find(e => e.occurrence_id === occurrenceId);
      if (series && occurrence) {
        const newEvent: SelectedEvent = { type: 'eventbrite', id: occurrence.occurrence_id, name: `${series.series_name} (${formatDate(occurrence.start_date)})`, details: { ...occurrence, series_id: series.series_id } };
        onEventSelect(newEvent);
      }
    } else if (type === 'woocommerce' && productId && slotId && dateId) {
      const product = dataState.woocommerceProducts.find(p => p.product_id === productId);
      const slot = product?.slots.find(s => s.slot_id === slotId);
      const date = slot?.dates.find(d => d.date_id === dateId);
      if (product && slot && date) {
        const newEvent: SelectedEvent = {
          type: 'woocommerce', id: `${productId}-${slotId}-${dateId}`, name: `${product.product_name} - ${slot.slot_label} (${date.date})`,
          details: {
            productId, productName: product.product_name, slotId, slotLabel: slot.slot_label, slotTime: slot.slot_time,
            dateId: date.date_id, date: date.date, stock: date.stock, available: date.available,
            capacity: date.total_capacity, sold: date.tickets_sold, price: product.product_price || '0'
          }
        };
        onEventSelect(newEvent);
      }
    }
  };

  const handleCapacityIncrement = async (eventKey: string, currentEventDetails: EventDetails) => {
    if (!currentEventDetails.occurrence?.occurrence_id || !currentEventDetails.ticketClass?.id) return;
    setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], capacityLoading: true, capacityError: undefined } }));
    try {
      await api.incrementCapacity(currentEventDetails.occurrence.occurrence_id, currentEventDetails.ticketClass.id);
      const capacityResponse = await api.getCurrentCapacity(currentEventDetails.occurrence.occurrence_id, currentEventDetails.ticketClass.id);
      
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
      setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], capacityLoading: false, capacityError: err instanceof ApiError ? err.message : 'Failed to increment capacity' } }));
    }
  };

  const handleCapacityDecrement = async (eventKey: string, currentEventDetails: EventDetails) => {
    if (!currentEventDetails.occurrence?.occurrence_id || !currentEventDetails.ticketClass?.id) return;
    setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], capacityLoading: true, capacityError: undefined } }));
    try {
      await api.decrementCapacity(currentEventDetails.occurrence.occurrence_id, currentEventDetails.ticketClass.id);
      const capacityResponse = await api.getCurrentCapacity(currentEventDetails.occurrence.occurrence_id, currentEventDetails.ticketClass.id);

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
      setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], capacityLoading: false, capacityError: err instanceof ApiError ? err.message : 'Failed to decrement capacity' } }));
    }
  };

  const updateWooCommerceMasterState = (productId: number, slotId: string, dateId: string, updatedInventory: any ) => { 
    setDataState(prevDataState => {
      const updatedWooCommerceProducts = prevDataState.woocommerceProducts.map(p => {
        if (p.product_id === productId) {
          return {
            ...p,
            slots: p.slots.map(s => {
              if (s.slot_id === slotId) {
                return {
                  ...s,
                  dates: s.dates.map(d => {
                    if (d.date_id === dateId) {
                      const updatedDate = {
                        ...d,
                        available: updatedInventory.available,
                        total_capacity: updatedInventory.new_capacity,
                        tickets_sold: updatedInventory.quantity_sold,
                        stock: updatedInventory.available
                      };
                      console.log(`[updateWooCommerceMasterState] Updated WC Date object for ${productId}-${slotId}-${dateId} in dataState.woocommerceProducts:`, updatedDate ? JSON.parse(JSON.stringify(updatedDate)) : 'updatedDate is null/undefined');
                      return updatedDate;
                    }
                    return d;
                  }),
                };
              }
              return s;
            }),
          };
        }
        return p;
      });
      return { ...prevDataState, woocommerceProducts: updatedWooCommerceProducts };
    });
  };

  const handleInventoryIncrement = async (eventKey: string, _currentEventDetails: EventDetails, event: SelectedEvent) => {
    const currentIds = getEventCurrentData(event);
    if (!currentIds.currentProductId || !currentIds.currentSlotId || !currentIds.currentDateId) {
      console.error('Missing required WooCommerce data for inventory increment');
      return;
    }
    setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], inventoryLoading: true, inventoryError: undefined } }));
    try {
      const result = await api.incrementWooCommerceInventory(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId);
      console.log(`[handleInventoryIncrement] API Response (result.data) for ${eventKey}:`, result && result.data ? JSON.parse(JSON.stringify(result.data)) : 'API result or result.data is null/undefined');
      const updatedInventoryData = result.data;
      console.log(`[handleInventoryIncrement] Data passed to updateWooCommerceMasterState for ${eventKey}:`, updatedInventoryData ? JSON.parse(JSON.stringify(updatedInventoryData)) : 'updatedInventoryData is null/undefined');
      if (updatedInventoryData) { // Ensure data exists before updating state
        updateWooCommerceMasterState(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId, updatedInventoryData);
      }

      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          available: updatedInventoryData.available,
          capacity: updatedInventoryData.new_capacity,
          sold: updatedInventoryData.quantity_sold,
          inventoryLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
    } catch (err) {
      setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], inventoryLoading: false, inventoryError: err instanceof ApiError ? err.message : 'Failed to increment inventory' } }));
    }
  };

  const handleInventoryDecrement = async (eventKey: string, _currentEventDetails: EventDetails, event: SelectedEvent) => {
    const currentIds = getEventCurrentData(event);
    if (!currentIds.currentProductId || !currentIds.currentSlotId || !currentIds.currentDateId) {
      console.error('Missing required WooCommerce data for inventory decrement');
      return;
    }
    setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], inventoryLoading: true, inventoryError: undefined } }));
    try {
      const result = await api.decrementWooCommerceInventory(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId);
      console.log(`[handleInventoryDecrement] API Response (result.data) for ${eventKey}:`, result && result.data ? JSON.parse(JSON.stringify(result.data)) : 'API result or result.data is null/undefined');
      const updatedInventoryData = result.data;
      console.log(`[handleInventoryDecrement] Data passed to updateWooCommerceMasterState for ${eventKey}:`, updatedInventoryData ? JSON.parse(JSON.stringify(updatedInventoryData)) : 'updatedInventoryData is null/undefined');
      if (updatedInventoryData) { // Ensure data exists before updating state
        updateWooCommerceMasterState(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId, updatedInventoryData);
      }
      
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          available: updatedInventoryData.available,
          capacity: updatedInventoryData.new_capacity,
          sold: updatedInventoryData.quantity_sold,
          inventoryLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
    } catch (err) {
      setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], inventoryLoading: false, inventoryError: err instanceof ApiError ? err.message : 'Failed to decrement inventory' } }));
    }
  };
  
  const handleSetWooCommerce = async (eventKey: string, event: SelectedEvent, currentEventDetails: EventDetails) => {
    const value = setInputs[eventKey];
    if (value === undefined || value === null) return;
    const newStock = parseInt(value, 10);

    if (isNaN(newStock) || newStock < 0) {
      setSetErrors(prev => ({ ...prev, [eventKey]: 'Enter a non-negative number' }));
      return;
    }

    const currentIds = getEventCurrentData(event);
    if (!currentIds.currentProductId || !currentIds.currentSlotId || !currentIds.currentDateId) {
        console.error('Missing IDs for setWooCommerce');
        setSetErrors(prev => ({ ...prev, [eventKey]: 'Internal error: Missing event IDs' }));
        return;
    }
    
    const ticketsSold = typeof currentEventDetails.sold === 'number' ? currentEventDetails.sold : 0;
    if (newStock < ticketsSold) {
      setSetErrors(prev => ({ ...prev, [eventKey]: `Cannot set below tickets sold (${ticketsSold})` }));
      return;
    }

    setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], inventoryLoading: true, inventoryError: undefined } }));
    setSetErrors(prev => ({ ...prev, [eventKey]: '' }));

    try {
      const result = await api.setWooCommerceInventory(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId, newStock);
      console.log(`[handleSetWooCommerce] API Response (result.data) for ${eventKey}:`, result && result.data ? JSON.parse(JSON.stringify(result.data)) : 'API result or result.data is null/undefined');
      const updatedInventoryData = result.data;
      console.log(`[handleSetWooCommerce] Data passed to updateWooCommerceMasterState for ${eventKey}:`, updatedInventoryData ? JSON.parse(JSON.stringify(updatedInventoryData)) : 'updatedInventoryData is null/undefined');
      if (updatedInventoryData) { // Ensure data exists before updating state
        updateWooCommerceMasterState(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId, updatedInventoryData);
      }

      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          available: updatedInventoryData.available,
          capacity: updatedInventoryData.new_capacity,
          sold: updatedInventoryData.quantity_sold,
          inventoryLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
      setSetInputs(prev => ({ ...prev, [eventKey]: '' }));
    } catch (err) {
      setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], inventoryLoading: false, inventoryError: err instanceof ApiError ? err.message : 'Failed to set inventory' } }));
      setSetErrors(prev => ({ ...prev, [eventKey]: err instanceof ApiError ? err.message : 'Failed to set inventory' }));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return dateString; }
  };

  const formatPrice = (price?: string) => {
    if (!price) return 'Free';
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;
    return `$${numPrice.toFixed(2)}`;
  };

  const getCapacityStatus = (capacity?: number, sold?: number) => {
    if (capacity === undefined || sold === undefined) return { status: 'unknown', percentage: 0 };
    const percentage = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
    let status = 'low';
    if (percentage >= 95) status = 'critical';
    else if (percentage >= 80) status = 'high';
    else if (percentage >= 50) status = 'medium';
    return { status, percentage };
  };

  const getEventCurrentData = (event: SelectedEvent) => {
    if (event.type === 'eventbrite') {
      const currentSeries = dataState.eventbriteSeries.find(s => s.events.some(e => e.occurrence_id === (event.details?.occurrence_id || event.id)));
      return { currentSeriesId: currentSeries?.series_id || '', currentOccurrenceId: event.details?.occurrence_id || event.id };
    } else {
      const productId = (event.details?.productId ?? parseInt(event.id.split('-')[0])) || 0;
      const slotId = (event.details?.slotId ?? event.id.split('-')[1]) || '';
      const dateId = (event.details?.dateId ?? event.id.split('-')[2]) || '';
      return { currentProductId: productId, currentSlotId: slotId, currentDateId: dateId };
    }
  };

  const truncateText = (text: string, maxLength: number = 25) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const NewEventRow: React.FC = () => {
    const [newEventType, setNewEventType] = useState<'eventbrite' | 'woocommerce'>('eventbrite');
    const [newSeriesId, setNewSeriesId] = useState('');
    const [newOccurrenceId, setNewOccurrenceId] = useState('');
    const [newProductId, setNewProductId] = useState('');
    const [newSlotId, setNewSlotId] = useState('');
    const [newDateId, setNewDateId] = useState('');

    const resetForm = () => { setNewSeriesId(''); setNewOccurrenceId(''); setNewProductId(''); setNewSlotId(''); setNewDateId(''); };

    const handleAdd = () => {
      if (selectedEvents.length >= 10) return;
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
    const isAnyNewEventLoading = Object.values(eventDetails).some(d => d.status === 'loading');

    return (
      <tr className={`add-event-row ${isAtMaximum ? 'disabled' : ''}`}>
        <td className="col-platform">
          {isAtMaximum ? <span className="max-reached">MAX</span> : (
            <select className="platform-select" value={newEventType} onChange={(e) => { setNewEventType(e.target.value as 'eventbrite' | 'woocommerce'); resetForm(); }}>
              <option value="eventbrite">🎭 EB</option>
              <option value="woocommerce">🛒 WC</option>
            </select>
          )}
        </td>
        <td className="col-name">
          {isAtMaximum ? <span className="max-message">Maximum 10 events.</span> : newEventType === 'eventbrite' ? (
            <select className="event-dropdown" value={newSeriesId} onChange={(e) => { setNewSeriesId(e.target.value); setNewOccurrenceId(''); }}>
              <option value="">Select series...</option>
              {dataState.eventbriteSeries.map(series => <option key={series.series_id} value={series.series_id}>{series.series_name}</option>)}
            </select>
          ) : (
            <select className="event-dropdown" value={newProductId} onChange={(e) => { setNewProductId(e.target.value); setNewSlotId(''); setNewDateId(''); }}>
              <option value="">Select product...</option>
              {dataState.woocommerceProducts.map(product => <option key={product.product_id} value={product.product_id}>{product.product_name}</option>)}
            </select>
          )}
          {(newEventType === 'eventbrite' && selectedSeries || newEventType === 'woocommerce' && selectedProduct) && <span className="inline-spinner"><Spinner size="tiny" /></span>}
        </td>
        <td className="col-slot">
          {isAtMaximum ? <span className="unavailable">-</span> : newEventType === 'woocommerce' && selectedProduct ? (
            <select className="slot-dropdown" value={newSlotId} onChange={(e) => { setNewSlotId(e.target.value); setNewDateId(''); }}>
              <option value="">Select slot...</option>
              {selectedProduct.slots.map(slot => <option key={slot.slot_id} value={slot.slot_id}>{slot.slot_label}</option>)}
            </select>
          ) : <span className="unavailable">-</span>}
        </td>
        <td className="col-date">
          {isAtMaximum ? <span className="unavailable">-</span> : newEventType === 'eventbrite' && selectedSeries ? (
            <select className="date-dropdown" value={newOccurrenceId} onChange={(e) => setNewOccurrenceId(e.target.value)}>
              <option value="">Select date...</option>
              {selectedSeries.events.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()).map(occurrence => <option key={occurrence.occurrence_id} value={occurrence.occurrence_id}>{formatDate(occurrence.start_date)}</option>)}
            </select>
          ) : newEventType === 'woocommerce' && selectedSlot ? (
            <select className="date-dropdown" value={newDateId} onChange={(e) => setNewDateId(e.target.value)}>
              <option value="">Select date...</option>
              {selectedSlot.dates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(date => <option key={date.date_id} value={date.date_id}>{formatDate(date.date)}</option>)}
            </select>
          ) : <span className="unavailable">-</span>}
        </td>
        <td className="col-capacity">-</td><td className="col-sold">-</td><td className="col-available">-</td><td className="col-percentage">-</td><td className="col-price">-</td><td className="col-controls">-</td>
        <td className="col-actions">
          <button className="btn-action btn-add" onClick={handleAdd} disabled={isAtMaximum || (newEventType === 'eventbrite' && (!newSeriesId || !newOccurrenceId)) || (newEventType === 'woocommerce' && (!newProductId || !newSlotId || !newDateId)) || isAnyNewEventLoading} title={isAtMaximum ? "Maximum 10 events" : "Add event"}>
            {isAnyNewEventLoading ? <Spinner size="tiny" /> : (isAtMaximum ? '✕' : '+')}
          </button>
        </td>
      </tr>
    );
  };

  const handleSetEventbrite = async (eventKey: string, currentEventDetails: EventDetails) => {
    const value = setInputs[eventKey];
    if (!value) return;

    // User input now represents desired AVAILABLE tickets
    const desiredAvailableTickets = parseInt(value, 10);

    if (isNaN(desiredAvailableTickets) || desiredAvailableTickets < 0) {
      setSetErrors(prev => ({ ...prev, [eventKey]: 'Enter a non-negative number for available tickets' }));
      return;
    }

    const ticketsSold = typeof currentEventDetails.sold === 'number' ? currentEventDetails.sold : 0;
    
    // New total capacity calculation
    const newTotalCapacity = desiredAvailableTickets + ticketsSold;

    // Validate if the calculated newTotalCapacity is less than ticketsSold
    // (This case should ideally not happen if desiredAvailableTickets is >= 0, but good for safety)
    if (newTotalCapacity < ticketsSold) {
        setSetErrors(prev => ({ ...prev, [eventKey]: `Calculated capacity (${newTotalCapacity}) is less than tickets sold (${ticketsSold}).` }));
        return;
    }

    setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], capacityLoading: true, capacityError: undefined } }));
    setSetErrors(prev => ({ ...prev, [eventKey]: '' }));

    try {
      // Call API to set the NEW TOTAL capacity
      const result = await api.setEventbriteCapacity(
        currentEventDetails.occurrence?.occurrence_id!,
        currentEventDetails.ticketClass?.id!,
        newTotalCapacity // Pass the calculated new total capacity
      );

      // Update UI with new values from API response
      // The API response (result.data) should reflect the new_capacity, quantity_sold, and available
      setEventDetails(prev => ({
        ...prev,
        [eventKey]: {
          ...prev[eventKey],
          capacity: (result.data as any).new_capacity, // This should be our newTotalCapacity
          sold: (result.data as any).quantity_sold,   // Should remain the same
          available: (result.data as any).available, // This should be our desiredAvailableTickets
          capacityLoading: false,
          lastUpdate: new Date().toISOString()
        }
      }));
      setSetInputs(prev => ({ ...prev, [eventKey]: '' })); // Clear input after successful set
    } catch (err) {
      setEventDetails(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], capacityLoading: false, capacityError: err instanceof ApiError ? err.message : 'Failed to set capacity' } }));
      setSetErrors(prev => ({ ...prev, [eventKey]: err instanceof ApiError ? err.message : 'Failed to set capacity' }));
    }
  };

  const refreshEventDetails = async (event: SelectedEvent) => {
    const key = `${event.type}-${event.id}`;
    setEventDetails(prev => ({ ...prev, [key]: { ...(prev[key] || { id: event.id, type: event.type, name: event.name }), status: 'loading', error: undefined } }));
    try {
      if (event.type === 'eventbrite') {
        if (event.details?.occurrence_id) {
          const ticketClassesResponse = await api.getTicketClasses(event.details.occurrence_id);
          if (ticketClassesResponse.data.ticket_classes.length > 0) {
            const firstTicketClass = ticketClassesResponse.data.ticket_classes[0];
            const capacityResponse = await api.getCurrentCapacity(event.details.occurrence_id, firstTicketClass.id);
            setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], occurrence: event.details, ticketClass: firstTicketClass, capacity: capacityResponse.data.capacity, sold: capacityResponse.data.quantity_sold, available: capacityResponse.data.available, startDate: event.details.start_date, url: event.details.url, status: 'loaded', capacityLoading: false, lastUpdate: new Date().toISOString(), error: undefined } }));
          } else {
            setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], occurrence: event.details, startDate: event.details.start_date, url: event.details.url, status: 'loaded', error: 'No ticket classes found' } }));
          }
        } else {
          setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', error: 'Missing occurrence details' } }));
        }
      } else if (event.type === 'woocommerce') {
        const currentIds = getEventCurrentData(event);
        try {
            const response = await api.refreshWooCommerce(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId);
            const refreshedProductData = response.data.products?.[0]; 

            if (refreshedProductData) {
                const refreshedSlotData = refreshedProductData.slots?.find(s => s.slot_id === currentIds.currentSlotId);
                if (refreshedSlotData) {
                    const refreshedDateData = refreshedSlotData.dates?.find(d => d.date_id === currentIds.currentDateId);
                    if (refreshedDateData) {
                        // Construct a payload similar to CapacityUpdateData for consistency
                        const payloadForStateUpdate = {
                            available: refreshedDateData.available,
                            new_capacity: typeof refreshedDateData.total_capacity === 'string' ? undefined : Number(refreshedDateData.total_capacity),
                            quantity_sold: typeof refreshedDateData.tickets_sold === 'string' ? undefined : Number(refreshedDateData.tickets_sold),
                            // old_capacity is not critical here for updateWooCommerceMasterState
                            event_id: String(currentIds.currentProductId)
                        };
                        console.log(`[refreshEventDetails] Payload for updateWooCommerceMasterState for ${key}:`, JSON.parse(JSON.stringify(payloadForStateUpdate)));
                        updateWooCommerceMasterState(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId, payloadForStateUpdate);
                        
                        setEventDetails(prev => ({
                            ...prev,
                            [key]: {
                                ...prev[key],
                                product: refreshedProductData,
                                slot: refreshedSlotData,
                                date: refreshedDateData,
                                available: payloadForStateUpdate.available,
                                capacity: payloadForStateUpdate.new_capacity,
                                sold: payloadForStateUpdate.quantity_sold,
                                price: refreshedProductData.product_price, 
                                startDate: refreshedDateData.date, 
                                status: 'loaded',
                                inventoryLoading: false,
                                error: undefined,
                                lastUpdate: new Date().toISOString()
                            }
                        }));
                    } else {
                         setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', error: 'Refreshed date not found in API response' } }));
                    }
                } else {
                    setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', error: 'Refreshed slot not found in API response' } }));
                }
            } else {
                 setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', error: 'Failed to refresh WooCommerce event details from API (no product data)' } }));
            }
        } catch (refreshErr) {
          console.error("Error during API refresh of WooCommerce event:", refreshErr);
          setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', error: 'Error during API refresh' } }));
        }
      }
    } catch (err) {
      setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', error: err instanceof ApiError ? err.message : 'Failed to refresh event' } }));
    }
  };

  const refreshWooCommerceSlot = async (event: SelectedEvent) => {
    if (event.type !== 'woocommerce') return;
    const currentIds = getEventCurrentData(event);
    
    try {
        const productFromMaster = dataState.woocommerceProducts.find(p => p.product_id === currentIds.currentProductId);
        const slotFromMaster = productFromMaster?.slots.find(s => s.slot_id === currentIds.currentSlotId);

        if (productFromMaster && slotFromMaster) {
            // Set the slot to loading status in eventDetails
            // This provides immediate feedback for the whole slot if multiple dates are refreshed.
            // We might need a more granular loading state if preferred.
            for (const date of slotFromMaster.dates) {
                const dateKey = `woocommerce-${productFromMaster.product_id}-${slotFromMaster.slot_id}-${date.date_id}`;
                setEventDetails(prev => ({ ...prev, [dateKey]: { ...(prev[dateKey] || { id: date.date_id, type: 'woocommerce', name: event.name }), status: 'loading', error: undefined } }));
            }

            for (const date of slotFromMaster.dates) {
                const dateSpecificEvent: SelectedEvent = {
                    ...event, 
                    id: `${productFromMaster.product_id}-${slotFromMaster.slot_id}-${date.date_id}`, 
                    name: `${productFromMaster.product_name} - ${slotFromMaster.slot_label} (${date.date})`, 
                    details: { 
                      productId: productFromMaster.product_id,
                      productName: productFromMaster.product_name,
                      slotId: slotFromMaster.slot_id,
                      slotLabel: slotFromMaster.slot_label,
                      slotTime: slotFromMaster.slot_time,
                      dateId: date.date_id,
                      date: date.date,
                      stock: date.stock, 
                      available: date.available, 
                      capacity: date.total_capacity, 
                      sold: date.tickets_sold, 
                      price: productFromMaster.product_price || '0'
                    }
                };
                await refreshEventDetails(dateSpecificEvent); 
            }
        } else {
            console.warn("Product/Slot not found in master for slot refresh, attempting single date refresh for:", event.id);
            await refreshEventDetails(event);
        }
    } catch (error) {
        console.error("Error refreshing WooCommerce slot:", error);
        const key = `${event.type}-${event.id}`; // Fallback to the original event key for error display
        setEventDetails(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', error: 'Failed to refresh slot' } }));
    }
  };

  const handleSyncInventory = async () => {
    if (!totalCapacity || totalCapacity < 0) {
      setSyncError('Total capacity must be a positive number');
      return;
    }
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
    const confirmMsg = `All events will be changed so that ${availableLeft} tickets are available for each. Are you sure?`;
    if (!window.confirm(confirmMsg)) return;

    setSyncLoading(true);
    setSyncError('');
    const results: {success: boolean, message: string, event: SelectedEvent, changed?: boolean}[] = [];
    try {
      for (const event of eventsWithSold) {
        const key = `${event.type}-${event.id}`;
        const details = eventDetails[key];
        let changed = false;
        if (event.type === 'woocommerce') {
          const currentIds = getEventCurrentData(event);
          if (!currentIds.currentProductId || !currentIds.currentSlotId || !currentIds.currentDateId) {
            results.push({ success: false, message: `Missing WooCommerce IDs for ${event.name}`, event });
            continue;
          }
          try {
            const response = await api.setWooCommerceInventory(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId, availableLeft);
            changed = (details?.available !== undefined && details.available !== availableLeft);
            if (response.success) {
                 updateWooCommerceMasterState(currentIds.currentProductId, currentIds.currentSlotId, currentIds.currentDateId, response.data as any);
            }
            results.push({ success: response.success, message: response.success ? `Set WC available for ${event.name} to ${availableLeft}` : `Failed: ${response.message || 'Unknown error'}`, event, changed });
          } catch (err) {
            results.push({ success: false, message: `Error syncing ${event.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, event });
          }
        } else if (event.type === 'eventbrite') {
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
            results.push({ success: response.success, message: response.success ? `Set EB capacity for ${event.name} to ${sold + availableLeft}` : `Failed: ${response.message || 'Unknown error'}`, event, changed });
          } catch (err) {
            results.push({ success: false, message: `Error syncing ${event.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, event });
          }
        }
      }
      for (const event of selectedEvents) {
        await refreshEventDetails(event);
      }
      const successCount = results.filter(r => r.success).length;
      const changedCount = results.filter(r => r.changed).length;
      if (successCount === results.length && changedCount > 0) { setSyncSuccess(true); setSyncError(''); }
      else if (successCount > 0 && changedCount > 0) { setSyncSuccess(true); setSyncError(results.filter(r => !r.success).map(r => r.message).join('. ')); }
      else if (changedCount === 0) { setSyncSuccess(false); setSyncError('No changes made. Events already at target.'); }
      else { setSyncSuccess(false); setSyncError(`Failed to sync. ${results.map(r => r.message).join('. ')}`); }
    } catch (err) {
      setSyncSuccess(false);
      setSyncError(`Error syncing inventory: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const Spinner: React.FC<{size?: 'tiny' | 'small' | 'medium'}> = ({ size = 'small' }) => (
    <span className={`spinner spinner-${size}`}></span>
  );

  if (isInitialMappingLoading) {
    return (
      <div className="comparison-view">
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading comparison data...</span>
        </div>
      </div>
    );
  }

  if (initialMappingError) {
    return (
      <div className="comparison-view">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <span>Error loading mapping: {initialMappingError}</span>
          {/* Optionally, add a button to clear/go back or retry */}
        </div>
      </div>
    );
  }

  if (dataState.loading && selectedEvents.length === 0) { // Show master list loading only if no specific mapping was loaded/attempted
    return <div className="comparison-view"><div className="loading-state"><div className="spinner"></div><span>Loading event data...</span></div></div>;
  }
  if (dataState.error && selectedEvents.length === 0) { // Show master list error only if no specific mapping was loaded/attempted
    return <div className="comparison-view"><div className="error-state"><span className="error-icon">⚠️</span><span>{dataState.error}</span><button className="btn btn-outline" onClick={loadData}>Retry</button></div></div>;
  }

  return (
    <div className="comparison-view">
      <div className="sync-inventory-bar">
        <label htmlFor="total-capacity-input">Total Capacity:</label>
        <input id="total-capacity-input" type="number" min={0} value={totalCapacity} onChange={e => setTotalCapacity(Number(e.target.value))} disabled={syncLoading} className="total-capacity-input" />
        <button className="btn btn-primary sync-inventory-btn" onClick={handleSyncInventory} disabled={syncLoading || selectedEvents.length < 2} title={selectedEvents.length < 2 ? 'Select at least 2 events' : 'Sync inventory'}>
          {syncLoading ? <><Spinner size="tiny" /> Syncing...</> : 'Sync Inventory'}
        </button>
        {syncError && <span className="sync-error">{syncError}</span>}
        {syncSuccess && <span className="sync-success">Inventory synced!</span>}
      </div>
      <div className="comparison-header">
        <div className="header-info"><h1>Compare Events</h1>{selectedEvents.length > 0 && <p>Comparing {selectedEvents.length} of 10 event{selectedEvents.length !== 1 ? 's' : ''}</p>}</div>
        <div className="header-actions">{selectedEvents.length > 0 && <button className="btn btn-secondary" onClick={onClearSelections}>Clear All ({selectedEvents.length})</button>}</div>
      </div>
      <div className="comparison-container-full">
        <div className="comparison-table-panel">
          <div className="comparison-table-container">
            {selectedEvents.length > 0 && (
              <div className="summary-bar">
                <div className="summary-stats">
                  <div className="summary-stat"><span className="stat-value">{selectedEvents.length}</span><span className="stat-label">Events</span></div>
                  <div className="summary-stat"><span className="stat-value">{Object.values(eventDetails).filter(d => d.capacity !== undefined).reduce((sum, d) => sum + (d.capacity || 0), 0)}</span><span className="stat-label">Total Capacity</span></div>
                  <div className="summary-stat"><span className="stat-value">{Object.values(eventDetails).filter(d => d.sold !== undefined).reduce((sum, d) => sum + (d.sold || 0), 0)}</span><span className="stat-label">Total Sold</span></div>
                  <div className="summary-stat"><span className="stat-value">{Object.values(eventDetails).filter(d => d.available !== undefined).reduce((sum, d) => sum + (d.available || 0), 0)}</span><span className="stat-label">Available</span></div>
                </div>
              </div>
            )}
            <div className="comparison-table-wrapper">
              <table className="comparison-table">
                <thead><tr><th className="col-platform">Platform</th><th className="col-name">Event Name</th><th className="col-slot">Slot</th><th className="col-date">Date</th><th className="col-capacity">Capacity</th><th className="col-sold">Sold</th><th className="col-available">Available</th><th className="col-percentage">% Sold</th><th className="col-price">Price</th><th className="col-controls">Controls</th><th className="col-actions">Actions</th></tr></thead>
                <tbody>
                  {selectedEvents.map((event) => {
                    const key = `${event.type}-${event.id}`;
                    const details = eventDetails[key];
                    if (!details) return null;
                    const capacityStatus = getCapacityStatus(details.capacity, details.sold);
                    const currentData = getEventCurrentData(event);
                    return (
                      <tr key={key} className={`event-row event-row-${event.type}`}>
                        <td className="col-platform"><div className="platform-badge"><span className="platform-icon">{event.type === 'eventbrite' ? '🎭' : '🛒'}</span><span className="platform-name">{event.type === 'eventbrite' ? 'EB' : 'WC'}</span>{details.status === 'loading' && <Spinner size="tiny" />}</div></td>
                        <td className="col-name">
                          {event.type === 'eventbrite' ? (
                            <select className="event-dropdown" value={currentData.currentSeriesId || ''} onChange={(e) => { const newSeriesId = e.target.value; const series = dataState.eventbriteSeries.find(s => s.series_id === newSeriesId); const firstOccurrence = series?.events[0]?.occurrence_id; if (newSeriesId && firstOccurrence) handleEventbriteChange(event, newSeriesId, firstOccurrence); }}>
                              {dataState.eventbriteSeries.map(series => <option key={series.series_id} value={series.series_id}>{truncateText(series.series_name)}</option>)}
                            </select>
                          ) : (
                            <select className="event-dropdown" value={currentData.currentProductId || ''} onChange={(e) => { const newProductId = parseInt(e.target.value); const product = dataState.woocommerceProducts.find(p => p.product_id === newProductId); const firstSlot = product?.slots[0]?.slot_id; const firstDate = product?.slots[0]?.dates[0]?.date_id; if (newProductId && firstSlot && firstDate) handleWooCommerceChange(event, newProductId, firstSlot, firstDate); }}>
                              {dataState.woocommerceProducts.map(product => <option key={product.product_id} value={product.product_id}>{truncateText(product.product_name)}</option>)}
                            </select>
                          )}
                          {details.status === 'loading' && <span className="inline-spinner"><Spinner size="tiny" /></span>}
                          {details.status === 'error' && <span className="error-indicator" title={details.error}>⚠️</span>}
                        </td>
                        <td className="col-slot">
                          {event.type === 'woocommerce' ? (() => {
                            const product = dataState.woocommerceProducts.find(p => p.product_id === currentData.currentProductId);
                            if (!product || !product.slots || product.slots.length === 0) return <span className="unavailable">-</span>;
                            const isTrueBookingProduct = product.slots.length > 1 || (product.slots.length === 1 && product.slots[0].slot_id !== `event_${currentData.currentProductId}`);
                            if (isTrueBookingProduct) {
                              return (
                                <select className="slot-dropdown" value={currentData.currentSlotId || ''} onChange={(e) => { const newSlotId = e.target.value; const selectedSlot = product.slots.find(s => s.slot_id === newSlotId); const firstDateId = selectedSlot?.dates?.[0]?.date_id; if (currentData.currentProductId && newSlotId && firstDateId) handleWooCommerceChange(event, currentData.currentProductId, newSlotId, firstDateId); }}>
                                  {product.slots.map(slot => <option key={slot.slot_id} value={slot.slot_id}>{slot.slot_label}</option>)}
                                </select>
                              );
                            } else { return <span className="unavailable">-</span>; }
                          })() : <span className="unavailable">-</span>}
                        </td>
                        <td className="col-date">
                          {event.type === 'eventbrite' ? (() => {
                            const series = dataState.eventbriteSeries.find(s => s.series_id === currentData.currentSeriesId);
                            return series ? (
                              <select className="date-dropdown" value={currentData.currentOccurrenceId || ''} onChange={(e) => { if (e.target.value && currentData.currentSeriesId) handleEventbriteChange(event, currentData.currentSeriesId, e.target.value); }}>
                                {series.events.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()).map(occurrence => <option key={occurrence.occurrence_id} value={occurrence.occurrence_id}>{formatDate(occurrence.start_date)}</option>)}
                              </select>
                            ) : <span className="event-date">{formatDate(details.startDate)}</span>;
                          })() : (() => {
                            const product = dataState.woocommerceProducts.find(p => p.product_id === currentData.currentProductId);
                            const slot = product?.slots.find(s => s.slot_id === currentData.currentSlotId);
                            return slot ? (
                              <select className="date-dropdown" value={currentData.currentDateId || ''} onChange={(e) => { if (e.target.value && currentData.currentSlotId) handleWooCommerceChange(event, currentData.currentProductId, currentData.currentSlotId, e.target.value); }}>
                                {slot.dates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(date => <option key={date.date_id} value={date.date_id}>{formatDate(date.date)}</option>)}
                              </select>
                            ) : <span className="event-date">{formatDate(details.startDate)}</span>;
                          })()}
                        </td>
                        <td className="col-capacity">{details.capacity !== undefined ? <span className="capacity-value">{details.capacity}</span> : <span className="unavailable">-</span>}</td>
                        <td className="col-sold">{details.sold !== undefined ? <span className="sold-value">{details.sold}</span> : <span className="unavailable">-</span>}</td>
                        <td className="col-available">{details.available !== undefined ? <span className="available-value">{details.available}</span> : <span className="unavailable">-</span>}</td>
                        <td className="col-percentage">{details.capacity !== undefined && details.sold !== undefined ? <div className="percentage-cell"><div className="progress-bar"><div className={`progress-fill progress-${capacityStatus.status}`} style={{ width: `${capacityStatus.percentage}%` }}></div></div><span className="percentage-text">{capacityStatus.percentage}%</span></div> : <span className="unavailable">-</span>}</td>
                        <td className="col-price"><span className="price-value">{details.price ? formatPrice(details.price) : '-'}</span></td>
                        <td className="col-controls">
                          {details.type === 'eventbrite' && details.ticketClass && details.status === 'loaded' ? (
                            <div className="capacity-controls-compact">
                              <button className="btn-capacity-compact btn-decrement" onClick={() => handleCapacityDecrement(key, details)} disabled={details.capacityLoading || (details.capacity || 0) <= (details.sold || 0)} title="Decrease capacity by 1">{details.capacityLoading ? <div className="spinner-tiny"></div> : '−'}</button>
                              <button className="btn-capacity-compact btn-increment" onClick={() => handleCapacityIncrement(key, details)} disabled={details.capacityLoading} title="Increase capacity by 1">{details.capacityLoading ? <div className="spinner-tiny"></div> : '+'}</button>
                            </div>
                          ) : details.type === 'woocommerce' && details.status === 'loaded' ? (
                            <div className="inventory-controls-compact">
                              <button className="btn-inventory-compact btn-decrement" onClick={() => handleInventoryDecrement(key, details, event)} disabled={details.inventoryLoading || (details.available || 0) <= 0} title="Decrease inventory by 1">{details.inventoryLoading ? <div className="spinner-tiny"></div> : '−'}</button>
                              <button className="btn-inventory-compact btn-increment" onClick={() => handleInventoryIncrement(key, details, event)} disabled={details.inventoryLoading} title="Increase inventory by 1">{details.inventoryLoading ? <div className="spinner-tiny"></div> : '+'}</button>
                            </div>
                          ) : <span className="no-controls">-</span>}
                          {details.type === 'woocommerce' && <input type="number" value={setInputs[key] || ''} onChange={(e) => setSetInputs(prev => ({ ...prev, [key]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSetWooCommerce(key, event, details); }} disabled={details.inventoryLoading} className="set-input" />}
                          {details.type === 'eventbrite' && <input type="number" value={setInputs[key] || ''} onChange={(e) => setSetInputs(prev => ({ ...prev, [key]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSetEventbrite(key, details); }} disabled={details.capacityLoading} className="set-input" />}
                          {setErrors[key] && <span className="error-message">{setErrors[key]}</span>}
                        </td>
                        <td className="col-actions">
                          <div className="action-buttons">
                            {details.url && <a href={details.url} target="_blank" rel="noopener noreferrer" className="btn-action btn-view" title="View event">👁️</a>}
                            <button className="btn-action btn-refresh-date" onClick={() => refreshEventDetails(event)} title="Refresh just this date">🔄 Date</button>
                            {event.type === 'woocommerce' && <button className="btn-action btn-refresh-slot" onClick={() => refreshWooCommerceSlot(event)} title="Refresh all dates for this slot">🔄 Slot</button>}
                            <button className="btn-action btn-remove" onClick={() => onEventSelect(event)} title="Remove from comparison">✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <NewEventRow />
                </tbody>
              </table>
            </div>
            {Object.values(eventDetails).some(d => d.capacityError || d.inventoryError) && (
              <div className="capacity-errors-panel">
                <h4>Management Errors</h4>
                {Object.entries(eventDetails).filter(([_, d]) => d.capacityError || d.inventoryError).map(([k, d]) => <div key={k} className="capacity-error"><span className="error-event">{truncateText(d.name, 30)}</span><span className="error-message">{d.capacityError || d.inventoryError}</span></div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;