import express from 'express';
import { db } from '../config/db.js';
import { validateINITData, verifyAdmin } from '../middleware/auth.js';
import { ensureStatsDocExists } from '../utils/stats.js';
import axios from 'axios';
import FormData from 'form-data';
import multer from 'multer';
import { sendTelegramMessage, sendTelegramPhoto } from '../utils/bot.js';
import { getLiveUsers } from '../utils/activityTracker.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// All routes here require Admin status
router.use(validateINITData, verifyAdmin);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const applyTelegramEntitiesToHTML = (text, entities) => {
  if (!text) return '';
  if (!entities || entities.length === 0) {
    return text;
  }

  const escape = (value) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  let result = '';
  let lastIndex = 0;
  const sorted = [...entities].sort((a, b) => a.offset - b.offset);

  for (const entity of sorted) {
    const start = entity.offset;
    const end = entity.offset + entity.length;
    result += escape(text.slice(lastIndex, start));
    let segment = escape(text.slice(start, end));

    switch (entity.type) {
      case 'bold': segment = `<b>${segment}</b>`; break;
      case 'italic': segment = `<i>${segment}</i>`; break;
      case 'underline': segment = `<u>${segment}</u>`; break;
      case 'strikethrough': segment = `<s>${segment}</s>`; break;
      case 'code': segment = `<code>${segment}</code>`; break;
      case 'pre': segment = `<pre>${segment}</pre>`; break;
      case 'text_link': segment = `<a href="${entity.url}" target="_blank" rel="noopener noreferrer">${segment}</a>`; break;
      case 'url': segment = `<a href="${segment}" target="_blank" rel="noopener noreferrer">${segment}</a>`; break;
      case 'text_mention': {
        const username = entity.user?.username ? `https://t.me/${entity.user.username}` : '#';
        segment = `<a href="${username}" target="_blank" rel="noopener noreferrer">${segment}</a>`;
        break;
      }
      default: break;
    }

    result += segment;
    lastIndex = end;
  }

  result += escape(text.slice(lastIndex));
  return result;
};

const sanitizeTelegramText = (text) => {
  if (!text) return '';
  let normalized = typeof text === 'string' ? text.normalize?.('NFC') || text : text;
  normalized = normalized.replace(/\u0000/g, '');

  let cleaned = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);

    // Keep valid surrogate pairs intact
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = normalized.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        cleaned += normalized[i] + normalized[i + 1];
        i++;
      }
      continue;
    }

    // Skip unpaired low surrogates
    if (code >= 0xDC00 && code <= 0xDFFF) {
      continue;
    }

    cleaned += normalized[i];
  }

  return cleaned;
};

const normalizeTelegramEntity = (entity) => {
  if (!entity || typeof entity !== 'object') return null;

  const normalized = { ...entity };

  // Ensure required fields exist
  if (typeof normalized.offset !== 'number' || typeof normalized.length !== 'number' || !normalized.type) {
    console.log('Entity missing required fields, skipping:', normalized);
    return null;
  }

  if (normalized.type === 'custom_emoji') {
    if (normalized.custom_emoji_id && !normalized.document_id) {
      normalized.document_id = normalized.custom_emoji_id;
    }

    // If document_id still missing, drop this entity
    if (!normalized.document_id) {
      console.log('Custom emoji entity missing document_id, skipping:', normalized);
      return null;
    }
  }

  // Always remove custom_emoji_id to prevent Telegram API errors
  delete normalized.custom_emoji_id;

  return normalized;
};

const sanitizeTelegramEntities = (text, entities) => {
  if (!Array.isArray(entities) || entities.length === 0 || !text) return [];

  console.log(`Sanitizing ${entities.length} entities for text length ${text.length}`);

  const normalized = entities
    .map(normalizeTelegramEntity)
    .filter(entity => {
      if (entity === null) {
        console.log('Filtered out null entity');
        return false;
      }
      return true;
    });

  console.log(`After normalization: ${normalized.length} entities`);

  const sanitized = normalized.filter(entity => {
    // Strict validation: ensure all required fields are present and valid
    if (!entity || typeof entity !== 'object') {
      console.log('Filtered out non-object entity:', entity);
      return false;
    }
    if (typeof entity.offset !== 'number' || typeof entity.length !== 'number' || typeof entity.type !== 'string') {
      console.log('Filtered out entity missing required fields:', entity);
      return false;
    }

    const start = entity.offset;
    const end = entity.offset + entity.length;
    if (start < 0 || end > text.length || start >= end) {
      console.log('Filtered out entity with invalid offset/length:', entity, `text length: ${text.length}`);
      return false;
    }

    // Additional validation for UTF-16 surrogate pairs
    const startCode = text.charCodeAt(start);
    const endCode = text.charCodeAt(end - 1);
    if ((startCode >= 0xDC00 && startCode <= 0xDFFF) || (endCode >= 0xD800 && endCode <= 0xDBFF)) {
      console.log('Filtered out entity with invalid UTF-16 positions:', entity);
      return false;
    }

    // Custom emoji must have document_id
    if (entity.type === 'custom_emoji' && !entity.document_id) {
      console.log(`Filtered out custom_emoji entity without document_id:`, entity);
      return false;
    }

    return true;
  });

  console.log(`After sanitization: ${sanitized.length} entities`);
  return sanitized;
};

const isTelegramRetryableError = (errorData) => {
  const message = errorData?.description || errorData?.message || '';
  return /entity begins in a middle of a UTF-16 symbol|text must be encoded in UTF-8|message must be encoded in UTF-8|ENTITY_TEXT_INVALID/i.test(message);
};

// 1. User Management - Search
router.get('/users/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    const q = query.toLowerCase();

    // Helper to enrich user with detailed stats
    const getStreak = (activities, types) => {
      if (!Array.isArray(activities) || activities.length === 0) return 0;
      const countPrefix = (list) => {
        let count = 0;
        for (const item of list) {
          if (types.includes(item.type)) count += 1;
          else break;
        }
        return count;
      };
      const forward = countPrefix(activities);
      const backward = countPrefix([...activities].reverse());
      return Math.max(forward, backward);
    };

    const enrichUser = async (userData) => {
      if (!userData) return null;
      const tid = userData.telegramId?.toString() || userData.id?.toString();
      if (!tid) return userData;

      // Parallel fetch for speed
      const [minesSnap, withdrawSnap] = await Promise.all([
        db.collection('mines_games').where('userId', 'in', [tid, Number(tid)]).get(),
        db.collection('withdrawals').where('userId', 'in', [tid, Number(tid)]).get()
      ]);

      // Calculate Lifetime Earnings: current balance + total withdrawn amount
      const totalWithdrawn = withdrawSnap.docs
        .filter(d => d.data().status === 'COMPLETED')
        .reduce((sum, d) => sum + (d.data().amount || 0), 0);
      
      const lifetimeEarnings = (userData.balance || 0) + totalWithdrawn;

      const activities = userData.activities || [];
      const pvpParticipation = activities.filter(a => a.type === 'pvp_join').length;
      const spinCount = activities.filter(a => a.type === 'spin' || a.type === 'spin_game').length;
      const slotCount = activities.filter(a => a.type === 'slot_game').length;
      const minesCount = minesSnap.size;
      const promosUsed = activities.filter(a => a.type === 'promocode_reward').length;

      return {
        ...userData,
        totalWithdrawn,
        lifetimeEarnings,
        pvpParticipation,
        spinCount,
        slotCount,
        minesCount,
        promosUsed,
        consecutivePvp: getStreak(activities, ['pvp_join']),
        consecutiveSpin: getStreak(activities, ['spin', 'spin_game']),
        consecutiveSlot: getStreak(activities, ['slot_game']),
        // Join Date is already in userData.createdAt but ensuring it's clear
        joinDate: userData.createdAt || null
      };
    };

    // Search by ID (exact)
    const idDoc = await db.collection('users').doc(q).get();
    if (idDoc.exists) {
      const enriched = await enrichUser(idDoc.data());
      return res.json([enriched]);
    }

    // Search by username
    const usernameQuery = await db.collection('users')
      .where('username', '>=', q)
      .where('username', '<=', q + '\uf8ff')
      .limit(20)
      .get();

    const results = await Promise.all(usernameQuery.docs.map(doc => enrichUser(doc.data())));
    res.json(results.filter(r => r !== null));
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'User search failed' });
  }
});

// Update user from Admin Panel
router.post('/users', async (req, res) => {
  try {
    const { id, telegramId, ...userData } = req.body;
    const targetId = id || telegramId;
    if (!targetId) return res.status(400).json({ error: 'User ID is required' });
    
    // Explicitly parse float if balance provided
    if (userData.balance !== undefined) {
      userData.balance = parseFloat(userData.balance);
    }
    
    await db.collection('users').doc(String(targetId)).set(userData, { merge: true });
    res.json({ success: true, id: targetId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});


// 2. Task Management - CRUD
router.get('/tasks', async (req, res) => {
  try {
    const snapshot = await db.collection('tasks').get();
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/tasks', upload.single('image'), async (req, res) => {
  try {
    const { id, ...taskData } = req.body;
    const image = req.file;

    // Handle numeric fields that might be strings from FormData
    if (taskData.reward) taskData.reward = parseFloat(taskData.reward);
    if (taskData.completionCount) taskData.completionCount = parseInt(taskData.completionCount);

    let imageUrl = taskData.imageUrl || null;

    if (image) {
      const base64Image = image.buffer.toString('base64');
      const formData = new FormData();
      formData.append('image', base64Image);
      try {
        const resImg = await axios.post(`https://api.imgbb.com/1/upload?key=9936ea5068fcfde7b0bfed9e125f84fd`, formData, { 
          headers: formData.getHeaders() 
        });
        imageUrl = resImg.data?.data?.url;
      } catch (err) {
        console.error('Image upload failed:', err.response?.data || err.message);
        // We can continue without image or fail? User request says "when image added then upload", so if it fails we might want to warn.
        // But for now let's just use old imageUrl if available.
      }
    }

    const finalData = { ...taskData, imageUrl };

    if (id) {
      await db.collection('tasks').doc(id).set(finalData, { merge: true });
      res.json({ success: true, id, imageUrl });
    } else {
      const docRef = await db.collection('tasks').add({ ...finalData, createdAt: new Date().toISOString() });
      res.json({ success: true, id: docRef.id, imageUrl });
    }
  } catch (error) {
    console.error('Task save error:', error);
    res.status(500).json({ error: 'Failed to save task' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    await db.collection('tasks').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ── AppStats ──────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    await ensureStatsDocExists();
    const doc = await db.collection('users').doc('AppStats').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Game Analytics ────────────────────────────────────────────────────────────
router.get('/game-analytics', async (req, res) => {
  try {
    const doc = await db.collection('users').doc('AppStats').get();
    if (!doc.exists) return res.json({ games: {} });

    const data = doc.data();
    const gamePlays = data.gamePlays || { spin_wheel: 0, slots: 0, coinflip: 0 };
    const gameActiveUsersRaw = data.gameActiveUsers || {};
    const todayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Build per-game analytics with total plays and active users today
    const GAME_LABELS = {
      spin_wheel: 'Lucky Spin',
      slots: 'Slot Machine',
      coinflip: 'Coin Flip'
    };

    const games = {};
    for (const [key, label] of Object.entries(GAME_LABELS)) {
      const todayActive = gameActiveUsersRaw[key]?.[todayKey] || 0;
      // Also compute 7-day active for a trend view
      let sevenDayActive = 0;
      const dailyData = gameActiveUsersRaw[key] || {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = d.toISOString().slice(0, 10).replace(/-/g, '');
        sevenDayActive += dailyData[k] || 0;
      }

      games[key] = {
        label,
        totalPlays: gamePlays[key] || 0,
        activeToday: todayActive,
        active7d: sevenDayActive
      };
    }

    res.json({ games });
  } catch (error) {
    console.error('Game analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch game analytics' });
  }
});

router.get('/users/search-index', async (req, res) => {
  try {
    const doc = await db.collection('appdata').doc('users').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user search index' });
  }
});

router.get('/users/rebuild-index', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const batchSize = 400; // Firestore limit is 500, we'll be safe
    let currentBatch = {};
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (doc.id === 'AppStats') return; // Skip stats doc
      
      const tid = data.telegramId?.toString() || doc.id;
      currentBatch[tid] = {
        u: (data.username || '').toLowerCase(),
        n: (data.firstName || '').toLowerCase(),
        p: data.photoUrl || '',
        id: tid
      };
      count++;
    });

    // We can't really "batch" a single document set, we just set the whole thing.
    // If it's too big (over 1MB), this will fail. 
    // But for now we stick to the "one doc" requirement.
    await db.collection('appdata').doc('users').set(currentBatch);

    res.json({ success: true, count });
  } catch (error) {
    console.error('Rebuild index error:', error);
    res.status(500).json({ error: 'Failed to rebuild search index' });
  }
});

router.get('/users/leaderboard', async (req, res) => {
  try {
    const { type = 'current', offset = 0, limit = 20 } = req.query;
    const sortField = type === 'lifetime' ? 'lifetimeEarnings' : 'balance';
    
    const snapshot = await db.collection('users')
      .orderBy(sortField, 'desc')
      .offset(parseInt(offset))
      .limit(parseInt(limit))
      .get();

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(users);
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.get('/users/rebuild-leaderboard', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    let count = 0;
    
    const batch = db.batch();
    
    for (const userDoc of snapshot.docs) {
      if (userDoc.id === 'AppStats') continue;
      const userData = userDoc.data();
      
      // Calculate lifetimeEarnings: Balance + All completed withdrawals
      const withdrawSnap = await db.collection('withdrawals')
        .where('userId', 'in', [userDoc.id, Number(userDoc.id)])
        .where('status', '==', 'COMPLETED')
        .get();
        
      const totalWithdrawn = withdrawSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
      const lifetimeEarnings = (userData.balance || 0) + totalWithdrawn;
      
      batch.update(userDoc.ref, { 
        lifetimeEarnings,
        totalWithdrawn 
      });
      count++;
      
      if (count % 400 === 0) await batch.commit();
    }
    
    await batch.commit();
    res.json({ success: true, count });
  } catch (error) {
    console.error('Rebuild leaderboard error:', error);
    res.status(500).json({ error: 'Failed to rebuild leaderboard stats' });
  }
});

// 3. Promo Management - CRUD
router.get('/promocodes', async (req, res) => {
  try {
    const snapshot = await db.collection('promocodes').get();
    const codes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promocodes' });
  }
});

router.post('/promocodes', async (req, res) => {
  try {
    const { id, code, ...promoData } = req.body;
    const cleanCode = code.toUpperCase().trim();

    const data = {
      ...promoData,
      code: cleanCode,
      reward: parseFloat(promoData.reward),
      supply: parseInt(promoData.supply),
      updatedAt: new Date().toISOString()
    };

    if (id) {
      await db.collection('promocodes').doc(id).set(data, { merge: true });
      res.json({ success: true, id });
    } else {
      const docRef = await db.collection('promocodes').add({ ...data, createdAt: new Date().toISOString() });
      res.json({ success: true, id: docRef.id });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save promocode' });
  }
});

router.delete('/promocodes/:id', async (req, res) => {
  try {
    await db.collection('promocodes').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete promocode' });
  }
});

// Referral link management for marketing campaigns and startapp params
const normalizeReferralParam = (param) => {
  if (!param) return '';
  return String(param).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '').toUpperCase();
};

router.get('/referral-links', async (req, res) => {
  try {
    const snapshot = await db.collection('referralLinks').get();
    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch referral links' });
  }
});

router.post('/referral-links', async (req, res) => {
  try {
    const { id, param, title, description, targetUrl } = req.body;
    const cleanParam = normalizeReferralParam(param);
    if (!cleanParam) {
      return res.status(400).json({ error: 'Referral parameter is required' });
    }

    if (!/[^\d]/.test(cleanParam)) {
      return res.status(400).json({ error: 'Parameter must contain at least one character without number' });
    }

    const data = {
      param: cleanParam,
      title: title ? String(title).trim() : `Referral ${cleanParam}`,
      description: description ? String(description).trim() : '',
      targetUrl: targetUrl ? String(targetUrl).trim() : '',
      updatedAt: new Date().toISOString(),
    };

    if (id) {
      await db.collection('referralLinks').doc(id).set(data, { merge: true });
      return res.json({ success: true, id });
    }

    const docRef = await db.collection('referralLinks').add({
      ...data,
      joinCount: 0,
      adViews: 0,
      adEarnings: 0,
      joinedUsers: [],
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('Referral Link Save Error:', error);
    res.status(500).json({ error: 'Failed to save referral link' });
  }
});

router.delete('/referral-links/:id', async (req, res) => {
  try {
    await db.collection('referralLinks').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete referral link' });
  }
});

// 4. Send Bot Message to Users (Background Processing & Persistence)
router.post('/bot/send', upload.single('image'), async (req, res) => {
  try {
    const {
      message,
      mode,
      filterType,
      buttons,
      balanceAmount,
      daysAgo,
      planType,
      targetIds,
      force,
      entities: entityPayload,
      captionEntities: captionEntityPayload,
      replyMarkup: replyMarkupPayload,
      photo: photoPayload,
      video: videoPayload,
      animation: animationPayload,
      sticker: stickerPayload
    } = req.body;

    const isForce = force === 'true' || force === true;

    const image = req.file;
    const parsePayload = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try { return JSON.parse(data); } catch (e) { return []; }
    };

    const parseMedia = (data) => {
      if (!data) return null;
      if (typeof data === 'object') return data;
      try { return JSON.parse(data); } catch (e) { return null; }
    };

    const rawEntities = parsePayload(entityPayload);
    const rawCaptionEntities = parsePayload(captionEntityPayload);
    const forwardedReplyMarkup = replyMarkupPayload ? (typeof replyMarkupPayload === 'string' ? JSON.parse(replyMarkupPayload) : replyMarkupPayload) : null;

    const rawPhoto = parseMedia(photoPayload);
    const rawVideo = parseMedia(videoPayload);
    const rawAnimation = parseMedia(animationPayload);
    const rawSticker = parseMedia(stickerPayload);

    // Clean and normalize entities using advanced helper
    const entities = sanitizeTelegramEntities(message, rawEntities);
    const captionEntities = sanitizeTelegramEntities(message, rawCaptionEntities);

    // Process Image early to get URL (do this before backgrounding)
    let imageUrl = null;
    if (image) {
      const base64Image = image.buffer.toString('base64');
      const formData = new FormData();
      formData.append('image', base64Image);
      try {
        const resImg = await axios.post(`https://api.imgbb.com/1/upload?key=9936ea5068fcfde7b0bfed9e125f84fd`, formData, { headers: formData.getHeaders() });
        imageUrl = resImg.data?.data?.url;
      } catch (err) {
        return res.status(500).json({ error: 'Image upload failed' });
      }
    }

    // Handle Buttons
    let finalMarkup = null;
    const parsedButtons = typeof buttons === 'string' ? JSON.parse(buttons) : buttons;
    if (Array.isArray(parsedButtons) && parsedButtons.length > 0) {
      finalMarkup = {
        inline_keyboard: [
          parsedButtons.map(b => {
            const btnObj = { text: b.title || b.text, url: b.link || b.url };
            if (b.icon_custom_emoji_id) {
              btnObj.icon_custom_emoji_id = b.icon_custom_emoji_id;
            }
            return btnObj;
          })
        ]
      };
    } else if (forwardedReplyMarkup) {
      finalMarkup = forwardedReplyMarkup;
    }

    // Create Broadcast Record with status initializing
    const broadcastRef = await db.collection('broadcasts').add({
        status: 'initializing',
        total: 0,
        sentCount: 0,
        failedCount: 0,
        failedIds: [],
        createdAt: new Date().toISOString()
    });

    const broadcastId = broadcastRef.id;

    // IMMEDIATE RESPONSE
    res.json({ success: true, broadcastId, status: 'initializing' });

    // BACKGROUND WORKER
    setImmediate(async () => {
        try {
            // Helper to check if broadcast was cancelled
            const isCancelled = async () => {
                try {
                    const doc = await broadcastRef.get();
                    return doc.exists && doc.data().status === 'cancelled';
                } catch {
                    return false;
                }
            };

            // Discovery of Target Users (Optimized for Large Scale)
            let targetUsers = [];

            if (filterType === 'targeted') {
              const ids = (targetIds || '').split(/[,\n;]+/).map(id => id.trim()).filter(Boolean);
              for (const id of [...new Set(ids)]) {
                  targetUsers.push({ telegramId: id, id });
              }
            } else {
                // Broad filters - Using Paginated Query to handle large volumes (no limit)
                let query = db.collection('users');
                const fields = ['telegramId', 'blocked'];
                if (filterType === 'balance') fields.push('balance');
                if (filterType === 'inactive') fields.push('lastAdDate', 'createdAt');
                if (filterType === 'plan') {
                  fields.push('tier');
                  query = query.where('tier', '==', planType);
                }

                let lastDoc = null;
                let hasMore = true;
                const PAGE_SIZE = 1000;

                while (hasMore) {
                  // Check cancellation during discovery
                  if (await isCancelled()) {
                      console.log(`Broadcast ${broadcastId} cancelled during discovery.`);
                      return;
                  }

                  let paginatedQuery = query.select(...fields).limit(PAGE_SIZE);
                  if (lastDoc) {
                    paginatedQuery = paginatedQuery.startAfter(lastDoc);
                  }
                  
                  const snap = await paginatedQuery.get();
                  if (snap.empty) {
                    hasMore = false;
                    break;
                  }

                  snap.forEach(doc => {
                      const u = { id: doc.id, ...doc.data() };
                      if (!isForce && u.blocked === true) return; // Skip blocked users!

                      if (filterType === 'balance') {
                         if ((u.balance || 0) < parseFloat(balanceAmount)) targetUsers.push(u);
                      } else if (filterType === 'inactive') {
                          const diff = Math.floor((Date.now() - new Date(u.lastAdDate || u.createdAt).getTime()) / 86400000);
                          if (diff >= parseInt(daysAgo)) targetUsers.push(u);
                      } else {
                         targetUsers.push(u);
                      }
                  });

                  lastDoc = snap.docs[snap.docs.length - 1];
                  if (snap.docs.length < PAGE_SIZE) hasMore = false;
                }
            }

            // Check cancellation after discovery
            if (await isCancelled()) {
                console.log(`Broadcast ${broadcastId} cancelled after discovery.`);
                return;
            }

            // Target users discovery completed
            await broadcastRef.update({
                status: 'processing',
                total: targetUsers.length
            });

            if (targetUsers.length === 0) {
                await broadcastRef.update({ status: 'completed' });
                return;
            }

            let sent = 0;
            let failedIds = [];

            const BATCH_SIZE = 30; // Max 30 requests per second

            for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
                // Check cancellation before each batch
                if (await isCancelled()) {
                    console.log(`Broadcast ${broadcastId} cancelled during sending. Sent: ${sent}, Failed: ${failedIds.length}`);
                    await broadcastRef.update({
                        sentCount: sent,
                        failedCount: failedIds.length,
                        failedIds: failedIds,
                        status: 'cancelled'
                    });
                    return;
                }

                const batch = targetUsers.slice(i, i + BATCH_SIZE);
                const startTime = Date.now();

                await Promise.all(batch.map(async (user) => {
                    try {
                        const chatId = user.telegramId || user.id;
                        
                        if (!isForce && user.blocked === true) {
                            failedIds.push(chatId);
                            return;
                        }

                        let sendMethod = 'sendMessage';
                        let sendBody = {
                            chat_id: chatId,
                            reply_markup: finalMarkup
                        };

                        if (rawSticker && rawSticker.file_id) {
                            sendMethod = 'sendSticker';
                            sendBody.sticker = rawSticker.file_id;
                        } else if (rawAnimation && rawAnimation.file_id) {
                            sendMethod = 'sendAnimation';
                            sendBody.animation = rawAnimation.file_id;
                            sendBody.caption = message || undefined;
                            sendBody.parse_mode = 'HTML';
                        } else if (rawVideo && rawVideo.file_id) {
                            sendMethod = 'sendVideo';
                            sendBody.video = rawVideo.file_id;
                            sendBody.caption = message || undefined;
                            sendBody.parse_mode = 'HTML';
                        } else if (rawPhoto && rawPhoto.length > 0) {
                            sendMethod = 'sendPhoto';
                            sendBody.photo = rawPhoto[rawPhoto.length - 1].file_id;
                            sendBody.caption = message || undefined;
                            sendBody.parse_mode = 'HTML';
                        } else if (imageUrl) {
                            sendMethod = 'sendPhoto';
                            sendBody.photo = imageUrl;
                            sendBody.caption = message || undefined;
                            sendBody.parse_mode = 'HTML';
                        } else {
                            sendMethod = 'sendMessage';
                            sendBody.text = message || '';
                            sendBody.parse_mode = 'HTML';
                        }

                        const token = process.env.TELEGRAM_BOT_TOKEN;
                        await axios.post(`https://api.telegram.org/bot${token}/${sendMethod}`, sendBody);
                        sent++;
                    } catch (err) {
                        // If the error is "bot can't initiate conversation" (user hasn't interacted), try sending anyway
                        const errData = err.response?.data || { message: err.message };
                        const errDesc = errData.description || '';
                        
                        // Retry with raw API call as last resort (some users may need different handling)
                        if (errDesc.includes('bot can\'t initiate conversation') || errDesc.includes('chat not found') || errDesc.includes('Forbidden')) {
                            // These users can't be reached - log and skip
                            failedIds.push(user.telegramId || user.id);
                        } else {
                            // For other errors, try one more time with plain text (no HTML)
                            try {
                                const token = process.env.TELEGRAM_BOT_TOKEN;
                                const plainText = message ? message.replace(/<[^>]*>/g, '') : '';
                                if (plainText) {
                                    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                                        chat_id: chatId,
                                        text: plainText
                                    });
                                    sent++;
                                } else {
                                    failedIds.push(user.telegramId || user.id);
                                }
                            } catch {
                                failedIds.push(user.telegramId || user.id);
                            }
                        }
                    }
                }));

                // Real-time progress update every 10 batches or at the end
                if (i % (BATCH_SIZE * 10) === 0 || i + BATCH_SIZE >= targetUsers.length) {
                    await broadcastRef.update({
                        sentCount: sent,
                        failedCount: failedIds.length,
                        failedIds: failedIds,
                        status: (sent + failedIds.length === targetUsers.length) ? 'completed' : 'processing'
                    });
                }

                // Respect Telegram limits (30 reqs/sec). Wait until at least 1000ms has passed since batch start.
                const elapsed = Date.now() - startTime;
                if (elapsed < 1000) {
                    await sleep(1000 - elapsed);
                }
            }

            // Final status update
            const finalStatus = sent + failedIds.length === targetUsers.length ? 'completed' : 'processing';
            await broadcastRef.update({
                sentCount: sent,
                failedCount: failedIds.length,
                failedIds: failedIds,
                status: finalStatus
            });

        } catch (workerError) {
            console.error('Broadcast Worker Error:', workerError);
            await broadcastRef.update({ status: 'failed', error: workerError.message }).catch(() => {});
        }
    });

  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/bot/status/:broadcastId', async (req, res) => {
    try {
        const doc = await db.collection('broadcasts').doc(req.params.broadcastId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        res.json(doc.data());
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.get('/bot/active-broadcast', async (req, res) => {
    try {
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        const yesterdayISO = yesterday.toISOString();

        const processingSnap = await db.collection('broadcasts')
            .where('status', '==', 'processing')
            .get();
        
        const activeProcessing = processingSnap.docs
            .map(doc => ({ broadcastId: doc.id, ...doc.data() }))
            .filter(b => new Date(b.createdAt) >= yesterday);

        if (activeProcessing.length > 0) {
            return res.json(activeProcessing[0]);
        }

        const initializingSnap = await db.collection('broadcasts')
            .where('status', '==', 'initializing')
            .get();

        const activeInitializing = initializingSnap.docs
            .map(doc => ({ broadcastId: doc.id, ...doc.data() }))
            .filter(b => new Date(b.createdAt) >= yesterday);

        if (activeInitializing.length > 0) {
            return res.json(activeInitializing[0]);
        }

        res.json(null);
    } catch (e) {
        console.error('Active broadcast fetch error:', e);
        res.status(500).json({ error: 'Failed' });
    }
});

router.delete('/bot/broadcast/:broadcastId', async (req, res) => {
    try {
        await db.collection('broadcasts').doc(req.params.broadcastId).update({
            status: 'cancelled',
            cancelledAt: new Date().toISOString()
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to cancel broadcast' });
    }
});

router.get('/bot/lastMessage', async (req, res) => {
  try {
    const doc = await db.collection('admin').doc('lastMessage').get();
    if (doc.exists) {
      const data = doc.data();

      // Ensure entities are normalized when returning to frontend
      const normalizeEntities = (arr = []) =>
        Array.isArray(arr)
          ? arr.map(normalizeTelegramEntity).filter(e => e !== null)
          : [];

      if (data.message) {
        data.message.entities = normalizeEntities(data.message.entities);
        data.message.caption_entities = normalizeEntities(data.message.caption_entities);
        if (typeof data.message.reply_markup === 'string') {
          try {
            data.message.reply_markup = JSON.parse(data.message.reply_markup);
          } catch(e) {}
        }
      }

      console.log('Retrieved lastMessage entities:', data.message?.entities);
      console.log('Full retrieved message:', JSON.stringify(data.message, null, 2));
      res.json(data);
    } else {
      res.json(null);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch last message' });
  }
});

// Proxy endpoint for custom emoji animations (like credant)
// Note: Removed validateINITData for emoji access - emojis should be accessible to authenticated users
router.get('/telegram-proxy/getFile', async (req, res) => {
  try {
    const { custom_emoji_id } = req.query;
    if (!custom_emoji_id) {
      return res.status(400).json({ error: "custom_emoji_id is required" });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Bot token not configured' });
    }

    // Get custom emoji sticker data
    const stickerUrl = `https://api.telegram.org/bot${token}/getCustomEmojiStickers`;
    const stickerResponse = await axios.get(stickerUrl, {
      params: { custom_emoji_ids: JSON.stringify([custom_emoji_id]) }
    });

    if (!stickerResponse.data.ok || !stickerResponse.data.result || stickerResponse.data.result.length === 0) {
      return res.status(404).json({ error: 'Custom emoji not found' });
    }

    const stickerData = stickerResponse.data.result[0];
    if (!stickerData.file_id) {
      return res.status(404).json({ error: 'No file_id for custom emoji' });
    }

    // Get file path
    const fileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${stickerData.file_id}`;
    const fileResponse = await axios.get(fileUrl);

    if (!fileResponse.data.ok || !fileResponse.data.result?.file_path) {
      return res.status(404).json({ error: 'Could not get file path' });
    }

    const filePath = fileResponse.data.result.file_path;

    // Stream the file from Telegram
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const downloadResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream'
    });

    // Set headers for caching and content type
    res.setHeader('Content-Type', downloadResponse.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    // Pipe the stream
    downloadResponse.data.pipe(res);

  } catch (error) {
    console.error('Custom emoji proxy error:', error.message);
    res.status(500).json({ error: 'Failed to fetch custom emoji' });
  }
});

// Stream a file from Telegram by file_id
router.get('/telegram-file', async (req, res) => {
  try {
    const { file_id } = req.query;
    if (!file_id) {
      return res.status(400).json({ error: 'file_id is required' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Bot token not configured' });
    }

    const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(file_id)}`;
    const getFileResponse = await axios.get(getFileUrl);

    if (!getFileResponse.data.ok || !getFileResponse.data.result?.file_path) {
      return res.status(404).json({ error: 'Could not resolve file path' });
    }

    const filePath = getFileResponse.data.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const downloadResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream'
    });

    res.setHeader('Content-Type', downloadResponse.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    downloadResponse.data.pipe(res);
  } catch (error) {
    console.error('Error proxying telegram file:', error.message);
    res.status(500).json({ error: 'Failed to proxy telegram file' });
  }
});

// ---- Withdrawal Offer Management ---- //

router.get('/offer', async (req, res) => {
  try {
    const offerDoc = await db.collection('admin').doc('offer').get();
    if (!offerDoc.exists) return res.json({ active: false });
    const data = offerDoc.data();
    if (new Date(data.endTime) < new Date()) {
      return res.json({ active: false });
    }
    return res.json({ active: true, ...data });
  } catch (error) {
    console.error('Admin Offer Get Error:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

router.post('/offer', async (req, res) => {
  try {
    const { limits, endTime } = req.body;
    if (!limits || !endTime) {
      return res.status(400).json({ error: 'Limits and End Time are required' });
    }

    const offerDoc = await db.collection('admin').doc('offer').get();
    if (offerDoc.exists) {
      const current = offerDoc.data();
      if (new Date(current.endTime) > new Date() && current.isActive) {
         // allow update of the running offer if they are explicitly sending an update
      }
    }

    const newOffer = {
      limits, // This will now be { free: 10000, cash: 8000, ... }
      endTime,
      isActive: true,
      updatedAt: new Date().toISOString()
    };

    await db.collection('admin').doc('offer').set(newOffer);
    res.json({ success: true, offer: newOffer });
  } catch (error) {
    console.error('Admin Offer Create Error:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

router.delete('/offer', async (req, res) => {
  try {
     const offerRef = db.collection('admin').doc('offer');
     await offerRef.update({
       isActive: false,
       endTime: new Date().toISOString() // end it immediately
     });
     res.json({ success: true, message: 'Offer ended' });
  } catch (error) {
    console.error('Admin Offer Delete Error:', error);
    res.status(500).json({ error: 'Failed to end offer' });
  }
});

// ---- Global Settings Management ---- //
router.get('/settings', async (req, res) => {
  try {
    const doc = await db.collection('admin').doc('settings').get();
    if (doc.exists) {
      res.json(doc.data());
    } else {
      res.json({
        tierLimits: {
           free: 10000,
           cash: 8000,
           reward: 6000,
           bonus: 4000,
           profit: 2000
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const config = req.body;
    await db.collection('admin').doc('settings').set({
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ---- Ban System ---- //
router.post('/users/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned, until, reason } = req.body;

    const userRef = db.collection('users').doc(id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare ban object
    const banData = isBanned 
      ? { isBanned: true, until: until || 'lifetime', reason: reason || 'Violation of terms', bannedAt: new Date().toISOString() } 
      : { isBanned: false, unbannedAt: new Date().toISOString() };

    await userRef.update({ ban: banData });

    // Send Telegram Notification
    let msg = '';
    if (isBanned) {
      if (until === 'lifetime') {
        msg = `🚨 <b>Account Banned</b>\n\nYour account has been permanently banned from Earn Fest.\n\n<b>Reason:</b> ${banData.reason}`;
      } else {
        const untilDate = new Date(until).toLocaleString();
        msg = `🚨 <b>Account Banned</b>\n\nYour account has been temporarily banned from Earn Fest.\n\n<b>Expires:</b> ${untilDate}\n<b>Reason:</b> ${banData.reason}`;
      }
    } else {
      msg = `✅ <b>Account Unbanned</b>\n\nYour account has been unbanned and full access to Earn Fest has been restored. Welcome back!`;
    }

    // Fire and forget telegram message (don't fail the request if bot is blocked)
    sendTelegramMessage(id, msg).catch(e => console.error('Failed to send ban notification:', e.message));

    res.json({ success: true, ban: banData });
  } catch (error) {
    console.error('Ban error:', error);
    res.status(500).json({ error: 'Failed to update ban status' });
  }
});

// Get live active users and their actions
router.get('/live-activity', async (req, res) => {
  try {
    res.json(getLiveUsers());
  } catch (error) {
    console.error('Failed to get live activity:', error);
    res.status(500).json({ error: 'Failed to fetch live activity' });
  }
});

export default router;
