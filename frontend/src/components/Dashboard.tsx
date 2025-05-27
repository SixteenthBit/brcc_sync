import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api';
import type { ViewMode, SelectedEvent } from '../App';
import type { EventSeries, WooCommerceProductsData, ConfigData } from '../api';
import './Dashboard.css';

interface DashboardProps {
  selectedEvents: SelectedEvent[];
  onEventSelect: (event: SelectedEvent) => void;
  onCompareEvents: () => void;
  onNavigate: (view: ViewMode) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  selectedEvents,
  onEventSelect,
  onCompareEvents,
  onNavigate
}) => {
  const [loading, setLoading] = useState(true);
  const [eventbriteData, setEventbriteData] = useState<{
    series: EventSeries[];
    totalSeries: number;
    totalEvents: number;
  } | null>(null);
  const [woocommerceData, setWoocommerceData] = useState<WooCommerceProductsData | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [configResponse, eventbriteResponse, woocommerceResponse] = await Promise.all([
        api.getConfig(),
        api.getOrganizationSeries().catch(() => null),
        api.getWooCommerceProducts().catch(() => null)
      ]);

      setConfig(configResponse);
      
      if (eventbriteResponse) {
        setEventbriteData({
          series: eventbriteResponse.data.series,
          totalSeries: eventbriteResponse.data.total_series_count,
          totalEvents: eventbriteResponse.data.total_events_on_sale
        });
      }

      if (woocommerceResponse) {
        setWoocommerceData(woocommerceResponse.data);
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getSystemStatus = () => {
    if (!config) return 'loading';
    
    const issues = [];
    if (!config.has_private_token) issues.push('Eventbrite token missing');
    if (!config.has_woocommerce_credentials) issues.push('WooCommerce credentials missing');
    if (!config.has_wordpress_db_credentials) issues.push('WordPress DB credentials missing');
    
    if (issues.length === 0) return 'healthy';
    if (issues.length <= 1) return 'warning';
    return 'error';
  };

  const getQuickStats = () => {
    let totalCapacity = 0;
    let totalAvailable = 0;
    let totalSold = 0;

    if (woocommerceData) {
      woocommerceData.products.forEach(product => {
        product.slots.forEach(slot => {
          slot.dates.forEach(date => {
            if (typeof date.total_capacity === 'number') {
              totalCapacity += date.total_capacity;
            }
            totalAvailable += date.available;
            if (typeof date.tickets_sold === 'number') {
              totalSold += date.tickets_sold;
            }
          });
        });
      });
    }

    return {
      eventbriteSeries: eventbriteData?.totalSeries || 0,
      eventbriteEvents: eventbriteData?.totalEvents || 0,
      woocommerceProducts: woocommerceData?.total_products || 0,
      woocommerceDates: woocommerceData?.total_dates || 0,
      totalCapacity,
      totalSold,
      totalAvailable
    };
  };

  const status = getSystemStatus();
  const stats = getQuickStats();

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>🎭 Event Management Dashboard</h1>
          <p>Overview and quick access to your event management tools</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadDashboardData}>
            🔄 Refresh
          </button>
          {selectedEvents.length >= 2 && (
            <button className="btn btn-primary" onClick={onCompareEvents}>
              ⚖️ Compare Events ({selectedEvents.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button className="btn btn-outline btn-sm" onClick={loadDashboardData}>
            Try Again
          </button>
        </div>
      )}

      {/* Status Card */}
      <div className="card status-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className={`status-indicator status-${status}`}>
              <span className="status-dot"></span>
              System Status
            </span>
          </h2>
        </div>
        <div className="card-body">
          <div className="status-grid">
            <div className="status-item">
              <div className="status-icon">🎭</div>
              <div className="status-info">
                <div className="status-label">Eventbrite API</div>
                <div className={`status-value ${config?.has_private_token ? 'status-good' : 'status-bad'}`}>
                  {config?.has_private_token ? 'Connected' : 'Not configured'}
                </div>
              </div>
            </div>
            <div className="status-item">
              <div className="status-icon">🛒</div>
              <div className="status-info">
                <div className="status-label">WooCommerce API</div>
                <div className={`status-value ${config?.has_woocommerce_credentials ? 'status-good' : 'status-bad'}`}>
                  {config?.has_woocommerce_credentials ? 'Connected' : 'Not configured'}
                </div>
              </div>
            </div>
            <div className="status-item">
              <div className="status-icon">🗄️</div>
              <div className="status-info">
                <div className="status-label">WordPress Database</div>
                <div className={`status-value ${config?.has_wordpress_db_credentials ? 'status-good' : 'status-bad'}`}>
                  {config?.has_wordpress_db_credentials ? 'Connected' : 'Not configured'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🎭</div>
          <div className="stat-content">
            <div className="stat-value">{stats.eventbriteSeries}</div>
            <div className="stat-label">Eventbrite Series</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.eventbriteEvents}</div>
            <div className="stat-label">Events On Sale</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛒</div>
          <div className="stat-content">
            <div className="stat-value">{stats.woocommerceProducts}</div>
            <div className="stat-label">WooCommerce Products</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎫</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalCapacity}</div>
            <div className="stat-label">Total Capacity</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalSold}</div>
            <div className="stat-label">Tickets Sold</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalAvailable}</div>
            <div className="stat-label">Available</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="actions-grid">
        <div className="action-card" onClick={() => onNavigate('eventbrite')}>
          <div className="action-header">
            <div className="action-icon">🎭</div>
            <h3>Manage Eventbrite Events</h3>
          </div>
          <p>Browse event series, view occurrences, and manage ticket capacity for Eventbrite events.</p>
          <div className="action-stats">
            <span className="badge badge-info">{stats.eventbriteSeries} series</span>
            <span className="badge badge-success">{stats.eventbriteEvents} on sale</span>
          </div>
        </div>

        <div className="action-card" onClick={() => onNavigate('woocommerce')}>
          <div className="action-header">
            <div className="action-icon">🛒</div>
            <h3>Manage WooCommerce Events</h3>
          </div>
          <p>Browse FooEvents products, view booking slots, and monitor ticket sales data.</p>
          <div className="action-stats">
            <span className="badge badge-info">{stats.woocommerceProducts} products</span>
            <span className="badge badge-warning">{stats.woocommerceDates} dates</span>
          </div>
        </div>

        <div className="action-card" onClick={() => onNavigate('manage')}>
          <div className="action-header">
            <div className="action-icon">🎯</div>
            <h3>Capacity Management</h3>
          </div>
          <p>Direct capacity control for Eventbrite events with increment and decrement tools.</p>
          <div className="action-stats">
            <span className="badge badge-neutral">Quick Tools</span>
          </div>
        </div>

        <div className="action-card" onClick={() => onNavigate('comparison')}>
          <div className="action-header">
            <div className="action-icon">⚖️</div>
            <h3>Compare Events</h3>
          </div>
          <p>Side-by-side comparison of events from both platforms for analysis.</p>
          <div className="action-stats">
            <span className="badge badge-info">{selectedEvents.length} selected</span>
          </div>
        </div>
      </div>

      {/* Selected Events Preview */}
      {selectedEvents.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Selected Events</h2>
            <button className="btn btn-outline btn-sm" onClick={onCompareEvents}>
              Compare All
            </button>
          </div>
          <div className="card-body">
            <div className="selected-events-grid">
              {selectedEvents.map((event) => (
                <div key={`${event.type}-${event.id}`} className="selected-event-card">
                  <div className="event-header">
                    <span className="event-type-badge">
                      {event.type === 'eventbrite' ? '🎭' : '🛒'} {event.type}
                    </span>
                  </div>
                  <h4 className="event-name">{event.name}</h4>
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => onEventSelect(event)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 