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

const { fetchAllLiveEvents, fetchTicketClassesForEvent, fetchEventOccurrences, updateTicketClassCapacity, fetchPaginatedGroupedLiveEvents } = require('./eventbrite-api');

// Routes
// GET /api/events
app.get('/api/events', async (req, res) => {
  const privateToken = process.env.PRIVATE_TOKEN;
  const organizationId = process.env.ORGANIZATION_ID;
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 10;

  if (!privateToken || !organizationId) {
    return res.status(500).json({ error: 'Server configuration error: Missing Eventbrite credentials.' });
  }

  try {
    const result = await fetchPaginatedGroupedLiveEvents(organizationId, privateToken, page, pageSize);
    res.json(result);
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
