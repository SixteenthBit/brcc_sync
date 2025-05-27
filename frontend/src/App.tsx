import { useState } from 'react'
import SeriesViewer from './components/SeriesViewer'
import WooCommerceViewer from './components/WooCommerceViewer'
import CapacityManager from './components/CapacityManager'
import './App.css'

function App() {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedWooCommerceDate, setSelectedWooCommerceDate] = useState<{
    productId: number;
    slotId: string;
    dateId: string;
  } | null>(null);

  const handleOccurrenceSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    // Clear WooCommerce selection when Eventbrite event is selected
    setSelectedWooCommerceDate(null);
  };

  const handleWooCommerceDateSelect = (productId: number, slotId: string, dateId: string) => {
    setSelectedWooCommerceDate({ productId, slotId, dateId });
    // Clear Eventbrite selection when WooCommerce date is selected
    setSelectedEventId('');
  };

  return (
    <div className="App">
      <div className="app-header">
        <h1>🎭 Backroom Comedy Club - Event Management</h1>
        <p>Manage both Eventbrite and WooCommerce events from one dashboard</p>
      </div>
      
      <div className="events-section">
        <SeriesViewer onOccurrenceSelect={handleOccurrenceSelect} initialCollapsed={true} />
        <WooCommerceViewer onDateSelect={handleWooCommerceDateSelect} initialCollapsed={true} />
      </div>
      
      <div className="capacity-section">
        <CapacityManager 
          selectedEventId={selectedEventId}
          selectedWooCommerceDate={selectedWooCommerceDate}
        />
      </div>
    </div>
  )
}

export default App
