import express from 'express';
import { joinGame, getStatus, getHistory } from '../controllers/pvpController.js';
import { validateINITData } from '../middleware/auth.js';
import { db } from '../config/firebase.js';

const router = express.Router();

router.get('/status', getStatus);
router.get('/history', getHistory);
router.post('/join', validateINITData, joinGame);

router.get('/config', async (req, res) => {
  try {
    const doc = await db.collection('admin').doc('pvpConfig').get();
    if (doc.exists) {
      res.json(doc.data());
    } else {
      res.json({
        shortcuts: [2000, 4000, 10000, 20000],
        minJoin: 1000,
        isActive: true
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
