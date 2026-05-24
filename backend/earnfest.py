import requests
import json
import time
import os
import sys
from urllib.parse import parse_qs

# --- COLORS ---
Y = "\033[93m"
C = "\033[96m"
W = "\033[97m"
R = "\033[91m"
G = "\033[92m"
X = "\033[0m"

# File to track state
STATE_FILE = "omni_miner_state.json"

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {"total_earned": 0, "ad_cycle_count": 0}

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

# Base URL
BASE_URL = "https://eidfest.up.railway.app/api"

def get_headers(init_data):
    return {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 16; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.137 Safari/537.36 Telegram-Android/12.6.4',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Android"',
        'x-telegram-init-data': init_data,
        'origin': 'https://earn-fest.web.app',
        'referer': 'https://earn-fest.web.app/',
        'x-requested-with': 'org.telegram.messenger.web'
    }

def get_user_info(init_data):
    try:
        parsed = parse_qs(init_data)
        user = json.loads(parsed['user'][0])
        return {
            'id': user.get('id'),
            'username': user.get('username', ''),
            'first_name': user.get('first_name', ''),
            'photo_url': user.get('photo_url', '')
        }
    except:
        return None

def sync_user(init_data, telegram_id, username, first_name, photo_url):
    url = f"{BASE_URL}/user/sync"
    headers = get_headers(init_data)
    payload = {
        "telegramId": telegram_id,
        "username": username,
        "firstName": first_name,
        "photoUrl": photo_url
    }
    try:
        requests.post(url, headers=headers, json=payload, timeout=10)
    except:
        pass

def get_streak(init_data, telegram_id):
    url = f"{BASE_URL}/user/streak/{telegram_id}"
    headers = get_headers(init_data)
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def continue_streak(init_data, telegram_id):
    url = f"{BASE_URL}/user/streak/continue"
    headers = get_headers(init_data)
    payload = {"telegramId": str(telegram_id)}
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def claim_reward(init_data, telegram_id):
    url = f"{BASE_URL}/user/reward"
    headers = get_headers(init_data)
    payload = {
        "telegramId": str(telegram_id),
        "type": "ad",
        "deviceFingerprint": f"fp_{telegram_id}"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            return {"success": data.get("success", False), "data": data}
        elif response.status_code == 429:
            return {"success": False, "error": "RATE_LIMITED"}
        else:
            return {"success": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    os.system('cls' if os.name == 'nt' else 'clear')
    
    print(f"{C}{'='*50}")
    print(f"{Y}🐣 OMNI MINER - AUTO CLAIMER 🐣")
    print(f"{C}{'='*50}{X}\n")
    
    print(f"{Y}📋 GET YOUR INITDATA:{X}")
    print(f"1. Open Telegram Web → Earn Fest Bot")
    print(f"2. F12 → Network tab")
    print(f"3. Find request to 'eidfest.up.railway.app'")
    print(f"4. Copy 'x-telegram-init-data' header value\n")
    
    init_data = input(f"{G}➤ Paste initData: {X}").strip()
    
    if not init_data:
        print(f"{R}❌ No initData!{X}")
        return
    
    user_info = get_user_info(init_data)
    if not user_info:
        print(f"{R}❌ Could not extract user info!{X}")
        return
    
    telegram_id = user_info['id']
    print(f"\n{G}✅ User: {user_info.get('first_name', 'Unknown')} (ID: {telegram_id}){X}")
    
    sync_user(init_data, telegram_id, 
              user_info.get('username', ''), 
              user_info.get('first_name', ''), 
              user_info.get('photo_url', ''))
    
    streak_data = get_streak(init_data, telegram_id)
    if streak_data:
        print(f"{G}📊 Streak: {streak_data.get('streak', 0)} days{X}")
    
    streak_result = continue_streak(init_data, telegram_id)
    if streak_result and streak_result.get('success'):
        print(f"{G}✅ Streak continued! Bonus: {streak_result.get('bonus', 0)}{X}")
    
    state = load_state()
    print(f"{G}💰 Total earned: {state.get('total_earned', 0)} coins{X}")
    
    print(f"\n{Y}🚀 Starting automation...{X}")
    print(f"{Y}⏱️ Delay: 30 seconds between claims{X}")
    print(f"{Y}🔄 Rate limited: Retry every 30 seconds (5 min cooldown){X}")
    print(f"{Y}🛑 Press Ctrl+C to stop{X}\n")
    
    cycle = 0
    last_balance = state.get('total_earned', 0)
    rate_limit_start = None
    
    try:
        while True:
            cycle += 1
            
            result = claim_reward(init_data, telegram_id)
            
            if result.get('success'):
                data = result.get('data', {})
                new_balance = data.get('newBalance', 0)
                ad_cycle_count = data.get('adCycleCount', 0)
                reward = data.get('reward', 0)
                
                if reward == 0 and new_balance > last_balance:
                    reward = new_balance - last_balance
                
                state['total_earned'] = new_balance
                state['ad_cycle_count'] = ad_cycle_count
                save_state(state)
                last_balance = new_balance
                
                print(f"{G}✅ Cycle {cycle} | +{reward} coins | Balance: {new_balance} | Total ads: {ad_cycle_count}{X}")
                
                delay = 30
                for remaining in range(delay, 0, -1):
                    sys.stdout.write(f"\r{C}⏳ Waiting {remaining} seconds...{X}")
                    sys.stdout.flush()
                    time.sleep(1)
                print()
                
            elif result.get('error') == 'RATE_LIMITED':
                if rate_limit_start is None:
                    rate_limit_start = time.time()
                    print(f"{R}⚠️ Rate limited! Waiting 30 seconds between retries (5 min cooldown){X}")
                else:
                    elapsed = int(time.time() - rate_limit_start)
                    print(f"{R}⚠️ Still rate limited... {elapsed//60}:{elapsed%60:02d} elapsed{X}")
                
                time.sleep(30)
                
            else:
                print(f"{R}❌ Cycle {cycle} failed: {result.get('error')}{X}")
                rate_limit_start = None
                time.sleep(5)
                    
    except KeyboardInterrupt:
        print(f"\n\n{Y}⚠️ Stopped by user{X}")
        print(f"{G}{'='*50}")
        print(f"{G}💰 FINAL BALANCE: {state.get('total_earned', 0)} coins{X}")
        print(f"{G}📊 Total ads completed: {state.get('ad_cycle_count', 0)}{X}")
        print(f"{G}{'='*50}{X}")

if __name__ == "__main__":
    main()