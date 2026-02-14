"""
TradeAI Pro - Markets Page Backend API Tests
Testing: Market instruments, chart data with timeframes, market overview
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from request
TEST_USER_EMAIL = "test2@trader.com"
TEST_USER_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for authenticated tests"""
    # Try to login with provided credentials
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    
    # If login fails, try to register
    unique_email = f"test_market_{int(time.time())}@example.com"
    reg_payload = {
        "username": f"TEST_market_{int(time.time())}",
        "email": unique_email,
        "password": "testpass123",
        "trader_type": "swing"
    }
    requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": unique_email,
        "password": "testpass123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Could not obtain auth token")


class TestMarketInstruments:
    """Tests for /api/market/instruments endpoint"""
    
    def test_get_instruments_success(self):
        """Test getting all available instruments"""
        response = requests.get(f"{BASE_URL}/api/market/instruments")
        assert response.status_code == 200, f"Get instruments failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "instruments" in data, "Missing 'instruments' key"
        instruments = data["instruments"]
        
        # Verify all categories exist
        assert "forex" in instruments, "Missing forex category"
        assert "crypto" in instruments, "Missing crypto category"
        assert "indices" in instruments, "Missing indices category"
        assert "commodities" in instruments, "Missing commodities category"
        print(f"✓ Instruments endpoint: All 4 categories present")
        
    def test_forex_instruments_structure(self):
        """Test forex instruments data structure"""
        response = requests.get(f"{BASE_URL}/api/market/instruments")
        data = response.json()
        
        forex = data["instruments"]["forex"]
        assert len(forex) > 0, "No forex instruments"
        
        # Each instrument should be [symbol, name, description]
        first = forex[0]
        assert len(first) == 3, f"Expected 3 elements, got {len(first)}"
        assert isinstance(first[0], str), "Symbol should be string"
        assert isinstance(first[1], str), "Name should be string"
        assert isinstance(first[2], str), "Description should be string"
        
        # Check for known forex pairs
        symbols = [f[0] for f in forex]
        assert "EURUSD=X" in symbols, "EURUSD missing"
        assert "GBPUSD=X" in symbols, "GBPUSD missing"
        print(f"✓ Forex instruments: {len(forex)} pairs with correct structure")
        
    def test_crypto_instruments_structure(self):
        """Test crypto instruments data structure"""
        response = requests.get(f"{BASE_URL}/api/market/instruments")
        data = response.json()
        
        crypto = data["instruments"]["crypto"]
        assert len(crypto) > 0, "No crypto instruments"
        
        # Check for known crypto symbols
        symbols = [c[0] for c in crypto]
        assert "BTC-USD" in symbols, "BTC-USD missing"
        assert "ETH-USD" in symbols, "ETH-USD missing"
        print(f"✓ Crypto instruments: {len(crypto)} coins found")
        
    def test_indices_instruments_structure(self):
        """Test indices instruments data structure"""
        response = requests.get(f"{BASE_URL}/api/market/instruments")
        data = response.json()
        
        indices = data["instruments"]["indices"]
        assert len(indices) > 0, "No indices instruments"
        
        # Check for known index symbols
        symbols = [i[0] for i in indices]
        assert "^GSPC" in symbols, "S&P 500 missing"
        print(f"✓ Indices instruments: {len(indices)} indices found")
        
    def test_commodities_instruments_structure(self):
        """Test commodities instruments data structure"""
        response = requests.get(f"{BASE_URL}/api/market/instruments")
        data = response.json()
        
        commodities = data["instruments"]["commodities"]
        assert len(commodities) > 0, "No commodities instruments"
        
        # Check for known commodity symbols
        symbols = [c[0] for c in commodities]
        assert "GC=F" in symbols, "Gold missing"
        print(f"✓ Commodities instruments: {len(commodities)} commodities found")


class TestMarketChartEndpoint:
    """Tests for /api/market/chart/{symbol} endpoint with timeframe support"""
    
    def test_chart_data_default_timeframe(self):
        """Test chart data with default 1h timeframe"""
        response = requests.get(f"{BASE_URL}/api/market/chart/EURUSD=X")
        assert response.status_code == 200, f"Chart data failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "symbol" in data, "Missing symbol"
        assert "timeframe" in data, "Missing timeframe"
        assert "data" in data, "Missing data array"
        assert data["symbol"] == "EURUSD=X"
        print(f"✓ Chart default timeframe: {len(data.get('data', []))} candles returned")
        
    def test_chart_data_has_price_info(self):
        """Test chart data includes price statistics"""
        response = requests.get(f"{BASE_URL}/api/market/chart/EURUSD=X?timeframe=1h")
        data = response.json()
        
        # Price info should be present
        assert "current_price" in data, "Missing current_price"
        assert "change" in data, "Missing change"
        assert "change_pct" in data, "Missing change_pct"
        assert "period_high" in data, "Missing period_high"
        assert "period_low" in data, "Missing period_low"
        
        if data.get("data"):
            print(f"✓ Chart price info: current={data.get('current_price')}, change={data.get('change_pct')}%")
        else:
            print(f"⚠ Chart data empty but structure correct")
            
    def test_chart_candlestick_structure(self):
        """Test chart data candle structure for TradingView"""
        response = requests.get(f"{BASE_URL}/api/market/chart/EURUSD=X?timeframe=1h")
        data = response.json()
        
        if data.get("data") and len(data["data"]) > 0:
            candle = data["data"][0]
            # TradingView Lightweight Charts expects: time, open, high, low, close, volume
            assert "time" in candle, "Missing time"
            assert "open" in candle, "Missing open"
            assert "high" in candle, "Missing high"
            assert "low" in candle, "Missing low"
            assert "close" in candle, "Missing close"
            
            # Time should be Unix timestamp (integer)
            assert isinstance(candle["time"], int), f"Time should be integer, got {type(candle['time'])}"
            print(f"✓ Candlestick structure: Valid OHLCV with Unix timestamp")
        else:
            print(f"⚠ No candle data to verify structure")
            
    def test_timeframe_1m(self):
        """Test 1-minute timeframe"""
        response = requests.get(f"{BASE_URL}/api/market/chart/BTC-USD?timeframe=1m")
        assert response.status_code == 200
        data = response.json()
        assert data.get("timeframe") == "1m", f"Timeframe mismatch: {data.get('timeframe')}"
        print(f"✓ 1m timeframe: {len(data.get('data', []))} candles")
        
    def test_timeframe_5m(self):
        """Test 5-minute timeframe"""
        response = requests.get(f"{BASE_URL}/api/market/chart/BTC-USD?timeframe=5m")
        assert response.status_code == 200
        data = response.json()
        assert data.get("timeframe") == "5m"
        print(f"✓ 5m timeframe: {len(data.get('data', []))} candles")
        
    def test_timeframe_15m(self):
        """Test 15-minute timeframe"""
        response = requests.get(f"{BASE_URL}/api/market/chart/EURUSD=X?timeframe=15m")
        assert response.status_code == 200
        data = response.json()
        assert data.get("timeframe") == "15m"
        print(f"✓ 15m timeframe: {len(data.get('data', []))} candles")
        
    def test_timeframe_30m(self):
        """Test 30-minute timeframe"""
        response = requests.get(f"{BASE_URL}/api/market/chart/ETH-USD?timeframe=30m")
        assert response.status_code == 200
        data = response.json()
        assert data.get("timeframe") == "30m"
        print(f"✓ 30m timeframe: {len(data.get('data', []))} candles")
        
    def test_timeframe_1h(self):
        """Test 1-hour timeframe"""
        response = requests.get(f"{BASE_URL}/api/market/chart/GBPUSD=X?timeframe=1h")
        assert response.status_code == 200
        data = response.json()
        assert data.get("timeframe") == "1h"
        print(f"✓ 1h timeframe: {len(data.get('data', []))} candles")
        
    def test_timeframe_4h(self):
        """Test 4-hour timeframe (resampled from 1h)"""
        response = requests.get(f"{BASE_URL}/api/market/chart/BTC-USD?timeframe=4h")
        assert response.status_code == 200
        data = response.json()
        assert data.get("timeframe") == "4h"
        print(f"✓ 4h timeframe: {len(data.get('data', []))} candles")
        
    def test_timeframe_1d(self):
        """Test daily timeframe"""
        response = requests.get(f"{BASE_URL}/api/market/chart/GC=F?timeframe=1d")
        assert response.status_code == 200
        data = response.json()
        assert data.get("timeframe") == "1d"
        print(f"✓ 1d timeframe: {len(data.get('data', []))} candles")
        
    def test_timeframe_1w(self):
        """Test weekly timeframe"""
        response = requests.get(f"{BASE_URL}/api/market/chart/^GSPC?timeframe=1w")
        assert response.status_code == 200
        data = response.json()
        assert data.get("timeframe") == "1w"
        print(f"✓ 1w timeframe: {len(data.get('data', []))} candles")
        
    def test_chart_different_categories(self):
        """Test chart endpoint works for all instrument categories"""
        test_symbols = [
            ("EURUSD=X", "forex"),
            ("BTC-USD", "crypto"),
            ("^GSPC", "indices"),
            ("GC=F", "commodities")
        ]
        
        for symbol, category in test_symbols:
            response = requests.get(f"{BASE_URL}/api/market/chart/{symbol}?timeframe=1h")
            assert response.status_code == 200, f"Chart failed for {symbol}: {response.text}"
            data = response.json()
            assert data.get("symbol") == symbol
            print(f"✓ Chart {category} ({symbol}): {len(data.get('data', []))} candles")
            
    def test_chart_invalid_symbol(self):
        """Test chart with invalid symbol returns gracefully"""
        response = requests.get(f"{BASE_URL}/api/market/chart/INVALID_SYMBOL_XYZ?timeframe=1h")
        assert response.status_code == 200, "Should return 200 with empty data"
        data = response.json()
        # Should have structure but empty or error
        assert "symbol" in data
        if "error" in data or len(data.get("data", [])) == 0:
            print(f"✓ Invalid symbol handling: Graceful response")
        else:
            print(f"⚠ Invalid symbol returned unexpected data")


class TestMarketOverview:
    """Tests for /api/market/overview endpoint"""
    
    def test_overview_success(self):
        """Test market overview returns data"""
        response = requests.get(f"{BASE_URL}/api/market/overview")
        assert response.status_code == 200, f"Overview failed: {response.text}"
        data = response.json()
        
        assert "prices" in data, "Missing prices"
        assert "sessions" in data, "Missing sessions"
        assert "timestamp" in data, "Missing timestamp"
        print(f"✓ Market overview: Structure verified")
        
    def test_overview_sessions(self):
        """Test trading sessions data"""
        response = requests.get(f"{BASE_URL}/api/market/overview")
        data = response.json()
        
        sessions = data.get("sessions", [])
        assert isinstance(sessions, list), "Sessions should be list"
        
        if len(sessions) > 0:
            session = sessions[0]
            assert "name" in session, "Session missing name"
            assert "status" in session, "Session missing status"
            print(f"✓ Trading sessions: {len(sessions)} sessions, first: {session.get('name')}")
        else:
            print(f"⚠ No active sessions (may be between sessions)")
            
    def test_overview_price_categories(self):
        """Test price categories in overview"""
        response = requests.get(f"{BASE_URL}/api/market/overview")
        data = response.json()
        
        prices = data.get("prices", {})
        assert "forex" in prices, "Missing forex prices"
        assert "crypto" in prices, "Missing crypto prices"
        assert "metals" in prices, "Missing metals prices"
        
        for category in ["forex", "crypto", "metals"]:
            items = prices.get(category, [])
            if len(items) > 0:
                item = items[0]
                assert "symbol" in item
                assert "price" in item
                assert "change" in item
                print(f"✓ {category.title()} prices: {len(items)} items")


class TestWatchlistIntegration:
    """Tests for watchlist functionality with market instruments"""
    
    def test_add_to_watchlist(self, auth_token):
        """Test adding market instrument to watchlist"""
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        
        payload = {
            "symbol": "EURUSD=X",
            "name": "EUR/USD",
            "asset_type": "forex"
        }
        
        response = requests.post(f"{BASE_URL}/api/watchlist", json=payload, headers=headers)
        assert response.status_code == 200, f"Add to watchlist failed: {response.text}"
        
        data = response.json()
        # Either new addition or already exists
        assert "id" in data or data.get("already_exists") == True
        print(f"✓ Add to watchlist: SUCCESS")
        
    def test_get_watchlist(self, auth_token):
        """Test getting watchlist with prices"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/watchlist", headers=headers)
        assert response.status_code == 200, f"Get watchlist failed: {response.text}"
        
        data = response.json()
        assert "watchlist" in data
        
        watchlist = data["watchlist"]
        if len(watchlist) > 0:
            item = watchlist[0]
            assert "symbol" in item
            assert "price" in item or item.get("price") == 0
            print(f"✓ Watchlist: {len(watchlist)} items with prices")
        else:
            print(f"✓ Watchlist: Empty (no items added)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
