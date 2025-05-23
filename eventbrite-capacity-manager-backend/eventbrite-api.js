const axios = require('axios');

const EVENTBRITE_API_BASE_URL = 'https://www.eventbriteapi.com/v3';

/**
 * Fetches a single page of live events for the given organization.
 * @param {string} organizationId The Eventbrite organization ID.
 * @param {string} privateToken The Eventbrite private token.
 * @param {string|null} continuationToken Token for the next page of results.
 * @returns {Promise<object>} A promise that resolves to the API response.
 */
async function fetchEventPage(organizationId, privateToken, continuationToken = null) {
  const url = `${EVENTBRITE_API_BASE_URL}/organizations/${organizationId}/events/`;
  const params = {
    status: 'live', // Fetch only live events
    expand: 'ticket_availability,venue', // Include ticket availability and venue details
    page_size: 50, // Default is 50, max is 200
  };
  if (continuationToken) {
    params.continuation = continuationToken;
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${privateToken}`,
        'Content-Type': 'application/json',
      },
      params,
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching events page: ${error.response ? error.response.status : error.message}`, error.response ? error.response.data : '');
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Fetches all live events for the given organization, handling pagination.
 * @param {string} organizationId The Eventbrite organization ID.
 * @param {string} privateToken The Eventbrite private token.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of all live event objects.
 */
async function fetchAllLiveEvents(organizationId, privateToken) {
  let allEvents = [];
  let continuationToken = null;
  let hasMoreItems = true;

  console.log(`Fetching all live events for organization ID: ${organizationId}`);

  while (hasMoreItems) {
    try {
      const data = await fetchEventPage(organizationId, privateToken, continuationToken);
      if (data.events && data.events.length > 0) {
        allEvents = allEvents.concat(data.events);
      }
      if (data.pagination && data.pagination.has_more_items) {
        continuationToken = data.pagination.continuation;
        console.log(`Fetching next page with continuation: ${continuationToken}`);
      } else {
        hasMoreItems = false;
      }
    } catch (error) {
      console.error('Failed to fetch all live events:', error);
      hasMoreItems = false; // Stop pagination on error
      throw error; // Re-throw to be handled by the route handler
    }
  }
  console.log(`Total live events fetched: ${allEvents.length}`);
  return allEvents;
}

/**
 * Fetches ticket classes for a specific event ID.
 * This event ID can be for a single event, a series, or a specific occurrence.
 * The `ticket_classes` endpoint provides details for each class.
 *
 * @param {string} eventId The Eventbrite event ID (series or occurrence).
 * @param {string} privateToken The Eventbrite private token.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of ticket class objects.
 */
async function fetchTicketClassesForEvent(eventId, privateToken) {
  const url = `${EVENTBRITE_API_BASE_URL}/events/${eventId}/ticket_classes/`;
  console.log(`Fetching ticket classes for event ID: ${eventId}`);
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${privateToken}`,
        'Content-Type': 'application/json',
      },
    });
    // We need to extract relevant details: id, name, capacity, quantity_sold
    // The `ticket_classes` endpoint provides `total_capacity_per_event` and `quantity_sold`
    // The ticket_classes endpoint returns a paginated list of ticket_class objects.
    // We need to handle potential pagination here as well, though typically events have few ticket classes.
    // For simplicity, assuming it returns all in one go or that default pagination is sufficient for now.
    // If not, this would need a similar pagination loop as fetchAllLiveEvents.
    // The response.data is an object like { pagination: {...}, ticket_classes: [...] }
    return response.data.ticket_classes.map(tc => {
      // Ensure we are picking the correct capacity.
      // `capacity` on ticket class is the total capacity for that class.
      // `capacity_remaining` is also available.
      return {
        id: tc.id,
        name: tc.display_name || tc.name, // display_name is often more user-friendly
        capacity: tc.capacity, // Total capacity for this ticket class
        quantity_sold: tc.quantity_sold,
        // `event.ticket_availability` from the event details (if expanded) gives overall event capacity
        // and sales, which might be different from sum of ticket class capacities/sales
        // if there are holds or other configurations.
      };
    });
  } catch (error) {
    console.error(`Error fetching ticket classes for event ${eventId}: ${error.response ? error.response.status : error.message}`, error.response ? error.response.data : '');
    // If an event has no ticket classes or access is restricted, this might fail.
    // Return empty array to allow processing of other events.
    // Consider if specific error codes (e.g., 404) should be handled differently.
    return [];
  }
}

/**
 * Fetches all occurrences for a given event series ID.
 * @param {string} seriesId The Eventbrite event series ID.
 * @param {string} privateToken The Eventbrite private token.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of occurrence objects.
 */
async function fetchEventOccurrences(seriesId, privateToken) {
  const url = `${EVENTBRITE_API_BASE_URL}/series/${seriesId}/occurrences/`;
  console.log(`Fetching occurrences for event series ID: ${seriesId}`);
  try {
    // This endpoint also supports pagination, but typically series have a manageable number of occurrences.
    // Assuming one page is enough for now for simplicity.
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${privateToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        status: 'live', // Only interested in live occurrences
      }
    });
    return response.data.occurrences || [];
  } catch (error) {
    console.error(`Error fetching occurrences for series ${seriesId}: ${error.response ? error.response.status : error.message}`, error.response ? error.response.data : '');
    return []; // Return empty on error to not break the entire event list
  }
}


/**
 * Updates the capacity of a specific ticket class for a given event occurrence.
 * @param {string} eventOccurrenceId The ID of the specific event occurrence.
 * @param {string} ticketClassId The ID of the ticket class to update.
 * @param {number} newCapacity The new capacity to set.
 * @param {string} privateToken The Eventbrite private token.
 * @returns {Promise<object>} A promise that resolves to the API response.
 */
async function updateTicketClassCapacity(eventOccurrenceId, ticketClassId, newCapacity, privateToken) {
  const url = `${EVENTBRITE_API_BASE_URL}/events/${eventOccurrenceId}/ticket_classes/${ticketClassId}/`;
  console.log(`Updating capacity for ticket class ${ticketClassId} on event ${eventOccurrenceId} to ${newCapacity}`);

  const payload = {
    ticket_class: {
      capacity: newCapacity,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${privateToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`Successfully updated capacity for ticket class ${ticketClassId} on event ${eventOccurrenceId}.`);
    return response.data;
  } catch (error) {
    console.error(`Error updating capacity for ticket class ${ticketClassId} on event ${eventOccurrenceId}:`, error.response ? error.response.data : error.message);
    throw error; // Re-throw to be handled by the route handler
  }
}

module.exports = {
  fetchAllLiveEvents,
  fetchTicketClassesForEvent,
  fetchEventOccurrences,
  updateTicketClassCapacity,
};
