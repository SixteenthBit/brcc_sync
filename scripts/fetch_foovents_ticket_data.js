/*
  High-level: Fetches a specific FooEvents ticket and WooCommerce order data by order ID and ticket number,
  then writes a detailed markdown report including full order data and matched ticket line item metadata.
*/

require('dotenv').config();
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const fs = require('fs').promises;

const TICKET_NUMBER_TO_FIND = '14490912115';
const ORDER_ID = '14489';
const OUTPUT_FILE = 'ticket_data_reference.md';

const wooCommerce = new WooCommerceRestApi({
  url: 'https://' + process.env.BASE_URL,
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
  version: "wc/v3"
});

// Define relevant keys here for efficiency
const RELEVANT_TICKET_KEYS = [
  'WooCommerceEventsTicketID',
  '_fooevents_ticket_id',
  'ticket_id',
  '_ticket_number',
  'WooCommerceEventsTicketHash',
];

async function fetchTicketAndOrderData() {
  let outputContent = '# FooEvents Ticket & WooCommerce Order Data Reference\n\n';
  outputContent += '**Date Fetched:** ' + new Date().toISOString() + '\n\n';
  let ticketFound = false;

  try {
    console.log('Fetching order ' + ORDER_ID + '...');
    const response = await wooCommerce.get('orders/' + ORDER_ID);
    const order = response.data;

    outputContent += '## Full WooCommerce Order Data (JSON) - Order ID: ' + order.id + '\n';
    outputContent += '```json\n';
    outputContent += JSON.stringify(order, null, 2) + '\n';
    outputContent += '```\n\n';

    console.log('Searching for ticket ' + TICKET_NUMBER_TO_FIND + ' in order ' + ORDER_ID + '...');
    let foundItem = null;
    let matchedMetaKey = "N/A"; 

    for (const item of order.line_items) {
      if (item.meta_data && Array.isArray(item.meta_data)) {
        for (const meta of item.meta_data) {
          if (RELEVANT_TICKET_KEYS.includes(meta.key) && meta.value && meta.value.toString() === TICKET_NUMBER_TO_FIND) {
            ticketFound = true;
            foundItem = item;
            matchedMetaKey = meta.key; 
            console.log('Ticket ' + TICKET_NUMBER_TO_FIND + ' found (matched meta_data key: "' + matchedMetaKey + '", value: "' + meta.value + '") in Line Item ID: ' + item.id);
            break; 
          }
        }
      }
      if (ticketFound) break;
    }

    if (ticketFound && foundItem) {
      outputContent += '## Specific Ticket/Line Item Data (JSON) - Line Item ID: ' + foundItem.id + '\n';
      outputContent += '(Ticket ' + TICKET_NUMBER_TO_FIND + ' was found associated with this line item via meta_data key: "' + matchedMetaKey + '")\n\n';
      
      outputContent += '```json\n';
      outputContent += JSON.stringify(foundItem, null, 2) + '\n';
      outputContent += '```\n\n';

      outputContent += '### Specific Line Item MetaData (JSON) - Line Item ID: ' + foundItem.id + '\n';
      outputContent += '```json\n';
      outputContent += JSON.stringify(foundItem.meta_data, null, 2) + '\n';
      outputContent += '```\n\n';
    } else {
      const notFoundMsg = 'Ticket ' + TICKET_NUMBER_TO_FIND + ' not found within the meta_data of any line items in order ' + ORDER_ID + '.';
      console.log(notFoundMsg);
      outputContent += '## Specific Ticket/Line Item Data\n\n';
      outputContent += notFoundMsg + '\n\n';
    }

  } catch (error) {
    const errorMsg = 'Error fetching or processing data: ' + error.message;
    console.error(errorMsg, error.response ? error.response.data : '');
    outputContent += '## Error\n\n' + errorMsg + '\n';
    if (error.response && error.response.data) {
        outputContent += '\n**API Error Details:**\n';
        outputContent += '```json\n';
        outputContent += JSON.stringify(error.response.data, null, 2) + '\n';
        outputContent += '```\n';
    }
  }

  try {
    await fs.writeFile(OUTPUT_FILE, outputContent);
    console.log('Data successfully written to ' + OUTPUT_FILE);
  } catch (fileError) {
    console.error('Error writing to file ' + OUTPUT_FILE + ':', fileError.message);
  }
}

fetchTicketAndOrderData();
