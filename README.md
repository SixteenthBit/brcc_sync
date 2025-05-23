# Eventbrite Capacity Manager

## Overview

The Eventbrite Capacity Manager is a full-stack application designed to help event organizers manage the ticket capacities for their Eventbrite events. It provides a user-friendly interface to view live events and their occurrences, and to adjust the capacity of individual ticket classes. The application intelligently tracks the total adjustments made to each ticket class's capacity over time, storing this "app-modified count" in the browser's local storage to provide context alongside the current API-set capacity.

## Project Structure

The application is organized into two main parts:

*   `eventbrite-capacity-manager-backend/`: A Node.js/Express.js application that serves as the backend API. It handles communication with the Eventbrite API for fetching event data and updating ticket capacities.
*   `eventbrite-capacity-manager-frontend/`: A React application that provides the user interface for viewing events and managing capacities.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js:** (LTS version recommended, e.g., v18.x or later) - Download from [nodejs.org](https://nodejs.org/)
*   **npm:** (Node Package Manager) - Typically comes with Node.js.

## Backend Setup (`eventbrite-capacity-manager-backend/`)

1.  **Navigate to the Backend Directory:**
    ```bash
    cd eventbrite-capacity-manager-backend
    ```

2.  **Create and Configure `.env` File:**
    Create a `.env` file in the `eventbrite-capacity-manager-backend/` directory by copying the `.env.example` file (if it exists) or by creating a new one. Add your Eventbrite API credentials and server configuration as follows:

    ```env
    # EVENTBRITE API DETAILS
    PRIVATE_TOKEN="YOUR_EVENTBRITE_PRIVATE_TOKEN" # Critical for API authentication
    ORGANIZATION_ID="YOUR_EVENTBRITE_ORGANIZATION_ID" # Critical to fetch correct events for your organization

    # Optional - These are standard Eventbrite App Partner variables.
    # While not strictly used by this project's core Eventbrite API calls for fetching events
    # or updating ticket capacities (which primarily use the PRIVATE_TOKEN),
    # including them can be useful if you intend to expand the application's
    # capabilities or use a more complex OAuth flow in the future.
    # For the current application, PRIVATE_TOKEN and ORGANIZATION_ID are the most important.
    API_KEY="YOUR_EVENTBRITE_API_KEY"
    CLIENT_SECRET="YOUR_EVENTBRITE_CLIENT_SECRET"
    PUBLIC_TOKEN="YOUR_EVENTBRITE_PUBLIC_TOKEN" # Sometimes referred to as an Anonymous Access OAuth token

    # SERVER CONFIGURATION
    PORT=3001 # Optional: Defines the port on which the backend server will run. Defaults to 3001 if not set.
    ```
    *   **`PRIVATE_TOKEN`**: Your private OAuth token from Eventbrite. This is **critical** for authenticating API requests to manage your events. You can find or generate this in your Eventbrite account under "API Keys".
    *   **`ORGANIZATION_ID`**: Your Eventbrite Organization ID. This is **critical** to ensure the application fetches events for the correct organization. This ID can be found in your Eventbrite account settings or via the API.
    *   `API_KEY`, `CLIENT_SECRET`, `PUBLIC_TOKEN`: These are generally used for more complex Eventbrite integrations or app partnerships. For the direct server-to-server interactions in this application (fetching events and updating capacities for your own organization), the `PRIVATE_TOKEN` is typically sufficient.
    *   `PORT`: The port for the backend server. If not specified, the application defaults to `3001`.

3.  **Install Dependencies:**
    In the `eventbrite-capacity-manager-backend/` directory, run:
    ```bash
    npm install
    ```

4.  **Start the Backend Server:**
    ```bash
    npm start
    ```
    The backend server should now be running (by default on `http://localhost:3001`).

## Frontend Setup (`eventbrite-capacity-manager-frontend/`)

1.  **Navigate to the Frontend Directory:**
    From the project root, navigate to the frontend directory:
    ```bash
    cd eventbrite-capacity-manager-frontend
    ```

2.  **Install Dependencies:**
    In the `eventbrite-capacity-manager-frontend/` directory, run:
    ```bash
    npm install
    ```

3.  **Start the Frontend Development Server:**
    ```bash
    npm start
    ```
    The React development server will start, and the application should automatically open in your default web browser (usually at `http://localhost:3000`).

4.  **(Optional) Configure Backend API URL:**
    By default, the frontend application expects the backend API to be running at `http://localhost:3001/api`. If your backend is running on a different URL (e.g., if you deployed it or are using a different port), you can configure this by creating a `.env` file in the `eventbrite-capacity-manager-frontend/` directory with the following content:
    ```env
    REACT_APP_API_URL=http://your-backend-host:your-backend-port/api
    ```
    Replace `http://your-backend-host:your-backend-port/api` with the actual URL of your backend.

## Running the Application

To use the Eventbrite Capacity Manager:

1.  Ensure the **backend server is running** (see Backend Setup).
2.  Ensure the **frontend development server is running** (see Frontend Setup).
3.  Open your web browser and navigate to the frontend application's URL (typically `http://localhost:3000`).

## How to Use

1.  **Select an Event Occurrence:**
    *   Upon loading, the application will fetch and display a list of your live Eventbrite event occurrences.
    *   The list is formatted as: "`<Event Series Name>` - `<Occurrence Name>` - `Date @ Time`".
    *   Click on an event occurrence from the list to select it for capacity management.

2.  **Manage Ticket Class Capacities:**
    *   Once an occurrence is selected, its ticket classes will be displayed.
    *   For each ticket class, you will see:
        *   **Ticket Class Name and ID.**
        *   **API Capacity:** The current capacity as set on Eventbrite.
        *   **Sold:** The number of tickets sold for that class.
        *   **App-Modified Count:** A value stored in your browser's local storage that represents the cumulative capacity adjustments made *by this application* over time, relative to the original Eventbrite capacity. This helps you track how much you've manually increased or decreased capacity using this tool.
    *   **Modify Capacity:**
        *   Use the **`+`** and **`-`** buttons to increment or decrement the desired capacity.
        *   Alternatively, you can directly type a new total capacity into the input field.
        *   These changes are staged locally in the browser and are reflected in the input field. They are not yet saved to Eventbrite.

3.  **Save Changes:**
    *   After making your desired capacity adjustments for one or more ticket classes of the selected occurrence, click the **"Save All Changes for This Occurrence"** button.
    *   The application will then:
        *   Send requests to the backend to update the capacities on Eventbrite for each modified ticket class.
        *   Update the "App-Modified Count" in your browser's local storage to reflect the changes just applied.
        *   Display results of the save operation (success or failure for each ticket class).
        *   Refresh the event data to show the latest capacities from Eventbrite.

4.  **Refresh Events:**
    *   Click the "Refresh Events" button in the header at any time to reload the list of events and their current capacities from Eventbrite.

---

This README provides a comprehensive guide for setting up and using the Eventbrite Capacity Manager.
