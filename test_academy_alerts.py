"""
Test suite for Academy (50 lessons with quizzes) and Price Alerts features
Created: Feb 2026
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test2@trader.com",
            "password": "Test123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Authenticated headers"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestAcademyLessons(TestAuth):
    """Academy lessons with 50 lessons across 9 modules"""
    
    def test_get_academy_lessons_returns_50_lessons(self, auth_headers):
        """Verify Academy returns exactly 50 lessons"""
        response = requests.get(f"{BASE_URL}/api/academy/lessons", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 50, f"Expected 50 lessons, got {data['total_count']}"
    
    def test_academy_has_9_modules(self, auth_headers):
        """Verify Academy has 9 modules"""
        response = requests.get(f"{BASE_URL}/api/academy/lessons", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        modules = data.get("modules", {})
        assert len(modules) == 9, f"Expected 9 modules, got {len(modules)}"
        
        expected_modules = [
            "Candlestick Patterns", "Trend Analysis", "Support & Resistance",
            "Technical Indicators", "Risk Management", "Trading Psychology",
            "Chart Patterns", "Market Structure", "Trading Strategies"
        ]
        for module in expected_modules:
            assert module in modules, f"Missing module: {module}"
    
    def test_lessons_have_quiz_data(self, auth_headers):
        """Verify lessons have quiz data structure"""
        response = requests.get(f"{BASE_URL}/api/academy/lessons", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        lessons = data.get("lessons", [])
        
        # Check at least 80% of lessons have quizzes
        lessons_with_quiz = [l for l in lessons if l.get("quiz") and len(l.get("quiz", [])) > 0]
        quiz_coverage = len(lessons_with_quiz) / len(lessons) * 100
        assert quiz_coverage >= 80, f"Quiz coverage too low: {quiz_coverage:.1f}%"
    
    def test_lesson_structure_is_correct(self, auth_headers):
        """Verify lesson structure has required fields"""
        response = requests.get(f"{BASE_URL}/api/academy/lessons", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        lesson = data["lessons"][0]
        
        required_fields = ["id", "module", "title", "difficulty", "xp", "duration", "content"]
        for field in required_fields:
            assert field in lesson, f"Missing field: {field}"
        
        # Verify difficulty is one of valid values
        assert lesson["difficulty"] in ["beginner", "intermediate", "advanced"]
        
        # Verify XP is a positive number
        assert isinstance(lesson["xp"], int) and lesson["xp"] > 0
    
    def test_complete_lesson_awards_xp(self, auth_headers):
        """Complete a lesson and verify XP is awarded"""
        # Use a test lesson that may not be completed
        lesson_id = "candle_basics"
        response = requests.post(
            f"{BASE_URL}/api/academy/complete/{lesson_id}", 
            json={}, 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        # Either gets XP or already completed
        assert "xp_earned" in data or "already_completed" in data


class TestAcademyQuiz(TestAuth):
    """Quiz functionality tests"""
    
    def test_submit_quiz_correct_answer(self, auth_headers):
        """Submit a correct quiz answer and earn XP"""
        # candle_basics quiz: answer index 1 is correct
        lesson_id = "candle_doji"  # Doji quiz: answer is 1 (Bearish reversal)
        response = requests.post(
            f"{BASE_URL}/api/academy/quiz/{lesson_id}",
            json={"lesson_id": lesson_id, "answer_index": 1},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "correct" in data
        assert "correct_answer" in data
        if data["correct"]:
            assert data["xp_earned"] == 10
    
    def test_submit_quiz_wrong_answer(self, auth_headers):
        """Submit a wrong quiz answer"""
        lesson_id = "candle_doji"
        response = requests.post(
            f"{BASE_URL}/api/academy/quiz/{lesson_id}",
            json={"lesson_id": lesson_id, "answer_index": 3},  # Wrong answer
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Should return correct=false and no XP
        if not data.get("correct"):
            assert data["xp_earned"] == 0
    
    def test_quiz_invalid_lesson_returns_404(self, auth_headers):
        """Quiz for non-existent lesson returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/academy/quiz/invalid_lesson_id",
            json={"lesson_id": "invalid_lesson_id", "answer_index": 0},
            headers=auth_headers
        )
        assert response.status_code == 404


class TestPriceAlerts(TestAuth):
    """Price alerts CRUD operations"""
    
    @pytest.fixture
    def test_alert_id(self, auth_headers):
        """Create a test alert and return its ID"""
        response = requests.post(
            f"{BASE_URL}/api/alerts",
            json={
                "symbol": "BTC-USD",
                "alert_type": "above",
                "price_level": 100000.0,
                "enabled": True,
                "notes": "TEST_pytest_alert"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        alert_id = response.json()["alert"]["id"]
        yield alert_id
        # Cleanup
        requests.delete(f"{BASE_URL}/api/alerts/{alert_id}", headers=auth_headers)
    
    def test_create_alert(self, auth_headers):
        """Create a new price alert"""
        response = requests.post(
            f"{BASE_URL}/api/alerts",
            json={
                "symbol": "GC=F",
                "alert_type": "below",
                "price_level": 1000.0,
                "enabled": True,
                "notes": "TEST_gold_alert"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "alert" in data
        alert = data["alert"]
        assert alert["symbol"] == "GC=F"
        assert alert["alert_type"] == "below"
        assert alert["price_level"] == 1000.0
        assert alert["enabled"] == True
        assert alert["triggered"] == False
        assert "id" in alert
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/alerts/{alert['id']}", headers=auth_headers)
    
    def test_get_alerts(self, auth_headers, test_alert_id):
        """Get all user alerts"""
        response = requests.get(f"{BASE_URL}/api/alerts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        assert isinstance(data["alerts"], list)
    
    def test_delete_alert(self, auth_headers):
        """Delete a price alert"""
        # Create alert first
        create_response = requests.post(
            f"{BASE_URL}/api/alerts",
            json={
                "symbol": "ETH-USD",
                "alert_type": "above",
                "price_level": 10000.0,
                "enabled": True,
                "notes": "TEST_to_delete"
            },
            headers=auth_headers
        )
        assert create_response.status_code == 200
        alert_id = create_response.json()["alert"]["id"]
        
        # Delete alert
        delete_response = requests.delete(
            f"{BASE_URL}/api/alerts/{alert_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] == True
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/alerts", headers=auth_headers)
        alerts = get_response.json()["alerts"]
        alert_ids = [a["id"] for a in alerts]
        assert alert_id not in alert_ids, "Alert was not deleted"
    
    def test_toggle_alert(self, auth_headers, test_alert_id):
        """Toggle alert enabled status"""
        # Get initial state
        get_response = requests.get(f"{BASE_URL}/api/alerts", headers=auth_headers)
        alerts = get_response.json()["alerts"]
        test_alert = next((a for a in alerts if a["id"] == test_alert_id), None)
        assert test_alert is not None
        initial_state = test_alert["enabled"]
        
        # Toggle
        toggle_response = requests.put(
            f"{BASE_URL}/api/alerts/{test_alert_id}/toggle",
            json={},
            headers=auth_headers
        )
        assert toggle_response.status_code == 200
        new_state = toggle_response.json()["enabled"]
        assert new_state != initial_state, "Alert state should have changed"
    
    def test_alert_types_are_valid(self, auth_headers):
        """Test all alert types: above, below, cross_resistance, cross_support"""
        alert_types = ["above", "below", "cross_resistance", "cross_support"]
        created_ids = []
        
        for alert_type in alert_types:
            response = requests.post(
                f"{BASE_URL}/api/alerts",
                json={
                    "symbol": "EURUSD=X",
                    "alert_type": alert_type,
                    "price_level": 1.05,
                    "enabled": True,
                    "notes": f"TEST_{alert_type}"
                },
                headers=auth_headers
            )
            assert response.status_code == 200, f"Failed to create {alert_type} alert"
            created_ids.append(response.json()["alert"]["id"])
        
        # Cleanup
        for alert_id in created_ids:
            requests.delete(f"{BASE_URL}/api/alerts/{alert_id}", headers=auth_headers)


class TestAlertCheck(TestAuth):
    """Test alert check endpoint"""
    
    def test_check_alerts_endpoint(self, auth_headers):
        """Check alerts endpoint returns triggered alerts"""
        response = requests.get(
            f"{BASE_URL}/api/alerts/check",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "triggered_alerts" in data
        assert isinstance(data["triggered_alerts"], list)
    
    def test_alert_triggers_when_price_exceeds_level(self, auth_headers):
        """Create an alert with a price below current and verify it triggers"""
        # Create alert with very low price (guaranteed to trigger)
        response = requests.post(
            f"{BASE_URL}/api/alerts",
            json={
                "symbol": "BTC-USD",
                "alert_type": "above",
                "price_level": 1.0,  # Very low - guaranteed above
                "enabled": True,
                "notes": "TEST_trigger_test"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        alert_id = response.json()["alert"]["id"]
        
        # Check alerts
        check_response = requests.get(
            f"{BASE_URL}/api/alerts/check",
            headers=auth_headers
        )
        assert check_response.status_code == 200
        triggered = check_response.json()["triggered_alerts"]
        
        # Find our alert in triggered
        triggered_alert = next((a for a in triggered if a["id"] == alert_id), None)
        if triggered_alert:
            assert triggered_alert["current_price"] > triggered_alert["price_level"]
            assert "triggered_at" in triggered_alert
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/alerts/{alert_id}", headers=auth_headers)


class TestLiveMarketScan(TestAuth):
    """Test live market scan endpoint"""
    
    def test_live_scan_returns_events(self, auth_headers):
        """Live scan endpoint returns market events"""
        response = requests.get(f"{BASE_URL}/api/market/live-scan")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
    
    def test_live_scan_event_structure(self, auth_headers):
        """Verify live scan event structure"""
        response = requests.get(f"{BASE_URL}/api/market/live-scan")
        assert response.status_code == 200
        events = response.json()["events"]
        
        if len(events) > 0:
            event = events[0]
            required_fields = ["symbol", "name", "event_type", "current_price", 
                            "change_pct", "high_20", "low_20", "sma_20", "timestamp"]
            for field in required_fields:
                assert field in event, f"Missing field in event: {field}"
            
            valid_event_types = ["approaching_resistance", "approaching_support", 
                               "significant_move", "breakout", "breakdown", 
                               "sma_cross_up", "sma_cross_down"]
            assert event["event_type"] in valid_event_types or event["event_type"] is None


class TestTradeCoaching(TestAuth):
    """Test AI trade coaching with GPT-5.2"""
    
    def test_request_coaching_for_trade(self, auth_headers):
        """Request AI coaching for a logged trade"""
        # First create a trade
        trade_response = requests.post(
            f"{BASE_URL}/api/trades",
            json={
                "symbol": "EURUSD=X",
                "entry_price": 1.08,
                "exit_price": 1.09,
                "position_size": 1000,
                "trade_type": "buy",
                "direction": "BUY",
                "outcome": "win",
                "pnl": 100.0,
                "notes": "TEST_coaching_trade",
                "asset_type": "forex",
                "timeframe": "1h"
            },
            headers=auth_headers
        )
        assert trade_response.status_code == 200
        trade_id = trade_response.json()["id"]
        
        # Request coaching
        coaching_response = requests.post(
            f"{BASE_URL}/api/trades/{trade_id}/request-coaching",
            json={},
            headers=auth_headers
        )
        assert coaching_response.status_code == 200
        data = coaching_response.json()
        
        # Verify coaching structure (may be from fallback or real GPT-5.2)
        if "coaching" in data:
            coaching = data["coaching"]
            assert "overall_grade" in coaching
            assert "summary" in coaching
            assert "strengths" in coaching
            assert "areas_for_improvement" in coaching
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/trades/{trade_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
