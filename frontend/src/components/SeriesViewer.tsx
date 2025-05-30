import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api';
import type { EventSeries, EventOccurrence, CacheInfo } from '../api';
import './SeriesViewer.css';

interface SeriesViewerProps {
  onOccurrenceSelect: (eventId: string, occurrence?: any) => void;
  initialCollapsed?: boolean;
}

const SeriesViewer: React.FC<SeriesViewerProps> = ({ onOccurrenceSelect, initialCollapsed = false }) => {
  const [series, setSeries] = useState<EventSeries[]>([]);
  const [, setSelectedSeries] = useState<EventSeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [cacheSource, setCacheSource] = useState<'api' | 'cache' | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  // Check if backend is online
  const checkBackendHealth = async () => {
    try {
      await api.healthCheck();
      setIsOnline(true);
      setError(null);
    } catch (err) {
      setIsOnline(false);
      setError('Backend is not running. Please start the FastAPI server.');
    }
  };

  // Load cache information
  const loadCacheInfo = async () => {
    if (!isOnline) return;
    
    try {
      const response = await api.getCacheInfo();
      setCacheInfo(response.data);
    } catch (err) {
      console.error('Failed to load cache info:', err);
    }
  };

  // Load series data (from cache by default)
  const loadSeries = async (forceRefresh: boolean = false) => {
    if (!isOnline) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let response;
      if (forceRefresh) {
        setRefreshing(true);
        response = await api.refreshOrganizationSeries();
      } else {
        response = await api.getOrganizationSeries();
      }
      
      setSeries(response.data.series);
      setLastUpdated(response.data.last_updated || null);
      setCacheSource(response.data.cache_source || null);
      
      
      // Refresh cache info after loading
      await loadCacheInfo();
      
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to load series';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    await loadSeries(true);
  };

  // Handle series selection
  const handleSeriesClick = (selectedSeries: EventSeries) => {
    const seriesId = selectedSeries.series_id;
    const newExpandedSeries = new Set(expandedSeries);
    
    if (expandedSeries.has(seriesId)) {
      // Collapse this series
      newExpandedSeries.delete(seriesId);
      if (selectedSeries?.series_id === seriesId) {
        setSelectedSeries(null);
      }
    } else {
      // Expand this series
      newExpandedSeries.add(seriesId);
      setSelectedSeries(selectedSeries);
    }
    
    setExpandedSeries(newExpandedSeries);
  };

  // Toggle entire section collapse
  const toggleSectionCollapse = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
      // When collapsing, also collapse all individual series
      setExpandedSeries(new Set());
      setSelectedSeries(null);
    }
  };

  // Handle occurrence selection
  const handleOccurrenceClick = (occurrence: EventOccurrence, seriesItem: any) => {
    const occurrenceWithSeries = {
      ...occurrence,
      series_name: seriesItem.series_name
    };
    onOccurrenceSelect(occurrence.occurrence_id, occurrenceWithSeries);
    // Scroll to capacity manager section
    const capacitySection = document.querySelector('.capacity-manager');
    if (capacitySection) {
      capacitySection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Format last updated time
  const formatLastUpdated = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Clear error after 5 seconds
  useEffect(() => {
    if (error && !error.includes('Backend is not running')) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      await checkBackendHealth();
    };
    initialize();
  }, []);

  // Load series and cache info when online
  useEffect(() => {
    if (isOnline) {
      loadSeries();
      loadCacheInfo();
    }
  }, [isOnline]);

  return (
    <div className="series-viewer">
      <div className="series-header">
        <div className="header-left">
          <div className="header-title">
            <h2>🎭 Eventbrite Event Series</h2>
            <button 
              className="btn btn-collapse"
              onClick={toggleSectionCollapse}
              title={isCollapsed ? 'Expand series section' : 'Collapse series section'}
            >
              <span className="btn-icon">{isCollapsed ? '▼' : '▲'}</span>
            </button>
          </div>
          {lastUpdated && !isCollapsed && (
            <div className="last-updated">
              Last updated: {formatLastUpdated(lastUpdated)}
              {cacheSource === 'cache' && ' (cached)'}
            </div>
          )}
        </div>
        <div className="header-right">
          <div className={`series-status ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isOnline ? 'Connected' : 'Offline'}
          </div>
          {isOnline && !isCollapsed && (
            <button 
              className="btn btn-refresh" 
              onClick={handleRefresh}
              disabled={refreshing || loading}
              title="Refresh fresh data from Eventbrite API"
            >
              <span className="btn-icon">{refreshing ? '⏳' : '🔄'}</span>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {isCollapsed && (
        <div className="series-collapsed">
          <p>
            <strong>{series.length}</strong> event series available
            {cacheInfo && cacheInfo.has_cache && (
              <span className="cache-info">
                {' '}• Cache: {cacheInfo.age_minutes || 0} minutes old
              </span>
            )}
          </p>
        </div>
      )}

      {!isCollapsed && (
        <>
          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠️</span>
              {error}
            </div>
          )}

          {(loading || refreshing) && (
            <div className="series-loading">
              <div className="spinner"></div>
              <span>{refreshing ? 'Refreshing with Eventbrite API...' : 'Loading event series...'}</span>
            </div>
          )}

          {!loading && !refreshing && series.length > 0 && (
            <div className="series-content">
              <div className="series-summary">
                <p>
                  Found <strong>{series.length}</strong> active event series currently on sale
                  {cacheInfo && cacheInfo.has_cache && (
                    <span className="cache-info">
                      {' '}• Cache: {cacheInfo.age_minutes || 0} minutes old
                    </span>
                  )}
                </p>
              </div>

              <div className="series-grid">
                {series.map((seriesItem) => {
                  const isExpanded = expandedSeries.has(seriesItem.series_id);
                  return (
                    <div key={seriesItem.series_id} className="series-item">
                      <div 
                        className={`series-card ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => handleSeriesClick(seriesItem)}
                      >
                        <div className="series-card-header">
                          <h3>{seriesItem.series_name}</h3>
                          <div className="series-card-controls">
                            <span className="series-id">ID: {seriesItem.series_id}</span>
                            <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        <div className="series-card-footer">
                          <span className="event-count">{seriesItem.event_count} events</span>
                          <span className="click-hint">
                            {isExpanded ? 'Click to collapse' : 'Click to view events'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="occurrences-section">
                          <h4>Events in "{seriesItem.series_name}"</h4>
                          <div className="occurrences-grid">
                            {seriesItem.events.map((occurrence) => (
                              <div 
                                key={occurrence.occurrence_id}
                                className="occurrence-card"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOccurrenceClick(occurrence, seriesItem);
                                }}
                              >
                                <div className="occurrence-date">
                                  {formatDate(occurrence.start_date)}
                                </div>
                                <div className="occurrence-id">
                                  ID: {occurrence.occurrence_id}
                                </div>
                                <div className="occurrence-action">
                                  Click to manage capacity →
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && !refreshing && !error && series.length === 0 && isOnline && (
            <div className="series-empty">
              <p>No event series found that are currently on sale.</p>
              <button onClick={() => loadSeries(true)} className="btn btn-refresh">
                🔄 Refresh from API
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SeriesViewer; 