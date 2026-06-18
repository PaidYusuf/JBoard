require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/db/pool');

const SUPERADMIN_EMAIL    = process.env.SUPERADMIN_EMAIL    || 'superadmin@jboard.local';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin1234!';

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Plans ────────────────────────────────────────────────
    await client.query(`
      INSERT INTO plans (plan_name, max_user, price) VALUES
        ('Free',       5,   0.00),
        ('Starter',   20,  29.99),
        ('Pro',       100, 99.99),
        ('Enterprise',500, 299.99)
      ON CONFLICT DO NOTHING
    `);
    console.log('✓ Plans seeded');

    // ── System group for SuperAdmin ───────────────────────────
    const { rows: planRows } = await client.query(
      `SELECT plan_id FROM plans WHERE plan_name = 'Enterprise' LIMIT 1`
    );
    const planId = planRows[0].plan_id;

    const { rows: groupRows } = await client.query(`
      INSERT INTO groups (group_name, plan_id, type, status)
      VALUES ('System', $1, 'personal', 'active')
      ON CONFLICT DO NOTHING
      RETURNING group_id
    `, [planId]);

    const groupId = groupRows.length
      ? groupRows[0].group_id
      : (await client.query(`SELECT group_id FROM groups WHERE group_name = 'System' LIMIT 1`)).rows[0].group_id;

    console.log('✓ System group seeded');

    // ── SuperAdmin user ───────────────────────────────────────
    const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

    await client.query(`
      INSERT INTO users (group_id, email, password_hash, fname, lname, role, account_type, is_active)
      VALUES ($1, $2, $3, 'Super', 'Admin', 'superadmin', 'solo', true)
      ON CONFLICT (email) DO NOTHING
    `, [groupId, SUPERADMIN_EMAIL, passwordHash]);

    console.log('✓ SuperAdmin user seeded');

    await client.query('COMMIT');

    console.log('\n─────────────────────────────────────');
    console.log('  SuperAdmin email   :', SUPERADMIN_EMAIL);
    console.log('  SuperAdmin password:', SUPERADMIN_PASSWORD);
    console.log('  Change this password before any production use.');
    console.log('─────────────────────────────────────');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
