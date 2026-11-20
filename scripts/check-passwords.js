const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8');
const m = env.match(/^MONGODB_URI=(.*)$/m);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  await mongoose.connect(m[1].trim());
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({}).toArray();
  for (const user of users) {
    const hashed = /^\$2[aby]\$/.test(user.password || '');
    console.log(`\n${user.phone} (${user.fullName})`);
    console.log('  password:', user.password?.slice(0, 30) + (user.password?.length > 30 ? '...' : ''));
    console.log('  is hashed:', hashed ? '✅' : '❌ PLAIN TEXT');

    if (hashed) {
      // Try common passwords
      const candidates = ['12345678', 'Gebreslassie1234##@', 'Admin@2026!', 'admin1234'];
      for (const pwd of candidates) {
        const ok = await bcrypt.compare(pwd, user.password);
        if (ok) console.log('  matches:', pwd);
      }
    }
  }
  process.exit(0);
})().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});