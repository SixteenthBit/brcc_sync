import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // For fetch errors
  const [appMessage, setAppMessage] = useState({ text: null, type: null }); // For general messages/errors
  const [pendingChanges, setPendingChanges] = useState({}); // { ticketClassId: newDesiredCapacity }
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState([]); // To store results of save operations

  // LocalStorage helpers
  const getStoredOffset = (ticketClassId) => {
    const offset = localStorage.getItem(`eventbrite_capacity_offset_${ticketClassId}`);
    return offset ? parseInt(offset, 10) : 0;
  };

  const setStoredOffset = (ticketClassId, offset) => {
    localStorage.setItem(`eventbrite_capacity_offset_${ticketClassId}`, offset.toString());
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null); // Clear previous fetch error
    setAppMessage({ text: null, type: null }); // Clear general messages
    try {
      const response = await axios.get(`${API_URL}/events`);
      setEvents(response.data);
      if (response.data.length === 0) {
        setAppMessage({ text: "No live events found for your organization.", type: "info" });
      }
    } catch (err) {
      const errorMessage = err.response ? err.response.data.error : err.message;
      setError(errorMessage); // Set fetch error for specific display
      console.error("Error fetching events:", err);
    }
    setLoading(false);
  };

  const handlePendingCapacityChange = (ticketClassId, newDesiredCapacity) => {
    // Ensure newDesiredCapacity is a number or can be parsed to one.
    // Allow empty string for user clearing input, but store as number or undefined.
    const numericValue = parseInt(newDesiredCapacity, 10);
    setPendingChanges(prev => ({
      ...prev,
      [ticketClassId]: isNaN(numericValue) ? '' : numericValue // Store empty string or number
    }));
  };

  const incrementCapacity = (ticketClassId, currentCapacity) => {
    const currentPending = pendingChanges[ticketClassId];
    const baseCapacity = currentPending !== undefined && !isNaN(parseInt(currentPending)) ? parseInt(currentPending) : currentCapacity;
    handlePendingCapacityChange(ticketClassId, baseCapacity + 1);
  };

  const decrementCapacity = (ticketClassId, currentCapacity) => {
    const currentPending = pendingChanges[ticketClassId];
    const baseCapacity = currentPending !== undefined && !isNaN(parseInt(currentPending)) ? parseInt(currentPending) : currentCapacity;
    if (baseCapacity > 0) { // Prevent negative capacity
      handlePendingCapacityChange(ticketClassId, baseCapacity - 1);
    }
  };

  const handleSaveAllChanges = async () => {
    if (!selectedOccurrenceId || !selectedOccurrenceDetails) {
      setAppMessage({ text: "Please select an event occurrence first.", type: "error" });
      return;
    }

    if (Object.keys(pendingChanges).length === 0) {
      setAppMessage({ text: "No pending changes to save.", type: "info" });
      return;
    }

    setIsSaving(true);
    setSaveResults([]); 
    setAppMessage({ text: null, type: null }); // Clear previous app messages

    const promises = [];
    const currentTicketClasses = selectedOccurrenceDetails.ticket_classes;

    for (const ticketClassId in pendingChanges) {
      const newDesiredCapacityString = pendingChanges[ticketClassId];
      if (newDesiredCapacityString === undefined || newDesiredCapacityString === '' || isNaN(parseInt(newDesiredCapacityString))) {
        console.warn(`Skipping invalid capacity for ticket class ID ${ticketClassId}`);
        // Optionally add to saveResults as a skipped item
        setSaveResults(prev => [...prev, { ticketClassId, status: 'skipped', error: 'Invalid capacity value.' }]);
        continue;
      }
      const newDesiredCapacity = parseInt(newDesiredCapacityString, 10);

      const ticketClass = currentTicketClasses.find(tc => tc.id === ticketClassId);
      if (!ticketClass) {
        console.warn(`Ticket class ID ${ticketClassId} not found in selected occurrence.`);
        setSaveResults(prev => [...prev, { ticketClassId, status: 'error', error: 'Ticket class not found.' }]);
        continue;
      }

      const originalApiCapacity = ticketClass.capacity;
      const changeBeingApplied = newDesiredCapacity - originalApiCapacity;
      const currentStoredOffset = getStoredOffset(ticketClassId);
      const newStoredOffset = currentStoredOffset + changeBeingApplied;
      
      setStoredOffset(ticketClassId, newStoredOffset); // Update localStorage

      promises.push(
        axios.post(`${API_URL}/events/${selectedOccurrenceDetails.id}/ticket_classes/${ticketClassId}`, {
          capacity: newDesiredCapacity
        })
        .then(response => ({ ticketClassId, status: 'fulfilled', data: response.data, name: ticketClass.name }))
        .catch(error => ({ 
          ticketClassId, 
          status: 'rejected', 
          error: error.response ? error.response.data.error : error.message, 
          name: ticketClass.name 
        }))
      );
    }

    const results = await Promise.allSettled(promises.map(p => p.catch(e => e))); // Ensure all promises resolve for allSettled
    
    const processedResults = results.map(result => {
        if (result.status === 'fulfilled') {
            // This means the axios promise itself resolved. Now check the custom status property.
            if (result.value.status === 'fulfilled') {
                 return { name: result.value.name, id: result.value.ticketClassId, status: 'Success' };
            } else if (result.value.status === 'rejected') {
                 return { name: result.value.name, id: result.value.ticketClassId, status: 'Failed', error: result.value.error };
            }
        }
        // This case handles if the promise pushed to promises array was already a rejection (e.g. from .catch(error => ...))
        // Or if Promise.allSettled itself reports 'rejected' for one of the axios calls that didn't have the inner .then/.catch structure
        return { name: 'Unknown Ticket Class', id: result.reason?.ticketClassId || 'Unknown ID', status: 'Failed', error: result.reason?.error || 'Network or unknown error' };
    });

    setSaveResults(processedResults);
    setIsSaving(false);
    setPendingChanges({}); // Clear pending changes after attempting to save all
    fetchEvents(); // Refresh data from the server
  };

  // Remove or comment out handleSubmitCapacityUpdate as it's replaced by handleSaveAllChanges
  // const handleSubmitCapacityUpdate = async (eventOccurrenceId, ticketClassId) => { ... };

  // Helper to find the selected occurrence details from the events state
  const getSelectedOccurrenceDetails = () => {
    if (!selectedOccurrenceId) return null;
    for (const series of events) {
      const found = series.occurrences.find(occ => occ.id === selectedOccurrenceId);
      if (found) return { ...found, seriesName: series.name }; // Add series name for context
    }
    return null;
  };

  const selectedOccurrenceDetails = getSelectedOccurrenceDetails();

  // Flatten occurrences for selection list
  const allOccurrences = events.reduce((acc, series) => {
    series.occurrences.forEach(occurrence => {
      acc.push({
        ...occurrence,
        seriesName: series.name, // Add series name for display
        seriesId: series.series_id,
      });
    });
    return acc;
  }, []);

  if (loading) return <div className="App"><header className="App-header"><h1>Eventbrite Capacity Manager</h1></header><main><p className="loading-message">Loading events...</p></main></div>;
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>Eventbrite Capacity Manager</h1>
        <button onClick={fetchEvents} disabled={loading || isSaving}>Refresh Events</button>
      </header>
      <main>
        {error && <div className="app-message error-message">Error fetching events: {error}</div>}
        {appMessage.text && <div className={`app-message ${appMessage.type}-message`}>{appMessage.text}</div>}

        <div className="occurrence-selector">
          <h2>Select an Event Occurrence:</h2>
          {allOccurrences.length === 0 && !loading && !error && !appMessage.text && <p>No live event occurrences found.</p>}
          <ul>
            {allOccurrences.map(occurrence => (
              <li
                key={occurrence.id}
                className={`occurrence-item ${selectedOccurrenceId === occurrence.id ? 'selected' : ''}`}
                onClick={() => setSelectedOccurrenceId(occurrence.id)}
              >
                {occurrence.seriesName} - {occurrence.name} - {new Date(occurrence.start_time).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>

        {selectedOccurrenceDetails && (
          <div className="ticket-class-manager">
            <h3>
              Managing Tickets for: {selectedOccurrenceDetails.seriesName} - {selectedOccurrenceDetails.name}
            </h3>
            <p>Start: {new Date(selectedOccurrenceDetails.start_time).toLocaleString()}</p>
            <p>End: {new Date(selectedOccurrenceDetails.end_time).toLocaleString()}</p>
            <h4>Ticket Classes:</h4>
            {selectedOccurrenceDetails.ticket_classes.length === 0 ? <p>No ticket classes found for this occurrence.</p> : (
              <ul>
                {selectedOccurrenceDetails.ticket_classes.map(tc => (
                  <li key={tc.id} className="ticket-class">
                    <div className="ticket-class-info">
                      <strong>{tc.name}</strong> (ID: {tc.id})<br />
                      API Capacity: {tc.capacity} | Sold: {tc.quantity_sold} <br />
                      App-Modified Count: {getStoredOffset(tc.id)}
                    </div>
                    <div className="ticket-class-controls">
                      <button onClick={() => decrementCapacity(tc.id, tc.capacity)} disabled={isSaving}>-</button>
                      <input
                        type="number"
                        value={pendingChanges[tc.id] !== undefined ? pendingChanges[tc.id] : tc.capacity}
                        onChange={(e) => handlePendingCapacityChange(tc.id, e.target.value)}
                        min="0"
                        className="capacity-input"
                        disabled={isSaving}
                      />
                      <button onClick={() => incrementCapacity(tc.id, tc.capacity)} disabled={isSaving}>+</button>
                      {/* Individual save button removed */}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {Object.keys(pendingChanges).length > 0 && selectedOccurrenceDetails && (
              <div className="save-all-container">
                <button onClick={handleSaveAllChanges} disabled={isSaving || loading} className="save-all-button">
                  {isSaving ? 'Saving...' : 'Save All Changes for This Occurrence'}
                </button>
              </div>
            )}
            {saveResults.length > 0 && (
              <div className="save-results">
                <h4>Save Attempt Results:</h4>
                <ul>
                  {saveResults.map((result, index) => (
                    <li key={index} className={result.status === 'Success' ? 'success' : 'failure'}>
                      Ticket Class: {result.name || result.id} - Status: {result.status}
                      {result.error && ` - Error: ${result.error}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {!selectedOccurrenceDetails && !loading && events.length > 0 && (
          <p className="initial-prompt">Please select an event occurrence to view and manage its ticket classes.</p>
        )}
      </main>
    </div>
  );
}

export default App;
