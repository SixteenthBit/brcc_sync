#!/usr/bin/env python3
"""
Development server runner for the Eventbrite Capacity Manager backend.
"""

import uvicorn
import os
import sys
import argparse
import asyncio
from pathlib import Path

async def sync_on_startup():
    """Sync both Eventbrite and WooCommerce data on startup"""
    try:
        from eventbrite import EventbriteClient
        from woocommerce import WooCommerceClient
        
        print("🔄 Syncing Eventbrite data on startup...")
        eventbrite_client = EventbriteClient()
        eventbrite_result = await eventbrite_client.get_organization_series(use_cache=False)
        print(f"✅ Synced {eventbrite_result['total_series_count']} Eventbrite series")
        
        print("🔄 Syncing WooCommerce data on startup...")
        woocommerce_client = WooCommerceClient()
        woocommerce_result = await woocommerce_client.get_all_fooevents_products(use_cache=False)
        print(f"✅ Synced {woocommerce_result['total_products']} WooCommerce products")
        
        print("🎉 Startup sync completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during startup sync: {e}")
        print("⚠️  Server will start but cached data may be stale")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Development server for BRCC Event Management System')
    parser.add_argument('--sync', action='store_true', 
                       help='Sync fresh data from APIs on startup (otherwise uses cache)')
    
    args = parser.parse_args()
    
    # Ensure we're in the backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    print("🚀 Starting Backroom Comedy Club Event Management Backend...")
    print("📍 Backend running at: http://localhost:8000")
    print("📖 API docs available at: http://localhost:8000/docs")
    print("🔄 Auto-reload enabled for development")
    
    if args.sync:
        print("🔄 Sync mode enabled - will fetch fresh data on startup")
        # Run sync before starting server
        asyncio.run(sync_on_startup())
    else:
        print("📦 Cache mode - will use existing cached data")
    
    print("\n" + "="*50)
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(backend_dir)],
        log_level="info"
    ) 