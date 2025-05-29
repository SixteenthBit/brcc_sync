import { useState } from 'react'
import './App.css'

// Import new components (will create these)
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ComparisonView from './components/ComparisonView'
import EventManager from './components/EventManager'
import MappingView from './components/MappingView'

// Types for selected events
export interface SelectedEvent {
  type: 'eventbrite' | 'woocommerce';
  id: string;
  name: string;
  details?: any;
}

export type ViewMode = 'dashboard' | 'comparison' | 'eventbrite' | 'woocommerce' | 'mapping' | 'manage';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [selectedEvents, setSelectedEvents] = useState<SelectedEvent[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mappingIdForComparisonView, setMappingIdForComparisonView] = useState<string | null>(null);

  // Handle event selection from either platform
  const handleEventSelect = (event: SelectedEvent) => {
    setSelectedEvents(prev => {
      // Check if event already selected
      const existingIndex = prev.findIndex(e => e.type === event.type && e.id === event.id);
      
      if (existingIndex !== -1) {
        // Remove if already selected
        return prev.filter((_, index) => index !== existingIndex);
      } else {
        // Add new event (limit to 10 for comparison)
        if (prev.length >= 10) {
          // Don't add if we're at the maximum
          return prev;
        }
        return [...prev, event];
      }
    });
  };

  // Replace an event in the selectedEvents array
  const replaceSelectedEvent = (oldEvent: SelectedEvent, newEvent: SelectedEvent) => {
    setSelectedEvents(prev => {
      const idx = prev.findIndex(e => e.type === oldEvent.type && e.id === oldEvent.id);
      if (idx === -1) return prev;
      // Replace at idx
      const updated = [...prev];
      updated[idx] = newEvent;
      return updated;
    });
  };

  // Clear all selections
  const handleClearSelections = () => {
    setSelectedEvents([]);
  };

  // Navigate to comparison view when events are selected
  const handleCompareEvents = () => {
    if (selectedEvents.length >= 1) {
      setCurrentView('comparison');
    }
  };

  // Handle sending mapping to compare view
  const handleSendToCompare = (mappingId: string, mappingData?: any) => {
    if (mappingData) {
      // Existing flow: MappingView fetched data, now App processes it
      const selectedEventsFromMapping: SelectedEvent[] = [];
      
      if (mappingData.woocommerce_combinations && Array.isArray(mappingData.woocommerce_combinations)) {
        mappingData.woocommerce_combinations.forEach((combination: any) => {
          selectedEventsFromMapping.push({
            type: 'woocommerce',
            id: `${combination.product_id}-${combination.slot_id}-${combination.date_id}`, // Ensure consistent ID format
            name: `${combination.product_name} - ${combination.slot_label} (${combination.date})`,
            details: {
              productId: combination.product_id,
              productName: combination.product_name,
              slotId: combination.slot_id,
              slotLabel: combination.slot_label,
              slotTime: combination.slot_time,
              dateId: combination.date_id,
              date: combination.date,
              stock: combination.stock,
              available: combination.available,
              capacity: combination.total_capacity,
              sold: combination.tickets_sold,
              price: combination.price || '0'
            }
          });
        });
      }
      
      if (mappingData.eventbrite_series && Array.isArray(mappingData.eventbrite_series)) {
        mappingData.eventbrite_series.forEach((series: any) => {
          const events = series.events || [];
          if (events.length > 0) {
            const sortedEvents = events.sort((a: any, b: any) => new Date(a.start_date || '').getTime() - new Date(b.start_date || '').getTime());
            const nextEvent = sortedEvents[0]; // Consider taking the first *upcoming* or most relevant
            selectedEventsFromMapping.push({
              type: 'eventbrite',
              id: nextEvent.occurrence_id || series.series_id || series.id, // Prefer occurrence_id for uniqueness
              name: `${series.series_name || series.name} (${new Date(nextEvent.start_date).toLocaleDateString()})`,
              details: {
                ...nextEvent,
                series_name: series.series_name || series.name,
                series_id: series.series_id || series.id
              }
            });
          } else {
            selectedEventsFromMapping.push({
              type: 'eventbrite',
              id: series.series_id || series.id,
              name: series.series_name || series.name,
              details: series
            });
          }
        });
      }
      setSelectedEvents(selectedEventsFromMapping);
      setMappingIdForComparisonView(null); // Ensure no ID is lingering if data was provided
    } else {
      // New flow: MappingView sends only ID, ComparisonView will fetch
      setSelectedEvents([]); // Clear any existing selections
      setMappingIdForComparisonView(mappingId);
    }
    setCurrentView('comparison');
  };

  const renderMainContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            selectedEvents={selectedEvents}
            onEventSelect={handleEventSelect}
            onCompareEvents={handleCompareEvents}
            onNavigate={setCurrentView}
          />
        );
      case 'comparison':
        return (
          <ComparisonView
            selectedEvents={selectedEvents}
            onEventSelect={handleEventSelect}
            onClearSelections={handleClearSelections}
            replaceSelectedEvent={replaceSelectedEvent}
            mappingIdToLoad={mappingIdForComparisonView}
            onMappingLoaded={() => setMappingIdForComparisonView(null)} // Callback to clear the ID
          />
        );
      case 'mapping':
        return (
          <MappingView
            onSendToCompare={handleSendToCompare} // This now sends (mappingId) or (mappingId, data)
          />
        );
      case 'eventbrite':
      case 'woocommerce':
        return (
          <EventManager
            mode={currentView}
            selectedEvents={selectedEvents}
            onEventSelect={handleEventSelect}
            onNavigate={setCurrentView}
          />
        );
      default:
        return <Dashboard 
          selectedEvents={selectedEvents}
          onEventSelect={handleEventSelect}
          onCompareEvents={handleCompareEvents}
          onNavigate={setCurrentView}
        />;
    }
  };

  return (
    <div className="app">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        selectedEvents={selectedEvents}
        onClearSelections={handleClearSelections}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {renderMainContent()}
      </main>
    </div>
  )
}

export default App
