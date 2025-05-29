import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api';
import type { EventMapping, UnmappedEvent, MappingSummary } from '../api';
import './MappingView.css';

interface MappingViewProps {
  onSendToCompare: (mappingId: string, mappingData?: any) => void;
}

interface Alert {
  type: 'success' | 'error' | 'info';
  message: string;
}

const MappingView: React.FC<MappingViewProps> = ({ onSendToCompare }) => {
  const [mappings, setMappings] = useState<EventMapping[]>([]);
  const [unmappedEvents, setUnmappedEvents] = useState<UnmappedEvent[]>([]);
  const [summary, setSummary] = useState<MappingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [selectedWooCommerceEvent, setSelectedWooCommerceEvent] = useState<UnmappedEvent | null>(null);
  const [selectedEventbriteEvents, setSelectedEventbriteEvents] = useState<UnmappedEvent[]>([]);
  const [isCreatingMapping, setIsCreatingMapping] = useState(false);
  // const [editingMapping, setEditingMapping] = useState<EventMapping | null>(null);
  const [showUnmapped, setShowUnmapped] = useState(true);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      setLoading(true);
      const response = await api.getMappings();
      setMappings(response.data.mappings);
      setUnmappedEvents(response.data.unmapped_events);
      setSummary(response.data.summary);
      setAlert(null);
    } catch (error) {
      console.error('Failed to load mappings:', error);
      setAlert({
        type: 'error',
        message: error instanceof ApiError ? error.message : 'Failed to load mappings'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMapping = async () => {
    if (!selectedWooCommerceEvent || selectedEventbriteEvents.length === 0) {
      setAlert({
        type: 'error',
        message: 'Please select one WooCommerce event and at least one Eventbrite event'
      });
      return;
    }

    try {
      setIsCreatingMapping(true);
      await api.createMapping({
        woocommerce_product_id: selectedWooCommerceEvent.product_id!,
        eventbrite_series_ids: selectedEventbriteEvents.map(e => e.series_id!),
        name: `${selectedWooCommerceEvent.name} (Custom Mapping)`
      });

      setAlert({
        type: 'success',
        message: 'Custom mapping created successfully'
      });

      // Reset selection
      setSelectedWooCommerceEvent(null);
      setSelectedEventbriteEvents([]);
      
      // Reload mappings
      await loadMappings();
    } catch (error) {
      console.error('Failed to create mapping:', error);
      setAlert({
        type: 'error',
        message: error instanceof ApiError ? error.message : 'Failed to create mapping'
      });
    } finally {
      setIsCreatingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) {
      return;
    }

    try {
      await api.deleteMapping(mappingId);
      setAlert({
        type: 'success',
        message: 'Mapping deleted successfully'
      });
      await loadMappings();
    } catch (error) {
      console.error('Failed to delete mapping:', error);
      setAlert({
        type: 'error',
        message: error instanceof ApiError ? error.message : 'Failed to delete mapping'
      });
    }
  };

  const handleSendToCompare = (mappingId: string) => {
    try {
      // Call onSendToCompare immediately without fetching data here
      onSendToCompare(mappingId);
      setAlert({
        type: 'success',
        message: 'Navigating to comparison view...'
      });
    } catch (error) {
      // This catch block handles synchronous errors from onSendToCompare or setAlert
      console.error('Failed to initiate navigation to compare view:', error);
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to navigate to comparison view'
      });
    }
  };

  const handleWooCommerceEventSelect = (event: UnmappedEvent) => {
    if (selectedWooCommerceEvent?.id === event.id) {
      setSelectedWooCommerceEvent(null);
    } else {
      setSelectedWooCommerceEvent(event);
    }
  };

  const handleEventbriteEventSelect = (event: UnmappedEvent) => {
    if (selectedEventbriteEvents.some(e => e.id === event.id)) {
      setSelectedEventbriteEvents(prev => prev.filter(e => e.id !== event.id));
    } else {
      setSelectedEventbriteEvents(prev => [...prev, event]);
    }
  };

  const getMappingSourceBadge = (source: string) => {
    switch (source) {
      case 'manual_fallback':
        return <span className="mapping-badge manual">Manual Fallback</span>;
      case 'programmatic':
        return <span className="mapping-badge programmatic">Auto-Matched</span>;
      case 'user_override':
        return <span className="mapping-badge user">User Override</span>;
      default:
        return <span className="mapping-badge unknown">Unknown</span>;
    }
  };

  const woocommerceUnmapped = unmappedEvents.filter(e => e.platform === 'woocommerce');
  const eventbriteUnmapped = unmappedEvents.filter(e => e.platform === 'eventbrite');

  if (loading) {
    return (
      <div className="mapping-view">
        <div className="loading">
          <div className="spinner"></div>
          <span>Loading event mappings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mapping-view">
      <div className="header">
        <h1>Event Mapping</h1>
        <div className="header-actions">
          <button 
            onClick={loadMappings} 
            className="btn btn-refresh"
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          <span className="alert-icon">
            {alert.type === 'success' ? '✅' : alert.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          {alert.message}
        </div>
      )}

      {summary && (
        <div className="summary-section">
          <h3>Mapping Summary</h3>
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-number">{summary.total_mappings}</div>
              <div className="summary-label">Total Mappings</div>
            </div>
            <div className="summary-card manual">
              <div className="summary-number">{summary.manual_fallback_count}</div>
              <div className="summary-label">Manual Fallback</div>
            </div>
            <div className="summary-card programmatic">
              <div className="summary-number">{summary.programmatic_count}</div>
              <div className="summary-label">Auto-Matched</div>
            </div>
            <div className="summary-card user">
              <div className="summary-number">{summary.user_override_count}</div>
              <div className="summary-label">User Override</div>
            </div>
            <div className="summary-card unmapped">
              <div className="summary-number">{summary.total_unmapped}</div>
              <div className="summary-label">Unmapped Events</div>
            </div>
          </div>
        </div>
      )}

      <div className="mappings-section">
        <h3>Event Mappings</h3>
        <div className="mappings-grid">
          {mappings.map(mapping => (
            <div key={mapping.id} className="mapping-card">
              <div className="mapping-header">
                <h4>{mapping.name}</h4>
                {getMappingSourceBadge(mapping.mapping_source)}
              </div>
              
              <div className="mapping-details">
                <div className="mapping-detail">
                  <span className="label">WooCommerce Product:</span>
                  <span className="value">{mapping.woocommerce_product_id}</span>
                </div>
                <div className="mapping-detail">
                  <span className="label">Eventbrite Series:</span>
                  <span className="value">{mapping.eventbrite_series_ids.length} series</span>
                </div>
                <div className="mapping-detail">
                  <span className="label">Last Updated:</span>
                  <span className="value">{new Date(mapping.last_updated).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mapping-actions">
                <button 
                  onClick={() => handleSendToCompare(mapping.id)}
                  className="btn btn-primary"
                >
                  📊 Send to Compare
                </button>
                {mapping.mapping_source === 'user_override' && (
                  <button 
                    onClick={() => handleDeleteMapping(mapping.id)}
                    className="btn btn-danger"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {unmappedEvents.length > 0 && (
        <div className="unmapped-section">
          <div className="section-header">
            <h3>Manual Mapping Tools</h3>
            <button 
              onClick={() => setShowUnmapped(!showUnmapped)}
              className="btn btn-toggle"
            >
              {showUnmapped ? '🔼 Hide' : '🔽 Show'} Unmapped Events
            </button>
          </div>

          {showUnmapped && (
            <>
              <div className="manual-mapping">
                <h4>Create Custom Mapping</h4>
                <p>Select one WooCommerce event and up to 3 Eventbrite events to create a custom mapping.</p>
                
                <div className="selection-summary">
                  <div className="selected-woocommerce">
                    <strong>WooCommerce:</strong> {selectedWooCommerceEvent ? selectedWooCommerceEvent.name : 'None selected'}
                  </div>
                  <div className="selected-eventbrite">
                    <strong>Eventbrite:</strong> {selectedEventbriteEvents.length > 0 ? `${selectedEventbriteEvents.length} selected` : 'None selected'}
                  </div>
                  <button 
                    onClick={handleCreateMapping}
                    disabled={!selectedWooCommerceEvent || selectedEventbriteEvents.length === 0 || isCreatingMapping}
                    className="btn btn-success"
                  >
                    {isCreatingMapping ? '⏳ Creating...' : '✨ Create Mapping'}
                  </button>
                </div>
              </div>

              <div className="unmapped-grid">
                <div className="unmapped-column">
                  <h4>Unmapped WooCommerce Events ({woocommerceUnmapped.length})</h4>
                  <div className="unmapped-list">
                    {woocommerceUnmapped.map(event => (
                      <div 
                        key={event.id} 
                        className={`unmapped-item ${selectedWooCommerceEvent?.id === event.id ? 'selected' : ''}`}
                        onClick={() => handleWooCommerceEventSelect(event)}
                      >
                        <div className="event-name">{event.name}</div>
                        <div className="event-id">Product ID: {event.product_id}</div>
                        <div className="event-reason">Reason: {event.reason.replace('_', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="unmapped-column">
                  <h4>Unmapped Eventbrite Events ({eventbriteUnmapped.length})</h4>
                  <div className="unmapped-list">
                    {eventbriteUnmapped.map(event => (
                      <div 
                        key={event.id} 
                        className={`unmapped-item ${selectedEventbriteEvents.some(e => e.id === event.id) ? 'selected' : ''}`}
                        onClick={() => handleEventbriteEventSelect(event)}
                      >
                        <div className="event-name">{event.name}</div>
                        <div className="event-id">Series ID: {event.series_id}</div>
                        <div className="event-reason">Reason: {event.reason.replace('_', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MappingView; 