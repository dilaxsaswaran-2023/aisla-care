import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Relationship from '../models/Relationship';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

// Roles each actor is allowed to create
const CREATABLE_ROLES: Record<string, string[]> = {
  super_admin: ['admin', 'caregiver', 'patient', 'family'],
  admin: ['caregiver', 'patient', 'family'],
  caregiver: ['patient', 'family'],
};

// GET /api/users – super_admin/admin: list users, caregiver: list their patients
router.get('/', authMiddleware, roleMiddleware('super_admin', 'admin', 'caregiver'), async (req: Request, res: Response) => {
  try {
    let filter: any = {};

    if (req.user!.role === 'super_admin') {
      // Super admin sees all users
      filter = {};
    } else if (req.user!.role === 'admin') {
      // Admin sees only users under their corporate_id
      filter = { corporate_id: req.user!.userId };
    } else if (req.user!.role === 'caregiver') {
      // Caregiver sees only their patients
      filter = { caregiver_id: req.user!.userId };
    }

    const users = await User.find(filter).select('-password').sort({ created_at: -1 });
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/corporate/:corporate_id – get users under a specific corporate_id (excluding the admin themselves)
router.get('/corporate/:corporate_id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const targetCorporateId = req.params.corporate_id;
    const currentUser = req.user!;

    // Authorization: Only admins under this corporate_id or super_admin can view
    if (currentUser.role !== 'super_admin') {
      if (currentUser.role !== 'admin' || currentUser.userId !== targetCorporateId) {
        res.status(403).json({ error: 'You can only view users under your own organization' });
        return;
      }
    }

    // Fetch users under this corporate_id, excluding the admin user themselves
    const users = await User.find({
      corporate_id: targetCorporateId,
      _id: { $ne: targetCorporateId }, // Exclude the admin (whose ID is the corporate_id)
    }).select('-password').sort({ created_at: -1 });

    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/stats/:userId – role counts for a specific user
router.get('/stats/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    
    // Fetch the target user from database
    const targetUser = await User.findById(targetUserId).select('corporate_id role');
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let query: any = { _id: { $ne: targetUserId } };
    
    // Super admin sees all non-super_admin users
    if (targetUser.role === 'super_admin') {
      query.role = { $ne: 'super_admin' };
    } else if (targetUser.role === 'admin') {
      // Admin sees only users under their corporate_id
      query.corporate_id = targetUserId;
    } else if (targetUser.role === 'caregiver') {
      // Caregiver sees only their patients
      query.caregiver_id = targetUserId;
    } else {
      // Patients and family see no user counts
      return res.json({ 
        total: 0, 
        admins: 0, 
        caregivers: 0, 
        patients: 0, 
        family: 0,
        role: targetUser.role,
        userId: targetUserId,
        corporate_id: targetUser.corporate_id || null
      });
    }
    
    const users = await User.find(query).select('role');
    const stats = { 
      total: users.length, 
      admins: 0, 
      caregivers: 0, 
      patients: 0, 
      family: 0,
      role: targetUser.role,
      userId: targetUserId,
      corporate_id: targetUser.corporate_id || null
    };
    
    users.forEach((u) => {
      if (u.role === 'admin') stats.admins++;
      else if (u.role === 'caregiver') stats.caregivers++;
      else if (u.role === 'patient') stats.patients++;
      else if (u.role === 'family') stats.family++;
    });
    
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users – create a user (role-gated)
router.post('/', authMiddleware, roleMiddleware('super_admin', 'admin', 'caregiver'), async (req: Request, res: Response) => {
  try {
    const actorRole = req.user!.role;
    const actorId = req.user!.userId;
    const { email, password, full_name, role, caregiver_id, family_ids, phone_country, phone_number, caregiver_type, caregiver_subtype } = req.body;

    const allowed = CREATABLE_ROLES[actorRole] || [];
    if (!allowed.includes(role)) {
      res.status(403).json({ error: `You are not allowed to create a user with role "${role}"` });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    // New users created by admin/caregiver default to 'invited' status
    const userData: any = { email, password: hashed, full_name, role, status: 'invited', phone_country, phone_number, caregiver_type, caregiver_subtype };

    // Create user first so we have their ID for corporate_id assignment
    let user = await User.create(userData);

    // Set corporate_id and additional fields based on role/actor
    let updateData: any = {};
    if (role !== 'super_admin') {
      if (actorRole === 'super_admin') {
        // Super admin creates admin: admin's corporate_id = admin's own id (self-governed organization)
        updateData.corporate_id = user.id;
      } else if (actorRole === 'admin') {
        // Admin creates caregiver/patient/family: their corporate_id = admin's id
        updateData.corporate_id = actorId;
      } else if (actorRole === 'caregiver') {
        // Caregiver creates patient/family: their corporate_id = caregiver's corporate_id (chain)
        const caregiver = await User.findById(actorId);
        updateData.corporate_id = caregiver?.corporate_id || actorId;
      }
    }

    // Add caregiver_id for patients
    if (role === 'patient' && caregiver_id) {
      updateData.caregiver_id = caregiver_id;
    } else if (role === 'patient' && actorRole === 'caregiver') {
      // If caregiver creates a patient without specifying caregiver_id, use their own id
      updateData.caregiver_id = req.user!.userId;
    }

    // Add family_ids for patients (many-to-many: array of family member IDs)
    if (role === 'patient' && Array.isArray(family_ids) && family_ids.length > 0) {
      updateData.family_ids = family_ids;
    }

    // Update user with all computed fields
    user = await User.findByIdAndUpdate(user.id, updateData, { new: true }) as any;
    res.status(201).json({ id: user.id, email: user.email, full_name: user.full_name, role: user.role, caregiver_id: user.caregiver_id, family_ids: user.family_ids, corporate_id: user.corporate_id, status: user.status, phone_country: user.phone_country, phone_number: user.phone_number, caregiver_type: user.caregiver_type, caregiver_subtype: user.caregiver_subtype });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/status – admin/super_admin change user status
router.put('/:id/status', authMiddleware, roleMiddleware('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const { status } = req.body;

    if (!['invited', 'active', 'disabled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Admin can only change users under their corporate_id
    if (req.user!.role === 'admin') {
      const targetCorporateId = (targetUser as any).corporate_id?.toString?.();
      if (targetCorporateId !== req.user!.userId) {
        res.status(403).json({ error: 'You can only change users under your organization' });
        return;
      }
    }

    targetUser.set({ status });
    await targetUser.save();
    res.json({ success: true, id: targetUser.id, status: targetUser.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/caregivers-list – fetch list of caregivers with optional search
router.get('/caregivers-list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string || '';
    const query: any = { role: 'caregiver' };

    // Filter by corporate_id for non-super_admin users
    if (req.user!.role !== 'super_admin') {
      query.corporate_id = req.user!.userId;
    }

    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const caregivers = await User.find(query).select('_id email full_name').sort({ full_name: 1 });
    res.json(caregivers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/patients-list – fetch list of patients with optional search
router.get('/patients-list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string || '';
    const query: any = { role: 'patient' };

    // Filter by corporate_id for non-super_admin users
    if (req.user!.role !== 'super_admin') {
      query.corporate_id = req.user!.userId;
    }

    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const patients = await User.find(query).select('_id email full_name').sort({ full_name: 1 });
    res.json(patients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/family-list – fetch list of family members with optional search
router.get('/family-list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string || '';
    const query: any = { role: 'family' };

    // Filter by corporate_id for non-super_admin users
    if (req.user!.role !== 'super_admin') {
      query.corporate_id = req.user!.userId;
    }

    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const families = await User.find(query).select('_id email full_name').sort({ full_name: 1 });
    res.json(families);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authMiddleware, roleMiddleware('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) { res.status(404).json({ error: 'User not found' }); return; }

    // Admins cannot delete super_admin or other admins
    if (req.user!.role === 'admin' && ['super_admin', 'admin'].includes(target.role)) {
      res.status(403).json({ error: 'Insufficient permissions to delete this user' });
      return;
    }

    // Admin can only delete users under their corporate_id
    if (req.user!.role === 'admin') {
      const targetCorporateId = (target as any).corporate_id?.toString?.();
      if (targetCorporateId !== req.user!.userId) {
        res.status(403).json({ error: 'You can only delete users under your organization' });
        return;
      }
    }

    // Nobody can delete themselves
    if (target.id === req.user!.userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/patients – get patients for current caregiver/family
router.get('/patients', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const relationships = await Relationship.find({ related_user_id: userId });
    const patientIds = relationships.map((r) => r.patient_id);

    const patients = await User.find({ _id: { $in: patientIds } }).select('-password');

    const familyRels = await Relationship.find({
      patient_id: { $in: patientIds },
      relationship_type: 'family',
    });
    const familyIds = familyRels.map((r) => r.related_user_id);
    const familyMembers = await User.find({ _id: { $in: familyIds } }).select('-password');

    res.json({ patients, familyMembers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id – update user details
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const currentUser = req.user!;
    const { full_name, email, caregiver_id, family_ids, phone_country, phone_number, address, caregiver_type, caregiver_subtype } = req.body;

    // Fetch the target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Authorization: User can only update their own details, or admin can update users in their corporate_id
    if (currentUser.userId !== targetUserId && currentUser.role !== 'super_admin') {
      if (currentUser.role === 'admin') {
        // If corporate_id is in the JWT, use it. Otherwise, fetch from DB as fallback.
        let adminCorporateId = currentUser.corporate_id;
        if (!adminCorporateId) {
          const admin = await User.findById(currentUser.userId).select('corporate_id');
          adminCorporateId = admin?.corporate_id?.toString();
        }
        
        const targetCorporateId = (targetUser as any).corporate_id?.toString?.();
        if (targetCorporateId !== adminCorporateId) {
          res.status(403).json({ error: 'You can only update users under your organization' });
          return;
        }
      } else {
        res.status(403).json({ error: 'You can only update your own details' });
        return;
      }
    }

    // Update allowed fields
    const updateData: any = {};
    
    if (full_name) updateData.full_name = full_name;
    if (phone_country !== undefined) updateData.phone_country = phone_country;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;
    if (caregiver_type !== undefined) updateData.caregiver_type = caregiver_type;
    if (caregiver_subtype !== undefined) updateData.caregiver_subtype = caregiver_subtype;

    if (email) {
      // Check if email is already in use by another user
      const existing = await User.findOne({ email, _id: { $ne: targetUserId } });
      if (existing) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
      updateData.email = email;
    }

    // Only patients can have caregiver_id and family_ids
    if (targetUser.role === 'patient') {
      if (caregiver_id !== undefined) updateData.caregiver_id = caregiver_id || null;
      if (family_ids !== undefined) updateData.family_ids = Array.isArray(family_ids) ? family_ids : [];
    }

    const updatedUser = await User.findByIdAndUpdate(targetUserId, updateData, { new: true }).select('-password');

    res.json({
      id: updatedUser?.id,
      email: updatedUser?.email,
      full_name: updatedUser?.full_name,
      role: updatedUser?.role,
      caregiver_id: updatedUser?.caregiver_id,
      family_ids: updatedUser?.family_ids,
      corporate_id: updatedUser?.corporate_id,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
