import bcrypt from 'bcryptjs';
import User from '../models/User';

const SUPER_ADMIN_EMAIL = 'senz@gmail.com';
const SUPER_ADMIN_PASSWORD = 'password';
const SUPER_ADMIN_NAME = 'Super Admin';

/**
 * Seeds the super-admin user once. If they already exist in the DB, this is a no-op.
 */
export const seedSuperAdmin = async (): Promise<void> => {
  const existing = await User.findOne({ email: SUPER_ADMIN_EMAIL });
  if (existing) {
    console.log('Super-admin already exists — skipping seed');
    return;
  }

  const hashed = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  await User.create({
    email: SUPER_ADMIN_EMAIL,
    password: hashed,
    full_name: SUPER_ADMIN_NAME,
    role: 'super_admin',
  });
  console.log(`Super-admin seeded: ${SUPER_ADMIN_EMAIL}`);
};
