import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../api';
import type { WooCommerceProductsData, WooCommerceCacheInfo, WooCommerceProduct, WooCommerceSlot, WooCommerceDate } from '../api';
import './WooCommerceViewer.css';

interface WooCommerceViewerProps {
  onDateSelect?: (productId: number, slotId: string, dateId: string) => void;
  initialCollapsed?: boolean;
}

const WooCommerceViewer: React.FC<WooCommerceViewerProps> = ({ onDateSelect, initialCollapsed = false }) => {
  const [productsData, setProductsData] = useState<WooCommerceProductsData | null>(null);
  const [cacheInfo, setCacheInfo] = useState<WooCommerceCacheInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());

  // Load products data
  const loadProducts = async (useCache: boolean = true) => {
    if (useCache) {
      setLoading(true);
    } else {
      setSyncing(true);
    }
    setError(null);

    try {
      const response = useCache 
        ? await api.getWooCommerceProducts()
        : await api.syncWooCommerceProducts();
      
      setProductsData(response.data);
      
      // Load cache info
      const cacheResponse = await api.getWooCommerceCacheInfo();
      setCacheInfo(cacheResponse.data);
      
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to load WooCommerce products';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  // Toggle product expansion
  const toggleProduct = (productId: number) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
      // Also collapse all slots for this product
      const slotsToRemove = Array.from(expandedSlots).filter(slotKey => 
        slotKey.startsWith(`${productId}-`)
      );
      slotsToRemove.forEach(slotKey => expandedSlots.delete(slotKey));
      setExpandedSlots(new Set(expandedSlots));
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  // Toggle slot expansion
  const toggleSlot = (productId: number, slotId: string) => {
    const slotKey = `${productId}-${slotId}`;
    const newExpanded = new Set(expandedSlots);
    if (newExpanded.has(slotKey)) {
      newExpanded.delete(slotKey);
    } else {
      newExpanded.add(slotKey);
    }
    setExpandedSlots(newExpanded);
  };

  // Handle date selection
  const handleDateSelect = (productId: number, slotId: string, dateId: string) => {
    if (onDateSelect) {
      onDateSelect(productId, slotId, dateId);
    }
  };

  // Collapse all products and slots
  const collapseAll = () => {
    setExpandedProducts(new Set());
    setExpandedSlots(new Set());
  };

  // Toggle main section collapse
  const toggleMainCollapse = () => {
    if (!isCollapsed) {
      collapseAll();
    }
    setIsCollapsed(!isCollapsed);
  };

  // Format cache age
  const formatCacheAge = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  };

  // Calculate total inventory across all products
  const getTotalInventory = () => {
    if (!productsData) return { totalCapacity: 0, totalSold: 0, totalAvailable: 0, totalDates: 0 };
    
    let totalCapacity = 0;
    let totalSold = 0;
    let totalAvailable = 0;
    let totalDates = 0;
    
    productsData.products.forEach(product => {
      product.slots.forEach(slot => {
        slot.dates.forEach(date => {
          // Only count numeric values, skip error states
          if (typeof date.total_capacity === 'number') {
            totalCapacity += date.total_capacity;
          }
          if (typeof date.tickets_sold === 'number') {
            totalSold += date.tickets_sold;
          }
          totalAvailable += date.available;
          totalDates++;
        });
      });
    });
    
    return { totalCapacity, totalSold, totalAvailable, totalDates };
  };

  // Initial load
  useEffect(() => {
    loadProducts();
  }, []);

  const { totalCapacity, totalSold, totalAvailable, totalDates } = getTotalInventory();

  return (
    <div className="woocommerce-viewer">
      <div className="woocommerce-header">
        <h2>
          <button 
            className="collapse-button"
            onClick={toggleMainCollapse}
            title={isCollapsed ? "Expand WooCommerce section" : "Collapse WooCommerce section"}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
          🛒 WooCommerce FooEvents Products
        </h2>
        
        {!isCollapsed && (
          <div className="woocommerce-controls">
            <button
              className="sync-button"
              onClick={() => loadProducts(false)}
              disabled={syncing || loading}
              title="Refresh from WooCommerce API"
            >
              {syncing ? '🔄 Syncing...' : '🔄 Sync'}
            </button>
          </div>
        )}
      </div>

      {isCollapsed ? (
        <div className="collapsed-summary">
          {productsData ? (
            <span>
              {productsData.total_products} products • {totalCapacity} total capacity • {totalAvailable} available • 
              {cacheInfo?.has_cache && cacheInfo.age_minutes !== undefined 
                ? ` Updated ${formatCacheAge(cacheInfo.age_minutes)}`
                : ' No cache'
              }
            </span>
          ) : (
            <span>Click to expand WooCommerce products</span>
          )}
        </div>
      ) : (
        <>
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {cacheInfo && (
            <div className="cache-status">
              <span className="cache-info">
                {cacheInfo.has_cache ? (
                  <>
                    📦 Cache: {cacheInfo.products_count} products, {cacheInfo.slots_count} slots, {cacheInfo.dates_count} dates
                    {cacheInfo.age_minutes !== undefined && (
                      <> • Updated {formatCacheAge(cacheInfo.age_minutes)}</>
                    )}
                  </>
                ) : (
                  '📦 No cache available'
                )}
              </span>
            </div>
          )}

          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <span>Loading WooCommerce products...</span>
            </div>
          )}

          {productsData && !loading && (
            <div className="products-container">
              <div className="products-summary">
                <div className="summary-stats">
                  <div className="stat">
                    <span className="stat-number">{productsData.total_products}</span>
                    <span className="stat-label">Products</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{productsData.total_slots}</span>
                    <span className="stat-label">Slots</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{totalDates}</span>
                    <span className="stat-label">Dates</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{totalCapacity}</span>
                    <span className="stat-label">Total Capacity</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{totalSold}</span>
                    <span className="stat-label">Tickets Sold</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{totalAvailable}</span>
                    <span className="stat-label">Available</span>
                  </div>
                </div>
                
                {expandedProducts.size > 0 && (
                  <button 
                    className="collapse-all-button"
                    onClick={collapseAll}
                    title="Collapse all products"
                  >
                    Collapse All
                  </button>
                )}
              </div>

              <div className="products-grid">
                {productsData.products.map((product) => (
                  <div key={product.product_id} className="product-card">
                    <div 
                      className="product-header"
                      onClick={() => toggleProduct(product.product_id)}
                    >
                      <div className="product-info">
                        <h3 className="product-name">{product.product_name}</h3>
                        <div className="product-meta">
                          <span className="product-id">ID: {product.product_id}</span>
                          <span className="product-price">${product.product_price}</span>
                          <span className="product-sales">{product.total_sales} sold</span>
                        </div>
                      </div>
                      <div className="product-stats">
                        <span className="slot-count">{product.slot_count} slots</span>
                        <span className="expand-icon">
                          {expandedProducts.has(product.product_id) ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {expandedProducts.has(product.product_id) && (
                      <div className="product-slots">
                        {product.slots.map((slot) => {
                          const slotKey = `${product.product_id}-${slot.slot_id}`;
                          const isSlotExpanded = expandedSlots.has(slotKey);
                          
                          return (
                            <div key={slot.slot_id} className="slot-card">
                              <div 
                                className="slot-header"
                                onClick={() => toggleSlot(product.product_id, slot.slot_id)}
                              >
                                <div className="slot-info">
                                  <h4 className="slot-label">{slot.slot_label}</h4>
                                  <span className="slot-time">{slot.slot_time}</span>
                                </div>
                                <div className="slot-stats">
                                  <span className="date-count">{slot.total_dates} dates</span>
                                  <span className="expand-icon">
                                    {isSlotExpanded ? '▲' : '▼'}
                                  </span>
                                </div>
                              </div>

                              {isSlotExpanded && (
                                <div className="slot-dates">
                                  {slot.dates.map((date) => (
                                    <div 
                                      key={date.date_id} 
                                      className={`date-card ${date.available === 0 ? 'sold-out' : ''}`}
                                      onClick={() => handleDateSelect(product.product_id, slot.slot_id, date.date_id)}
                                    >
                                      <div className="date-info">
                                        <span className="date-text">{date.date}</span>
                                        <div className="date-capacity-metrics">
                                          <div className={`capacity-metric total ${typeof date.total_capacity === 'string' ? 'error-state' : ''}`}>
                                            <span className="metric-label">Total:</span>
                                            <span className="metric-value">{date.total_capacity}</span>
                                          </div>
                                          <div className={`capacity-metric sold ${typeof date.tickets_sold === 'string' ? 'error-state' : ''}`}>
                                            <span className="metric-label">Sold:</span>
                                            <span className="metric-value">{date.tickets_sold}</span>
                                          </div>
                                          <div className="capacity-metric available">
                                            <span className="metric-label">Available:</span>
                                            <span className="metric-value">{date.available}</span>
                                          </div>
                                          {date.available === 0 && typeof date.total_capacity === 'number' && (
                                            <span className="sold-out-badge">SOLD OUT</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WooCommerceViewer; 