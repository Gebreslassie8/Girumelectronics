const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8');
const m = env.match(/^MONGODB_URI=(.*)$/m);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  await mongoose.connect(m[1].trim());
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash('Admin@2026!', 12);
  const r = await db.collection('users').updateOne(
    { phone: '0900000000' },
    { $set: { password: hash, role: 'admin' } }
  );
  console.log(r.matchedCount ? '✅ 0900000000 → Admin@2026! (role: admin)' : '❌ user not found');
  process.exit(0);
})().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});