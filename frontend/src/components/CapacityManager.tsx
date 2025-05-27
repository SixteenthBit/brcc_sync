import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api';
import type { CapacityData, ConfigData, TicketClass } from '../api';
import './CapacityManager.css';

interface CapacityManagerProps {
  selectedEventId?: string;
  selectedWooCommerceDate?: {
    productId: number;
    slotId: string;
    dateId: string;
  } | null;
}

const CapacityManager: React.FC<CapacityManagerProps> = ({ selectedEventId, selectedWooCommerceDate }) => {
  const [capacityData, setCapacityData] = useState<CapacityData | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [ticketClasses, setTicketClasses] = useState<TicketClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTicketClasses, setLoadingTicketClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  
  // Form state
  const [eventId, setEventId] = useState<string>('');
  const [selectedTicketClassId, setSelectedTicketClassId] = useState<string>('');

  // Check if backend is online
  const checkBackendHealth = async () => {
    try {
      await api.healthCheck();
      setIsOnline(true);
      setError(null);
    } catch (err) {
      setIsOnline(false);
      setError('Backend is not running. Please start the FastAPI server.');
    }
  };

  // Load configuration
  const loadConfig = async () => {
    try {
      const configData = await api.getConfig();
      setConfig(configData);
      
      // Set default event ID if available
      if (configData.default_event_id && !eventId) {
        setEventId(configData.default_event_id);
      }
      
      if (!configData.has_private_token) {
        setError('Eventbrite private token not configured. Please set PRIVATE_TOKEN in .env');
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  // Load ticket classes for an event
  const loadTicketClasses = async (eventIdToLoad: string) => {
    if (!eventIdToLoad.trim()) {
      setTicketClasses([]);
      setSelectedTicketClassId('');
      setCapacityData(null);
      return;
    }
    
    setLoadingTicketClasses(true);
    setError(null);
    
    try {
      const response = await api.getTicketClasses(eventIdToLoad.trim());
      setTicketClasses(response.data.ticket_classes);
      
      // Auto-select the first ticket class if available
      if (response.data.ticket_classes.length > 0) {
        const firstTicketClass = response.data.ticket_classes[0];
        setSelectedTicketClassId(firstTicketClass.id);
        
        // If this matches the default, load capacity immediately
        if (config?.default_ticket_class_id === firstTicketClass.id) {
          await loadCapacity(eventIdToLoad, firstTicketClass.id);
        }
      } else {
        setSelectedTicketClassId('');
        setCapacityData(null);
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to load ticket classes';
      setError(errorMessage);
      setTicketClasses([]);
      setSelectedTicketClassId('');
      setCapacityData(null);
    } finally {
      setLoadingTicketClasses(false);
    }
  };

  // Load current capacity
  const loadCapacity = async (eventIdToUse?: string, ticketClassIdToUse?: string) => {
    const useEventId = eventIdToUse || eventId;
    const useTicketClassId = ticketClassIdToUse || selectedTicketClassId;
    
    if (!useEventId || !useTicketClassId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getCurrentCapacity(useEventId, useTicketClassId);
      setCapacityData(response.data);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to load capacity';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle increment
  const handleIncrement = async () => {
    if (!eventId || !selectedTicketClassId) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await api.incrementCapacity(eventId, selectedTicketClassId);
      setCapacityData({
        capacity: response.data.new_capacity,
        quantity_sold: response.data.quantity_sold,
        quantity_total: response.data.quantity_total || 0,
        available: response.data.available,
        ticket_class_name: response.data.ticket_class_name,
        ticket_class_id: response.data.ticket_class_id,
        event_id: response.data.event_id,
      });
      setSuccess(`Capacity increased from ${response.data.old_capacity} to ${response.data.new_capacity}`);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to increment capacity';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle decrement
  const handleDecrement = async () => {
    if (!eventId || !selectedTicketClassId) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await api.decrementCapacity(eventId, selectedTicketClassId);
      setCapacityData({
        capacity: response.data.new_capacity,
        quantity_sold: response.data.quantity_sold,
        quantity_total: response.data.quantity_total || 0,
        available: response.data.available,
        ticket_class_name: response.data.ticket_class_name,
        ticket_class_id: response.data.ticket_class_id,
        event_id: response.data.event_id,
      });
      setSuccess(`Capacity decreased from ${response.data.old_capacity} to ${response.data.new_capacity}`);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to decrement capacity';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle event ID change
  const handleEventIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEventId = e.target.value;
    setEventId(newEventId);
    
    // Clear current data
    setCapacityData(null);
    setSelectedTicketClassId('');
    
    // Load ticket classes if event ID is provided
    if (newEventId.trim()) {
      loadTicketClasses(newEventId);
    } else {
      setTicketClasses([]);
    }
  };

  // Handle ticket class selection change
  const handleTicketClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTicketClassId = e.target.value;
    setSelectedTicketClassId(newTicketClassId);
    
    if (newTicketClassId && eventId) {
      loadCapacity(eventId, newTicketClassId);
    } else {
      setCapacityData(null);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error && !error.includes('Backend is not running') && !error.includes('private token')) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      await checkBackendHealth();
      await loadConfig();
    };
    initialize();
  }, []);

  // Load ticket classes when config is loaded and we have a default event ID
  useEffect(() => {
    if (config && isOnline && eventId && config.default_event_id === eventId) {
      loadTicketClasses(eventId);
    }
  }, [config, isOnline]);

  // Handle selectedEventId prop changes
  useEffect(() => {
    if (selectedEventId && selectedEventId !== eventId) {
      setEventId(selectedEventId);
      setCapacityData(null);
      setSelectedTicketClassId('');
      if (isOnline) {
        loadTicketClasses(selectedEventId);
      }
    }
  }, [selectedEventId, isOnline]);

  const canModify = isOnline && config?.has_private_token && capacityData && !loading && eventId && selectedTicketClassId;

  return (
    <div className="capacity-manager">
      <div className="header">
        <h1>🎫 Eventbrite Capacity Manager</h1>
        <div className={`status ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          {isOnline ? 'Backend Online' : 'Backend Offline'}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          {success}
        </div>
      )}

      <div className="form-section">
        <h3>Event Configuration</h3>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="eventId">Event ID:</label>
            <input
              id="eventId"
              type="text"
              value={eventId}
              onChange={handleEventIdChange}
              placeholder="Enter Eventbrite Event ID"
              disabled={!isOnline}
              className="form-input"
            />
            {config?.default_event_id && (
              <small className="form-hint">Default: {config.default_event_id}</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="ticketClass">Ticket Class:</label>
            <select
              id="ticketClass"
              value={selectedTicketClassId}
              onChange={handleTicketClassChange}
              disabled={!isOnline || loadingTicketClasses || ticketClasses.length === 0}
              className="form-select"
            >
              <option value="">
                {loadingTicketClasses ? 'Loading...' : 
                 ticketClasses.length === 0 ? 'No ticket classes available' : 
                 'Select a ticket class'}
              </option>
              {ticketClasses.map((ticketClass) => (
                <option key={ticketClass.id} value={ticketClass.id}>
                  {ticketClass.name} (Capacity: {ticketClass.capacity}, Cost: {ticketClass.cost})
                </option>
              ))}
            </select>
            {loadingTicketClasses && (
              <small className="form-hint">Loading ticket classes...</small>
            )}
          </div>
        </div>

        {config && (
          <div className="config-status">
            <div className="config-item">
              <label>API Token:</label>
              <span className={config.has_private_token ? 'configured' : 'missing'}>
                {config.has_private_token ? '✅ Configured' : '❌ Missing'}
              </span>
            </div>
          </div>
        )}
      </div>

      {selectedWooCommerceDate && (
        <div className="woocommerce-selection">
          <h3>Selected WooCommerce Event</h3>
          <div className="selection-info">
            <div className="selection-item">
              <label>Product ID:</label>
              <span>{selectedWooCommerceDate.productId}</span>
            </div>
            <div className="selection-item">
              <label>Slot ID:</label>
              <span>{selectedWooCommerceDate.slotId}</span>
            </div>
            <div className="selection-item">
              <label>Date ID:</label>
              <span>{selectedWooCommerceDate.dateId}</span>
            </div>
          </div>
          <div className="selection-note">
            <span className="note-icon">ℹ️</span>
            WooCommerce inventory is view-only. Use WooCommerce admin to modify stock levels.
          </div>
        </div>
      )}

      {capacityData && (
        <div className="capacity-display">
          <h2>{capacityData.ticket_class_name}</h2>
          <div className="capacity-metrics">
            <div className="capacity-metric">
              <span className="metric-number">{capacityData.capacity}</span>
              <span className="metric-label">Total Capacity</span>
            </div>
            <div className="capacity-metric sold">
              <span className="metric-number">{capacityData.quantity_sold}</span>
              <span className="metric-label">Tickets Sold</span>
            </div>
            <div className="capacity-metric available">
              <span className="metric-number">{capacityData.available}</span>
              <span className="metric-label">Available</span>
            </div>
          </div>
          <div className="capacity-details">
            <small>Event ID: {capacityData.event_id}</small>
            <small>Ticket Class ID: {capacityData.ticket_class_id}</small>
          </div>
        </div>
      )}

      <div className="controls">
        <button
          className="btn btn-decrement"
          onClick={handleDecrement}
          disabled={!canModify || (capacityData?.capacity ?? 0) <= 0}
          title={capacityData?.capacity === 0 ? 'Cannot decrement below 0' : 'Decrease capacity by 1'}
        >
          <span className="btn-icon">➖</span>
          Decrement
        </button>

        <button
          className="btn btn-refresh"
          onClick={() => loadCapacity()}
          disabled={!isOnline || loading || !eventId || !selectedTicketClassId}
          title="Refresh current capacity"
        >
          <span className="btn-icon">🔄</span>
          {loading ? 'Loading...' : 'Refresh'}
        </button>

        <button
          className="btn btn-increment"
          onClick={handleIncrement}
          disabled={!canModify}
          title="Increase capacity by 1"
        >
          <span className="btn-icon">➕</span>
          Increment
        </button>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
};

export default CapacityManager; 