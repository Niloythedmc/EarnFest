# Spin Wheel System - Security & Probability Fix

## Issues Fixed

### 1. **Incorrect Probability Distribution**
**Problem**: Higher-value prizes ($0.05, $0.10, $0.20, $0.50, $1.00) were winning too frequently
- Old $0.05 probability: 10% (should be 0%)
- Old $0.01 probability: 40% (kept as-is)
- Old $0.005 probability: 30% (should be 40%)
- Old $0.001 probability: 10% (should be 30%)

**Solution**: Updated to correct probabilities:
- **$0.001**: 30% chance ✓
- **$0.005**: 40% chance ✓
- **$0.01**: 30% chance ✓
- **All others**: 0% chance ✓

---

## Security Improvements

### 1. **Cryptographically Secure Random Number Generation**
- **Before**: Used `Math.random()` which is predictable and hackable
- **After**: Uses Node.js `crypto.randomBytes()` - cryptographically secure
- **Impact**: Impossible for users/hacks to predict or manipulate spin results

### 2. **Backend-Only Prize Selection**
- **Before**: Probabilities were visible in frontend code
- **After**: All probability calculations happen on backend
- **Impact**: Users cannot modify HTTP requests to change outcomes

### 3. **Transaction-Based Balance Verification**
- All balance checks happen in Firestore transactions
- Atomic operations prevent race conditions
- User cannot tamper with balance during spin

### 4. **Rate Limiting**
- **Spin Cooldown**: 1 second minimum between spins (prevents rapid spam)
- **Hourly Limit**: Maximum 60 spins per hour per user
- **Impact**: Reduces abuse potential

### 5. **Configuration Verification**
- Game probabilities are defined in centralized config file
- Probabilities verified on startup and before each spin
- Sum must equal 1.0 (catches configuration errors)

### 6. **Comprehensive Audit Trail**
Every spin is logged with:
- Audit hash (SHA256): Allows verification of randomness
- Timestamp: Tracks when spin occurred
- User tier: Player's subscription level
- Outcome: Prize won and net gain
- **Usage**: Admin can investigate suspicious patterns or investigate fraud claims

### 7. **Security Logging**
- High-value spins (>$0.01) are logged immediately for monitoring
- Failed balance checks are logged (tracks abuse attempts)
- Rate limit violations are logged (tracks spam attempts)

### 8. **Configuration File**
Created [gameProbabilities.js](../config/gameProbabilities.js):
- Centralized, auditable prize definitions
- Integrity checks on startup
- Prevents accidental configuration changes

---

## Files Modified

### Backend Changes

#### 1. [userRoutes.js](../routes/userRoutes.js)
- ✅ Added `crypto` (imported at top)
- ✅ Replaced all hardcoded prizes with config imports
- ✅ Added `getCryptoRandom()` function
- ✅ Added 3 security checks in transaction:
  - Balance verification
  - Cooldown enforcement
  - Hourly rate limiting
- ✅ Configuration validation before each spin
- ✅ Audit trail with hash for fraud investigation
- ✅ Security logging for suspicious activity

#### 2. [gameProbabilities.js](../config/gameProbabilities.js) **[NEW FILE]**
- Defines `SPIN_WHEEL_PRIZES` array with correct probabilities
- Defines `SPIN_WHEEL_CONFIG` with cooldown and rate limits
- `verifyProbabilityConfig()` function runs on startup
- Prevents forbidden prizes from being added
- Configuration validation catches errors early

### Frontend Changes

#### 3. [SpinWheel.jsx](../pages/SpinWheel.jsx)
- ✅ Updated wheel to show only 3 prizes (not 8)
- ✅ Adjusted rotation calculations (120° per segment instead of 45°)
- ✅ Updated wheel gradient to 3 segments
- ✅ Updated UI text to show correct probabilities
- ✅ Updated visual to match actual prize distribution

---

## How It Works (Security Flow)

```
1. User clicks Spin Button
   ↓
2. Frontend sends spin request to /api/user/spin
   ↓
3. Backend validates INIT DATA (Telegram signature)
   ↓
4. Backend starts Firestore transaction:
   - Fetch user document
   - Check balance >= $0.005
   - Check cooldown timer
   - Check hourly spin limit
   - All checks MUST pass
   ↓
5. Generate secure random number with crypto.randomBytes()
   ↓
6. Use probability distribution from gameProbabilities.js
   - 30% → $0.001
   - 40% → $0.005
   - 30% → $0.01
   ↓
7. Calculate prize and update balance atomically
   - Store audit hash, timestamp, user tier
   ↓
8. Return result to frontend
   ↓
9. Frontend animates wheel to show result
```

---

## Anti-Tampering Measures

| Attack Vector | Prevention |
|---|---|
| **Predict outcome** | Crypto RNG + backend-only |
| **Force high prize** | Balance checked in transaction |
| **Rapid spam spins** | Cooldown + hourly rate limit |
| **Modify balance** | Atomic transaction + Firestore security rules |
| **Fake results** | Server-verified + audit trail |
| **Replay attacks** | Cooldown + timestamp validation |
| **Configuration changes** | Verified on startup + immutable file |

---

## Admin Audit Commands

### View Spin History with Audit Hash
```javascript
// Check specific user's spins
db.collection('users').doc(telegramId).get()
  .then(doc => console.log(doc.data().spinHistory))

// High-value spin alerts appear in server logs
// Search for: [HIGH_VALUE_SPIN]
```

### Verify Randomness (Future)
- Audit hashes allow external verification
- Combined with timestamp and random value
- Can prove spins were not predetermined

---

## Testing Recommendations

### Manual Testing
```bash
# Test 1: Verify correct probabilities (sample 100 spins)
# Expected: ~30% $0.001, ~40% $0.005, ~30% $0.01

# Test 2: Try rapid spins
# Expected: Cooldown error on 2nd spin within 1 second

# Test 3: Spin 60+ times in 1 hour
# Expected: Rate limit error after 60 spins

# Test 4: Try spin with $0.004 balance
# Expected: Insufficient balance error
```

### Fraud Detection Monitoring
- Monitor server logs for `[HIGH_VALUE_SPIN]` entries
- Check `Insufficient balance attempt` logs for abuse
- Review `Spin cooldown violation` logs for spam
- Verify audit hashes match timestamps

---

## Summary

✅ **Probabilities Fixed**: $0.001 (30%), $0.005 (40%), $0.01 (30%)  
✅ **Cryptographic RNG**: Backend-only, impossible to predict  
✅ **Anti-Tampering**: Multiple security layers, audit trail  
✅ **Rate Limiting**: Cooldown + hourly limits  
✅ **Configuration Audit**: Verified on startup  
✅ **Logging**: Security alerts for suspicious activity  

**System is now secured against tampering while maintaining correct probability distribution.**
