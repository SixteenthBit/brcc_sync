import React from 'react';
import type { ViewMode, SelectedEvent } from '../App';
import './Sidebar.css';

interface SidebarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  selectedEvents: SelectedEvent[];
  onClearSelections: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  selectedEvents,
  onClearSelections,
  collapsed,
  onToggleCollapse
}) => {
  const navigationItems = [
    {
      id: 'dashboard' as ViewMode,
      label: 'Dashboard',
      icon: '📊',
      description: 'Overview and quick actions'
    },
    {
      id: 'eventbrite' as ViewMode,
      label: 'Eventbrite',
      icon: '🎭',
      description: 'Manage Eventbrite events'
    },
    {
      id: 'woocommerce' as ViewMode,
      label: 'WooCommerce',
      icon: '🛒',
      description: 'Manage WooCommerce events'
    },
    {
      id: 'mapping' as ViewMode,
      label: 'Mapping',
      icon: '🔗',
      description: 'Map events between platforms'
    },
    {
      id: 'comparison' as ViewMode,
      label: 'Compare',
      icon: '⚖️',
      description: 'Compare selected events',
      badge: selectedEvents.length > 0 ? selectedEvents.length : undefined
    },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button 
          className="mobile-menu-btn"
          onClick={onToggleCollapse}
        >
          <span className="hamburger-icon">☰</span>
        </button>
        <h1 className="mobile-title">🎭 BRCC Events</h1>
        {selectedEvents.length > 0 && (
          <span className="mobile-badge">{selectedEvents.length}</span>
        )}
      </div>

      {/* Sidebar */}
      <div className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-title">
            <h1 className="title-full">🎭 Backroom Comedy Club</h1>
            <h1 className="title-short">🎭 BRCC</h1>
          </div>
          <button 
            className="collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <ul className="nav-list">
            {navigationItems.map((item) => (
              <li key={item.id} className="nav-item">
                <button
                  className={`nav-link ${currentView === item.id ? 'nav-link-active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : item.description}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Selected Events Section */}
        {selectedEvents.length > 0 && (
          <div className="sidebar-section">
            <div className="section-header">
              <h3 className="section-title">Selected Events</h3>
              <button 
                className="btn-clear"
                onClick={onClearSelections}
                title="Clear all selections"
              >
                ✕
              </button>
            </div>
            <div className="selected-events">
              {selectedEvents.map((event) => (
                <div key={`${event.type}-${event.id}`} className="selected-event">
                  <div className="event-type-icon">
                    {event.type === 'eventbrite' ? '🎭' : '🛒'}
                  </div>
                  <div className="event-info">
                    <div className="event-name">{event.name}</div>
                    <div className="event-type">{event.type}</div>
                  </div>
                </div>
              ))}
            </div>
            {selectedEvents.length >= 2 && (
              <button 
                className="btn btn-primary btn-compare"
                onClick={() => onNavigate('comparison')}
              >
                Compare Events
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="footer-info">
            <div className="version">v1.0.0</div>
            <div className="status-indicator status-online">
              <span className="status-dot"></span>
              <span className="status-text">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {!collapsed && (
        <div 
          className="mobile-overlay"
          onClick={onToggleCollapse}
        />
      )}
    </>
  );
};

export default Sidebar; 