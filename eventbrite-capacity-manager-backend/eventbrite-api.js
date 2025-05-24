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

  console.log(`[fetchEventPage] Fetching events page for org ${organizationId} (continuation: ${continuationToken || 'none'})`);

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${privateToken}`,
        'Content-Type': 'application/json',
      },
      params,
    });
    console.log(`[fetchEventPage] Fetched ${response.data.events ? response.data.events.length : 0} events.`);
    return response.data;
  } catch (error) {
    console.error(`[fetchEventPage] Error: ${error.response ? error.response.status : error.message}`, error.response ? error.response.data : '');
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Fetches all live events for the given organization, handling pagination and grouping by event name (series).
 * Returns a paginated, grouped, and filtered list of live events, with only the necessary fields.
 * @param {string} organizationId The Eventbrite organization ID.
 * @param {string} privateToken The Eventbrite private token.
 * @param {number} page The page number to fetch (1-based).
 * @param {number} pageSize The number of series per page.
 * @returns {Promise<object>} A promise that resolves to an object with grouped events and pagination info.
 */
async function fetchPaginatedGroupedLiveEvents(organizationId, privateToken, page = 1, pageSize = 10) {
  console.log(`[fetchPaginatedGroupedLiveEvents] Called for org ${organizationId}, page ${page}, pageSize ${pageSize}`);
  // Step 1: Fetch all live events (with pagination from Eventbrite API)
  let allEvents = [];
  let continuation = null;
  let hasMoreItems = true;
  let pageNumber = 0;
  let totalObjectCount = 0;

  while (hasMoreItems) {
    pageNumber++;
    console.log(`[fetchPaginatedGroupedLiveEvents] Fetching page ${pageNumber} from Eventbrite API...`);
    const data = await fetchEventPage(organizationId, privateToken, continuation);
    if (data.events && data.events.length > 0) {
      allEvents = allEvents.concat(data.events);
      console.log(`[fetchPaginatedGroupedLiveEvents] Accumulated events: ${allEvents.length}`);
    }
    if (pageNumber === 1) {
      totalObjectCount = data.pagination.object_count;
      console.log(`[fetchPaginatedGroupedLiveEvents] Total object count from API: ${totalObjectCount}`);
    }
    if (data.pagination && data.pagination.has_more_items) {
      continuation = data.pagination.continuation;
      console.log(`[fetchPaginatedGroupedLiveEvents] More items to fetch, continuation: ${continuation}`);
    } else {
      hasMoreItems = false;
      console.log(`[fetchPaginatedGroupedLiveEvents] No more items to fetch.`);
    }
  }

  // Step 2: Group events by name (series)
  const groupedEvents = {};
  allEvents.forEach(event => {
    const eventName = event.name && event.name.text ? event.name.text : 'Unnamed Event';
    if (!groupedEvents[eventName]) {
      groupedEvents[eventName] = [];
    }
    groupedEvents[eventName].push(event);
  });
  console.log(`[fetchPaginatedGroupedLiveEvents] Grouped into ${Object.keys(groupedEvents).length} series.`);

  // Step 3: Convert groupedEvents to an array of series objects, each with sorted occurrences
  const seriesList = Object.entries(groupedEvents).map(([seriesName, occurrences]) => {
    // Sort occurrences chronologically by start.utc
    occurrences.sort((a, b) => new Date(a.start.utc) - new Date(b.start.utc));
    // Attempt to find a common series_id or use the first event's ID as a fallback
    let seriesIdToDisplay = occurrences[0].series_id || (occurrences[0].series_parent ? occurrences[0].series_parent.id : null);
    if (!seriesIdToDisplay) {
      seriesIdToDisplay = occurrences[0].id;
    }
    return {
      series_id: seriesIdToDisplay,
      name: seriesName,
      occurrences: occurrences.map(occ => ({
        id: occ.id,
        name: occ.name && occ.name.text ? occ.name.text : 'Unnamed Occurrence',
        start_time: occ.start.utc,
        end_time: occ.end.utc,
        status: occ.status,
        url: occ.url,
        ticket_availability: occ.ticket_availability,
        category: occ.category,
        subcategory: occ.subcategory,
        venue: occ.venue,
      })),
    };
  });
  console.log(`[fetchPaginatedGroupedLiveEvents] Created seriesList with ${seriesList.length} series.`);

  // Step 4: Paginate the seriesList
  const totalSeries = seriesList.length;
  const totalPages = Math.ceil(totalSeries / pageSize);
  const paginatedSeries = seriesList.slice((page - 1) * pageSize, page * pageSize);
  console.log(`[fetchPaginatedGroupedLiveEvents] Returning page ${page} with ${paginatedSeries.length} series (totalPages: ${totalPages}).`);

  return {
    series: paginatedSeries,
    pagination: {
      page,
      pageSize,
      totalSeries,
      totalPages,
    },
  };
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
  console.log(`[fetchTicketClassesForEvent] Fetching ticket classes for event ID: ${eventId}`);
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${privateToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`[fetchTicketClassesForEvent] Fetched ${response.data.ticket_classes ? response.data.ticket_classes.length : 0} ticket classes.`);
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
    console.error(`[fetchTicketClassesForEvent] Error for event ${eventId}: ${error.response ? error.response.status : error.message}`, error.response ? error.response.data : '');
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
  console.log(`[fetchEventOccurrences] Fetching occurrences for event series ID: ${seriesId}`);
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
    console.log(`[fetchEventOccurrences] Fetched ${response.data.occurrences ? response.data.occurrences.length : 0} occurrences.`);
    return response.data.occurrences || [];
  } catch (error) {
    console.error(`[fetchEventOccurrences] Error for series ${seriesId}: ${error.response ? error.response.status : error.message}`, error.response ? error.response.data : '');
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
  console.log(`[updateTicketClassCapacity] Updating capacity for ticket class ${ticketClassId} on event ${eventOccurrenceId} to ${newCapacity}`);

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
    console.log(`[updateTicketClassCapacity] Successfully updated capacity for ticket class ${ticketClassId} on event ${eventOccurrenceId}.`);
    return response.data;
  } catch (error) {
    console.error(`[updateTicketClassCapacity] Error updating capacity for ticket class ${ticketClassId} on event ${eventOccurrenceId}:`, error.response ? error.response.data : error.message);
    throw error; // Re-throw to be handled by the route handler
  }
}

module.exports = {
  fetchPaginatedGroupedLiveEvents,
  fetchTicketClassesForEvent,
  fetchEventOccurrences,
  updateTicketClassCapacity,
};
