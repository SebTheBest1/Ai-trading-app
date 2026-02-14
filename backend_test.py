#!/usr/bin/env python3
"""
TradeAI Pro Backend API Testing Suite
Tests all backend endpoints systematically
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class TradeAIAPITester:
    def __init__(self, base_url="https://signal-engine-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.test_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def log_test(self, name: str, passed: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "passed": passed,
            "details": details,
            "response_data": response_data
        }
        self.results.append(result)
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}: {details}")
        return passed, response_data

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                if response.content:
                    response_data = response.json()
            except:
                response_data = {"raw_content": response.text[:200]}

            details = f"Status: {response.status_code} (expected {expected_status})"
            if not success:
                details += f", Response: {response_data}"

            return self.log_test(name, success, details, response_data)

        except Exception as e:
            return self.log_test(name, False, f"Error: {str(e)}")

    def test_user_registration(self):
        """Test user registration with test credentials"""
        timestamp = datetime.now().strftime("%H%M%S")
        test_data = {
            "username": "tester1", 
            "email": "tester1@test.com",
            "password": "test123",
            "trader_type": "swing"
        }
        
        success, response = self.run_test(
            "User Registration", 
            "POST", 
            "auth/register", 
            200,
            data=test_data
        )
        
        if success and response and 'token' in response:
            self.token = response['token']
            if 'user' in response:
                self.test_user_id = response['user'].get('id')
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": "tester1@test.com", "password": "test123"}
        )
        
        if success and response and 'token' in response:
            self.token = response['token']
            if 'user' in response:
                self.test_user_id = response['user'].get('id')
            return True
        return False

    def test_user_profile(self):
        """Test getting user profile"""
        return self.run_test("Get User Profile", "GET", "auth/me", 200)[0]

    def test_market_data(self):
        """Test market data endpoints"""
        # Test price endpoint
        self.run_test("Get EURUSD Price", "GET", "market/price/EURUSD=X", 200)
        
        # Test market overview
        return self.run_test("Market Overview", "GET", "market/overview", 200)[0]

    def test_ai_analysis(self):
        """Test AI analysis functionality"""
        analysis_data = {
            "symbol": "EURUSD=X",
            "timeframe": "1h",
            "asset_type": "forex",
            "trader_type": "swing"
        }
        
        success, response = self.run_test(
            "AI Analysis", 
            "POST", 
            "analysis/run", 
            200,
            data=analysis_data
        )
        
        # Test analysis history
        self.run_test("Analysis History", "GET", "analysis/history", 200)
        
        return success

    def test_trade_journal(self):
        """Test trade journal functionality"""
        # Create a trade
        trade_data = {
            "symbol": "EURUSD",
            "entry_price": 1.0850,
            "position_size": 1.0,
            "trade_type": "buy",
            "outcome": "tp_hit",
            "exit_price": 1.0900,
            "pnl": 50.0,
            "asset_type": "forex",
            "timeframe": "1h"
        }
        
        success, response = self.run_test(
            "Create Trade",
            "POST",
            "trades",
            200,
            data=trade_data
        )
        
        trade_id = None
        if success and response:
            trade_id = response.get('id')
        
        # Get trades
        self.run_test("Get Trades", "GET", "trades", 200)
        
        # Update trade if created successfully
        if trade_id:
            updated_trade = trade_data.copy()
            updated_trade["pnl"] = 75.0
            self.run_test("Update Trade", "PUT", f"trades/{trade_id}", 200, data=updated_trade)
        
        return success

    def test_goals(self):
        """Test goals functionality"""
        goal_data = {
            "title": "Monthly Target",
            "target_profit": 500.0,
            "description": "Test goal for monthly profit"
        }
        
        success, response = self.run_test(
            "Create Goal",
            "POST", 
            "goals",
            200,
            data=goal_data
        )
        
        goal_id = None
        if success and response:
            goal_id = response.get('id')
        
        # Get goals
        self.run_test("Get Goals", "GET", "goals", 200)
        
        return success

    def test_signals(self):
        """Test signals functionality"""
        # Generate signals
        success, response = self.run_test(
            "Generate Signals",
            "POST",
            "signals/generate", 
            200
        )
        
        # Get signals
        self.run_test("Get Signals", "GET", "signals", 200)
        
        return success

    def test_challenges(self):
        """Test challenges and gamification"""
        # Get challenges
        success, response = self.run_test("Get Challenges", "GET", "challenges", 200)
        
        # Try to complete a challenge (this might fail if already completed)
        challenge_data = {"challenge_id": "log_trade"}
        self.run_test("Complete Challenge", "POST", "challenges/complete", 200, data=challenge_data)
        
        return success

    def test_academy(self):
        """Test academy functionality"""
        # Get lessons
        success, response = self.run_test("Get Academy Lessons", "GET", "academy/lessons", 200)
        
        # Try to complete a lesson
        self.run_test("Complete Lesson", "POST", "academy/complete/candle_basics", 200)
        
        return success

    def test_analytics(self):
        """Test analytics endpoint"""
        return self.run_test("Get Analytics", "GET", "analytics", 200)[0]

    def test_profile_endpoint(self):
        """Test profile endpoint"""
        return self.run_test("Get Profile", "GET", "profile", 200)[0]

    def run_all_tests(self):
        """Run comprehensive API test suite"""
        print("🚀 Starting TradeAI Pro API Test Suite...")
        print("=" * 60)
        
        # Core Authentication Tests
        print("\n📝 Testing Authentication...")
        if not self.test_user_registration():
            print("⚠️  Registration failed, trying login...")
            if not self.test_user_login():
                print("❌ Cannot authenticate - stopping tests")
                return False
        
        self.test_user_profile()
        
        # Market Data Tests  
        print("\n📊 Testing Market Data...")
        self.test_market_data()
        
        # AI Analysis Tests
        print("\n🤖 Testing AI Analysis...")  
        self.test_ai_analysis()
        
        # Trade Journal Tests
        print("\n📖 Testing Trade Journal...")
        self.test_trade_journal()
        
        # Goals Tests
        print("\n🎯 Testing Goals...")
        self.test_goals()
        
        # Signals Tests
        print("\n📡 Testing Signals...")
        self.test_signals()
        
        # Challenges Tests
        print("\n🏆 Testing Challenges...")
        self.test_challenges()
        
        # Academy Tests
        print("\n🎓 Testing Academy...")
        self.test_academy()
        
        # Analytics Tests
        print("\n📈 Testing Analytics...")
        self.test_analytics()
        
        # Profile Tests
        print("\n👤 Testing Profile...")
        self.test_profile_endpoint()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        pass_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Pass Rate: {pass_rate:.1f}%")
        
        # Show failed tests
        failed_tests = [r for r in self.results if not r['passed']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  • {test['test_name']}: {test['details']}")
        
        print(f"\n🎯 Overall Result: {'PASS' if pass_rate >= 80 else 'FAIL'}")
        return pass_rate

def main():
    """Main test execution"""
    tester = TradeAIAPITester()
    
    try:
        success = tester.run_all_tests()
        pass_rate = tester.print_summary()
        
        # Save detailed results
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'summary': {
                    'tests_run': tester.tests_run,
                    'tests_passed': tester.tests_passed,
                    'pass_rate': pass_rate
                },
                'results': tester.results
            }, f, indent=2)
        
        return 0 if pass_rate >= 80 else 1
        
    except KeyboardInterrupt:
        print("\n⚡ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())