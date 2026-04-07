require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const { Plan } = require('./src/models/Subscription');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB...');

  // Create admin user
  const adminExists = await User.findOne({ email: 'admin@drsallah.com' });
  if (!adminExists) {
    await User.create({
      name: 'Dr. Sallah Admin',
      email: 'admin@drsallah.com',
      password: 'Admin@12345',
      role: 'admin',
      isVerified: true,
    });
    console.log('✅ Admin user created: admin@drsallah.com / Admin@12345');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // Create default plans
  const plans = [
    { name: 'Monthly', type: 'monthly', price: 29.99, durationDays: 30, features: ['Access all courses', 'HD streaming', 'Mobile app'] },
    { name: 'Quarterly', type: 'quarterly', price: 79.99, durationDays: 90, features: ['Access all courses', 'HD streaming', 'Mobile app', '10% discount'] },
    { name: 'Yearly', type: 'yearly', price: 249.99, durationDays: 365, features: ['Access all courses', 'HD streaming', 'Mobile app', '30% discount', 'Priority support'] },
  ];

  for (const p of plans) {
    const exists = await Plan.findOne({ type: p.type });
    if (!exists) {
      await Plan.create(p);
      console.log(`✅ Plan created: ${p.name} - $${p.price}`);
    }
  }

  console.log('\n🚀 Seed complete! You can now run: npm run dev');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});