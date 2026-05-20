# Anti-Autoclicker System Implementation

## Overview
A comprehensive anti-autoclicker system has been implemented to prevent automated bot abuse and multi-account exploitation in the EarnFest application. The system combines three key mechanisms:

1. **Interstitial Ads** - Randomly displayed after rewarded ads to break automation patterns
2. **Swappable Captchas** - Human verification after 4-5 ad views
3. **Multi-Account Detection** - IP/Device fingerprinting to prevent PVP bidding from multi-account users

---

## Backend Implementation

### 1. Device Fingerprinting (`backend/src/utils/deviceFingerprint.js`)

**Features:**
- Tracks user IP address and device characteristics
- Detects multiple accounts on the same IP/device
- Stores device history for fraud investigation
- Generates device fingerprints from browser/device info

**Key Functions:**
- `generateDeviceHash(userAgent, language, timezone)` - Creates a device hash
- `checkMultiAccountOnDevice(telegramId, ipAddress, deviceFingerprint)` - Detects multi-accounts
- `updateUserDeviceInfo(telegramId, ipAddress, deviceFingerprint, userAgent)` - Records device info
- `getLinkedAccountsOnIP(ipAddress)` - Gets all accounts on same IP

**Database Storage:**
- `lastIpAddress` - User's last IP address
- `deviceFingerprint` - Device identifier
- `userAgent` - Browser user agent string
- `lastDeviceUpdateAt` - Timestamp of last device update

---

### 2. Anti-Autoclicker Manager (`backend/src/utils/antiAutoClickerManager.js`)

**Features:**
- 35% probability of showing interstitial after rewarded ad
- Random captcha requirement after 4-6 ads
- Tracks ad viewing patterns for suspicious activity detection
- Session-based verification to prevent replay attacks

**Configuration:**
```javascript
INTERSTITIAL_PROBABILITY = 0.35  // 35% chance per ad
CAPTCHA_FREQUENCY = 5             // 4-6 ads randomized
```

**Key Functions:**
- `shouldShowInterstitial(telegramId)` - Determines if interstitial needed
- `shouldShowCaptcha(adCountSinceLastCaptcha)` - Determines if captcha needed
- `recordInterstitialView(telegramId, sessionId)` - Records interstitial display
- `recordCaptchaSolved(telegramId, captchaType)` - Records captcha completion
- `isSuspectedAutoClicker(telegramId)` - Detects rapid ad viewing (20+ in 5 mins)

**User Database Fields:**
- `lastInterstitialAt` - Timestamp of last interstitial
- `interstitialViewCount` - Total interstitials shown
- `lastCaptchaSolvedAt` - Timestamp of last captcha solve
- `captchaSolveCount` - Total captchas solved
- `adCountSinceLastCaptcha` - Counter for captcha frequency
- `lastInterstitialSessionId` - Current session ID

---

### 3. Updated Ad Reward Logic (`backend/src/utils/adReward.js`)

**Changes:**
- Accepts device info parameter (IP, fingerprint, user agent)
- Integrates anti-autoclicker checks before crediting reward
- Returns interstitial/captcha info in response
- Detects suspected autoclickers (20+ ads in 5 minutes)

**Response Format:**
```json
{
  "ok": true,
  "newBalance": 1000.50,
  "rewardAmount": 50,
  "antiAutoclicker": {
    "shouldShowInterstitial": true/false,
    "interstitialSessionId": "session_xxx",
    "shouldShowCaptcha": true/false,
    "adCountUntilCaptcha": 2
  }
}
```

---

### 4. PVP Controller Multi-Account Check (`backend/src/controllers/pvpController.js`)

**Changes:**
- Added multi-account detection before PVP bidding
- Checks both IP address and device fingerprint
- Rejects bid if multiple accounts detected on same device

**Error Response:**
```json
{
  "error": "Multi-account detected",
  "message": "Users with multiple accounts cannot participate in PVP bidding",
  "code": "multi_account_forbidden",
  "status": 403
}
```

---

### 5. New Backend Endpoints (`backend/src/routes/userRoutes.js`)

#### POST `/api/user/verify-interstitial`
Verifies that an interstitial ad was displayed and session is valid.

**Request:**
```json
{ "sessionId": "session_xxx" }
```

**Response:**
```json
{ "success": true, "verified": true }
```

#### POST `/api/user/verify-captcha`
Verifies captcha solution and records it in user document.

**Request:**
```json
{
  "captchaToken": "token_xxx",
  "captchaType": "puzzle"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Captcha verified successfully",
  "nextCaptchaAt": "after_4_to_6_ads"
}
```

#### POST `/api/user/check-multi-account`
Checks if user has multiple accounts on same IP/device.

**Request:**
```json
{ "deviceFingerprint": "fp_xxx" }
```

**Response:**
```json
{
  "success": true,
  "isMultiAccount": false,
  "message": "No multi-account detected"
}
```

---

## Frontend Implementation

### 1. Device Fingerprinting Utility (`frontend/src/utils/deviceFingerprint.js`)

**Features:**
- Generates device fingerprint from browser/device characteristics
- Stores fingerprint in session storage
- Retrieves consistent fingerprint across session
- Collects: User agent, language, timezone, screen resolution, platform, WebGL info

**Key Functions:**
- `generateDeviceFingerprint()` - Creates new fingerprint
- `getDeviceInfo()` - Returns device info object for backend
- `getStoredDeviceFingerprint()` - Gets persistent fingerprint
- `storeDeviceFingerprint()` - Saves fingerprint to session

---

### 2. Interstitial Modal Component (`frontend/src/components/InterstitialModal.jsx`)

**Features:**
- Non-skippable verification modal
- 3-second countdown timer
- Session-based verification
- Beautiful animated UI with gold/teal theme

**Props:**
- `isOpen` - Modal visibility
- `onClose` - Close callback
- `sessionId` - Session identifier
- `onInterstitialComplete` - Completion callback

**User Experience:**
1. Modal displays with 3-second countdown
2. Cannot be closed during countdown
3. After countdown, user clicks "Continue"
4. Verifies on backend via session ID
5. Closes automatically after verification

---

### 3. Captcha Modal Component (`frontend/src/components/CaptchaModal.jsx`)

**Features:**
- 3x3 puzzle grid (9 tiles)
- Random pattern (3-4 correct tiles)
- Tile selection with visual feedback
- Refresh button to regenerate puzzle
- Backend verification via token

**Props:**
- `isOpen` - Modal visibility
- `onClose` - Close callback
- `onCaptchaSolved` - Callback when captcha solved

**User Experience:**
1. Modal shows with instruction: "Select all matching tiles"
2. User clicks correct tiles (3-4 tiles)
3. Click "Verify" to submit answer
4. Backend verifies and records completion
5. Counter resets on successful solve
6. Can refresh puzzle if needed

---

### 4. Updated Components

#### TasksPage (`frontend/src/pages/TasksPage.jsx`)
- Imports InterstitialModal and CaptchaModal
- Stores modal state with hooks
- Passes device fingerprint to ad reward
- Shows modals based on server response
- Handles modal callbacks

**Changes:**
```javascript
// State
const [showInterstitial, setShowInterstitial] = useState(false);
const [interstitialSessionId, setInterstitialSessionId] = useState(null);
const [showCaptcha, setShowCaptcha] = useState(false);

// Ad callback
const result = await addReward('ad', 0, { deviceFingerprint });
if (result.antiAutoclicker?.shouldShowInterstitial) {
  setInterstitialSessionId(result.antiAutoclicker.interstitialSessionId);
  setShowInterstitial(true);
}
```

#### PvpPage (`frontend/src/pages/PvpPage.jsx`)
- Imports device fingerprinting utility
- Passes device fingerprint when joining game
- Handles multi-account error with user-friendly message

**Changes:**
```javascript
const deviceFingerprint = getStoredDeviceFingerprint();
const res = await axios.post(`${apiBase}/api/pvp/join`, {
  amount,
  deviceFingerprint
});
```

#### UserContext (`frontend/src/context/UserContext.jsx`)
- Updated `addReward()` function to accept device info
- Passes device fingerprint to backend
- Returns anti-autoclicker info from server response

---

## Security Features

### 1. Unpredictability
- Random interstitial (35% chance each ad)
- Randomized captcha frequency (4-6 ads)
- Session-based verification prevents replay
- No fixed patterns for bot to exploit

### 2. Multi-Account Prevention
- IP address tracking
- Device fingerprinting
- PVP bidding blocked for multi-account users
- Prevents farming through multiple accounts

### 3. Rapid Activity Detection
- Monitors for 20+ ads in 5 minutes
- Blocks suspected autoclickers
- Logs suspicious activity for review

### 4. Session Validation
- Session IDs expire after 2 minutes
- One-time use per session
- Mismatched sessions rejected

---

## User Database Schema Updates

```javascript
{
  // Device tracking
  lastIpAddress: String,
  deviceFingerprint: String,
  userAgent: String,
  lastDeviceUpdateAt: String (ISO),

  // Interstitial tracking
  lastInterstitialAt: String (ISO),
  interstitialViewCount: Number,
  lastInterstitialSessionId: String,

  // Captcha tracking
  lastCaptchaSolvedAt: String (ISO),
  captchaSolveCount: Number,
  adCountSinceLastCaptcha: Number,
  lastCaptchaType: String,

  // Existing fields (unchanged)
  balance: Number,
  adCycleCount: Number,
  lastAdRewardAt: Number,
  adCountSinceLastCaptcha: Number,
  // ...
}
```

---

## How It Works

### Ad Watching Flow

```
User watches ad
         ↓
Backend credits reward
         ↓
Checks anti-autoclicker logic
         ↓
35% chance: Show interstitial?
  ├─ YES: Return interstitialSessionId
  └─ NO: Continue
         ↓
Check captcha frequency
  ├─ YES (after 4-6 ads): Return shouldShowCaptcha=true
  └─ NO: Return shouldShowCaptcha=false
         ↓
Frontend receives response
         ↓
Show interstitial modal if needed
         ↓
Show captcha modal if needed
         ↓
User continues watching
```

### Multi-Account Prevention Flow

```
User attempts PVP bid
         ↓
Extract device fingerprint from request
         ↓
Check if other accounts on same IP
         ↓
Check if other accounts on same device
         ↓
Accounts found?
  ├─ YES: Reject with error code
  └─ NO: Allow bid
         ↓
Proceed with game join
```

---

## Configuration

### Adjust Interstitial Probability
File: `backend/src/utils/antiAutoClickerManager.js`
```javascript
export const INTERSTITIAL_PROBABILITY = 0.35; // Change to 0.25, 0.5, etc.
```

### Adjust Captcha Frequency
File: `backend/src/utils/antiAutoClickerManager.js`
```javascript
// Change the threshold (currently 4-6 ads)
const randomThreshold = 4 + Math.floor(Math.random() * 3);
```

### Autoclicker Detection Threshold
File: `backend/src/utils/antiAutoClickerManager.js`
```javascript
if (recentAdViews.length >= 20) { // Change 20 to different threshold
```

---

## Testing

### Test Interstitials
1. Watch ads in TasksPage
2. On average, 1 in 3 ads should show interstitial
3. Verify countdown displays correctly
4. Verify modal cannot be closed during countdown

### Test Captcha
1. Watch 5+ ads in sequence
2. Captcha should appear
3. Select tiles and verify correct tiles are accepted
4. Test refresh button
5. Verify counter resets after completion

### Test Multi-Account Prevention
1. Create second account on same device
2. Try to join PVP game
3. Should see multi-account error
4. Verify device fingerprint is being tracked

---

## Monitoring & Analytics

### Fields to Monitor
- `interstitialViewCount` - Total interstitials shown per user
- `captchaSolveCount` - Total captchas solved per user
- `adCountSinceLastCaptcha` - Current ad streak
- Rapid activity detection logs

### Admin Dashboard Considerations
- Track multi-account incidents
- Monitor autoclicker detection rate
- View device linking patterns
- Generate fraud reports

---

## Future Enhancements

1. **Variable Difficulty Captchas**
   - Increase difficulty for suspicious users
   - Rotate between puzzle types

2. **ML-Based Detection**
   - Train model on bot patterns
   - Detect subtle automation

3. **Geolocation Verification**
   - Add geographic data to fingerprint
   - Flag impossible location changes

4. **Behavioral Analysis**
   - Track click patterns
   - Monitor response times
   - Detect mechanical precision

---

## Troubleshooting

### Interstitial Not Showing
- Check `INTERSTITIAL_PROBABILITY` value
- Verify modal state management
- Check browser console for errors

### Captcha Not Appearing
- Verify `shouldShowCaptcha` logic in response
- Check if user is being counted correctly
- Verify `adCountSinceLastCaptcha` is incrementing

### Multi-Account Check Failing
- Ensure IP address is being extracted correctly
- Verify device fingerprint generation
- Check Firestore queries for users

---

## Files Modified/Created

### Backend
✅ Created: `backend/src/utils/deviceFingerprint.js`
✅ Created: `backend/src/utils/antiAutoClickerManager.js`
✅ Updated: `backend/src/utils/adReward.js`
✅ Updated: `backend/src/controllers/pvpController.js`
✅ Updated: `backend/src/routes/userRoutes.js`

### Frontend
✅ Created: `frontend/src/components/InterstitialModal.jsx`
✅ Created: `frontend/src/components/InterstitialModal.css`
✅ Created: `frontend/src/components/CaptchaModal.jsx`
✅ Created: `frontend/src/components/CaptchaModal.css`
✅ Created: `frontend/src/utils/deviceFingerprint.js`
✅ Updated: `frontend/src/pages/TasksPage.jsx`
✅ Updated: `frontend/src/pages/PvpPage.jsx`
✅ Updated: `frontend/src/context/UserContext.jsx`

---

## Summary

The anti-autoclicker system is now fully implemented with:
- ✅ Random interstitial ads after rewarded ads
- ✅ Swappable captcha verification
- ✅ Device fingerprinting and multi-account detection
- ✅ PVP bidding restrictions for multi-account users
- ✅ Beautiful, responsive UI components
- ✅ Session-based security
- ✅ Comprehensive backend validation

The system makes it extremely difficult for bots to farm ad rewards predictably, while keeping the user experience smooth and transparent.
