#!/usr/bin/env python3
"""
Development server runner for the Eventbrite Capacity Manager backend.
"""

import uvicorn
import os
from pathlib import Path

if __name__ == "__main__":
    # Ensure we're in the backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    print("🚀 Starting Eventbrite Capacity Manager Backend...")
    print("📍 Backend running at: http://localhost:8000")
    print("📖 API docs available at: http://localhost:8000/docs")
    print("🔄 Auto-reload enabled for development")
    print("\n" + "="*50)
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(backend_dir)],
        log_level="info"
    ) 