import express from 'express';
import { db } from '../config/firebase.js';
import { validateINITData, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

const PARTNERS_REF = () => db.collection('appdata').doc('partners');

/**
 * GET /api/partners
 * Public route - returns all public partners (sorted by order)
 */
router.get('/', async (req, res) => {
  try {
    const doc = await PARTNERS_REF().get();
    if (!doc.exists) {
      return res.json({ partners: [] });
    }
    const data = doc.data();
    const partners = (data.list || [])
      .filter(p => p.isPublic !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ partners });
  } catch (error) {
    console.error('Fetch partners error:', error);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

/**
 * GET /api/partners/all
 * Admin route - returns ALL partners (public + admin-only)
 */
router.get('/all', validateINITData, verifyAdmin, async (req, res) => {
  try {
    const doc = await PARTNERS_REF().get();
    if (!doc.exists) {
      return res.json({ partners: [] });
    }
    const data = doc.data();
    const partners = (data.list || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ partners });
  } catch (error) {
    console.error('Fetch all partners error:', error);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

/**
 * POST /api/partners
 * Admin route - add a new partner
 */
router.post('/', validateINITData, verifyAdmin, async (req, res) => {
  try {
    const { name, imageUrl, link, isPublic, order } = req.body;
    if (!name || !imageUrl || !link) {
      return res.status(400).json({ error: 'Name, imageUrl, and link are required' });
    }

    const newPartner = {
      id: Date.now().toString(),
      name,
      imageUrl,
      link,
      isPublic: isPublic !== false,
      order: order || 0,
      createdAt: new Date().toISOString()
    };

    const doc = await PARTNERS_REF().get();
    if (!doc.exists) {
      await PARTNERS_REF().set({ list: [newPartner] });
    } else {
      await PARTNERS_REF().update({
        list: [...(doc.data().list || []), newPartner]
      });
    }

    res.json({ success: true, partner: newPartner });
  } catch (error) {
    console.error('Add partner error:', error);
    res.status(500).json({ error: 'Failed to add partner' });
  }
});

/**
 * PUT /api/partners/:id
 * Admin route - update a partner
 */
router.put('/:id', validateINITData, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imageUrl, link, isPublic, order } = req.body;

    const doc = await PARTNERS_REF().get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'No partners found' });
    }

    const list = doc.data().list || [];
    const index = list.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const updatedPartner = {
      ...list[index],
      ...(name !== undefined && { name }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(link !== undefined && { link }),
      ...(isPublic !== undefined && { isPublic }),
      ...(order !== undefined && { order }),
      updatedAt: new Date().toISOString()
    };

    list[index] = updatedPartner;
    await PARTNERS_REF().update({ list });

    res.json({ success: true, partner: updatedPartner });
  } catch (error) {
    console.error('Update partner error:', error);
    res.status(500).json({ error: 'Failed to update partner' });
  }
});

/**
 * DELETE /api/partners/:id
 * Admin route - delete a partner
 */
router.delete('/:id', validateINITData, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await PARTNERS_REF().get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'No partners found' });
    }

    const list = doc.data().list || [];
    const filtered = list.filter(p => p.id !== id);
    if (filtered.length === list.length) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    await PARTNERS_REF().update({ list: filtered });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete partner error:', error);
    res.status(500).json({ error: 'Failed to delete partner' });
  }
});

export default router;