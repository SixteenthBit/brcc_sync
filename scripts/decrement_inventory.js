/*
  High-level: Decrements capacity of a specific Eventbrite ticket class by fetching current capacity and updating it via API.
*/

// decrement_inventory.js
const axios = require('axios');
require('dotenv').config();

const EVENT_ID = '1219650199579'; // Event Occurrence ID
const TARGET_TICKET_CLASS_ID = '2183507083'; // Specific Ticket Class ID to decrement
const PRIVATE_TOKEN = process.env.private_token;

/**
 * Fetches details for a specific ticket class.
 * @param {string} eventId - The ID of the event.
 * @param {string} ticketClassIdToFind - The ID of the ticket class to find.
 * @returns {Promise<object>} The ticket class object.
 * @throws {Error} If the ticket class is not found or API request fails.
 */
async function getTicketClassDetails(eventId, ticketClassIdToFind) {
  if (!PRIVATE_TOKEN) {
    throw new Error('Eventbrite private_token not found in .env file.');
  }
  try {
    const url = `https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`;
    const headers = {
      'Authorization': `Bearer ${PRIVATE_TOKEN}`,
    };
    console.log(`Fetching ticket classes for Event ID: ${eventId}...`);
    const response = await axios.get(url, { headers });

    if (response.data.error) {
      throw new Error(`Eventbrite API error while fetching ticket classes: ${response.data.error.error_description}`);
    }

    const ticketClasses = response.data.ticket_classes || [];
    const targetTicketClass = ticketClasses.find(tc => tc.id === ticketClassIdToFind);

    if (!targetTicketClass) {
      throw new Error(`Ticket Class ID ${ticketClassIdToFind} not found for Event ID ${eventId}.`);
    }
    console.log(`Found Ticket Class: ${targetTicketClass.name} (ID: ${targetTicketClass.id})`);
    return targetTicketClass;
  } catch (error) {
    const errorMessage = error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message;
    throw new Error(`Failed to get ticket class details: ${errorMessage}`);
  }
}

/**
 * Updates the capacity of a specific ticket class.
 * @param {string} eventId - The ID of the event.
 * @param {string} ticketClassId - The ID of the ticket class to update.
 * @param {number} newCapacity - The new capacity to set.
 * @returns {Promise<object>} The API response data.
 * @throws {Error} If the API request fails.
 */
async function updateTicketClassCapacity(eventId, ticketClassId, newCapacity) {
  if (!PRIVATE_TOKEN) {
    throw new Error('Eventbrite private_token not found in .env file.');
  }
  try {
    const url = `https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/${ticketClassId}/`;
    const headers = {
      'Authorization': `Bearer ${PRIVATE_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      ticket_class: { // API expects the ticket class data nested under 'ticket_class'
        capacity: newCapacity,
      },
    };
    console.log(`Attempting to update capacity for Ticket Class ID ${ticketClassId} to ${newCapacity}...`);
    const response = await axios.post(url, payload, { headers });
    
    if (response.data.error) {
        throw new Error(`Eventbrite API error while updating capacity: ${response.data.error.error_description}`);
    }
    return response.data;
  } catch (error) {
    const errorDetail = error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message;
    throw new Error(`Failed to update ticket class capacity: ${errorDetail}`);
  }
}

async function main() {
  console.log(`Starting inventory decrement process for Event ID: ${EVENT_ID}, Ticket Class ID: ${TARGET_TICKET_CLASS_ID}`);
  try {
    const ticketClass = await getTicketClassDetails(EVENT_ID, TARGET_TICKET_CLASS_ID);
    const currentCapacity = ticketClass.capacity;

    console.log(`Current capacity for Ticket Class ID ${TARGET_TICKET_CLASS_ID} ('${ticketClass.name}') is: ${currentCapacity}`);

    if (currentCapacity === undefined || currentCapacity === null) {
      throw new Error(`Could not determine current capacity for Ticket Class ID ${TARGET_TICKET_CLASS_ID}. Capacity is undefined or null.`);
    }

    if (typeof currentCapacity !== 'number') {
        throw new Error(`Current capacity for Ticket Class ID ${TARGET_TICKET_CLASS_ID} is not a number: ${currentCapacity}. Cannot decrement.`);
    }
    
    if (currentCapacity <= 0) {
      console.log(`Ticket Class ID ${TARGET_TICKET_CLASS_ID} already has 0 or less capacity (${currentCapacity}). No decrement needed.`);
      return;
    }

    const newCapacity = currentCapacity - 1;
    console.log(`Calculated new capacity: ${newCapacity}`);

    const result = await updateTicketClassCapacity(EVENT_ID, TARGET_TICKET_CLASS_ID, newCapacity);
    console.log('Ticket class capacity successfully updated.');
    console.log('API Response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('-----------------------------------------------------');
    console.error('Failed to decrement ticket class capacity:');
    console.error(error.message);
    if (error.stack && process.env.NODE_ENV === 'development') { // Show stack in dev
        console.error('Stacktrace:', error.stack);
    }
    console.error('-----------------------------------------------------');
  }
}

main();
