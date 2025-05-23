require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Basic logging for incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const { fetchAllLiveEvents, fetchTicketClassesForEvent, fetchEventOccurrences, updateTicketClassCapacity } = require('./eventbrite-api');

// Routes
// GET /api/events
app.get('/api/events', async (req, res) => {
  const privateToken = process.env.PRIVATE_TOKEN;
  const organizationId = process.env.ORGANIZATION_ID;

  if (!privateToken || !organizationId) {
    return res.status(500).json({ error: 'Server configuration error: Missing Eventbrite credentials.' });
  }

  try {
    const rawEvents = await fetchAllLiveEvents(organizationId, privateToken);
    const processedEvents = [];

    for (const event of rawEvents) {
      let occurrencesData = [];

      if (event.is_series_parent || (event.series_id && event.id === event.series_id) || (!event.series_id && event.has_multiple_dates)) { // Heuristic for a series
        // This event is likely a series parent. Fetch its occurrences.
        // Note: Eventbrite's /events endpoint can return series parents directly.
        // Their occurrences need to be fetched separately.
        // The event.id for a series parent is the series_id.
        const occurrences = await fetchEventOccurrences(event.id, privateToken);
        for (const occ of occurrences) {
          // For each occurrence, fetch its specific ticket classes
          // The 'occ.id' is the actual event_id for this specific occurrence
          const ticketClasses = await fetchTicketClassesForEvent(occ.id, privateToken);
          occurrencesData.push({
            id: occ.id,
            name: occ.name ? occ.name.text : event.name.text, // Occurrence might not have its own name
            start_time: occ.start.utc,
            end_time: occ.end.utc,
            ticket_classes: ticketClasses,
            // Add venue if available and needed: occ.venue or event.venue
          });
        }
      } else if (!event.series_id) {
        // This is a single, non-recurring event or an individual occurrence fetched from /events
        // It's treated as a "series" with one "occurrence" (itself).
        // The event.id is the occurrenceId here.
        const ticketClasses = await fetchTicketClassesForEvent(event.id, privateToken);
        occurrencesData.push({
          id: event.id,
          name: event.name.text,
          start_time: event.start.utc,
          end_time: event.end.utc,
          ticket_classes: ticketClasses,
          venue: event.venue ? { name: event.venue.name, address: event.venue.address.localized_address_display } : null,
          // Add overall capacity/sold from event.ticket_availability if needed for the occurrence
        });
      }
      // Else (if event.series_id && event.id !== event.series_id), it's an occurrence already,
      // but fetchAllLiveEvents with expand=ticket_availability might not give specific ticket classes for it.
      // The goal is to structure by series. If fetchAllLiveEvents only returns series, the first 'if' handles it.
      // If it returns individual occurrences of a series, they might be grouped later or we adjust fetchAllLiveEvents.
      // For now, this structure assumes fetchAllLiveEvents gets series parents or standalone events.

      if (occurrencesData.length > 0) {
        processedEvents.push({
          series_id: event.id, // The ID of the event series (or the event itself if not a series)
          name: event.name.text,
          //url: event.url, // URL to the series page
          occurrences: occurrencesData,
        });
      }
    }

    res.json(processedEvents);
  } catch (error) {
    console.error('Error in /api/events:', error);
    res.status(500).json({ error: 'Failed to fetch events from Eventbrite.', details: error.message });
  }
});

// POST /api/events/:eventOccurrenceId/ticket_classes/:ticketClassId
app.post('/api/events/:eventOccurrenceId/ticket_classes/:ticketClassId', async (req, res) => {
  const { eventOccurrenceId, ticketClassId } = req.params;
  const { capacity } = req.body;
  const privateToken = process.env.PRIVATE_TOKEN;

  if (!privateToken) {
    return res.status(500).json({ error: 'Server configuration error: Missing Eventbrite private token.' });
  }

  if (typeof capacity !== 'number' || capacity < 0 || isNaN(capacity)) {
    return res.status(400).json({ error: 'Invalid capacity provided. Must be a non-negative number.' });
  }

  try {
    const updatedTicketClass = await updateTicketClassCapacity(eventOccurrenceId, ticketClassId, capacity, privateToken);
    res.json({ message: 'Ticket class capacity updated successfully.', data: updatedTicketClass });
  } catch (error) {
    console.error(`Error updating capacity for ticket class ${ticketClassId} on event ${eventOccurrenceId}:`, error.response ? error.response.data : error.message);
    const statusCode = error.response && error.response.status === 404 ? 404 : (error.response ? error.response.status : 500);
    const errorMessage = error.response && error.response.data && error.response.data.error_description
      ? error.response.data.error_description
      : 'Failed to update ticket class capacity.';
    res.status(statusCode).json({ error: errorMessage, details: error.response ? error.response.data : error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // For potential testing
