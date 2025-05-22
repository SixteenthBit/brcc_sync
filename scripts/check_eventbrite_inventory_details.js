/**
 * This script checks an Eventbrite event's inventory details using the Eventbrite API,
 * including whether it uses tiered inventory and ticket class capacity, then logs a summary.
 */
require('dotenv').config();
const axios = require('axios');


const PRIVATE_TOKEN = process.env.private_token; // Changed to use 'private_token'
const EVENT_ID = '1219650199579';
const TICKET_CLASS_ID_TO_FIND = '2183507083';

async function checkEventDetails() {
    if (!PRIVATE_TOKEN) {
        console.error('Error: private_token not found in .env file. Please ensure it is set.'); // Updated error message
        console.log('\n--- Summary ---');
        console.log(`Uses Tiered Inventory: Error - Token Missing`);
        console.log(`Inventory Tier ID for Ticket Class ${TICKET_CLASS_ID_TO_FIND}: Error - Token Missing`);
        console.log(`Current Capacity for Ticket Class ${TICKET_CLASS_ID_TO_FIND}: Error - Token Missing`);
        return;
    }

    const headers = {
        'Authorization': `Bearer ${PRIVATE_TOKEN}`,
        'Content-Type': 'application/json',
    };

    let usesTieredInventory = false;
    let inventoryTierIdLog = 'Not Found'; // For final summary
    let currentCapacityLog = 'Not Found'; // For final summary

    try {
        // Step 1: Check for Tiered Inventory
        console.log(`Step 1: Checking for Tiered Inventory for Event ID: ${EVENT_ID}...`);
        const eventDetailsUrl = `https://www.eventbriteapi.com/v3/events/${EVENT_ID}/?expand=basic_inventory_info`;
        let eventResponse;
        try {
            eventResponse = await axios.get(eventDetailsUrl, { headers });
            if (eventResponse.data && eventResponse.data.basic_inventory_info) {
                usesTieredInventory = eventResponse.data.basic_inventory_info.has_inventory_tiers === true;
            }
            console.log(` -> Event ${EVENT_ID} uses tiered inventory: ${usesTieredInventory}`);
        } catch (eventError) {
            console.error(` -> Error fetching event details for Event ID ${EVENT_ID}:`);
            if (eventError.response) {
                console.error(`    Status: ${eventError.response.status}`);
                console.error(`    Data: ${JSON.stringify(eventError.response.data, null, 2)}`);
            } else {
                console.error(`    Error Message: ${eventError.message}`);
            }
            usesTieredInventory = false; // Assume false on error to prevent further issues
            inventoryTierIdLog = 'Error fetching event details';
            currentCapacityLog = 'Error fetching event details';
            // Early exit from try block to finally for summary
            throw new Error('Failed to fetch event details, aborting further checks.');
        }


        // Step 2: Get Ticket Class Details
        console.log(`\nStep 2: Fetching Ticket Class Details for Event ID: ${EVENT_ID}, looking for Ticket Class ID: ${TICKET_CLASS_ID_TO_FIND}...`);
        const ticketClassesUrl = `https://www.eventbriteapi.com/v3/events/${EVENT_ID}/ticket_classes/`;
        let ticketClassesResponse;
        try {
            ticketClassesResponse = await axios.get(ticketClassesUrl, { headers });
        } catch (tcError) {
            console.error(` -> Error fetching ticket classes for Event ID ${EVENT_ID}:`);
            if (tcError.response) {
                console.error(`    Status: ${tcError.response.status}`);
                console.error(`    Data: ${JSON.stringify(tcError.response.data, null, 2)}`);
            } else {
                console.error(`    Error Message: ${tcError.message}`);
            }
            inventoryTierIdLog = 'Error fetching ticket classes';
            currentCapacityLog = 'Error fetching ticket classes';
            // Early exit from try block to finally for summary
            throw new Error('Failed to fetch ticket classes, aborting further checks.');
        }


        if (ticketClassesResponse.data && ticketClassesResponse.data.ticket_classes) {
            const ticketClass = ticketClassesResponse.data.ticket_classes.find(tc => tc.id === TICKET_CLASS_ID_TO_FIND);

            if (ticketClass) {
                currentCapacityLog = ticketClass.capacity !== undefined ? ticketClass.capacity : 'Not specified';
                console.log(` -> Found Ticket Class ${TICKET_CLASS_ID_TO_FIND}.`);
                console.log(`    Current Capacity: ${currentCapacityLog}`);

                if (usesTieredInventory) {
                    if (ticketClass.inventory_tier_id) {
                        inventoryTierIdLog = ticketClass.inventory_tier_id;
                        console.log(`    Inventory Tier ID: ${inventoryTierIdLog}`);
                    } else {
                        inventoryTierIdLog = 'Not Found on ticket class object';
                        console.log(`    Inventory Tier ID: ${inventoryTierIdLog} (This might require checking /inventory_tiers/ or different expansions).`);
                    }
                } else {
                    inventoryTierIdLog = 'N/A (Event does not use tiered inventory)';
                    console.log(`    Inventory Tier ID: ${inventoryTierIdLog}`);
                }
            } else {
                console.log(` -> Ticket Class ID ${TICKET_CLASS_ID_TO_FIND} not found in the list of ticket classes.`);
                currentCapacityLog = `Ticket Class ${TICKET_CLASS_ID_TO_FIND} not found.`;
                inventoryTierIdLog = `Ticket Class ${TICKET_CLASS_ID_TO_FIND} not found.`;
            }
        } else {
            console.log(' -> No ticket classes found or error in ticket class data structure.');
            currentCapacityLog = 'No ticket class data returned.';
            inventoryTierIdLog = 'No ticket class data returned.';
        }

    } catch (error) {
        // This catch block now primarily handles errors thrown explicitly above
        // or unexpected errors not caught by specific try-catch blocks.
        console.error('\nAn error occurred during the process:', error.message);
        // Ensure logs are updated if not already set by specific error handlers
        if (inventoryTierIdLog === 'Not Found') inventoryTierIdLog = 'Processing error';
        if (currentCapacityLog === 'Not Found') currentCapacityLog = 'Processing error';
    } finally {
        console.log('\n--- Summary ---');
        console.log(`Uses Tiered Inventory: ${usesTieredInventory}`);
        console.log(`Inventory Tier ID for Ticket Class ${TICKET_CLASS_ID_TO_FIND}: ${inventoryTierIdLog}`);
        console.log(`Current Capacity for Ticket Class ${TICKET_CLASS_ID_TO_FIND}: ${currentCapacityLog}`);
    }
}

checkEventDetails();
