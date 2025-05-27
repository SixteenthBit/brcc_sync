# FooEvents Internals: A Concise Summary

FooEvents for WooCommerce and FooEvents Bookings integrate deeply with WordPress and WooCommerce to manage events, tickets, and bookings. Here's a summary of their core mechanics:

1.  **Events as WooCommerce Products:**
    
	-   Events in FooEvents are fundamentally WooCommerce products (`product` post type).
	-   All event-specific configurations (like date, time, venue) and, for FooEvents Bookings, the definitions of available booking slots (dates, times, capacities), are stored as post metadata associated with that WooCommerce product post in the `wp_postmeta` table. &lt;sup>1&lt;/sup>
2.  Ticket Generation and Storage:
    
	When a ticket is sold (typically when a WooCommerce order is completed), FooEvents performs two main actions:
    
	-   **`event_magic_tickets` Custom Post Type (CPT):** An individual post of the type `event_magic_tickets` is created for each unique ticket. This CPT stores details specific to that ticket, such as its status (e.g., "Not Checked In", "Checked In"), attendee information, and if applicable, the selected booking slot and date. This data is stored as post metadata for each `event_magic_tickets` post. &lt;sup>5&lt;/sup>
	-   **WooCommerce Order Meta:** Critical ticket and attendee information is also stored within the metadata of the WooCommerce order (`shop_order` post type) itself, primarily under the meta key `WooCommerceEventsOrderTickets`. This usually contains a serialized PHP array with details for all tickets in that order. &lt;sup>8&lt;/sup>
3.  FooEvents Bookings Data:
    
	The FooEvents Bookings plugin allows for creating bookable events with specific time slots and dates.
    
	-   **Slot Configuration:** Available booking slots, their dates, times, and capacities are configured within the "Bookings Settings" tab on the WooCommerce product edit screen. This configuration is saved as post metadata associated with the event product, likely as a serialized array. &lt;sup>4&lt;/sup>
	-   **Linking to Tickets:** When a booking is made, the chosen slot and date are linked to the individual `event_magic_tickets` CPT entries generated for that purchase, stored in meta fields like `BookingSlot` and `BookingDate`. &lt;sup>6&lt;/sup>
4.  **Key WordPress Objects Utilized:**
    
	-   **`product` (WooCommerce Post Type):** Represents the Event. Stores event settings and booking slot definitions in its metadata. &lt;sup>3&lt;/sup>
	-   **`event_magic_tickets` (Custom Post Type):** Represents an individual Ticket. Stores ticket status, attendee details, and booking specifics in its metadata. &lt;sup>5&lt;/sup>
	-   **`shop_order` (WooCommerce Post Type):** Represents a customer's Purchase. Stores initial, comprehensive ticket and attendee data for the entire order in its metadata (key: `WooCommerceEventsOrderTickets`). &lt;sup>8&lt;/sup>
	-   **`wp_postmeta` (WordPress Table):** The primary storage location for all custom data (metadata) related to events, tickets, and orders. &lt;sup>8&lt;/sup>
5.  **Developer Interaction Points:**
    
	-   **Direct Database (WordPress APIs):** Use standard WordPress functions (`WP_Query`, `get_post_meta()`, `update_post_meta()`) and WooCommerce functions to interact with the data in `wp_posts` and `wp_postmeta`. &lt;sup>8&lt;/sup>
	-   **Internal REST API (`/wp-json/fooevents/v1`):** Used by FooEvents' own apps (e.g., Check-ins app). While not officially documented for third-party use, it might offer some data access, but should be used cautiously due to potential unannounced changes. &lt;sup>12&lt;/sup>
	-   **WordPress Hooks:** Leverage standard WordPress and WooCommerce action and filter hooks (e.g., `save_post_product`, `woocommerce_order_status_completed`) to interact with FooEvents processes, as FooEvents does not provide an official list of its own developer-specific hooks. &lt;sup>15&lt;/sup>

In essence, FooEvents cleverly extends WooCommerce's existing structure. Event definitions and booking configurations reside as metadata on WooCommerce products. Individual tickets become their own custom posts (`event_magic_tickets`) and are also detailed within the metadata of the WooCommerce order that generated them.

----------

# FooEvents Internals: A Technical Deep Dive for Application Integration

This report provides a detailed technical analysis of the FooEvents for WooCommerce and FooEvents Bookings plugins. It is intended to equip developers with the necessary understanding of their internal architecture, data storage mechanisms, and WordPress object utilization to facilitate the development of applications that interact with FooEvents-generated tickets, bookings, and events.

## I. Introduction and Core Architecture of FooEvents for WooCommerce

### A. Overview of FooEvents' Role and Integration with WooCommerce

FooEvents for WooCommerce extends the core functionality of WooCommerce, enabling it to manage and sell event tickets.&lt;sup>1&lt;/sup> Rather than operating as a standalone event management system, FooEvents is intricately designed to leverage the existing e-commerce infrastructure of WooCommerce. This integration allows users to sell tickets as standard WooCommerce products, benefiting from WooCommerce's robust features such as payment gateway diversity, order management, and extensive theme compatibility.&lt;sup>1&lt;/sup> The plugin's philosophy centers on providing users with complete control over their ticketing operations and customer data, bypassing intermediary platform fees.

This deep reliance on WooCommerce is a foundational aspect for developers to grasp. An understanding of WooCommerce's product and order architecture is paramount, as FooEvents largely conforms to and extends these structures. By building upon WooCommerce, FooEvents inherits not only its strengths, such as a secure and widely audited codebase and a vast ecosystem of extensions, but also its inherent data structures. Consequently, event-specific data is often managed as metadata associated with WooCommerce products. This architectural choice means that data retrieval and manipulation can often be accomplished using standard WordPress and WooCommerce functions like `get_post_meta()` or `WC_Order_Query()`. However, it also implies that queries for events based on specific FooEvents attributes might necessitate complex meta queries. The scalability of FooEvents for very large numbers of events or tickets is thus intertwined with WooCommerce's own performance characteristics when handling products with extensive metadata. Data primarily resides within WordPress's standard `wp_posts` table (for products, orders, and custom post types) and the `wp_postmeta` table (for their associated metadata).&lt;sup>4&lt;/sup>

### B. Event Creation Process: Events as WooCommerce Products

The creation of an event within FooEvents begins with the creation of a WooCommerce product.&lt;sup>6&lt;/sup> This product, which can be a "Simple" or "Variable" type (the latter allowing for different ticket tiers or prices), serves as the digital representation of the event. The standard WooCommerce product editing interface is augmented by FooEvents with additional tabs, such as "Event Settings" and "Ticket Settings".&lt;sup>6&lt;/sup> If the FooEvents Bookings plugin is active, a "Bookings Settings" tab also becomes available for configuring bookable events.&lt;sup>7&lt;/sup>

The various parameters that define an event—such as its date, time, location (physical or virtual), and ticket appearance—are configured through these specialized tabs. These configurations are subsequently saved as post metadata associated with the WooCommerce product post that represents the event. This methodology reinforces the concept that an "event" in the FooEvents ecosystem is, at its core, a specialized WooCommerce "product." This is significant because it centralizes event configuration within the product metadata, simplifying the user experience for event setup. For developers, this means that querying events based on FooEvents-specific attributes (e.g., finding all events scheduled for a particular venue or all bookable events offering morning sessions) will typically involve constructing `WP_Query` calls that target the `product` post type and include `meta_query` arguments to filter by the relevant metadata keys and values. This is a common pattern in WordPress development when dealing with custom data associated with posts.

## II. Ticket Generation, WordPress Objects, and Data Storage (FooEvents for WooCommerce)

### A. The `event_magic_tickets` Custom Post Type (CPT)

A cornerstone of FooEvents' ticketing mechanism is the `event_magic_tickets` custom post type (CPT).&lt;sup>8&lt;/sup> When a ticket is sold—an action typically triggered when a WooCommerce order containing an event product reaches a "completed" status &lt;sup>6&lt;/sup>—FooEvents generates an individual post within this CPT. Each such post uniquely represents a single ticket.

This CPT is pivotal for managing the lifecycle of individual tickets, including their status (e.g., "Not Checked In," "Checked In," "Canceled," "Unpaid") and for establishing explicit links between a ticket and its corresponding event (WooCommerce product), the originating WooCommerce order, and the attendee. The existence and importance of the `event_magic_tickets` CPT are evident in various technical discussions, such as support forum threads where performance issues related to queries involving this CPT are addressed.&lt;sup>8&lt;/sup> Furthermore, code examples from third-party export utilities and PDF ticket generation tools demonstrate direct querying and manipulation of `event_magic_tickets` posts, revealing many of the key meta fields associated with them.&lt;sup>9&lt;/sup> For instance, bulk actions are specifically added to the `edit-event_magic_tickets` administration screen, underscoring its role in ticket management.&lt;sup>10&lt;/sup>

The metadata associated with each `event_magic_tickets` post stores the specific attributes of that ticket. Understanding these meta keys is crucial for any application aiming to retrieve or modify ticket data.

**Key Meta Fields for `event_magic_tickets` CPT:**

Markdown

```
| Meta Key                          	| Data Type    	| Description                                                                                            	| References |
| :------------------------------------ | :--------------- | :--------------------------------------------------------------------------------------------------------- | :--------- |
| `WooCommerceEventsProductID`      	| integer      	| The ID of the WooCommerce product (the event) this ticket is for.                                      	| 9      	|
| `WooCommerceEventsVariationID`    	| integer      	| The ID of the WooCommerce product variation if the ticket is for a specific variation (0 if not applicable). | 9      	|
| `WooCommerceEventsOrderID`        	| integer      	| The ID of the WooCommerce order this ticket belongs to.                                                	| 9      	|
| `WooCommerceEventsTicketID`       	| string       	| A unique identifier generated by FooEvents for the ticket.                                             	| 9      	|
| `WooCommerceEventsStatus`         	| string       	| The current status of the ticket (e.g., "Not Checked In", "Checked In", "Canceled", "Unpaid").           	| 6      	|
| `WooCommerceEventsAttendeeName`     	| string       	| First name of the attendee.                                                                            	| 9      	|
| `WooCommerceEventsAttendeeLastName`   | string       	| Last name of the attendee.                                                                             	| 9      	|
| `WooCommerceEventsAttendeeEmail`  	| string       	| Email address of the attendee.                                                                         	| 9      	|
| `WooCommerceEventsCustomerID`     	| integer      	| WordPress User ID of the purchasing customer, if logged in.                                            	| 10     	|
| `WooCommerceEventsTicketType`     	| string       	| The type or name of the ticket, often derived from a product variation name.                           	| 9      	|
| `WooCommerceEventsPurchaserFirstName` | string       	| First name of the purchaser (if different from attendee or specifically captured).                     	| 9      	|
| `WooCommerceEventsPurchaserLastName`  | string       	| Last name of the purchaser.                                                                            	| 9      	|
| `WooCommerceEventsPurchaserEmail` 	| string       	| Email address of the purchaser.                                                                        	| 9      	|
| `WooCommerceEventsCustomAttendeeFields` | serialized array | Stores data collected via FooEvents Custom Attendee Fields add-on.                                     	| 4      	|
| `BookingSlot`                     	| string       	| (FooEvents Bookings) The name or identifier of the booked time slot.                                   	| 9      	|
| `BookingDate`                     	| string/timestamp | (FooEvents Bookings) The date of the booking.                                                          	| 9      	|

```

### B. Ticket Data within WooCommerce Order Meta

Beyond the dedicated `event_magic_tickets` CPT, critical information pertaining to tickets and attendees is also persisted within the metadata of the WooCommerce order itself. The principal meta key used for this purpose is `WooCommerceEventsOrderTickets`.&lt;sup>4&lt;/sup> The value associated with this key is typically a serialized PHP array. Upon unserialization, this array often reveals a nested structure that encapsulates the details for every ticket purchased within that specific order, including comprehensive attendee information and any data submitted through custom attendee fields.&lt;sup>4&lt;/sup>

User guides for FooEvents explicitly state that "All information1 needed for the ticket is stored in a custom field that is associated with the order. The stored data is formatted as a JSON string".&lt;sup>6&lt;/sup> It is further clarified that FooEvents proceeds to create individual ticket posts (the `event_magic_tickets` entries) when the order status is updated to 'Completed', utilizing this JSON string (serialized array) as the source data.&lt;sup>6&lt;/sup> This indicates that the order metadata serves as the primary repository from which the individual, more structured ticket posts are hydrated. Various community discussions and code examples corroborate this, providing insights into the structure of this serialized data and confirming its array nature, which includes ticket details such as `WooCommerceEventsProductID`, attendee names, email addresses, and the `WooCommerceEventsCustomAttendeeFields` array.&lt;sup>4&lt;/sup>

Understanding the structure of the `WooCommerceEventsOrderTickets` metadata is vital for developers who need to parse all ticket data associated with a single order, particularly for applications that might display or process multiple tickets stemming from one purchase. An illustrative, unserialized structure is as follows:

PHP

```
// Example structure after: $data = maybe_unserialize( get_post_meta( $order_id, 'WooCommerceEventsOrderTickets', true ) );
Array (
	[0] => Array ( // Index, may correspond to a line item or a group of tickets
    	[0] => Array ( // Index for an individual ticket within this group
        	[0] => (int) 454, // Event (Product) ID
        	[1] => (int) 0, // Variation ID, if applicable
        	[2] => (int) 4609, // Order ID
        	[3] => (string) "General Admission",
        	[4] => (string) "Unpaid", // Initial status in order meta
        	[WooCommerceEventsAttendeeName] => (string) "Jane",
        	[WooCommerceEventsAttendeeLastName] => (string) "Doe",
        	[WooCommerceEventsAttendeeEmail] => (string) "jane.doe@example.com",
        	[WooCommerceEventsPurchaserFirstName] => (string) "John",
        	[WooCommerceEventsPurchaserLastName] => (string) "Doe",
        	[WooCommerceEventsPurchaserEmail] => (string) "john.doe@example.com",
        	[WooCommerceEventsCustomAttendeeFields] => Array (
            	[dietary_requirements] => (string) "Vegetarian",
            	[t_shirt_size] => (string) "L"
        	)
        	// BookingSlot and BookingDate would appear here if applicable
    	),
    	[1] => Array ( // Data for a second ticket in the same order/group
        	//... similar structure...
    	)
	)
	// Potentially other top-level arrays for different event products in the same order
)

```

&lt;sup>4&lt;/sup>

The presence of ticket data in both the `WooCommerceEventsOrderTickets` order meta and as individual `event_magic_tickets` CPT entries indicates a two-stage data handling process. The order meta likely serves as the initial data capture point during checkout. The `event_magic_tickets` CPT entries then become the canonical, individually manageable representations of these tickets, especially for subsequent operations like status updates (e.g., check-ins). Developers must consider which data source is most authoritative for their specific use case. For querying existing, processed tickets, the CPT is generally more direct. However, for understanding the complete set of ticket information as it was at the time of purchase, before any individual ticket modifications, the order meta might be more relevant. Maintaining synchronization between these two data stores could be a consideration if direct database manipulations occur outside the plugin's standard operational flow.

### C. Attendee Information Storage

Attendee-specific details, such as names, email addresses, and responses to custom attendee fields, are primarily captured and stored within the `WooCommerceEventsOrderTickets` serialized array located in the WooCommerce order's metadata.&lt;sup>4&lt;/sup> Subsequently, during the ticket generation process (typically upon order completion), these details are propagated to the corresponding metadata fields of the individual `event_magic_tickets` CPT posts. For example, an attendee's first name from the order meta would populate the `WooCommerceEventsAttendeeName` meta field of their specific ticket post.&lt;sup>9&lt;/sup> The nested nature of this data, particularly when custom attendee fields are involved, can make extraction and export complex, as highlighted by user experiences with tools like Zapier attempting to process FooEvents attendee information.&lt;sup>13&lt;/sup>

## III. FooEvents Bookings: Functionality and Data Management

### A. Extending Core FooEvents for Bookable Events

The FooEvents Bookings plugin significantly extends the capabilities of the core FooEvents for WooCommerce plugin by introducing functionality for creating events that are bookable by specific dates and/or time slots.&lt;sup>7&lt;/sup> This extension is designed for scenarios such as selling access to venues, classes, appointments, or any service where customers need to check availability for particular timeframes and reserve a specific slot.&lt;sup>7&lt;/sup> The FooEvents Calendar plugin, for instance, can integrate with FooEvents Bookings to display each bookable slot directly within a calendar interface.&lt;sup>15&lt;/sup>

### B. Booking Slot Configuration and Storage

The definition of booking slots—including their names (e.g., "Morning Session 09:00 - 12:00"), the dates on which they are available, specific start and end times, and the capacity or stock for each slot—is configured at the WooCommerce product level.&lt;sup>7&lt;/sup> This configuration occurs within the "Bookings Settings" tab added by the FooEvents Bookings plugin to the WooCommerce product data section.

All this detailed booking availability information is stored as metadata associated with that specific WooCommerce product's post ID in the `wp_postmeta` table. While the provided documentation does not exhaustively list the exact meta keys used, the user interface described for setting up these slots implies a structured and likely complex data storage method.&lt;sup>7&lt;/sup> It is highly probable that this information is stored as a serialized PHP array under one or more specific product meta keys. Common naming conventions might suggest keys like `_fooevents_bookings_options`, `_fooevents_booking_slots`, `_fooevents_booking_schedule`, or similar. The precise keys would need to be confirmed by inspecting the `wp_postmeta` table for a WooCommerce product that has been configured with FooEvents Bookings.

The structure for storing booking slots, their associated dates, times, and individual stock levels per slot/date combination is likely to be a multi-dimensional array. This is a common WordPress practice for storing complex, structured data associated with a post.&lt;sup>17&lt;/sup> For example, a single product can offer multiple distinct booking slots (e.g., "Morning," "Afternoon"), and each of these slots can be available on numerous dates, potentially with different stock levels or even price adjustments for each specific date and time. Therefore, the product meta value holding this configuration will almost certainly be a nested array. Accessing information such as "all available slots for Product X on Date Y" would necessitate fetching this metadata, unserializing it, and then programmatically navigating its structure.

Hypothetical Product Meta Keys for FooEvents Bookings Configuration:

(Note: These are illustrative. Actual keys require database inspection.)

Markdown

```
| Meta Key (Hypothetical)         	| Data Type    	| Description                                                                                            	| Inferred From |
| :---------------------------------- | :--------------- | :--------------------------------------------------------------------------------------------------------- | :------------ |
| `_fooevents_booking_settings`   	| Serialized Array | Primary key holding all booking slot definitions: names, times, and a nested array of dates with associated stock/capacity for each. | 7         	|
| `_fooevents_booking_config_order`   | String       	| Stores settings like "Bookings selection order" (e.g., 'Date > Slot' or 'Slot > Date').               	| 7         	|
| `_fooevents_booking_display_options`| Serialized Array | Stores settings related to where booking options are displayed (e.g., on the Product Page).              	| 7         	|

```

### C. Linking Booking Data to Tickets and Events

When a customer proceeds through the booking process for an event, they select a specific date and time slot from the available options configured for that event product. This selection is captured during the WooCommerce checkout process. Subsequently, the chosen booking information—the specific slot name, date, and time—is intrinsically linked to the individual ticket(s) generated for that purchase.

The `event_magic_tickets` CPT entries created for these booked tickets will have their booking-specific meta fields, such as `BookingSlot` and `BookingDate`, populated with the selected values.&lt;sup>9&lt;/sup> This ensures that each ticket clearly reflects the specific reservation it represents. It is also highly probable that this booking information forms part of the comprehensive `WooCommerceEventsOrderTickets` serialized data stored within the WooCommerce order's metadata, as these fields are mentioned in the context of exporting ticket data, which is typically derived from processed orders.&lt;sup>9&lt;/sup>

This establishes a clear data flow for bookings:

1.  **Definition:** The administrator defines available booking slots, dates, and capacities on the WooCommerce product. This configuration is saved as product metadata.
2.  **Selection:** The customer selects a desired slot and date during the purchase process.
3.  **Capture:** The selected booking details are captured and stored within the `WooCommerceEventsOrderTickets` array in the order's metadata.
4.  **Instantiation:** When individual `event_magic_tickets` CPTs are generated from the processed order, the selected booking slot and date are transferred to the respective meta fields of each ticket CPT post.

Therefore, to ascertain available booking slots for an event, an application would query the event product's metadata. To retrieve the specific booked slot for an issued ticket, the application would query the metadata of the corresponding `event_magic_tickets` post. To understand what was originally booked within an order, parsing the `WooCommerceEventsOrderTickets` order meta would be necessary.

## IV. Consolidated WordPress Objects Summary

### A. Key WordPress Objects Utilized

FooEvents and FooEvents Bookings primarily leverage and extend standard WordPress and WooCommerce objects to deliver their functionality. Understanding this mapping is crucial for developers.

-   **WooCommerce Product (`product` post type):** This is the foundational object for an Event. All event-level configurations for FooEvents core (like event date, time, location) and booking slot definitions for FooEvents Bookings are stored as post metadata associated with this product post.&lt;sup>1&lt;/sup>
-   **FooEvents Ticket (`event_magic_tickets` custom post type):** This CPT represents each individual ticket sold. It stores ticket-specific details, its current status (e.g., checked-in), attendee information, and, if applicable, the selected booking slot and date as its post metadata.&lt;sup>8&lt;/sup>
-   **WooCommerce Order (`shop_order` post type):** This object represents a customer's purchase transaction. It holds vital FooEvents data within its post metadata, most notably under the `WooCommerceEventsOrderTickets` key. This key stores a serialized array containing all ticket, attendee, and initial booking information related to that order.&lt;sup>4&lt;/sup>
-   **Post Metadata (`wp_postmeta` table):** This standard WordPress table is the repository for all custom fields associated with Products (event settings, booking configurations), `event_magic_tickets` posts (individual ticket details), and Orders (raw ticket/attendee data for the purchase).&lt;sup>4&lt;/sup>
-   **WordPress Page/Post (Standard `page`/`post` types):** While the FooEvents Calendar plugin allows standard pages or posts to be designated as events by adding event date/time metadata to them, the core functionality of selling tickets and managing bookings is intrinsically tied to WooCommerce products.

**Summary of FooEvents Concepts Mapped to WordPress Objects:**

Markdown

```
| FooEvents Concept    	| WordPress Object Type(s)                             	| Key Metadata Storage                                                                                 	| Primary Role                                                                                                          	|
| :----------------------- | :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Event** | `product` (WooCommerce)                              	| Product Post Meta (e.g., event date, time, location, booking slot definitions)                         	| Defines the event, its properties, and (for bookings) the available slots, dates, and capacities.                   	|
| **Ticket (Individual)** | `event_magic_tickets` (Custom Post Type)             	| `event_magic_tickets` Post Meta (e.g., status, attendee info, booking slot/date, event ID)             	| Represents a unique, issued ticket with its current status, assigned attendee, and specific booking details.        	|
| **Booking (Instance)** | Embedded within Ticket (`event_magic_tickets`) & Order Meta | `BookingSlot`, `BookingDate` on ticket CPT; details within `WooCommerceEventsOrderTickets` order meta      	| Represents a specific slot and date reservation made by a customer for a bookable event, linked to one or more individual tickets. |
| **Ticket Purchase (Order)**| `shop_order` (WooCommerce)                           	| Order Post Meta (primarily `WooCommerceEventsOrderTickets` serialized array)                           	| Records the customer's transaction and contains the initial, comprehensive data for all tickets and attendees included in that purchase. |
| **Attendee** | Data within Order Meta & `event_magic_tickets` Post Meta   | Attendee fields within `WooCommerceEventsOrderTickets` & `event_magic_tickets` meta                    	| Stores information (name, email, custom fields) about the person designated to use the ticket or attend the event.    	|

```

### B. Data Flow Diagram (Conceptual)

The generation and management of event and ticket data follow a logical progression:

1.  **Event & Booking Setup:** An administrator creates an Event by setting up a WooCommerce Product. Event-specific details (e.g., date, venue) are saved as product metadata. If the event is bookable (using FooEvents Bookings), the administrator defines available slots, dates, and capacities, which are also stored as product metadata.
2.  **Customer Interaction:** A customer views the event product page. If it's a bookable event, they select an available date and time slot.
3.  **Purchase:** The customer adds the event (and chosen slot, if applicable) to their cart and completes the purchase. This action creates a WooCommerce Order (`shop_order` post type).
4.  **Initial Data Capture:** Crucial ticket, attendee, and booking information related to this purchase is immediately stored as a serialized array in the order's post metadata, under the key `WooCommerceEventsOrderTickets`.
5.  **Ticket Instantiation:** When the WooCommerce order status changes to a designated state (typically 'Completed', but configurable &lt;sup>6&lt;/sup>), FooEvents processes the data from the `WooCommerceEventsOrderTickets` order meta. For each ticket purchased, it creates or updates an individual post in the `event_magic_tickets` custom post type. The metadata for these ticket CPTs is populated with the specific details for each ticket, including attendee information and selected booking slot/date.

The transition from order-level data to individual `event_magic_tickets` CPT entries is a critical stage in the FooEvents lifecycle. This process is likely triggered by standard WooCommerce action hooks, such as `woocommerce_order_status_completed`.&lt;sup>20&lt;/sup> An application needing to interact with ticket data might need to consider whether to act before these individual ticket posts are finalized (by interacting with order data) or after (by interacting with the `event_magic_tickets` CPTs).

## V. Developer Interaction Points and Data Access

### A. Direct Database Interaction (Standard WordPress APIs)

The primary method for an external application to interact with FooEvents data is through direct interaction with the WordPress database, utilizing standard WordPress functions and APIs. The core tables involved are `wp_posts` (which stores products, orders, and `event_magic_tickets` posts) and `wp_postmeta` (which stores all associated metadata).&lt;sup>4&lt;/sup>

Developers can:

-   Use `WP_Query` to fetch collections of `product` posts (representing events) or `event_magic_tickets` posts (representing individual tickets), applying `meta_query` arguments to filter by specific FooEvents attributes.
-   Employ `get_post_meta()`, `update_post_meta()`, and `add_post_meta()` functions to read, modify, or add metadata for events (products), tickets (`event_magic_tickets`), and orders (`shop_order`).
-   Utilize WooCommerce-specific functions like `WC_Order_Query` or `wc_get_order()` to retrieve WooCommerce orders, and then access their metadata, particularly the `WooCommerceEventsOrderTickets` key.
-   Be prepared to handle serialized data. Information stored in `WooCommerceEventsOrderTickets` (order meta) and potentially some product metadata fields (especially for FooEvents Bookings configurations) will likely be serialized PHP arrays. The `maybe_unserialize()` WordPress function is recommended for safely unserializing this data.&lt;sup>4&lt;/sup>

Examples from community discussions and third-party plugin code demonstrate this direct data access pattern, such as querying WooCommerce orders and then retrieving and parsing the `WooCommerceEventsOrderTickets` meta key to extract attendee and ticket details.&lt;sup>4&lt;/sup>

### B. FooEvents Internal REST API (`/wp-json/fooevents/v1`)

FooEvents incorporates an internal REST API, accessible at the endpoint `www.YOURWEBSITE.com/wp-json/fooevents/v1` (assuming default permalink structures). This API is primarily utilized by FooEvents' own applications, such as the FooEvents Check-ins app, for communication with the WordPress backend.&lt;sup>21&lt;/sup> Its functionalities include scanning ticket barcodes, retrieving event information, and updating ticket check-in statuses.&lt;sup>21&lt;/sup> A successful connection to this base endpoint typically returns a JSON response detailing the API namespace and available routes, starting with `{"namespace":"fooevents\/v1","routes":...}`.&lt;sup>22&lt;/sup>

While FooEvents has stated that there is no officially supported public API for third-party developers &lt;sup>23&lt;/sup>, the existence and operational use of the `/wp-json/fooevents/v1` endpoint by their proprietary applications indicate that defined routes for fetching event and ticket data, and possibly for updating ticket statuses, are present. This internal API could offer a more abstracted method for interacting with FooEvents data compared to direct database queries, potentially simplifying some operations.

However, the specific routes, required authentication methods (likely standard WordPress REST API authentication mechanisms), request parameters, and precise response structures for the `/wp-json/fooevents/v1` endpoints are not detailed in the available documentation.&lt;sup>24&lt;/sup> Developers wishing to leverage this internal API would need to undertake further investigation. This could involve:

-   Accessing `www.YOURWEBSITE.com/wp-json/fooevents/v1` directly in a browser or API client to inspect the list of available routes.
-   Utilizing tools like Postman to explore these routes with appropriate authentication.
-   Monitoring the network traffic generated by the official FooEvents Check-ins app to observe the API calls it makes, including endpoints, parameters, and data formats.

It is crucial to approach the use of this internal API with caution. Since it is undocumented and intended for internal use, its endpoints and data structures could change without notice in future FooEvents updates, potentially breaking any third-party application relying on it. Nevertheless, for read operations or simple status updates, it might present a cleaner alternative to complex direct database queries if its structure can be reliably determined.

### C. WordPress Hooks (Actions and Filters)

As a WordPress plugin, FooEvents inevitably utilizes and interacts with a variety of standard WordPress and WooCommerce hooks (actions and filters). For instance, there is evidence that FooEvents hooks into `woocommerce_order_status_completed` to trigger its `process_order_tickets` function, which is responsible for generating or finalizing individual tickets when an order is marked as complete.&lt;sup>20&lt;/sup>

Although FooEvents does not provide an official, publicly documented list of its own developer-specific hooks for extension purposes &lt;sup>23&lt;/sup>, developers can still leverage the rich ecosystem of standard WordPress and WooCommerce hooks to interact with data and processes surrounding FooEvents operations. Examples include:

-   `save_post_product`: To execute custom actions when an event (which is a WooCommerce product) is saved or updated.
-   `woocommerce_new_order` or `woocommerce_checkout_order_processed`: To act when a new order containing event tickets is created.
-   `save_post_event_magic_tickets`: To perform actions after an individual FooEvents ticket post is created or updated.

If an application needs to modify FooEvents data, doing so by hooking into standard WordPress actions (e.g., `save_post_event_magic_tickets`) after FooEvents has performed its primary operations, or by filtering data that FooEvents itself might use (if such filter hooks are discovered through code inspection), is generally a safer approach than direct database manipulation. This allows FooEvents' own data validation and processing logic to execute. The primary challenge remains the lack of FooEvents-specific documented filters that would allow modification of data before FooEvents saves it. Developers may need to rely on hooks that fire subsequent to FooEvents' main data processing tasks.

## VI. Conclusion and Recommendations for App Development

FooEvents for WooCommerce and its Bookings add-on are deeply integrated with the WooCommerce framework, utilizing WooCommerce products to represent events and storing most of their custom data as WordPress post metadata. Individual tickets are managed via the `event_magic_tickets` custom post type, with critical initial ticket and attendee data also being stored in a serialized format within WooCommerce order metadata. Booking configurations are similarly stored as metadata associated with the event product.

For developers aiming to build applications that interact with FooEvents, the following recommendations are key:

1.  **Prioritize Standard WordPress/WooCommerce APIs:** The most stable and supported method for data interaction will be through standard WordPress functions (`WP_Query`, `get_post_meta()`, `update_post_meta()`, etc.) and WooCommerce functions/classes (`wc_get_order()`, `WC_Order_Query`). This approach targets the `wp_posts` and `wp_postmeta` tables.
2.  **Thoroughly Investigate Serialized Data Structures:**
	-   The structure of the `WooCommerceEventsOrderTickets` order meta field is crucial for accessing comprehensive ticket and attendee data from a purchase. Direct inspection of this data from a live site is essential to understand its precise array structure.
	-   Similarly, for FooEvents Bookings, the product meta key(s) storing booking slot definitions, dates, and capacities (e.g., a hypothetical `_fooevents_booking_schedule`) will contain complex serialized arrays. These must be carefully examined to enable programmatic access or modification of booking availability.
3.  **Cautiously Evaluate the Internal REST API:** The `/wp-json/fooevents/v1` API endpoint, while undocumented for third-party use, is operational for FooEvents' own apps. It may offer endpoints for reading event/ticket data or updating statuses. Developers should:
	-   Inspect the API's routes by accessing the base URL.
	-   Consider reverse-engineering specific calls by observing the FooEvents Check-ins app's network traffic.
	-   Acknowledge the inherent risks: internal APIs can change without notice, potentially breaking integrations. This approach is best suited for read operations or non-critical updates where the risk is acceptable.
4.  **Focus on `event_magic_tickets` CPT for Individual Ticket Management:** Once WooCommerce orders are processed and FooEvents has generated individual tickets, the `event_magic_tickets` CPT becomes the primary object for managing individual ticket statuses, check-ins, and specific attendee details linked to a unique ticket.
5.  **Anticipate Data Unserialization:** Be prepared to handle data that is stored in a serialized PHP array format, particularly from order metadata and product metadata related to bookings. Use `maybe_unserialize()` for safe and reliable data conversion.
6.  **Leverage WordPress Hooks Strategically:** While FooEvents lacks a public hook API, utilize standard WordPress and WooCommerce action and filter hooks to interact with data at appropriate stages of the event, order, and ticket lifecycle. For example, use `save_post_{post_type}` to react to data changes or `woocommerce_order_status_changed` hooks to trigger processes.

By understanding these internal mechanics and data storage patterns, developers can build robust and effective applications that successfully integrate with the FooEvents ecosystem. Direct data inspection and testing on a development environment with FooEvents installed will be invaluable to confirm the specific meta keys and data structures encountered.

----------

## Works Cited

1.  FooEvents for WooCommerce PREMIUM BUNDLE + All Addons - Celina - Pa... - Hotmart, accessed May 10, 2025, [https://hotmart.com/en/marketplace/products/hagsxd-fooevents-for-woocommerce-premium-bundle-all-addons-ylswf/K94853206L](https://hotmart.com/en/marketplace/products/hagsxd-fooevents-for-woocommerce-premium-bundle-all-addons-ylswf/K94853206L)
2.  Events Calendar by FooEvents – WordPress plugin | WordPress.org ..., accessed May 10, 2025, [https://sa.wordpress.org/plugins/fooevents-calendar/](https://sa.wordpress.org/plugins/fooevents-calendar/)
3.  Third-party Resources - FooEvents Help Center, accessed May 10, 2025, [https://help.fooevents.com/docs/topics/third-party-integration/](https://help.fooevents.com/docs/topics/third-party-integration/)
4.  FOOEvents – generate a custom CSV report - createIT, accessed May 10, 2025, [https://www.createit.com/blog/fooevents-generate-a-custom-csv-report/](https://www.createit.com/blog/fooevents-generate-a-custom-csv-report/)
5.  HOW TO: Display Extra Meta Data For Ticketed Events on a Woocommerce Shop Page -, accessed May 10, 2025, [https://theeventscalendar.com/support/forums/topic/how-to-display-extra-meta-data-for-ticketed-events-on-a-woocommerce-shop-page/](https://theeventscalendar.com/support/forums/topic/how-to-display-extra-meta-data-for-ticketed-events-on-a-woocommerce-shop-page/)
6.  Fooevents for Woocommerce - User Guide, accessed May 10, 2025, [https://sos.cru.io/portal/en-gb/kb/articles/fooevents-for-woocommerce-user-guide](https://sos.cru.io/portal/en-gb/kb/articles/fooevents-for-woocommerce-user-guide)
7.  Bookable: Party Venue Booking - FooEvents Help Center, accessed May 10, 2025, [https://help.fooevents.com/docs/topics/use-cases/bookable-party-venue-booking/](https://help.fooevents.com/docs/topics/use-cases/bookable-party-venue-booking/)
8.  re: FooEvents Bookings - WordPress.org, accessed May 10, 2025, [https://wordpress.org/support/topic/re-fooevents-bookings/](https://wordpress.org/support/topic/re-fooevents-bookings/)
9.  FooEvents For WooCommerce - Algol+ Documentation - Algolplus, accessed May 10, 2025, [https://docs.algolplus.com/algol_order_export/developers-algol_order_export/codes-for-plugins-developers-algol_order_export/fooevents-for-woocommerce/](https://docs.algolplus.com/algol_order_export/developers-algol_order_export/codes-for-plugins-developers-algol_order_export/fooevents-for-woocommerce/)
10.  fooevents-admin-pdf-tickets.php - GitHub, accessed May 10, 2025, [https://github.com/dkjensen/fooevents-admin-pdf-tickets/blob/master/fooevents-admin-pdf-tickets.php](https://github.com/dkjensen/fooevents-admin-pdf-tickets/blob/master/fooevents-admin-pdf-tickets.php)
11.  Get a custom field array values within WooCommerce email order meta - Stack Overflow, accessed May 10, 2025, [https://stackoverflow.com/questions/50274892/get-a-custom-field-array-values-within-woocommerce-email-order-meta](https://stackoverflow.com/questions/50274892/get-a-custom-field-array-values-within-woocommerce-email-order-meta)
12.  Salesforce WooCommerce Integration & FooEvents Bookings : r/ProWordPress - Reddit, accessed May 10, 2025, [https://www.reddit.com/r/ProWordPress/comments/1huw86z/salesforce_woocommerce_integration_fooevents/](https://www.reddit.com/r/ProWordPress/comments/1huw86z/salesforce_woocommerce_integration_fooevents/)
13.  Exporting WooCommerce meta data (FooEvents) into Airtable - Zapier Community, accessed May 10, 2025, [https://community.zapier.com/how-do-i-3/exporting-woocommerce-meta-data-fooevents-into-airtable-13375](https://community.zapier.com/how-do-i-3/exporting-woocommerce-meta-data-fooevents-into-airtable-13375)
14.  Docs - FooEvents Help Center, accessed May 10, 2025, [https://help.fooevents.com/docs/](https://help.fooevents.com/docs/)
15.  Events Calendar by FooEvents – WordPress plugin, accessed May 10, 2025, [https://wordpress.org/plugins/fooevents-calendar/](https://wordpress.org/plugins/fooevents-calendar/)
16.  Events Calendar by FooEvents – WordPress plugin, accessed May 10, 2025, [https://en-ca.wordpress.org/plugins/fooevents-calendar/](https://en-ca.wordpress.org/plugins/fooevents-calendar/)
17.  WordPress database tables and functions - Liquid Web, accessed May 10, 2025, [https://www.liquidweb.com/blog/wordpress-database/](https://www.liquidweb.com/blog/wordpress-database/)
18.  Meta Key array building with multiple input values from fields - WordPress Stack Exchange, accessed May 10, 2025, [https://wordpress.stackexchange.com/questions/337858/meta-key-array-building-with-multiple-input-values-from-fields](https://wordpress.stackexchange.com/questions/337858/meta-key-array-building-with-multiple-input-values-from-fields)
19.  WordPress database tables explained - Accreditly, accessed May 10, 2025, [https://accreditly.io/articles/wordpress-database-tables-explained](https://accreditly.io/articles/wordpress-database-tables-explained)
20.  How do I remove an action hook inside a class that is called by another class?, accessed May 10, 2025, [https://wordpress.stackexchange.com/questions/342164/how-do-i-remove-an-action-hook-inside-a-class-that-is-called-by-another-class](https://wordpress.stackexchange.com/questions/342164/how-do-i-remove-an-action-hook-inside-a-class-that-is-called-by-another-class)
21.  REST API Archives - FooEvents Help Center, accessed May 10, 2025, [https://help.fooevents.com/doc-tag/rest-api/](https://help.fooevents.com/doc-tag/rest-api/)
22.  Connecting To Your Store - FooEvents Help Center, accessed May 10, 2025, [https://help.fooevents.com/docs/topics/check-ins-app/connecting-to-your-store/](https://help.fooevents.com/docs/topics/check-ins-app/connecting-to-your-store/)
23.  Is There An API Or Any Hooks Available For FooEvents ..., accessed May 10, 2025, [https://help.fooevents.com/docs/frequently-asked-questions/integrations/is-there-an-api-or-any-hooks-for-fooevents/](https://help.fooevents.com/docs/frequently-asked-questions/integrations/is-there-an-api-or-any-hooks-for-fooevents/)
24.  Documentation of Foo's API endpoints for its page experience testing services | Foo Docs, accessed May 10, 2025, [https://www.foo.software/docs/api/endpoints](https://www.foo.software/docs/api/endpoints)
25.  Introduction – WooCommerce Bookings REST API Documentation, accessed May 10, 2025, [https://woocommerce.github.io/woocommerce-bookings-api-docs/](https://woocommerce.github.io/woocommerce-bookings-api-docs/)
