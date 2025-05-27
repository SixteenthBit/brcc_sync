#!/usr/bin/env python3
"""
Production server runner for the Backroom Comedy Club Event Management backend.
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
    parser = argparse.ArgumentParser(description='Production server for BRCC Event Management System')
    parser.add_argument('--sync', action='store_true', 
                       help='Sync fresh data from APIs on startup (otherwise uses cache)')
    parser.add_argument('--host', default='0.0.0.0', 
                       help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8000, 
                       help='Port to bind to (default: 8000)')
    
    args = parser.parse_args()
    
    # Ensure we're in the backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    print("🚀 Starting Backroom Comedy Club Event Management Backend (Production)...")
    print(f"📍 Backend running at: http://{args.host}:{args.port}")
    print("📖 API docs available at: http://localhost:8000/docs")
    
    if args.sync:
        print("🔄 Sync mode enabled - will fetch fresh data on startup")
        # Run sync before starting server
        asyncio.run(sync_on_startup())
    else:
        print("📦 Cache mode - will use existing cached data")
    
    print("\n" + "="*50)
    
    uvicorn.run(
        "app:app",
        host=args.host,
        port=args.port,
        reload=False,  # No auto-reload in production
        log_level="info"
    ) 