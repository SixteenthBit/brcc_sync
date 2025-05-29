import React, { useState } from 'react';
import type { ViewMode, SelectedEvent } from '../App';
import SeriesViewer from './SeriesViewer';
import WooCommerceViewer from './WooCommerceViewer';
import './EventManager.css';

interface EventManagerProps {
  mode: ViewMode;
  selectedEvents: SelectedEvent[];
  onEventSelect: (event: SelectedEvent) => void;
  onNavigate: (view: ViewMode) => void;
}

const EventManager: React.FC<EventManagerProps> = ({
  mode,
  selectedEvents,
  onEventSelect,
  onNavigate
}) => {
  // Legacy state for existing components
  const [selectedWooCommerceDate, setSelectedWooCommerceDate] = useState<{
    productId: number;
    slotId: string;
    dateId: string;
  } | null>(null);

  // Handle Eventbrite event selection
  const handleOccurrenceSelect = (eventId: string, occurrence?: any) => {
    setSelectedWooCommerceDate(null);
    
    // Also add to new selection system for comparison
    const event: SelectedEvent = {
      type: 'eventbrite',
      id: eventId,
      name: occurrence?.series_name ? `${occurrence.series_name} - ${eventId}` : `Eventbrite Event ${eventId}`,
      details: occurrence ? {
        occurrence_id: eventId,
        start_date: occurrence.start_date,
        url: occurrence.url,
        series_name: occurrence.series_name
      } : { occurrence_id: eventId }
    };
    onEventSelect(event);
  };

  // Handle WooCommerce date selection
  const handleWooCommerceDateSelect = (productId: number, slotId: string, dateId: string, eventData?: any) => {
    setSelectedWooCommerceDate({ productId, slotId, dateId });
    
    // Also add to new selection system for comparison
    const event: SelectedEvent = {
      type: 'woocommerce',
      id: `${productId}-${slotId}-${dateId}`,
      name: eventData ? `${eventData.productName} - ${eventData.slotLabel}` : `WooCommerce Event ${productId}`,
      details: eventData ? {
        productId, 
        slotId, 
        dateId,
        productName: eventData.productName,
        slotLabel: eventData.slotLabel,
        date: eventData.date,
        price: eventData.price,
        capacity: eventData.capacity,
        sold: eventData.sold,
        available: eventData.available
      } : {
        productId, 
        slotId, 
        dateId
      }
    };
    onEventSelect(event);
  };

  const renderContent = () => {
    switch (mode) {
      case 'eventbrite':
        return (
          <div className="event-manager-content">
            <div className="page-header">
              <div className="header-content">
                <h1>🎭 Eventbrite Event Management</h1>
                <p>Browse event series, select occurrences, and manage ticket capacity</p>
              </div>
              <div className="header-actions">
                <button 
                  className="btn btn-outline"
                  onClick={() => onNavigate('comparison')}
                  disabled={selectedEvents.filter(e => e.type === 'eventbrite').length === 0}
                >
                  Compare Selected
                </button>
              </div>
            </div>

            <div className="eventbrite-layout">
              <div className="series-section full-width">
                <SeriesViewer 
                  onOccurrenceSelect={handleOccurrenceSelect} 
                  initialCollapsed={false}
                />
              </div>
            </div>
          </div>
        );

      case 'woocommerce':
        return (
          <div className="event-manager-content">
            <div className="page-header">
              <div className="header-content">
                <h1>🛒 WooCommerce Event Management</h1>
                <p>Browse FooEvents products, view booking slots, and monitor ticket sales</p>
              </div>
              <div className="header-actions">
                <button 
                  className="btn btn-outline"
                  onClick={() => onNavigate('comparison')}
                  disabled={selectedEvents.filter(e => e.type === 'woocommerce').length === 0}
                >
                  Compare Selected
                </button>
              </div>
            </div>

            <div className="content-grid">
              <div className="woocommerce-section">
                <WooCommerceViewer 
                  onDateSelect={handleWooCommerceDateSelect}
                  initialCollapsed={false}
                />
              </div>
              
              {selectedWooCommerceDate && (
                <div className="details-section">
                  <div className="section-card">
                    <div className="card-header">
                      <h2 className="card-title">Event Details</h2>
                    </div>
                    <div className="card-body">
                      <div className="event-details">
                        <div className="detail-row">
                          <span className="detail-label">Product ID</span>
                          <span className="detail-value">{selectedWooCommerceDate.productId}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Slot ID</span>
                          <span className="detail-value">{selectedWooCommerceDate.slotId}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Date ID</span>
                          <span className="detail-value">{selectedWooCommerceDate.dateId}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="event-manager-content">
            <div className="page-header">
              <h1>Event Manager</h1>
              <p>Unknown mode: {mode}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="event-manager">
      {renderContent()}
    </div>
  );
};

export default EventManager; 