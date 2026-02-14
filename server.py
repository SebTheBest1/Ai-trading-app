from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
import jwt
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback_secret')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Models ---
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    trader_type: str = "swing"

class UserLogin(BaseModel):
    email: str
    password: str

class TradeLog(BaseModel):
    symbol: str
    entry_price: float
    position_size: float
    tp1: Optional[float] = None
    tp2: Optional[float] = None
    tp3: Optional[float] = None
    sl: Optional[float] = None
    trade_type: str = "buy"
    direction: Optional[str] = "BUY"
    outcome: Optional[str] = None
    exit_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    pnl: Optional[float] = None
    notes: Optional[str] = ""
    asset_type: str = "forex"
    timeframe: str = "1h"

class GoalCreate(BaseModel):
    title: str
    target_profit: float
    deadline: Optional[str] = None
    description: Optional[str] = ""

class AnalysisRequest(BaseModel):
    symbol: str
    timeframe: str = "1h"
    current_price: Optional[float] = None
    position_size: Optional[float] = None
    asset_type: str = "forex"
    trader_type: str = "swing"

class SignalSettings(BaseModel):
    min_confidence: int = 70
    asset_types: List[str] = ["forex", "crypto", "metals"]
    sound_enabled: bool = True

class ChallengeAction(BaseModel):
    challenge_id: str

class UserSettings(BaseModel):
    notifications_enabled: bool = True
    sound_enabled: bool = True
    signal_frequency: str = "normal"
    theme: str = "dark"
    ai_aggressiveness: str = "balanced"
    risk_profile: str = "swing"

class WatchlistAdd(BaseModel):
    symbol: str
    name: str
    asset_type: str = "forex"

class AnalysisFeedback(BaseModel):
    worked: bool
    notes: Optional[str] = ""

class ChartUploadRequest(BaseModel):
    image_base64: str
    market_type: str = "forex"
    timeframe: str = "1h"
    pair_name: Optional[str] = ""

# --- Auth Helpers ---
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: str, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Auth Routes ---
@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": data.username,
        "email": data.email,
        "password": hash_password(data.password),
        "trader_type": data.trader_type,
        "xp": 0,
        "level": 1,
        "streak": 0,
        "best_streak": 0,
        "last_active": datetime.now(timezone.utc).isoformat(),
        "achievements": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, data.username)
    return {"token": token, "user": {"id": user_id, "username": data.username, "email": data.email, "trader_type": data.trader_type, "xp": 0, "level": 1, "streak": 0}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or user["password"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Update streak
    now = datetime.now(timezone.utc)
    last_active = datetime.fromisoformat(user.get("last_active", now.isoformat()))
    diff = (now - last_active).days
    streak = user.get("streak", 0)
    if diff == 1:
        streak += 1
    elif diff > 1:
        streak = 1
    best_streak = max(user.get("best_streak", 0), streak)
    await db.users.update_one({"id": user["id"]}, {"$set": {"streak": streak, "best_streak": best_streak, "last_active": now.isoformat()}})
    token = create_token(user["id"], user["username"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "email": user["email"], "trader_type": user.get("trader_type", "swing"), "xp": user.get("xp", 0), "level": user.get("level", 1), "streak": streak, "best_streak": best_streak, "achievements": user.get("achievements", [])}}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    u = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "password": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u

# --- XP Helper ---
async def add_xp(user_id: str, amount: int):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    new_xp = user.get("xp", 0) + amount
    new_level = 1 + new_xp // 500
    await db.users.update_one({"id": user_id}, {"$set": {"xp": new_xp, "level": new_level}})

# --- Market Data ---
# Full instrument list for Markets page
MARKET_INSTRUMENTS = {
    "forex": [
        ("EURUSD=X", "EUR/USD", "Euro / US Dollar"),
        ("GBPUSD=X", "GBP/USD", "British Pound / US Dollar"),
        ("USDJPY=X", "USD/JPY", "US Dollar / Japanese Yen"),
        ("AUDUSD=X", "AUD/USD", "Australian Dollar / US Dollar"),
        ("USDCAD=X", "USD/CAD", "US Dollar / Canadian Dollar"),
        ("USDCHF=X", "USD/CHF", "US Dollar / Swiss Franc"),
        ("NZDUSD=X", "NZD/USD", "New Zealand Dollar / US Dollar"),
        ("EURGBP=X", "EUR/GBP", "Euro / British Pound"),
        ("EURJPY=X", "EUR/JPY", "Euro / Japanese Yen"),
        ("GBPJPY=X", "GBP/JPY", "British Pound / Japanese Yen"),
    ],
    "crypto": [
        ("BTC-USD", "BTC/USD", "Bitcoin"),
        ("ETH-USD", "ETH/USD", "Ethereum"),
        ("SOL-USD", "SOL/USD", "Solana"),
        ("XRP-USD", "XRP/USD", "Ripple"),
        ("ADA-USD", "ADA/USD", "Cardano"),
        ("DOGE-USD", "DOGE/USD", "Dogecoin"),
        ("DOT-USD", "DOT/USD", "Polkadot"),
        ("AVAX-USD", "AVAX/USD", "Avalanche"),
    ],
    "indices": [
        ("^GSPC", "S&P 500", "S&P 500 Index"),
        ("^DJI", "Dow Jones", "Dow Jones Industrial Average"),
        ("^IXIC", "NASDAQ", "NASDAQ Composite"),
        ("^FTSE", "FTSE 100", "FTSE 100 Index"),
        ("^GDAXI", "DAX", "German DAX Index"),
        ("^N225", "Nikkei 225", "Nikkei 225 Index"),
    ],
    "commodities": [
        ("GC=F", "Gold", "Gold Futures"),
        ("SI=F", "Silver", "Silver Futures"),
        ("CL=F", "Crude Oil", "WTI Crude Oil Futures"),
        ("NG=F", "Natural Gas", "Natural Gas Futures"),
        ("PL=F", "Platinum", "Platinum Futures"),
        ("HG=F", "Copper", "Copper Futures"),
    ],
}

@api_router.get("/market/instruments")
async def get_instruments():
    """Get all available instruments for the Markets page"""
    return {"instruments": MARKET_INSTRUMENTS}

@api_router.get("/market/chart/{symbol}")
async def get_chart_data(symbol: str, timeframe: str = "1h"):
    """Get chart data for a specific symbol with timeframe"""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        
        # Map timeframe to yfinance parameters
        tf_map = {
            "1m": ("1d", "1m"),
            "5m": ("5d", "5m"),
            "15m": ("5d", "15m"),
            "30m": ("10d", "30m"),
            "1h": ("1mo", "1h"),
            "4h": ("3mo", "1h"),  # yfinance doesn't support 4h, we'll resample
            "1d": ("1y", "1d"),
            "1w": ("5y", "1wk"),
        }
        
        period, interval = tf_map.get(timeframe, ("1mo", "1h"))
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            return {"symbol": symbol, "timeframe": timeframe, "data": [], "error": "No data available"}
        
        # For 4h, we need to resample from 1h data
        if timeframe == "4h" and not hist.empty:
            hist = hist.resample('4h').agg({
                'Open': 'first',
                'High': 'max',
                'Low': 'min',
                'Close': 'last',
                'Volume': 'sum'
            }).dropna()
        
        data = []
        for idx, row in hist.iterrows():
            # TradingView Lightweight Charts expects Unix timestamp
            timestamp = int(idx.timestamp())
            data.append({
                "time": timestamp,
                "open": round(float(row['Open']), 5),
                "high": round(float(row['High']), 5),
                "low": round(float(row['Low']), 5),
                "close": round(float(row['Close']), 5),
                "volume": float(row['Volume'])
            })
        
        # Get current price info
        current = float(hist['Close'].iloc[-1])
        prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
        change = current - prev_close
        change_pct = (change / prev_close * 100) if prev_close != 0 else 0
        
        # Get high/low for the period
        period_high = float(hist['High'].max())
        period_low = float(hist['Low'].min())
        
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "data": data,
            "current_price": round(current, 5),
            "change": round(change, 5),
            "change_pct": round(change_pct, 2),
            "period_high": round(period_high, 5),
            "period_low": round(period_low, 5),
            "volume": float(hist['Volume'].iloc[-1]) if 'Volume' in hist.columns else 0
        }
    except Exception as e:
        logger.error(f"Chart data error for {symbol}: {e}")
        return {"symbol": symbol, "timeframe": timeframe, "data": [], "error": str(e)}

@api_router.get("/market/price/{symbol}")
async def get_price(symbol: str):
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5d", interval="1h")
        if hist.empty:
            return {"symbol": symbol, "price": 0, "change": 0, "data": []}
        current = float(hist['Close'].iloc[-1])
        prev = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current
        change_pct = ((current - prev) / prev) * 100
        data = []
        for idx, row in hist.tail(50).iterrows():
            data.append({"time": idx.isoformat(), "open": float(row['Open']), "high": float(row['High']), "low": float(row['Low']), "close": float(row['Close']), "volume": float(row['Volume'])})
        return {"symbol": symbol, "price": round(current, 5), "change": round(change_pct, 2), "data": data}
    except Exception as e:
        logger.error(f"Market data error: {e}")
        return {"symbol": symbol, "price": 0, "change": 0, "data": [], "error": str(e)}

@api_router.get("/market/overview")
async def market_overview():
    symbols = {
        "forex": [("EURUSD=X", "EUR/USD"), ("GBPUSD=X", "GBP/USD"), ("USDJPY=X", "USD/JPY")],
        "crypto": [("BTC-USD", "BTC/USD"), ("ETH-USD", "ETH/USD"), ("SOL-USD", "SOL/USD")],
        "metals": [("GC=F", "Gold"), ("SI=F", "Silver"), ("PL=F", "Platinum")]
    }
    results = {}
    import yfinance as yf
    for category, pairs in symbols.items():
        cat_results = []
        for sym, name in pairs:
            try:
                t = yf.Ticker(sym)
                h = t.history(period="2d")
                if not h.empty:
                    price = float(h['Close'].iloc[-1])
                    prev = float(h['Close'].iloc[0])
                    change = ((price - prev) / prev) * 100
                    cat_results.append({"symbol": sym, "name": name, "price": round(price, 5), "change": round(change, 2)})
            except Exception:
                cat_results.append({"symbol": sym, "name": name, "price": 0, "change": 0})
        results[category] = cat_results
    # Sessions
    now = datetime.now(timezone.utc)
    hour = now.hour
    sessions = []
    if 0 <= hour < 9:
        sessions.append({"name": "Tokyo", "status": "active", "hours": "00:00 - 09:00 UTC"})
    if 7 <= hour < 16:
        sessions.append({"name": "London", "status": "active", "hours": "07:00 - 16:00 UTC"})
    if 13 <= hour < 22:
        sessions.append({"name": "New York", "status": "active", "hours": "13:00 - 22:00 UTC"})
    if 21 <= hour or hour < 6:
        sessions.append({"name": "Sydney", "status": "active", "hours": "21:00 - 06:00 UTC"})
    if not sessions:
        sessions = [{"name": "Inter-session", "status": "transitioning", "hours": "Between sessions"}]
    return {"prices": results, "sessions": sessions, "timestamp": now.isoformat()}

# --- AI Analysis ---
@api_router.post("/analysis/run")
async def run_analysis(data: AnalysisRequest, user=Depends(get_current_user)):
    try:
        import yfinance as yf
        ticker = yf.Ticker(data.symbol)
        period_map = {"1m": "7d", "5m": "5d", "15m": "5d", "1h": "1mo", "4h": "3mo", "1d": "6mo", "1w": "2y"}
        period = period_map.get(data.timeframe, "1mo")
        interval_map = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "1h", "1d": "1d", "1w": "1wk"}
        interval = interval_map.get(data.timeframe, "1h")
        hist = ticker.history(period=period, interval=interval)
        if hist.empty:
            raise HTTPException(status_code=400, detail="No data available for this symbol")
        
        prices = hist['Close'].tolist()
        highs = hist['High'].tolist()
        lows = hist['Low'].tolist()
        current_price = data.current_price or float(prices[-1])
        
        # Calculate indicators
        sma_20 = sum(prices[-20:]) / min(20, len(prices)) if len(prices) >= 5 else current_price
        sma_50 = sum(prices[-50:]) / min(50, len(prices)) if len(prices) >= 5 else current_price
        
        # RSI
        gains, losses = [], []
        for i in range(1, min(15, len(prices))):
            diff = prices[-i] - prices[-i-1]
            if diff > 0:
                gains.append(diff)
            else:
                losses.append(abs(diff))
        avg_gain = sum(gains) / 14 if gains else 0.001
        avg_loss = sum(losses) / 14 if losses else 0.001
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        # MACD
        ema12 = sum(prices[-12:]) / min(12, len(prices))
        ema26 = sum(prices[-26:]) / min(26, len(prices))
        macd = ema12 - ema26
        
        # Bollinger Bands
        import math
        window = prices[-20:] if len(prices) >= 20 else prices
        mean = sum(window) / len(window)
        variance = sum((x - mean) ** 2 for x in window) / len(window)
        std = math.sqrt(variance)
        bb_upper = mean + 2 * std
        bb_lower = mean - 2 * std
        
        # Support & Resistance
        recent_lows = sorted(lows[-20:])[:3] if len(lows) >= 5 else [current_price * 0.98]
        recent_highs = sorted(highs[-20:], reverse=True)[:3] if len(highs) >= 5 else [current_price * 1.02]
        support = round(sum(recent_lows) / len(recent_lows), 5)
        resistance = round(sum(recent_highs) / len(recent_highs), 5)
        
        chart_data = []
        for i, idx in enumerate(hist.index[-30:]):
            chart_data.append({"time": idx.isoformat(), "open": round(float(hist['Open'].iloc[-(30-i)]), 5), "high": round(float(hist['High'].iloc[-(30-i)]), 5), "low": round(float(hist['Low'].iloc[-(30-i)]), 5), "close": round(float(hist['Close'].iloc[-(30-i)]), 5)})
        
        indicators = {
            "rsi": round(rsi, 2),
            "macd": round(macd, 5),
            "sma_20": round(sma_20, 5),
            "sma_50": round(sma_50, 5),
            "bb_upper": round(bb_upper, 5),
            "bb_lower": round(bb_lower, 5),
            "support": support,
            "resistance": resistance,
            "current_price": round(current_price, 5)
        }
        
        # AI Analysis with GPT-5.2
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"analysis-{uuid.uuid4()}",
            system_message="""You are an expert trading analyst specializing in forex, crypto, and metals. You analyze charts using technical analysis including candlestick patterns, trend detection, support/resistance, moving averages, RSI, MACD, Bollinger Bands, and advanced pattern recognition. Always provide structured, actionable trading recommendations. Be specific with price levels. You must respond in valid JSON format only."""
        )
        chat.with_model("openai", "gpt-5.2")
        
        prompt = f"""Analyze this {data.asset_type} pair: {data.symbol}
Timeframe: {data.timeframe}
Trader Type: {data.trader_type}
Current Price: {current_price}
Position Size: {data.position_size or 'Not specified'}

Technical Indicators:
- RSI(14): {indicators['rsi']}
- MACD: {indicators['macd']}
- SMA 20: {indicators['sma_20']}
- SMA 50: {indicators['sma_50']}
- Bollinger Upper: {indicators['bb_upper']}
- Bollinger Lower: {indicators['bb_lower']}
- Key Support: {indicators['support']}
- Key Resistance: {indicators['resistance']}

Recent price action (last 10 closes): {[round(p, 5) for p in prices[-10:]]}
Recent highs: {[round(h, 5) for h in highs[-10:]]}
Recent lows: {[round(low, 5) for low in lows[-10:]]}

Provide analysis in this exact JSON format:
{{
  "recommendation": "BUY" or "SELL" or "HOLD",
  "confidence": 0-100,
  "tp1": price_level,
  "tp2": price_level,
  "tp3": price_level,
  "sl": price_level,
  "risk_reward": "ratio like 1:2.5",
  "patterns_detected": ["list of detected patterns"],
  "trend": "BULLISH" or "BEARISH" or "SIDEWAYS",
  "key_levels": {{"support": [levels], "resistance": [levels]}},
  "explanation": "Detailed analysis explanation",
  "entry_zone": "price range for entry",
  "timeframe_bias": "short-term outlook",
  "advanced_patterns": ["harmonic patterns, market structure etc"],
  "volume_analysis": "volume assessment",
  "momentum": "momentum assessment"
}}"""
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse AI response
        try:
            resp_text = response.strip()
            if resp_text.startswith("```"):
                resp_text = resp_text.split("\n", 1)[1].rsplit("```", 1)[0]
            ai_result = json.loads(resp_text)
        except Exception:
            ai_result = {
                "recommendation": "HOLD",
                "confidence": 50,
                "tp1": round(current_price * 1.01, 5),
                "tp2": round(current_price * 1.02, 5),
                "tp3": round(current_price * 1.03, 5),
                "sl": round(current_price * 0.99, 5),
                "risk_reward": "1:2",
                "patterns_detected": ["Analysis pending"],
                "trend": "SIDEWAYS",
                "explanation": response[:500] if response else "Analysis completed",
                "entry_zone": f"{round(current_price * 0.999, 5)} - {round(current_price * 1.001, 5)}",
                "advanced_patterns": [],
                "volume_analysis": "Normal volume",
                "momentum": "Neutral"
            }
        
        # Save analysis
        analysis_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["user_id"],
            "symbol": data.symbol,
            "timeframe": data.timeframe,
            "asset_type": data.asset_type,
            "indicators": indicators,
            "ai_result": ai_result,
            "chart_data": chart_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.analyses.insert_one(analysis_doc)
        await add_xp(user["user_id"], 25)
        
        return {"analysis": {k: v for k, v in analysis_doc.items() if k != "_id"}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analysis/history")
async def get_analysis_history(user=Depends(get_current_user)):
    analyses = await db.analyses.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"analyses": analyses}

# --- Trade Journal ---
@api_router.post("/trades")
async def create_trade(data: TradeLog, user=Depends(get_current_user)):
    trade_id = str(uuid.uuid4())
    
    # Generate AI coaching if trade is closed
    coaching = None
    if data.outcome:
        try:
            coaching = await generate_trade_coaching(data, user)
        except Exception:
            pass
    
    trade_doc = {
        "id": trade_id,
        "user_id": user["user_id"],
        **data.model_dump(),
        "status": "open" if not data.outcome else "closed",
        "ai_coaching": coaching,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trades.insert_one(trade_doc)
    await add_xp(user["user_id"], 10)
    
    # Bonus XP for following AI advice
    if coaching and coaching.get("overall_grade") in ["A+", "A"]:
        await add_xp(user["user_id"], 25)
    
    # Update goals progress
    if data.pnl and data.pnl != 0:
        goals = await db.goals.find({"user_id": user["user_id"], "status": "active"}, {"_id": 0}).to_list(50)
        for goal in goals:
            new_progress = goal.get("current_profit", 0) + data.pnl
            status = "completed" if new_progress >= goal["target_profit"] else "active"
            await db.goals.update_one({"id": goal["id"]}, {"$set": {"current_profit": new_progress, "status": status}})
            if status == "completed":
                await add_xp(user["user_id"], 100)
    return {k: v for k, v in trade_doc.items() if k != "_id"}

@api_router.get("/trades")
async def get_trades(
    user=Depends(get_current_user),
    asset_type: Optional[str] = None,
    outcome: Optional[str] = None,
    direction: Optional[str] = None,
    symbol: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_pnl: Optional[float] = None,
    max_pnl: Optional[float] = None
):
    """Get trades with optional filtering"""
    query = {"user_id": user["user_id"]}
    
    if asset_type and asset_type != "all":
        query["asset_type"] = asset_type
    if outcome and outcome != "all":
        query["outcome"] = outcome
    if direction and direction != "all":
        query["$or"] = [{"direction": direction}, {"trade_type": direction}]
    if symbol:
        query["symbol"] = {"$regex": symbol.upper(), "$options": "i"}
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    if min_pnl is not None:
        query["pnl"] = {"$gte": min_pnl}
    if max_pnl is not None:
        if "pnl" in query:
            query["pnl"]["$lte"] = max_pnl
        else:
            query["pnl"] = {"$lte": max_pnl}
    
    trades = await db.trades.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"trades": trades}

@api_router.get("/trades/statistics")
async def get_trade_statistics(
    user=Depends(get_current_user),
    asset_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get advanced trade statistics"""
    import math
    
    query = {"user_id": user["user_id"]}
    if asset_type and asset_type != "all":
        query["asset_type"] = asset_type
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    trades = await db.trades.find(query, {"_id": 0}).to_list(1000)
    
    if not trades:
        return {
            "total_trades": 0,
            "closed_trades": 0,
            "open_trades": 0,
            "win_rate": 0,
            "total_pnl": 0,
            "avg_pnl": 0,
            "avg_win": 0,
            "avg_loss": 0,
            "largest_win": 0,
            "largest_loss": 0,
            "profit_factor": 0,
            "expectancy": 0,
            "avg_rr": 0,
            "best_asset": None,
            "worst_asset": None,
            "best_timeframe": None,
            "win_streak": 0,
            "loss_streak": 0,
            "current_streak": 0,
            "current_streak_type": None,
            "by_asset": {},
            "by_timeframe": {},
            "by_direction": {},
            "by_day": {},
            "monthly_pnl": [],
            "pnl_distribution": []
        }
    
    # Basic counts
    total_trades = len(trades)
    closed_trades = [t for t in trades if t.get("outcome")]
    open_trades = total_trades - len(closed_trades)
    
    # P&L calculations
    pnls = [t.get("pnl", 0) or 0 for t in closed_trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    
    total_pnl = sum(pnls)
    avg_pnl = total_pnl / len(pnls) if pnls else 0
    avg_win = sum(wins) / len(wins) if wins else 0
    avg_loss = sum(losses) / len(losses) if losses else 0
    largest_win = max(wins) if wins else 0
    largest_loss = min(losses) if losses else 0
    win_rate = (len(wins) / len(pnls) * 100) if pnls else 0
    
    # Profit factor
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else gross_profit
    
    # Expectancy = (Win Rate * Avg Win) - (Loss Rate * Avg Loss)
    win_rate_decimal = len(wins) / len(pnls) if pnls else 0
    loss_rate_decimal = len(losses) / len(pnls) if pnls else 0
    expectancy = (win_rate_decimal * avg_win) + (loss_rate_decimal * avg_loss)
    
    # Average R:R calculation
    rr_values = []
    for t in closed_trades:
        entry = t.get("entry_price", 0) or 0
        sl = t.get("sl") or t.get("stop_loss") or 0
        tp = t.get("tp1") or t.get("take_profit") or 0
        if entry and sl and tp and entry != sl:
            risk = abs(entry - sl)
            reward = abs(tp - entry)
            if risk > 0:
                rr_values.append(reward / risk)
    avg_rr = sum(rr_values) / len(rr_values) if rr_values else 0
    
    # Streak calculations
    win_streak = 0
    loss_streak = 0
    current_streak = 0
    current_streak_type = None
    temp_win = 0
    temp_loss = 0
    
    sorted_trades = sorted(closed_trades, key=lambda x: x.get("created_at", ""))
    for t in sorted_trades:
        pnl_val = t.get("pnl", 0) or 0
        if pnl_val > 0:
            temp_win += 1
            temp_loss = 0
            win_streak = max(win_streak, temp_win)
        elif pnl_val < 0:
            temp_loss += 1
            temp_win = 0
            loss_streak = max(loss_streak, temp_loss)
        else:
            temp_win = 0
            temp_loss = 0
    
    # Current streak
    if sorted_trades:
        for t in reversed(sorted_trades):
            pnl_val = t.get("pnl", 0) or 0
            if current_streak_type is None:
                if pnl_val > 0:
                    current_streak_type = "win"
                    current_streak = 1
                elif pnl_val < 0:
                    current_streak_type = "loss"
                    current_streak = 1
            elif current_streak_type == "win" and pnl_val > 0:
                current_streak += 1
            elif current_streak_type == "loss" and pnl_val < 0:
                current_streak += 1
            else:
                break
    
    # Performance by asset type
    by_asset = {}
    for t in closed_trades:
        asset = t.get("asset_type", "unknown")
        if asset not in by_asset:
            by_asset[asset] = {"trades": 0, "wins": 0, "pnl": 0}
        by_asset[asset]["trades"] += 1
        pnl_val = t.get("pnl", 0) or 0
        by_asset[asset]["pnl"] += pnl_val
        if pnl_val > 0:
            by_asset[asset]["wins"] += 1
    
    for asset in by_asset:
        by_asset[asset]["win_rate"] = round(by_asset[asset]["wins"] / by_asset[asset]["trades"] * 100, 1) if by_asset[asset]["trades"] > 0 else 0
    
    # Find best/worst asset
    best_asset = max(by_asset.items(), key=lambda x: x[1]["pnl"])[0] if by_asset else None
    worst_asset = min(by_asset.items(), key=lambda x: x[1]["pnl"])[0] if by_asset else None
    
    # Performance by timeframe
    by_timeframe = {}
    for t in closed_trades:
        tf = t.get("timeframe", "1h")
        if tf not in by_timeframe:
            by_timeframe[tf] = {"trades": 0, "wins": 0, "pnl": 0}
        by_timeframe[tf]["trades"] += 1
        pnl_val = t.get("pnl", 0) or 0
        by_timeframe[tf]["pnl"] += pnl_val
        if pnl_val > 0:
            by_timeframe[tf]["wins"] += 1
    
    for tf in by_timeframe:
        by_timeframe[tf]["win_rate"] = round(by_timeframe[tf]["wins"] / by_timeframe[tf]["trades"] * 100, 1) if by_timeframe[tf]["trades"] > 0 else 0
    
    best_timeframe = max(by_timeframe.items(), key=lambda x: x[1]["win_rate"])[0] if by_timeframe else None
    
    # Performance by direction
    by_direction = {"buy": {"trades": 0, "wins": 0, "pnl": 0}, "sell": {"trades": 0, "wins": 0, "pnl": 0}}
    for t in closed_trades:
        direction = t.get("direction", t.get("trade_type", "buy")).lower()
        if direction in by_direction:
            by_direction[direction]["trades"] += 1
            pnl_val = t.get("pnl", 0) or 0
            by_direction[direction]["pnl"] += pnl_val
            if pnl_val > 0:
                by_direction[direction]["wins"] += 1
    
    for d in by_direction:
        by_direction[d]["win_rate"] = round(by_direction[d]["wins"] / by_direction[d]["trades"] * 100, 1) if by_direction[d]["trades"] > 0 else 0
    
    # Performance by day of week
    by_day = {}
    for t in closed_trades:
        created = t.get("created_at", "")
        if created:
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                day_name = dt.strftime("%A")
                if day_name not in by_day:
                    by_day[day_name] = {"trades": 0, "wins": 0, "pnl": 0}
                by_day[day_name]["trades"] += 1
                pnl_val = t.get("pnl", 0) or 0
                by_day[day_name]["pnl"] += pnl_val
                if pnl_val > 0:
                    by_day[day_name]["wins"] += 1
            except Exception:
                pass
    
    for d in by_day:
        by_day[d]["win_rate"] = round(by_day[d]["wins"] / by_day[d]["trades"] * 100, 1) if by_day[d]["trades"] > 0 else 0
    
    # Monthly P&L
    monthly_pnl = {}
    for t in closed_trades:
        created = t.get("created_at", "")
        if created:
            try:
                month_key = created[:7]  # YYYY-MM
                if month_key not in monthly_pnl:
                    monthly_pnl[month_key] = 0
                monthly_pnl[month_key] += t.get("pnl", 0) or 0
            except Exception:
                pass
    
    monthly_list = [{"month": k, "pnl": round(v, 2)} for k, v in sorted(monthly_pnl.items())]
    
    # P&L distribution for histogram
    pnl_distribution = []
    if pnls:
        min_pnl_val = min(pnls)
        max_pnl_val = max(pnls)
        if min_pnl_val != max_pnl_val:
            bucket_size = (max_pnl_val - min_pnl_val) / 10
            for i in range(10):
                bucket_min = min_pnl_val + i * bucket_size
                bucket_max = bucket_min + bucket_size
                count = len([p for p in pnls if bucket_min <= p < bucket_max])
                pnl_distribution.append({
                    "range": f"{round(bucket_min)}-{round(bucket_max)}",
                    "count": count
                })
    
    return {
        "total_trades": total_trades,
        "closed_trades": len(closed_trades),
        "open_trades": open_trades,
        "win_rate": round(win_rate, 1),
        "total_pnl": round(total_pnl, 2),
        "avg_pnl": round(avg_pnl, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "largest_win": round(largest_win, 2),
        "largest_loss": round(largest_loss, 2),
        "profit_factor": round(profit_factor, 2),
        "expectancy": round(expectancy, 2),
        "avg_rr": round(avg_rr, 2),
        "best_asset": best_asset,
        "worst_asset": worst_asset,
        "best_timeframe": best_timeframe,
        "win_streak": win_streak,
        "loss_streak": loss_streak,
        "current_streak": current_streak,
        "current_streak_type": current_streak_type,
        "by_asset": by_asset,
        "by_timeframe": by_timeframe,
        "by_direction": by_direction,
        "by_day": by_day,
        "monthly_pnl": monthly_list,
        "pnl_distribution": pnl_distribution
    }

@api_router.get("/trades/export")
async def export_trades(
    user=Depends(get_current_user),
    format: str = "json",
    asset_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export trades as JSON or CSV"""
    from fastapi.responses import Response
    
    query = {"user_id": user["user_id"]}
    if asset_type and asset_type != "all":
        query["asset_type"] = asset_type
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    trades = await db.trades.find(query, {"_id": 0, "user_id": 0, "ai_coaching": 0}).sort("created_at", -1).to_list(1000)
    
    if format == "csv":
        # Generate CSV
        if not trades:
            csv_content = "No trades found"
        else:
            headers = ["id", "symbol", "asset_type", "direction", "entry_price", "exit_price", "position_size", "sl", "tp1", "tp2", "tp3", "outcome", "pnl", "timeframe", "notes", "created_at"]
            rows = [",".join(headers)]
            for t in trades:
                row = []
                for h in headers:
                    val = t.get(h, "")
                    if val is None:
                        val = ""
                    # Escape commas and quotes
                    val = str(val).replace('"', '""')
                    if "," in val or '"' in val:
                        val = f'"{val}"'
                    row.append(val)
                rows.append(",".join(row))
            csv_content = "\n".join(rows)
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=trades_export_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
        )
    else:
        return {"trades": trades, "exported_at": datetime.now(timezone.utc).isoformat(), "total": len(trades)}

@api_router.put("/trades/{trade_id}")
async def update_trade(trade_id: str, data: TradeLog, user=Depends(get_current_user)):
    update_data = data.model_dump()
    if data.outcome:
        update_data["status"] = "closed"
    await db.trades.update_one({"id": trade_id, "user_id": user["user_id"]}, {"$set": update_data})
    if data.pnl and data.pnl != 0:
        goals = await db.goals.find({"user_id": user["user_id"], "status": "active"}, {"_id": 0}).to_list(50)
        for goal in goals:
            new_progress = goal.get("current_profit", 0) + data.pnl
            status = "completed" if new_progress >= goal["target_profit"] else "active"
            await db.goals.update_one({"id": goal["id"]}, {"$set": {"current_profit": new_progress, "status": status}})
    return {"success": True}

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str, user=Depends(get_current_user)):
    await db.trades.delete_one({"id": trade_id, "user_id": user["user_id"]})
    return {"success": True}

async def generate_trade_coaching(trade_data: TradeLog, user: dict):
    """Generate AI coaching feedback for a trade using GPT-5.2"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Get user's recent trades for context
        recent_trades = await db.trades.find(
            {"user_id": user["user_id"]}, 
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        win_rate = 0
        if len(recent_trades) > 0:
            wins = sum(1 for t in recent_trades if t.get("outcome") == "win")
            win_rate = (wins / len(recent_trades)) * 100
        
        # Use sl field as fallback for stop_loss
        stop_loss = trade_data.stop_loss or trade_data.sl
        take_profit = trade_data.take_profit or trade_data.tp1
        direction = trade_data.direction or trade_data.trade_type.upper()
        
        prompt = f"""As a professional trading coach, analyze this trade and provide constructive feedback.

TRADE DETAILS:
- Symbol: {trade_data.symbol}
- Direction: {direction}
- Entry Price: {trade_data.entry_price}
- Exit Price: {trade_data.exit_price or 'Still open'}
- Position Size: {trade_data.position_size}
- Stop Loss: {stop_loss or 'Not set'}
- Take Profit: {take_profit or 'Not set'}
- Outcome: {trade_data.outcome or 'Open'}
- P&L: {trade_data.pnl or 'N/A'}
- Notes: {trade_data.notes or 'No notes'}

TRADER CONTEXT:
- Recent Win Rate: {win_rate:.1f}%
- Recent Trades: {len(recent_trades)}

Provide coaching in this EXACT JSON format:
{{
  "overall_grade": "A+",
  "summary": "One sentence overall assessment",
  "strengths": ["2-3 things done well"],
  "areas_for_improvement": ["2-3 specific actionable improvements"],
  "risk_management_feedback": "Specific feedback on SL, position sizing, R:R",
  "entry_analysis": "Was the entry good? At support/resistance? With trend?",
  "exit_analysis": "Was the exit optimal? Did they follow their plan?",
  "psychological_notes": "Any emotional trading signs or discipline issues",
  "key_lesson": "One main takeaway for this trader",
  "next_trade_tip": "Specific actionable tip for their next trade"
}}

Be honest but constructive. Focus on education, not criticism. Return ONLY valid JSON."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"coaching_{user['user_id']}_{uuid.uuid4()}",
            system_message="You are a professional trading coach with 20 years of experience. Always respond with valid JSON only."
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        result_text = response.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1].rsplit("```", 1)[0]
        
        coaching = json.loads(result_text)
        return coaching
        
    except Exception as e:
        logger.error(f"Trade coaching error: {e}")
        return {
            "overall_grade": "B",
            "summary": "Trade logged successfully. Keep tracking your performance!",
            "strengths": ["Documented the trade", "Building trading history"],
            "areas_for_improvement": ["Continue practicing", "Review past trades"],
            "risk_management_feedback": "Keep using stop losses consistently",
            "entry_analysis": "Track your entry reasoning for future review",
            "exit_analysis": "Document exit strategy for each trade",
            "psychological_notes": "Stay disciplined with your trading plan",
            "key_lesson": "Consistent tracking leads to improvement",
            "next_trade_tip": "Plan your trade and trade your plan"
        }

@api_router.post("/trades/{trade_id}/request-coaching")
async def request_trade_coaching(trade_id: str, user=Depends(get_current_user)):
    """Request AI coaching for an existing trade"""
    trade = await db.trades.find_one({"id": trade_id, "user_id": user["user_id"]}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Convert to TradeLog model
    trade_data = TradeLog(**{k: v for k, v in trade.items() if k in TradeLog.model_fields})
    coaching = await generate_trade_coaching(trade_data, user)
    
    # Update trade with coaching
    await db.trades.update_one(
        {"id": trade_id, "user_id": user["user_id"]},
        {"$set": {"ai_coaching": coaching}}
    )
    
    return {"coaching": coaching}

# --- Goals ---
@api_router.post("/goals")
async def create_goal(data: GoalCreate, user=Depends(get_current_user)):
    goal_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        **data.model_dump(),
        "current_profit": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.goals.insert_one(goal_doc)
    return {k: v for k, v in goal_doc.items() if k != "_id"}

@api_router.get("/goals")
async def get_goals(user=Depends(get_current_user)):
    goals = await db.goals.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"goals": goals}

@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, user=Depends(get_current_user)):
    await db.goals.delete_one({"id": goal_id, "user_id": user["user_id"]})
    return {"success": True}

# --- Signals ---
@api_router.get("/signals")
async def get_signals(user=Depends(get_current_user)):
    signals = await db.signals.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"signals": signals}

@api_router.post("/signals/generate")
async def generate_signals(user=Depends(get_current_user)):
    import yfinance as yf
    import math
    symbols = [("EURUSD=X", "EUR/USD", "forex"), ("GBPUSD=X", "GBP/USD", "forex"), ("BTC-USD", "BTC/USD", "crypto"), ("ETH-USD", "ETH/USD", "crypto"), ("GC=F", "Gold", "metals")]
    new_signals = []
    for sym, name, asset_type in symbols:
        try:
            t = yf.Ticker(sym)
            h = t.history(period="5d", interval="1h")
            if h.empty:
                continue
            prices = h['Close'].tolist()
            highs = h['High'].tolist()
            lows = h['Low'].tolist()
            current = float(prices[-1])
            sma20 = sum(prices[-20:]) / min(20, len(prices))
            sma50 = sum(prices[-50:]) / min(50, len(prices)) if len(prices) >= 10 else sma20
            gains, losses_list = [], []
            for i in range(1, min(15, len(prices))):
                diff = prices[-i] - prices[-i-1]
                if diff > 0:
                    gains.append(diff)
                else:
                    losses_list.append(abs(diff))
            avg_gain = sum(gains) / 14 if gains else 0.001
            avg_loss = sum(losses_list) / 14 if losses_list else 0.001
            rsi = 100 - (100 / (1 + avg_gain / avg_loss))
            
            # MACD for confluence
            ema12 = sum(prices[-12:]) / min(12, len(prices))
            ema26 = sum(prices[-26:]) / min(26, len(prices))
            macd_val = ema12 - ema26
            
            # Count confirmations for confluence
            confirmations = 0
            reasons = []
            
            if rsi < 30:
                confirmations += 2
                reasons.append(f"RSI oversold at {round(rsi, 1)}")
                direction = "BUY"
            elif rsi > 70:
                confirmations += 2
                reasons.append(f"RSI overbought at {round(rsi, 1)}")
                direction = "SELL"
            elif rsi < 45:
                confirmations += 1
                reasons.append(f"RSI leaning bearish at {round(rsi, 1)}")
                direction = "SELL"
            elif rsi > 55:
                confirmations += 1
                reasons.append(f"RSI leaning bullish at {round(rsi, 1)}")
                direction = "BUY"
            else:
                direction = "HOLD"
            
            if current > sma20 and direction != "SELL":
                confirmations += 1
                reasons.append("Price above SMA20 (bullish)")
                if direction == "HOLD":
                    direction = "BUY"
            elif current < sma20 and direction != "BUY":
                confirmations += 1
                reasons.append("Price below SMA20 (bearish)")
                if direction == "HOLD":
                    direction = "SELL"
            
            if current > sma50 and direction == "BUY":
                confirmations += 1
                reasons.append("Price above SMA50 (strong uptrend)")
            elif current < sma50 and direction == "SELL":
                confirmations += 1
                reasons.append("Price below SMA50 (strong downtrend)")
            
            if macd_val > 0 and direction == "BUY":
                confirmations += 1
                reasons.append("MACD positive (bullish momentum)")
            elif macd_val < 0 and direction == "SELL":
                confirmations += 1
                reasons.append("MACD negative (bearish momentum)")
            
            # Only generate signal if enough confluence (2+ confirmations)
            if confirmations < 2 or direction == "HOLD":
                continue
            
            confidence = min(95, 50 + confirmations * 10)
            if rsi < 25 or rsi > 75:
                confidence = min(95, confidence + 10)
            
            # Quality rating
            if confidence >= 85:
                quality = "A+"
            elif confidence >= 75:
                quality = "A"
            elif confidence >= 65:
                quality = "B"
            else:
                quality = "C"
            
            # Risk level
            if confirmations >= 4:
                risk_level = "Low"
            elif confirmations >= 3:
                risk_level = "Medium"
            else:
                risk_level = "High"
            
            atr = sum(abs(float(h['High'].iloc[-i]) - float(h['Low'].iloc[-i])) for i in range(1, min(15, len(h)))) / 14
            if direction == "BUY":
                tp1 = round(current + atr, 5)
                tp2 = round(current + atr * 2, 5)
                tp3 = round(current + atr * 3, 5)
                sl = round(current - atr * 1.5, 5)
                market_direction = "BULLISH"
            else:
                tp1 = round(current - atr, 5)
                tp2 = round(current - atr * 2, 5)
                tp3 = round(current - atr * 3, 5)
                sl = round(current + atr * 1.5, 5)
                market_direction = "BEARISH"
            
            risk_amount = abs(current - sl)
            reward_amount = abs(tp2 - current)
            rr_ratio = f"1:{round(reward_amount / risk_amount, 1)}" if risk_amount > 0 else "1:2"
            
            # Support/Resistance
            recent_lows = sorted(lows[-20:])[:3]
            recent_highs = sorted(highs[-20:], reverse=True)[:3]
            support_lvl = round(sum(recent_lows) / len(recent_lows), 5)
            resistance_lvl = round(sum(recent_highs) / len(recent_highs), 5)
            
            # Calculate trade quality score based on multiple factors
            trade_quality_score = 0
            if confirmations >= 4:
                trade_quality_score += 30
            elif confirmations >= 3:
                trade_quality_score += 20
            elif confirmations >= 2:
                trade_quality_score += 10
            
            if confidence >= 80:
                trade_quality_score += 25
            elif confidence >= 70:
                trade_quality_score += 15
            
            # R:R contribution
            rr_num = reward_amount / risk_amount if risk_amount > 0 else 1
            if rr_num >= 3:
                trade_quality_score += 25
            elif rr_num >= 2:
                trade_quality_score += 15
            elif rr_num >= 1.5:
                trade_quality_score += 10
            
            # RSI extremes add quality
            if rsi < 30 or rsi > 70:
                trade_quality_score += 20
            
            trade_quality_score = min(100, trade_quality_score)
            
            # Bias score (how strong is the directional bias)
            bias_score = min(100, 40 + (confirmations * 12) + (10 if rsi < 30 or rsi > 70 else 0))
            
            # Generate visual overlays for this signal
            chart_height = 600
            price_range = resistance_lvl - support_lvl if resistance_lvl > support_lvl else current * 0.1
            
            def price_to_y(price_val):
                if price_range == 0:
                    return chart_height / 2
                normalized = (resistance_lvl - price_val) / price_range
                return int(50 + normalized * (chart_height - 100))
            
            visual_overlays = {
                "support_zones": [
                    {"y": price_to_y(support_lvl), "label": f"Support {support_lvl}", "strength": "strong"}
                ],
                "resistance_zones": [
                    {"y": price_to_y(resistance_lvl), "label": f"Resistance {resistance_lvl}", "strength": "strong"}
                ],
                "trendlines": [],
                "patterns": [],
                "entry_markers": [
                    {"x": 650, "y": price_to_y(current), "label": f"Entry {current}", "type": "entry"}
                ],
                "stop_loss_markers": [
                    {"x": 650, "y": price_to_y(sl), "label": f"SL {sl}", "type": "stop_loss"}
                ],
                "take_profit_markers": [
                    {"x": 650, "y": price_to_y(tp1), "label": f"TP1 {tp1}", "type": "tp1"},
                    {"x": 650, "y": price_to_y(tp2), "label": f"TP2 {tp2}", "type": "tp2"},
                    {"x": 650, "y": price_to_y(tp3), "label": f"TP3 {tp3}", "type": "tp3"}
                ],
                "breakout_zones": [],
                "liquidity_sweeps": []
            }
            
            # Add trendline based on direction
            if direction == "BUY":
                visual_overlays["trendlines"].append({
                    "x1": 100, "y1": price_to_y(support_lvl * 0.99), 
                    "x2": 700, "y2": price_to_y(current * 0.995), 
                    "type": "bullish", "label": "Bullish Trend"
                })
            else:
                visual_overlays["trendlines"].append({
                    "x1": 100, "y1": price_to_y(resistance_lvl * 1.01), 
                    "x2": 700, "y2": price_to_y(current * 1.005), 
                    "type": "bearish", "label": "Bearish Trend"
                })
            
            why_trade = f"Multiple technical confirmations align for a {direction} setup on {name}. " + ". ".join(reasons) + f". Key support at {support_lvl}, resistance at {resistance_lvl}. ATR-based targets with {rr_ratio} risk/reward ratio suggest favorable setup."
            
            signal = {
                "id": str(uuid.uuid4()),
                "user_id": user["user_id"],
                "symbol": name,
                "ticker": sym,
                "asset_type": asset_type,
                "action": direction,
                "confidence": confidence,
                "price": round(current, 5),
                "tp1": tp1,
                "tp2": tp2,
                "tp3": tp3,
                "sl": sl,
                "rsi": round(rsi, 1),
                "quality": quality,
                "trade_quality_score": trade_quality_score,
                "bias_score": bias_score,
                "market_bias": market_direction,
                "risk_level": risk_level,
                "market_direction": market_direction,
                "risk_reward": rr_ratio,
                "confirmations": confirmations,
                "why_this_trade": why_trade,
                "reasons": reasons,
                "support": support_lvl,
                "resistance": resistance_lvl,
                "visual_overlays": visual_overlays,
                "timeframe": "1h",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            new_signals.append(signal)
            await db.signals.insert_one(signal)
        except Exception as e:
            logger.error(f"Signal gen error for {sym}: {e}")
    return {"signals": [{k: v for k, v in s.items() if k != "_id"} for s in new_signals]}

@api_router.put("/signals/settings")
async def update_signal_settings(data: SignalSettings, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["user_id"]}, {"$set": {"signal_settings": data.model_dump()}})
    return {"success": True}

# --- Challenges & Gamification ---
DAILY_CHALLENGES = [
    {"id": "log_trade", "title": "Log a Trade", "description": "Record at least one trade today", "xp": 20, "type": "daily"},
    {"id": "analyze_chart", "title": "Analyze a Chart", "description": "Run AI analysis on any symbol", "xp": 25, "type": "daily"},
    {"id": "set_goal", "title": "Set a Goal", "description": "Create or update a trading goal", "xp": 15, "type": "daily"},
    {"id": "review_signals", "title": "Check Signals", "description": "Review today's AI signals", "xp": 10, "type": "daily"},
    {"id": "study_lesson", "title": "Study Time", "description": "Complete a trading lesson", "xp": 30, "type": "daily"},
]

WEEKLY_CHALLENGES = [
    {"id": "win_streak_3", "title": "Hot Streak", "description": "Win 3 trades in a row", "xp": 100, "type": "weekly"},
    {"id": "profit_target", "title": "Profit Hunter", "description": "Reach $100 profit this week", "xp": 150, "type": "weekly"},
    {"id": "analyze_5", "title": "Chart Master", "description": "Analyze 5 different symbols", "xp": 75, "type": "weekly"},
    {"id": "journal_5", "title": "Consistent Logger", "description": "Log trades for 5 days", "xp": 80, "type": "weekly"},
]

ACHIEVEMENTS = [
    {"id": "first_trade", "title": "First Steps", "description": "Log your first trade", "icon": "trophy"},
    {"id": "streak_7", "title": "Week Warrior", "description": "Maintain a 7-day streak", "icon": "flame"},
    {"id": "streak_30", "title": "Monthly Machine", "description": "Maintain a 30-day streak", "icon": "zap"},
    {"id": "analyses_10", "title": "Pattern Seeker", "description": "Complete 10 AI analyses", "icon": "eye"},
    {"id": "analyses_50", "title": "Chart Whisperer", "description": "Complete 50 AI analyses", "icon": "brain"},
    {"id": "profit_1000", "title": "Grand Trader", "description": "Earn $1000 total profit", "icon": "dollar"},
    {"id": "level_5", "title": "Rising Star", "description": "Reach level 5", "icon": "star"},
    {"id": "level_10", "title": "Elite Trader", "description": "Reach level 10", "icon": "crown"},
    {"id": "win_rate_60", "title": "Consistent Winner", "description": "Maintain 60%+ win rate over 20 trades", "icon": "target"},
    {"id": "goal_complete", "title": "Goal Crusher", "description": "Complete your first trading goal", "icon": "flag"},
]

@api_router.get("/challenges")
async def get_challenges(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week = datetime.now(timezone.utc).strftime("%Y-W%W")
    user_progress = await db.challenge_progress.find_one({"user_id": user["user_id"], "date": today}, {"_id": 0})
    weekly_progress = await db.challenge_progress.find_one({"user_id": user["user_id"], "week": week}, {"_id": 0})
    
    daily = []
    for c in DAILY_CHALLENGES:
        completed = False
        if user_progress and c["id"] in user_progress.get("completed", []):
            completed = True
        daily.append({**c, "completed": completed})
    
    weekly = []
    for c in WEEKLY_CHALLENGES:
        completed = False
        if weekly_progress and c["id"] in weekly_progress.get("completed", []):
            completed = True
        weekly.append({**c, "completed": completed})
    
    return {"daily": daily, "weekly": weekly, "achievements": ACHIEVEMENTS}

@api_router.post("/challenges/complete")
async def complete_challenge(data: ChallengeAction, user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week = datetime.now(timezone.utc).strftime("%Y-W%W")
    
    all_challenges = DAILY_CHALLENGES + WEEKLY_CHALLENGES
    challenge = next((c for c in all_challenges if c["id"] == data.challenge_id), None)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    if challenge["type"] == "daily":
        await db.challenge_progress.update_one(
            {"user_id": user["user_id"], "date": today},
            {"$addToSet": {"completed": data.challenge_id}, "$setOnInsert": {"user_id": user["user_id"], "date": today}},
            upsert=True
        )
    else:
        await db.challenge_progress.update_one(
            {"user_id": user["user_id"], "week": week},
            {"$addToSet": {"completed": data.challenge_id}, "$setOnInsert": {"user_id": user["user_id"], "week": week}},
            upsert=True
        )
    
    await add_xp(user["user_id"], challenge["xp"])
    return {"success": True, "xp_earned": challenge["xp"]}

# --- Academy ---
ACADEMY_LESSONS = [
    # Beginner Module - Candlestick Patterns (5 lessons)
    {"id": "candle_basics", "module": "Candlestick Patterns", "title": "Understanding Candlesticks", "difficulty": "beginner", "xp": 20, "duration": "10 min",
     "content": "Learn the basics of candlestick charts including body, wicks, and what they represent about market sentiment.",
     "quiz": [{"q": "What does a long upper wick indicate?", "options": ["Strong buying pressure", "Selling pressure at higher prices", "Low volume", "Indecision"], "answer": 1}]},
    {"id": "candle_doji", "module": "Candlestick Patterns", "title": "Doji & Spinning Tops", "difficulty": "beginner", "xp": 25, "duration": "15 min",
     "content": "Master doji patterns - standard doji, dragonfly, gravestone, and long-legged doji patterns for reversal signals.",
     "quiz": [{"q": "A gravestone doji typically signals?", "options": ["Bullish continuation", "Bearish reversal", "Range expansion", "No signal"], "answer": 1}]},
    {"id": "candle_engulfing", "module": "Candlestick Patterns", "title": "Engulfing Patterns", "difficulty": "beginner", "xp": 30, "duration": "12 min",
     "content": "Bullish and bearish engulfing patterns are powerful reversal signals. Learn to identify and trade them.",
     "quiz": [{"q": "A bullish engulfing requires the green candle to:", "options": ["Be smaller than previous", "Completely cover the previous red candle", "Have no wicks", "Form at resistance"], "answer": 1}]},
    {"id": "candle_hammer", "module": "Candlestick Patterns", "title": "Hammer & Hanging Man", "difficulty": "beginner", "xp": 25, "duration": "12 min",
     "content": "Learn the hammer (bullish reversal) and hanging man (bearish reversal) patterns with their key characteristics.",
     "quiz": [{"q": "A hammer pattern is most reliable when:", "options": ["At resistance", "At support after downtrend", "In a range", "At any point"], "answer": 1}]},
    {"id": "candle_star", "module": "Candlestick Patterns", "title": "Morning & Evening Star", "difficulty": "beginner", "xp": 30, "duration": "15 min",
     "content": "Three-candle reversal patterns - morning star (bullish) and evening star (bearish) formations.",
     "quiz": [{"q": "The middle candle in a morning star is typically:", "options": ["Large bullish", "Large bearish", "Small body/doji", "Hammer"], "answer": 2}]},
    
    # Beginner Module - Trend Analysis (5 lessons)
    {"id": "trend_basics", "module": "Trend Analysis", "title": "Identifying Trends", "difficulty": "beginner", "xp": 20, "duration": "10 min",
     "content": "Learn to identify uptrends, downtrends, and sideways markets using higher highs, higher lows patterns.",
     "quiz": [{"q": "An uptrend is defined by:", "options": ["Lower lows", "Higher highs and higher lows", "Equal highs", "Only higher highs"], "answer": 1}]},
    {"id": "trend_lines", "module": "Trend Analysis", "title": "Drawing Trendlines", "difficulty": "beginner", "xp": 30, "duration": "15 min",
     "content": "Master the art of drawing accurate trendlines and channels for trend-following strategies.",
     "quiz": [{"q": "A valid trendline needs at least:", "options": ["1 touch", "2 touches", "3 touches", "5 touches"], "answer": 1}]},
    {"id": "trend_channels", "module": "Trend Analysis", "title": "Price Channels", "difficulty": "beginner", "xp": 30, "duration": "15 min",
     "content": "Parallel price channels for trading ranges and trending markets with entry/exit strategies.",
     "quiz": [{"q": "In an ascending channel, you should buy at:", "options": ["Upper boundary", "Lower boundary", "Middle", "Breakout only"], "answer": 1}]},
    {"id": "trend_phases", "module": "Trend Analysis", "title": "Market Phases", "difficulty": "beginner", "xp": 25, "duration": "12 min",
     "content": "Accumulation, markup, distribution, and markdown phases of market cycles.",
     "quiz": [{"q": "Smart money accumulates during:", "options": ["Markup phase", "Distribution", "Accumulation phase", "Markdown"], "answer": 2}]},
    {"id": "trend_multi", "module": "Trend Analysis", "title": "Multiple Timeframe Analysis", "difficulty": "beginner", "xp": 35, "duration": "18 min",
     "content": "Using multiple timeframes to confirm trends and find high-probability entries.",
     "quiz": [{"q": "Which timeframe should determine overall trend?", "options": ["1 minute", "15 minute", "Higher timeframe", "Lower timeframe"], "answer": 2}]},
    
    # Beginner Module - Support & Resistance (5 lessons)
    {"id": "sr_basics", "module": "Support & Resistance", "title": "Key Levels", "difficulty": "beginner", "xp": 25, "duration": "12 min",
     "content": "Understanding support and resistance levels - how price reacts at key levels.",
     "quiz": [{"q": "Support is a level where:", "options": ["Sellers dominate", "Buyers step in", "Price always reverses", "Volume decreases"], "answer": 1}]},
    {"id": "sr_zones", "module": "Support & Resistance", "title": "S/R Zones vs Lines", "difficulty": "beginner", "xp": 25, "duration": "12 min",
     "content": "Why zones work better than exact lines and how to draw effective S/R zones.",
     "quiz": [{"q": "S/R zones are better because:", "options": ["Easier to draw", "Price rarely touches exact levels", "They're wider", "More accurate signals"], "answer": 1}]},
    {"id": "sr_flip", "module": "Support & Resistance", "title": "Role Reversal", "difficulty": "beginner", "xp": 30, "duration": "15 min",
     "content": "How broken support becomes resistance and vice versa - the flip concept.",
     "quiz": [{"q": "When support breaks, it often becomes:", "options": ["Stronger support", "Resistance", "Invalid", "Weaker support"], "answer": 1}]},
    {"id": "sr_psychological", "module": "Support & Resistance", "title": "Psychological Levels", "difficulty": "beginner", "xp": 25, "duration": "12 min",
     "content": "Round numbers and psychological price levels (1.0000, 50000, etc.) and why they matter.",
     "quiz": [{"q": "Psychological levels work because:", "options": ["Banks set them", "Many orders cluster there", "They're random", "Technical analysis"], "answer": 1}]},
    {"id": "sr_dynamic", "module": "Support & Resistance", "title": "Dynamic S/R", "difficulty": "beginner", "xp": 30, "duration": "15 min",
     "content": "Moving averages as dynamic support and resistance levels in trending markets.",
     "quiz": [{"q": "The 200 MA is often used as:", "options": ["Entry signal", "Exit signal", "Long-term dynamic S/R", "Short-term indicator"], "answer": 2}]},
    
    # Intermediate Module - Technical Indicators (8 lessons)
    {"id": "indicator_rsi", "module": "Technical Indicators", "title": "RSI Mastery", "difficulty": "intermediate", "xp": 35, "duration": "20 min",
     "content": "Relative Strength Index - overbought/oversold conditions, divergences, and hidden divergences.",
     "quiz": [{"q": "RSI above 70 typically indicates:", "options": ["Oversold", "Overbought", "Neutral", "Trend strength"], "answer": 1}]},
    {"id": "indicator_macd", "module": "Technical Indicators", "title": "MACD Deep Dive", "difficulty": "intermediate", "xp": 35, "duration": "20 min",
     "content": "MACD histogram, signal line crossovers, and divergence trading strategies.",
     "quiz": [{"q": "A bullish MACD crossover occurs when:", "options": ["MACD crosses below signal", "MACD crosses above signal", "Histogram turns red", "MACD hits zero"], "answer": 1}]},
    {"id": "indicator_bb", "module": "Technical Indicators", "title": "Bollinger Bands Strategy", "difficulty": "intermediate", "xp": 40, "duration": "25 min",
     "content": "Bollinger Band squeezes, walks, and mean reversion strategies.",
     "quiz": [{"q": "A Bollinger Band squeeze indicates:", "options": ["High volatility", "Impending volatility expansion", "Trend reversal", "No signal"], "answer": 1}]},
    {"id": "indicator_stoch", "module": "Technical Indicators", "title": "Stochastic Oscillator", "difficulty": "intermediate", "xp": 35, "duration": "18 min",
     "content": "Fast and slow stochastic settings, crossovers, and overbought/oversold trading.",
     "quiz": [{"q": "Stochastic %K crossing above %D is:", "options": ["Bearish", "Bullish", "Neutral", "Exit signal"], "answer": 1}]},
    {"id": "indicator_atr", "module": "Technical Indicators", "title": "ATR for Position Sizing", "difficulty": "intermediate", "xp": 35, "duration": "18 min",
     "content": "Average True Range for volatility measurement and stop loss placement.",
     "quiz": [{"q": "ATR measures:", "options": ["Trend direction", "Price momentum", "Volatility", "Volume"], "answer": 2}]},
    {"id": "indicator_ichimoku", "module": "Technical Indicators", "title": "Ichimoku Cloud Basics", "difficulty": "intermediate", "xp": 45, "duration": "25 min",
     "content": "Tenkan-sen, Kijun-sen, Kumo cloud, and Chikou span trading strategies.",
     "quiz": [{"q": "Price above the Kumo cloud indicates:", "options": ["Bearish bias", "Bullish bias", "No bias", "Reversal"], "answer": 1}]},
    {"id": "indicator_fibonacci", "module": "Technical Indicators", "title": "Fibonacci Retracements", "difficulty": "intermediate", "xp": 40, "duration": "22 min",
     "content": "Key Fibonacci levels (38.2%, 50%, 61.8%) for finding entries and targets.",
     "quiz": [{"q": "The 'golden ratio' Fibonacci level is:", "options": ["38.2%", "50%", "61.8%", "78.6%"], "answer": 2}]},
    {"id": "indicator_volume", "module": "Technical Indicators", "title": "Volume Analysis", "difficulty": "intermediate", "xp": 35, "duration": "18 min",
     "content": "Volume confirmation, volume spikes, and volume divergence analysis.",
     "quiz": [{"q": "A breakout with high volume is:", "options": ["Less reliable", "More reliable", "Same reliability", "Always false"], "answer": 1}]},
    
    # Intermediate Module - Risk Management (5 lessons)
    {"id": "risk_mgmt", "module": "Risk Management", "title": "Position Sizing", "difficulty": "intermediate", "xp": 30, "duration": "15 min",
     "content": "Learn the 1-2% rule, risk-reward ratios, and how to calculate proper position sizes.",
     "quiz": [{"q": "The 1% rule means:", "options": ["1% profit target", "Risk 1% of account per trade", "1% daily gain", "1% win rate"], "answer": 1}]},
    {"id": "risk_rr", "module": "Risk Management", "title": "Risk-Reward Ratios", "difficulty": "intermediate", "xp": 30, "duration": "15 min",
     "content": "Minimum R:R requirements and how to calculate potential reward vs risk.",
     "quiz": [{"q": "A 1:3 R:R means:", "options": ["Risk 3, reward 1", "Risk 1, reward 3", "Risk 1, reward 1", "Risk 3, reward 3"], "answer": 1}]},
    {"id": "risk_stop", "module": "Risk Management", "title": "Stop Loss Strategies", "difficulty": "intermediate", "xp": 35, "duration": "18 min",
     "content": "Fixed stops, trailing stops, ATR-based stops, and structure-based stops.",
     "quiz": [{"q": "A trailing stop:", "options": ["Never moves", "Follows price in profit", "Is placed at entry", "Widens in loss"], "answer": 1}]},
    {"id": "risk_portfolio", "module": "Risk Management", "title": "Portfolio Diversification", "difficulty": "intermediate", "xp": 30, "duration": "15 min",
     "content": "Correlation between trades, maximum exposure, and balancing a trading portfolio.",
     "quiz": [{"q": "Correlated trades:", "options": ["Reduce risk", "Increase risk", "Have no effect", "Always profit together"], "answer": 1}]},
    {"id": "risk_drawdown", "module": "Risk Management", "title": "Managing Drawdowns", "difficulty": "intermediate", "xp": 35, "duration": "18 min",
     "content": "Maximum drawdown limits, recovery strategies, and when to pause trading.",
     "quiz": [{"q": "After 10% drawdown, you should:", "options": ["Double position size", "Reduce size and review", "Stop trading forever", "Ignore it"], "answer": 1}]},
    
    # Intermediate Module - Trading Psychology (5 lessons)
    {"id": "psych_emotions", "module": "Trading Psychology", "title": "Emotions in Trading", "difficulty": "intermediate", "xp": 25, "duration": "15 min",
     "content": "Managing fear and greed, avoiding revenge trading, and building mental discipline.",
     "quiz": [{"q": "Revenge trading is:", "options": ["A good strategy", "Trading to recover losses quickly", "Waiting for setups", "Risk management"], "answer": 1}]},
    {"id": "psych_discipline", "module": "Trading Psychology", "title": "Building Discipline", "difficulty": "intermediate", "xp": 30, "duration": "18 min",
     "content": "Creating and following trading rules, journaling, and accountability.",
     "quiz": [{"q": "A trading journal helps with:", "options": ["Finding patterns in your behavior", "Making money", "Avoiding losses", "Nothing"], "answer": 0}]},
    {"id": "psych_fomo", "module": "Trading Psychology", "title": "Overcoming FOMO", "difficulty": "intermediate", "xp": 30, "duration": "15 min",
     "content": "Fear of missing out - why it's dangerous and how to overcome it.",
     "quiz": [{"q": "FOMO often leads to:", "options": ["Better entries", "Chasing price", "Patience", "Discipline"], "answer": 1}]},
    {"id": "psych_patience", "module": "Trading Psychology", "title": "Patience & Waiting", "difficulty": "intermediate", "xp": 30, "duration": "15 min",
     "content": "The importance of waiting for A+ setups and not overtrading.",
     "quiz": [{"q": "Overtrading usually results in:", "options": ["More profits", "Account growth", "More losses", "Better skills"], "answer": 2}]},
    {"id": "psych_mindset", "module": "Trading Psychology", "title": "Winning Mindset", "difficulty": "intermediate", "xp": 35, "duration": "20 min",
     "content": "Thinking in probabilities, accepting losses, and long-term perspective.",
     "quiz": [{"q": "Professional traders view losses as:", "options": ["Failures", "Cost of doing business", "Avoidable always", "Bad luck"], "answer": 1}]},
    
    # Advanced Module - Chart Patterns (7 lessons)
    {"id": "pattern_head", "module": "Chart Patterns", "title": "Head & Shoulders", "difficulty": "advanced", "xp": 40, "duration": "22 min",
     "content": "Classic reversal pattern - H&S top and inverse H&S bottom formations.",
     "quiz": [{"q": "Head & Shoulders is a:", "options": ["Continuation pattern", "Reversal pattern", "Range pattern", "Random formation"], "answer": 1}]},
    {"id": "pattern_double", "module": "Chart Patterns", "title": "Double Tops & Bottoms", "difficulty": "advanced", "xp": 35, "duration": "18 min",
     "content": "M and W patterns for identifying potential reversals at key levels.",
     "quiz": [{"q": "A double bottom signals:", "options": ["Bearish reversal", "Bullish reversal", "Continuation", "No signal"], "answer": 1}]},
    {"id": "pattern_triangle", "module": "Chart Patterns", "title": "Triangles", "difficulty": "advanced", "xp": 40, "duration": "20 min",
     "content": "Ascending, descending, and symmetrical triangles with breakout strategies.",
     "quiz": [{"q": "An ascending triangle typically breaks:", "options": ["Downward", "Upward", "Either direction", "Sideways"], "answer": 1}]},
    {"id": "pattern_wedge", "module": "Chart Patterns", "title": "Wedges & Flags", "difficulty": "advanced", "xp": 40, "duration": "20 min",
     "content": "Rising/falling wedges and bull/bear flags as continuation patterns.",
     "quiz": [{"q": "A bull flag forms during:", "options": ["Downtrend", "Uptrend consolidation", "Range", "Reversal"], "answer": 1}]},
    {"id": "pattern_cup", "module": "Chart Patterns", "title": "Cup & Handle", "difficulty": "advanced", "xp": 40, "duration": "22 min",
     "content": "The cup and handle pattern for long-term bullish breakout setups.",
     "quiz": [{"q": "The handle in cup & handle should:", "options": ["Be deeper than cup", "Be shallow pullback", "Break support", "Go sideways"], "answer": 1}]},
    {"id": "harmonic_gartley", "module": "Chart Patterns", "title": "Gartley Pattern", "difficulty": "advanced", "xp": 50, "duration": "30 min",
     "content": "Learn the Gartley harmonic pattern with Fibonacci ratios for reversal trades.",
     "quiz": [{"q": "The Gartley pattern uses:", "options": ["Random levels", "Fibonacci ratios", "Moving averages", "Volume"], "answer": 1}]},
    {"id": "harmonic_bat", "module": "Chart Patterns", "title": "Bat & Butterfly", "difficulty": "advanced", "xp": 50, "duration": "30 min",
     "content": "Advanced harmonic patterns - Bat (0.886) and Butterfly (1.272) setups.",
     "quiz": [{"q": "The key Bat pattern ratio is:", "options": ["0.618", "0.786", "0.886", "1.272"], "answer": 2}]},
    
    # Advanced Module - Market Structure (5 lessons)
    {"id": "struct_bos", "module": "Market Structure", "title": "Break of Structure", "difficulty": "advanced", "xp": 45, "duration": "25 min",
     "content": "Understanding BOS (Break of Structure) for trend continuation signals.",
     "quiz": [{"q": "BOS confirms:", "options": ["Reversal", "Trend continuation", "Range", "Indecision"], "answer": 1}]},
    {"id": "struct_choch", "module": "Market Structure", "title": "Change of Character", "difficulty": "advanced", "xp": 45, "duration": "25 min",
     "content": "CHoCH (Change of Character) as an early reversal signal in market structure.",
     "quiz": [{"q": "CHoCH signals potential:", "options": ["Continuation", "Trend reversal", "Range bound", "Breakout"], "answer": 1}]},
    {"id": "struct_ob", "module": "Market Structure", "title": "Order Blocks", "difficulty": "advanced", "xp": 50, "duration": "28 min",
     "content": "Identifying and trading order blocks where institutional orders cluster.",
     "quiz": [{"q": "Order blocks represent:", "options": ["Retail interest", "Institutional orders", "Random zones", "Support only"], "answer": 1}]},
    {"id": "struct_fvg", "module": "Market Structure", "title": "Fair Value Gaps", "difficulty": "advanced", "xp": 45, "duration": "25 min",
     "content": "Imbalances in price action and how price tends to fill FVGs.",
     "quiz": [{"q": "FVGs are created by:", "options": ["Slow moves", "Fast impulsive moves", "Consolidation", "Low volume"], "answer": 1}]},
    {"id": "struct_liquidity", "module": "Market Structure", "title": "Liquidity Concepts", "difficulty": "advanced", "xp": 50, "duration": "30 min",
     "content": "Buy-side and sell-side liquidity, stop hunts, and liquidity sweeps.",
     "quiz": [{"q": "Stop hunts target:", "options": ["Take profits", "Clustered stop losses", "Entry orders", "Pending orders"], "answer": 1}]},
    
    # Advanced Module - Trading Strategies (5 lessons)
    {"id": "strat_scalping", "module": "Trading Strategies", "title": "Scalping Techniques", "difficulty": "advanced", "xp": 45, "duration": "25 min",
     "content": "High-frequency trading on lower timeframes with tight stops and quick profits.",
     "quiz": [{"q": "Scalping typically uses:", "options": ["Daily charts", "1-5 minute charts", "Weekly charts", "Monthly charts"], "answer": 1}]},
    {"id": "strat_swing", "module": "Trading Strategies", "title": "Swing Trading Mastery", "difficulty": "advanced", "xp": 45, "duration": "25 min",
     "content": "Capturing multi-day moves by trading pullbacks in trending markets.",
     "quiz": [{"q": "Swing trades typically last:", "options": ["Minutes", "Hours", "Days to weeks", "Years"], "answer": 2}]},
    {"id": "strat_position", "module": "Trading Strategies", "title": "Position Trading", "difficulty": "advanced", "xp": 50, "duration": "28 min",
     "content": "Long-term trading based on fundamental and technical analysis.",
     "quiz": [{"q": "Position traders focus on:", "options": ["5-minute charts", "Noise", "Major trends", "Scalping"], "answer": 2}]},
    {"id": "strat_breakout", "module": "Trading Strategies", "title": "Breakout Trading", "difficulty": "advanced", "xp": 45, "duration": "25 min",
     "content": "Trading breakouts from consolidation with volume confirmation.",
     "quiz": [{"q": "Valid breakouts usually have:", "options": ["Low volume", "High volume", "No volume", "Decreasing volume"], "answer": 1}]},
    {"id": "strat_reversal", "module": "Trading Strategies", "title": "Reversal Trading", "difficulty": "advanced", "xp": 50, "duration": "30 min",
     "content": "Identifying and trading trend reversals with confirmation signals.",
     "quiz": [{"q": "Reversal trading is:", "options": ["Low risk", "Counter-trend", "With the trend", "Random"], "answer": 1}]},
]

# Quiz endpoint for lessons
class QuizAnswer(BaseModel):
    lesson_id: str
    answer_index: int

@api_router.post("/academy/quiz/{lesson_id}")
async def submit_quiz(lesson_id: str, data: QuizAnswer, user=Depends(get_current_user)):
    """Submit quiz answer for a lesson"""
    lesson = next((les for les in ACADEMY_LESSONS if les["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    quiz = lesson.get("quiz", [])
    if not quiz:
        return {"success": False, "message": "No quiz for this lesson"}
    
    question = quiz[0]  # First question
    is_correct = data.answer_index == question["answer"]
    
    if is_correct:
        # Award bonus XP for correct quiz answer
        await add_xp(user["user_id"], 10)
        
    return {
        "correct": is_correct,
        "correct_answer": question["answer"],
        "xp_earned": 10 if is_correct else 0
    }

@api_router.get("/academy/lessons")
async def get_lessons(user=Depends(get_current_user)):
    completed = await db.lesson_progress.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    completed_ids = [c["lesson_id"] for c in completed]
    lessons = [{**lesson, "completed": lesson["id"] in completed_ids} for lesson in ACADEMY_LESSONS]
    modules = {}
    for lesson in lessons:
        if lesson["module"] not in modules:
            modules[lesson["module"]] = []
        modules[lesson["module"]].append(lesson)
    return {"lessons": lessons, "modules": modules, "completed_count": len(completed_ids), "total_count": len(ACADEMY_LESSONS)}

@api_router.post("/academy/complete/{lesson_id}")
async def complete_lesson(lesson_id: str, user=Depends(get_current_user)):
    lesson = next((les for les in ACADEMY_LESSONS if les["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    existing = await db.lesson_progress.find_one({"user_id": user["user_id"], "lesson_id": lesson_id}, {"_id": 0})
    if existing:
        return {"success": True, "already_completed": True}
    await db.lesson_progress.insert_one({"user_id": user["user_id"], "lesson_id": lesson_id, "completed_at": datetime.now(timezone.utc).isoformat()})
    await add_xp(user["user_id"], lesson["xp"])
    return {"success": True, "xp_earned": lesson["xp"]}

# --- Analytics ---
@api_router.get("/analytics")
async def get_analytics(user=Depends(get_current_user)):
    trades = await db.trades.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    closed = [t for t in trades if t.get("status") == "closed" or t.get("outcome")]
    total = len(closed)
    wins = len([t for t in closed if t.get("pnl", 0) > 0])
    losses = len([t for t in closed if t.get("pnl", 0) < 0])
    win_rate = (wins / total * 100) if total > 0 else 0
    total_pnl = sum(t.get("pnl", 0) for t in closed)
    avg_win = sum(t.get("pnl", 0) for t in closed if t.get("pnl", 0) > 0) / wins if wins > 0 else 0
    avg_loss = sum(t.get("pnl", 0) for t in closed if t.get("pnl", 0) < 0) / losses if losses > 0 else 0
    profit_factor = abs(avg_win * wins / (avg_loss * losses)) if losses > 0 and avg_loss != 0 else 0
    
    # Equity curve
    equity = []
    running = 0
    for t in sorted(closed, key=lambda x: x.get("created_at", "")):
        running += t.get("pnl", 0)
        equity.append({"date": t.get("created_at", "")[:10], "equity": round(running, 2)})
    
    # By asset type
    by_asset = {}
    for t in closed:
        at = t.get("asset_type", "unknown")
        if at not in by_asset:
            by_asset[at] = {"trades": 0, "pnl": 0, "wins": 0}
        by_asset[at]["trades"] += 1
        by_asset[at]["pnl"] += t.get("pnl", 0)
        if t.get("pnl", 0) > 0:
            by_asset[at]["wins"] += 1
    
    # Max drawdown
    peak = 0
    max_dd = 0
    running = 0
    for t in sorted(closed, key=lambda x: x.get("created_at", "")):
        running += t.get("pnl", 0)
        if running > peak:
            peak = running
        dd = peak - running
        if dd > max_dd:
            max_dd = dd
    
    return {
        "total_trades": total,
        "wins": wins,
        "losses": losses,
        "win_rate": round(win_rate, 1),
        "total_pnl": round(total_pnl, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "profit_factor": round(profit_factor, 2),
        "max_drawdown": round(max_dd, 2),
        "equity_curve": equity,
        "by_asset": by_asset,
        "recent_trades": closed[-10:] if closed else []
    }

# --- Profile ---
@api_router.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    u = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "password": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    trades = await db.trades.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    analyses = await db.analyses.count_documents({"user_id": user["user_id"]})
    lessons = await db.lesson_progress.count_documents({"user_id": user["user_id"]})
    
    closed = [t for t in trades if t.get("outcome") or t.get("status") == "closed"]
    total_pnl = sum(t.get("pnl", 0) for t in closed)
    wins = len([t for t in closed if t.get("pnl", 0) > 0])
    win_rate = (wins / len(closed) * 100) if closed else 0
    
    # Check achievements
    earned = u.get("achievements", [])
    new_achievements = []
    if len(trades) >= 1 and "first_trade" not in earned:
        new_achievements.append("first_trade")
    if u.get("streak", 0) >= 7 and "streak_7" not in earned:
        new_achievements.append("streak_7")
    if u.get("streak", 0) >= 30 and "streak_30" not in earned:
        new_achievements.append("streak_30")
    if analyses >= 10 and "analyses_10" not in earned:
        new_achievements.append("analyses_10")
    if analyses >= 50 and "analyses_50" not in earned:
        new_achievements.append("analyses_50")
    if total_pnl >= 1000 and "profit_1000" not in earned:
        new_achievements.append("profit_1000")
    if u.get("level", 1) >= 5 and "level_5" not in earned:
        new_achievements.append("level_5")
    if u.get("level", 1) >= 10 and "level_10" not in earned:
        new_achievements.append("level_10")
    
    if new_achievements:
        all_achievements = earned + new_achievements
        await db.users.update_one({"id": user["user_id"]}, {"$set": {"achievements": all_achievements}})
        u["achievements"] = all_achievements
    
    level_titles = {1: "Novice", 2: "Apprentice", 3: "Intermediate", 4: "Skilled", 5: "Advanced", 6: "Expert", 7: "Master", 8: "Grandmaster", 9: "Legend", 10: "Ultimate"}
    
    return {
        **u,
        "total_trades": len(trades),
        "total_analyses": analyses,
        "lessons_completed": lessons,
        "total_pnl": round(total_pnl, 2),
        "win_rate": round(win_rate, 1),
        "level_title": level_titles.get(min(u.get("level", 1), 10), "Ultimate"),
        "xp_to_next": 500 - (u.get("xp", 0) % 500),
        "all_achievements": ACHIEVEMENTS,
        "new_achievements": new_achievements
    }

# --- Settings ---
@api_router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    s = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not s:
        s = {"user_id": user["user_id"], "notifications_enabled": True, "sound_enabled": True, "signal_frequency": "normal", "theme": "dark", "ai_aggressiveness": "balanced", "risk_profile": "swing"}
    return s

@api_router.put("/settings")
async def update_settings(data: UserSettings, user=Depends(get_current_user)):
    await db.user_settings.update_one(
        {"user_id": user["user_id"]},
        {"$set": {**data.model_dump(), "user_id": user["user_id"]}},
        upsert=True
    )
    return {"success": True}

# --- Watchlist ---
@api_router.get("/watchlist")
async def get_watchlist(user=Depends(get_current_user)):
    items = await db.watchlist.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    import yfinance as yf
    enriched = []
    for item in items:
        try:
            t = yf.Ticker(item["symbol"])
            h = t.history(period="2d")
            if not h.empty:
                price = float(h['Close'].iloc[-1])
                prev = float(h['Close'].iloc[0])
                change = ((price - prev) / prev) * 100
                enriched.append({**item, "price": round(price, 5), "change": round(change, 2)})
            else:
                enriched.append({**item, "price": 0, "change": 0})
        except Exception:
            enriched.append({**item, "price": 0, "change": 0})
    return {"watchlist": enriched}

@api_router.post("/watchlist")
async def add_to_watchlist(data: WatchlistAdd, user=Depends(get_current_user)):
    existing = await db.watchlist.find_one({"user_id": user["user_id"], "symbol": data.symbol}, {"_id": 0})
    if existing:
        return {"success": True, "already_exists": True}
    doc = {"id": str(uuid.uuid4()), "user_id": user["user_id"], **data.model_dump(), "added_at": datetime.now(timezone.utc).isoformat()}
    await db.watchlist.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api_router.delete("/watchlist/{item_id}")
async def remove_from_watchlist(item_id: str, user=Depends(get_current_user)):
    await db.watchlist.delete_one({"id": item_id, "user_id": user["user_id"]})
    return {"success": True}

# --- Enhanced Signal Detail ---
@api_router.get("/signals/{signal_id}")
async def get_signal_detail(signal_id: str, user=Depends(get_current_user)):
    sig = await db.signals.find_one({"id": signal_id, "user_id": user["user_id"]}, {"_id": 0})
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    return sig

# --- Chart Image Upload Analysis ---
@api_router.post("/analysis/upload")
async def upload_chart_analysis(data: ChartUploadRequest, user=Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"chart-upload-{uuid.uuid4()}",
            system_message="""You are an elite institutional-level trading chart analyst with expertise in:
1. CLASSIC CHART PATTERNS: Head & Shoulders (regular/inverse), Double/Triple Tops/Bottoms, Cup & Handle, Triangles (ascending/descending/symmetrical), Wedges (rising/falling), Flags, Pennants, Rectangles
2. HARMONIC PATTERNS: Gartley, Bat, Butterfly, Crab, Cypher patterns with Fibonacci ratios
3. MARKET STRUCTURE: BOS (Break of Structure), CHoCH (Change of Character), Order Blocks, Fair Value Gaps, Liquidity Zones
4. CANDLESTICK PATTERNS: Engulfing, Pin Bar, Doji, Hammer, Morning/Evening Star, Three White Soldiers, Three Black Crows

You analyze charts like a professional prop trader. Be specific about pattern coordinates for visual overlays. Respond ONLY in valid JSON format."""
        )
        chat.with_model("openai", "gpt-5.2")

        prompt = f"""Analyze this trading chart screenshot with ADVANCED PATTERN RECOGNITION.

Market Type: {data.market_type}
Timeframe: {data.timeframe}
Pair: {data.pair_name or 'Not specified'}

VISUAL COORDINATE SYSTEM for overlays (chart is 800px wide x 600px tall):
- X coordinates: 0 (left) to 800 (right)
- Y coordinates: 0 (top/highest price) to 600 (bottom/lowest price)

DETECT ALL APPLICABLE PATTERNS from these categories:
1. REVERSAL PATTERNS: Head & Shoulders, Inverse H&S, Double Top/Bottom, Triple Top/Bottom, Rising/Falling Wedge
2. CONTINUATION PATTERNS: Flags (Bull/Bear), Pennants, Triangles, Rectangles, Cup & Handle
3. HARMONIC PATTERNS: Gartley, Bat, Butterfly, Crab, Cypher (with Fibonacci ratios)
4. STRUCTURE: Order Blocks, FVGs, BOS, CHoCH, Liquidity Sweeps
5. CANDLESTICK: Engulfing, Pin Bar, Doji, Hammer, Shooting Star, Morning/Evening Star

Provide analysis in this EXACT JSON format:
{{
  "market_bias": "BULLISH" or "BEARISH" or "NEUTRAL",
  "bias_score": 0-100,
  "trade_quality_score": 0-100,
  "market_summary": "Detailed market assessment in 2-3 sentences",
  "trend_direction": "UPTREND" or "DOWNTREND" or "SIDEWAYS" or "TRANSITIONING",
  "visual_overlays": {{
    "support_zones": [
      {{"y": 450, "label": "Key Support 1.0850", "strength": "strong"}}
    ],
    "resistance_zones": [
      {{"y": 150, "label": "Major Resistance 1.1050", "strength": "strong"}}
    ],
    "trendlines": [
      {{"x1": 100, "y1": 500, "x2": 700, "y2": 200, "type": "bullish", "label": "Ascending Trendline"}}
    ],
    "patterns": [
      {{
        "name": "Head & Shoulders",
        "type": "head_shoulders",
        "points": [[200, 300], [300, 150], [400, 100], [500, 150], [600, 300]],
        "breakout_direction": "bearish",
        "key_points": [
          {{"x": 200, "y": 300, "label": "Left Shoulder"}},
          {{"x": 400, "y": 100, "label": "Head"}},
          {{"x": 600, "y": 300, "label": "Right Shoulder"}}
        ],
        "neckline": {{"x1": 200, "y1": 300, "x2": 600, "y2": 320}},
        "target": {{"x": 600, "y": 520, "price": "1.0750"}}
      }},
      {{
        "name": "Ascending Triangle",
        "type": "triangle",
        "points": [[200, 200], [600, 200], [600, 400], [200, 500]],
        "breakout_direction": "bullish"
      }},
      {{
        "name": "Bull Flag",
        "type": "flag",
        "points": [[400, 180], [550, 220], [550, 280], [400, 240]],
        "breakout_direction": "bullish"
      }},
      {{
        "name": "Falling Wedge",
        "type": "wedge",
        "points": [[150, 150], [700, 350], [700, 450], [150, 250]],
        "breakout_direction": "bullish"
      }}
    ],
    "entry_markers": [
      {{"x": 650, "y": 350, "label": "Entry 1.0920", "type": "entry"}}
    ],
    "stop_loss_markers": [
      {{"x": 650, "y": 470, "label": "SL 1.0840", "type": "stop_loss"}}
    ],
    "take_profit_markers": [
      {{"x": 650, "y": 180, "label": "TP1 1.1020", "type": "tp1"}},
      {{"x": 650, "y": 120, "label": "TP2 1.1080", "type": "tp2"}},
      {{"x": 650, "y": 60, "label": "TP3 1.1150", "type": "tp3"}}
    ],
    "breakout_zones": [
      {{"x": 550, "y": 240, "width": 100, "height": 60, "label": "Breakout Zone", "type": "bullish"}}
    ],
    "liquidity_sweeps": [
      {{"x": 300, "y": 480, "label": "Liquidity Grab", "direction": "down"}}
    ],
    "order_blocks": [
      {{"x": 200, "y": 400, "width": 80, "height": 40, "label": "Bullish OB", "type": "bullish"}}
    ],
    "fair_value_gaps": [
      {{"x": 350, "y": 280, "width": 60, "height": 30, "label": "FVG", "type": "bullish"}}
    ]
  }},
  "key_levels": {{
    "support": ["1.0850 - Strong weekly support", "1.0780 - Secondary support"],
    "resistance": ["1.1050 - Major resistance", "1.0980 - Minor resistance"]
  }},
  "patterns_detected": [
    {{"name": "Head & Shoulders", "type": "reversal", "significance": "high", "completion": "75%"}},
    {{"name": "Ascending Triangle", "type": "continuation", "significance": "medium", "completion": "90%"}},
    {{"name": "Bull Flag", "type": "continuation", "significance": "medium", "completion": "85%"}},
    {{"name": "Double Bottom", "type": "reversal", "significance": "high", "completion": "100%"}}
  ],
  "harmonic_patterns": [
    {{"name": "Gartley", "direction": "bullish", "completion": "78%", "potential_reversal_zone": "1.0850-1.0870"}}
  ],
  "market_structure": "Detailed market structure analysis with HH/HL/LH/LL, BOS, CHoCH identification",
  "candlestick_patterns": ["Bullish Engulfing at support", "Pin Bar rejection", "Morning Star formation"],
  "momentum": "Strong/Weak bullish/bearish momentum assessment",
  "scenarios": {{
    "bullish": "Bullish scenario description with targets",
    "bearish": "Bearish scenario description with invalidation levels"
  }},
  "trade_idea": {{
    "valid": true,
    "direction": "BUY" or "SELL",
    "entry_zone": "Entry price range",
    "stop_loss": "Stop loss level with reasoning",
    "tp1": "First target",
    "tp2": "Second target",
    "tp3": "Third target",
    "risk_level": "Low/Medium/High",
    "confidence": 75,
    "risk_reward_ratio": "1:3",
    "why_this_trade": "Detailed confluence-based reasoning for this trade setup"
  }},
  "volume_analysis": "Volume profile assessment",
  "breakout_zones": ["Key breakout levels"],
  "overall_assessment": "Comprehensive 2-3 sentence conclusion about the chart setup and probability of success"
}}

IMPORTANT: 
1. Detect ALL visible patterns - classics, harmonics, and structure-based
2. Provide accurate pixel coordinates for visual overlays
3. Include necklines for H&S patterns, targets for breakouts
4. Rate pattern completion percentage when applicable
5. Be specific about Fibonacci levels for harmonic patterns"""

        response = await chat.send_message(UserMessage(text=prompt, image=data.image_base64))

        try:
            resp_text = response.strip()
            if resp_text.startswith("```"):
                resp_text = resp_text.split("\n", 1)[1].rsplit("```", 1)[0]
            ai_result = json.loads(resp_text)
        except Exception:
            ai_result = {
                "market_bias": "NEUTRAL",
                "bias_score": 50,
                "trade_quality_score": 40,
                "market_summary": response[:300] if response else "Analysis in progress",
                "trend_direction": "SIDEWAYS",
                "visual_overlays": {
                    "support_zones": [{"y": 450, "label": "Support Area", "strength": "medium"}],
                    "resistance_zones": [{"y": 150, "label": "Resistance Area", "strength": "medium"}],
                    "trendlines": [],
                    "patterns": [],
                    "entry_markers": [],
                    "stop_loss_markers": [],
                    "take_profit_markers": [],
                    "breakout_zones": [],
                    "liquidity_sweeps": [],
                    "order_blocks": [],
                    "fair_value_gaps": []
                },
                "patterns_detected": [],
                "harmonic_patterns": [],
                "trade_idea": {"valid": False},
                "overall_assessment": response[:500] if response else "Unable to fully parse chart"
            }

        analysis_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["user_id"],
            "type": "chart_upload",
            "symbol": data.pair_name or "Uploaded Chart",
            "timeframe": data.timeframe,
            "asset_type": data.market_type,
            "ai_result": ai_result,
            "has_image": True,
            "accuracy_feedback": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.analyses.insert_one(analysis_doc)
        await add_xp(user["user_id"], 30)
        return {"analysis": {k: v for k, v in analysis_doc.items() if k != "_id"}}
    except Exception as e:
        logger.error(f"Chart upload analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Analysis Feedback ---
@api_router.post("/analysis/{analysis_id}/feedback")
async def analysis_feedback(analysis_id: str, data: AnalysisFeedback, user=Depends(get_current_user)):
    await db.analyses.update_one(
        {"id": analysis_id, "user_id": user["user_id"]},
        {"$set": {"accuracy_feedback": {"worked": data.worked, "notes": data.notes, "submitted_at": datetime.now(timezone.utc).isoformat()}}}
    )
    return {"success": True}

# --- AI Accuracy Stats ---
@api_router.get("/analysis/accuracy")
async def get_accuracy_stats(user=Depends(get_current_user)):
    analyses = await db.analyses.find({"user_id": user["user_id"], "accuracy_feedback": {"$ne": None}}, {"_id": 0}).to_list(500)
    total = len(analyses)
    correct = len([a for a in analyses if a.get("accuracy_feedback", {}).get("worked")])
    accuracy = (correct / total * 100) if total > 0 else 0
    return {"total_reviewed": total, "correct": correct, "accuracy": round(accuracy, 1)}

# --- Price Alerts System ---
class PriceAlert(BaseModel):
    symbol: str
    alert_type: str  # "above", "below", "cross_resistance", "cross_support"
    price_level: float
    enabled: bool = True
    notes: Optional[str] = ""

@api_router.post("/alerts")
async def create_alert(data: PriceAlert, user=Depends(get_current_user)):
    """Create a new price alert"""
    alert_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        **data.model_dump(),
        "triggered": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.price_alerts.insert_one(alert_doc)
    return {"alert": {k: v for k, v in alert_doc.items() if k != "_id"}}

@api_router.get("/alerts")
async def get_alerts(user=Depends(get_current_user)):
    """Get all user's price alerts"""
    alerts = await db.price_alerts.find(
        {"user_id": user["user_id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"alerts": alerts}

@api_router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, user=Depends(get_current_user)):
    """Delete a price alert"""
    await db.price_alerts.delete_one({"id": alert_id, "user_id": user["user_id"]})
    return {"success": True}

@api_router.put("/alerts/{alert_id}/toggle")
async def toggle_alert(alert_id: str, user=Depends(get_current_user)):
    """Toggle alert enabled status"""
    alert = await db.price_alerts.find_one({"id": alert_id, "user_id": user["user_id"]})
    if alert:
        new_status = not alert.get("enabled", True)
        await db.price_alerts.update_one(
            {"id": alert_id},
            {"$set": {"enabled": new_status}}
        )
        return {"enabled": new_status}
    raise HTTPException(status_code=404, detail="Alert not found")

@api_router.get("/alerts/check")
async def check_alerts(user=Depends(get_current_user)):
    """Check alerts against current prices and return triggered alerts"""
    import yfinance as yf
    
    alerts = await db.price_alerts.find(
        {"user_id": user["user_id"], "enabled": True, "triggered": False},
        {"_id": 0}
    ).to_list(100)
    
    triggered = []
    for alert in alerts:
        try:
            ticker = yf.Ticker(alert["symbol"])
            hist = ticker.history(period="1d")
            if hist.empty:
                continue
            current_price = float(hist['Close'].iloc[-1])
            
            is_triggered = False
            if alert["alert_type"] == "above" and current_price >= alert["price_level"]:
                is_triggered = True
            elif alert["alert_type"] == "below" and current_price <= alert["price_level"]:
                is_triggered = True
            elif alert["alert_type"] in ["cross_resistance", "cross_support"]:
                # Check if price crossed the level
                if len(hist) > 1:
                    prev_price = float(hist['Close'].iloc[-2])
                    if alert["alert_type"] == "cross_resistance":
                        if prev_price < alert["price_level"] <= current_price:
                            is_triggered = True
                    else:  # cross_support
                        if prev_price > alert["price_level"] >= current_price:
                            is_triggered = True
            
            if is_triggered:
                triggered.append({
                    **alert,
                    "current_price": current_price,
                    "triggered_at": datetime.now(timezone.utc).isoformat()
                })
                # Mark as triggered in DB
                await db.price_alerts.update_one(
                    {"id": alert["id"]},
                    {"$set": {"triggered": True, "triggered_at": datetime.now(timezone.utc).isoformat()}}
                )
        except Exception as e:
            logger.error(f"Alert check error for {alert['symbol']}: {e}")
            continue
    
    return {"triggered_alerts": triggered}

@api_router.get("/market/live-scan")
async def live_market_scan():
    """Background scan for significant market events (1-minute interval compatible)"""
    import yfinance as yf
    
    # Key instruments to monitor
    watchlist = [
        ("EURUSD=X", "EUR/USD"), ("GC=F", "Gold"), ("BTC-USD", "Bitcoin"),
        ("^GSPC", "S&P 500"), ("GBPUSD=X", "GBP/USD"), ("ETH-USD", "Ethereum")
    ]
    
    events = []
    for symbol, name in watchlist:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="5d", interval="1h")
            if hist.empty or len(hist) < 20:
                continue
            
            current = float(hist['Close'].iloc[-1])
            high_20 = float(hist['High'].tail(20).max())
            low_20 = float(hist['Low'].tail(20).min())
            sma_20 = float(hist['Close'].tail(20).mean())
            
            # Calculate price change
            prev_close = float(hist['Close'].iloc[-2])
            change_pct = ((current - prev_close) / prev_close) * 100
            
            # Detect events
            event_type = None
            if current >= high_20 * 0.99:  # Within 1% of 20-period high
                event_type = "approaching_resistance"
            elif current <= low_20 * 1.01:  # Within 1% of 20-period low
                event_type = "approaching_support"
            elif abs(change_pct) >= 1.0:  # 1%+ move
                event_type = "significant_move"
            elif abs(current - sma_20) / sma_20 < 0.002:  # Touching SMA
                event_type = "sma_touch"
            
            if event_type:
                events.append({
                    "symbol": symbol,
                    "name": name,
                    "event_type": event_type,
                    "current_price": round(current, 5),
                    "change_pct": round(change_pct, 2),
                    "high_20": round(high_20, 5),
                    "low_20": round(low_20, 5),
                    "sma_20": round(sma_20, 5),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
        except Exception as e:
            logger.error(f"Live scan error for {symbol}: {e}")
            continue
    
    return {"events": events, "scanned_at": datetime.now(timezone.utc).isoformat()}

# --- Daily Recap ---
@api_router.get("/recap")
async def get_daily_recap(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    trades_today = await db.trades.find({"user_id": user["user_id"], "created_at": {"$regex": f"^{today}"}}, {"_id": 0}).to_list(100)
    signals_today = await db.signals.find({"user_id": user["user_id"], "created_at": {"$regex": f"^{today}"}}, {"_id": 0}).to_list(100)
    analyses_today = await db.analyses.find({"user_id": user["user_id"], "created_at": {"$regex": f"^{today}"}}, {"_id": 0}).to_list(100)
    pnl = sum(t.get("pnl", 0) for t in trades_today if t.get("pnl"))
    wins = len([t for t in trades_today if (t.get("pnl", 0)) > 0])
    losses = len([t for t in trades_today if (t.get("pnl", 0)) < 0])
    return {
        "date": today,
        "trades_count": len(trades_today),
        "signals_count": len(signals_today),
        "analyses_count": len(analyses_today),
        "pnl": round(pnl, 2),
        "wins": wins,
        "losses": losses,
        "win_rate": round((wins / (wins + losses) * 100) if (wins + losses) > 0 else 0, 1)
    }

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
