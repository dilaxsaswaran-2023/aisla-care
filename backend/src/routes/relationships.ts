import { Router, Request, Response } from 'express';
import Relationship from '../models/Relationship';
import User from '../models/User';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/relationships – Get hierarchical relationships: caregivers -> patients -> family members
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    
    let relationships: any[] = [];

    if (role === 'super_admin') {
      // Super admin sees all caregivers across all corporates with their patients and families
      const caregivers = await User.find({ role: 'caregiver' }).select('_id full_name email corporate_id');
      
      for (const caregiver of caregivers) {
        const patients = await User.find({ caregiver_id: caregiver._id }).select('_id full_name email family_ids');
        const patientsList = [];
        
        for (const patient of patients) {
          const familyMembers = patient.family_ids && patient.family_ids.length > 0
            ? await User.find({ _id: { $in: patient.family_ids } }).select('_id full_name email role')
            : [];
          
          patientsList.push({
            patient: { _id: patient._id, full_name: patient.full_name, email: patient.email },
            family_members: familyMembers.map((f: any) => ({ _id: f._id, full_name: f.full_name, email: f.email, role: f.role }))
          });
        }
        
        relationships.push({
          caregiver: { _id: caregiver._id, full_name: caregiver.full_name, email: caregiver.email, corporate_id: caregiver.corporate_id },
          patients: patientsList
        });
      }
    } else if (role === 'admin') {
      // Admin sees caregivers under their corporate_id with their patients and families
      const caregivers = await User.find({ role: 'caregiver', corporate_id: userId }).select('_id full_name email');
      
      for (const caregiver of caregivers) {
        const patients = await User.find({ caregiver_id: caregiver._id }).select('_id full_name email family_ids');
        const patientsList = [];
        
        for (const patient of patients) {
          const familyMembers = patient.family_ids && patient.family_ids.length > 0
            ? await User.find({ _id: { $in: patient.family_ids } }).select('_id full_name email role')
            : [];
          
          patientsList.push({
            patient: { _id: patient._id, full_name: patient.full_name, email: patient.email },
            family_members: familyMembers.map((f: any) => ({ _id: f._id, full_name: f.full_name, email: f.email, role: f.role }))
          });
        }
        
        relationships.push({
          caregiver: { _id: caregiver._id, full_name: caregiver.full_name, email: caregiver.email },
          patients: patientsList
        });
      }
    } else if (role === 'caregiver') {
      // Caregiver sees their own patients and families
      const patients = await User.find({ caregiver_id: userId }).select('_id full_name email family_ids');
      const patientsList = [];
      
      for (const patient of patients) {
        const familyMembers = patient.family_ids && patient.family_ids.length > 0
          ? await User.find({ _id: { $in: patient.family_ids } }).select('_id full_name email role')
          : [];
        
        patientsList.push({
          patient: { _id: patient._id, full_name: patient.full_name, email: patient.email },
          family_members: familyMembers.map((f: any) => ({ _id: f._id, full_name: f.full_name, email: f.email, role: f.role }))
        });
      }
      
      const currentCaregiver = await User.findById(userId).select('_id full_name email');
      relationships.push({
        caregiver: { _id: currentCaregiver?._id, full_name: currentCaregiver?.full_name, email: currentCaregiver?.email },
        patients: patientsList
      });
    } else if (role === 'patient') {
      // Patient sees their own caregiver and family members
      const currentPatient = await User.findById(userId).populate('caregiver_id', '_id full_name email').populate('family_ids', '_id full_name email role');
      
      if (currentPatient?.caregiver_id) {
        relationships.push({
          caregiver: currentPatient.caregiver_id,
          patients: [
            {
              patient: { _id: currentPatient._id, full_name: currentPatient.full_name, email: currentPatient.email },
              family_members: Array.isArray(currentPatient.family_ids) ? currentPatient.family_ids : []
            }
          ]
        });
      }
    }

    res.json(relationships);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/relationships
router.post('/', authMiddleware, roleMiddleware('admin', 'caregiver'), async (req: Request, res: Response) => {
  try {
    const { patient_id, related_user_id, relationship_type } = req.body;

    // Check for duplicate
    const existing = await Relationship.findOne({ patient_id, related_user_id });
    if (existing) {
      res.status(400).json({ error: 'Relationship already exists' });
      return;
    }

    const relationship = await Relationship.create({
      patient_id,
      related_user_id,
      relationship_type,
      created_by: req.user!.userId,
    });

    res.status(201).json(relationship);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/relationships/:id
router.delete('/:id', authMiddleware, roleMiddleware('admin'), async (req: Request, res: Response) => {
  try {
    await Relationship.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
