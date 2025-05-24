@echo off
start "Backend" cmd /k "cd eventbrite-capacity-manager-backend && npm start"
timeout /t 2 >nul
start "Frontend" cmd /k "cd eventbrite-capacity-manager-frontend && npm start"