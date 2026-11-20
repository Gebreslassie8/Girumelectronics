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
  console.log('Found', users.length, 'users');

  let hashed = 0;
  let alreadyHashed = 0;

  for (const user of users) {
    // Already hashed? bcrypt hashes always start with $2a$ / $2b$ / $2y$
    if (typeof user.password === 'string' && /^\$2[aby]\$/.test(user.password)) {
      console.log(`  ✓ ${user.phone} — already hashed`);
      alreadyHashed++;
      continue;
    }

    const hash = await bcrypt.hash(user.password, 12);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { password: hash } }
    );
    console.log(`  ✅ ${user.phone} — hashed "${user.password}"`);
    hashed++;
  }

  console.log('');
  console.log('Hashed:', hashed);
  console.log('Already hashed:', alreadyHashed);
  process.exit(0);
})().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});