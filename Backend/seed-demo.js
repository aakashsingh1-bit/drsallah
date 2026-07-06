/**
 * Demo seeder — safe to run on live (idempotent).
 * Creates: admin, test student with active purchase, 1 course, 2 modules, 6 lessons.
 *
 * Run:  npm run seed:demo
 * Docker: docker compose exec api node seed-demo.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const { Course, Module, Lesson } = require('./src/models/Content');
const { CoursePurchase } = require('./src/models/CourseAccess');
const { Plan } = require('./src/models/Subscription');
const { recalculateCourseStats } = require('./src/services/courseStatsService');

const DEMO = {
  admin: {
    name: 'Dr. Sallah Admin',
    email: 'admin@drsallah.com',
    password: 'Admin@12345',
  },
  student: {
    name: 'Test Student',
    email: 'student@test.drsallahalzait.me',
    password: 'Test@12345',
    phone: '+971500000001',
  },
  course: {
    title: 'MRCP PACES Demo Course',
    description:
      'Demo course for live testing — clinical examination skills, history taking, and communication stations. Upload videos via admin panel to enable playback.',
    instructor: 'Dr. Salah Alzait',
    category: 'MRCP PACES',
    tags: ['demo', 'paces', 'clinical'],
    thumbnail:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop',
    language: 'English',
    level: 'intermediate',
  },
  purchase: {
    months: 3,
    amountPaid: 249,
    currency: 'AED',
  },
};

const MODULES = [
  {
    title: 'Module 1 — Introduction & Basics',
    description: 'Orientation and core clinical examination principles.',
    order: 0,
    lessons: [
      {
        title: 'Welcome & Course Overview',
        description: 'How to use this platform and what you will learn.',
        duration: 300,
        isFree: true,
        order: 0,
      },
      {
        title: 'History Taking Framework',
        description: 'Structured approach to clinical history in exam settings.',
        duration: 720,
        isFree: false,
        order: 1,
      },
      {
        title: 'General Physical Examination',
        description: 'Hands, face, neck, and general inspection checklist.',
        duration: 900,
        isFree: false,
        order: 2,
      },
    ],
  },
  {
    title: 'Module 2 — Cardiovascular Station',
    description: 'Heart examination skills for PACES-style stations.',
    order: 1,
    lessons: [
      {
        title: 'Cardiovascular Inspection & Palpation',
        description: 'JVP, apex beat, and heaves.',
        duration: 840,
        isFree: false,
        order: 0,
      },
      {
        title: 'Auscultation — Murmurs & Added Sounds',
        description: 'Systematic listening and presenting findings.',
        duration: 960,
        isFree: false,
        order: 1,
      },
      {
        title: 'Mock Station — Present Your Findings',
        description: 'Practice presenting a cardiovascular case to the examiner.',
        duration: 600,
        isFree: false,
        order: 2,
      },
    ],
  },
];

async function upsertUser({ name, email, password, role, phone }) {
  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role,
      isVerified: true,
      isActive: true,
      isSuspended: false,
      riskScore: 0,
      isFlagged: false,
    });
    console.log(`✅ User created: ${email} / ${password}`);
    return user;
  }

  user.name = name;
  user.role = role;
  user.isVerified = true;
  user.isActive = true;
  user.isSuspended = false;
  user.suspensionReason = null;
  user.riskScore = 0;
  user.isFlagged = false;
  if (phone) user.phone = phone;
  if (password) user.password = password;
  await user.save();
  console.log(`ℹ️  User updated: ${email} / ${password}`);
  return user;
}

async function seedPlans() {
  const plans = [
    {
      name: 'Monthly',
      type: 'monthly',
      price: 29.99,
      durationDays: 30,
      features: ['Access all courses', 'HD streaming'],
    },
    {
      name: 'Quarterly',
      type: 'quarterly',
      price: 79.99,
      durationDays: 90,
      features: ['Access all courses', 'HD streaming', '10% discount'],
    },
    {
      name: 'Yearly',
      type: 'yearly',
      price: 249.99,
      durationDays: 365,
      features: ['Access all courses', 'HD streaming', 'Priority support'],
    },
  ];

  for (const p of plans) {
    const exists = await Plan.findOne({ type: p.type });
    if (!exists) {
      await Plan.create(p);
      console.log(`✅ Plan created: ${p.name}`);
    }
  }
}

async function upsertDemoCourse() {
  let course = await Course.findOne({ title: DEMO.course.title });
  if (!course) {
    course = await Course.create({
      ...DEMO.course,
      isPublished: true,
      publishedAt: new Date(),
      requiredSubscription: 'free',
      priceTiers: [
        { months: 1, price: 99, currency: 'AED', isActive: true },
        { months: 3, price: 249, currency: 'AED', isActive: true },
        { months: 6, price: 449, currency: 'AED', isActive: true },
      ],
      order: 0,
    });
    console.log(`✅ Course created: ${course.title}`);
  } else {
    Object.assign(course, {
      ...DEMO.course,
      isPublished: true,
      publishedAt: course.publishedAt || new Date(),
      priceTiers: [
        { months: 1, price: 99, currency: 'AED', isActive: true },
        { months: 3, price: 249, currency: 'AED', isActive: true },
        { months: 6, price: 449, currency: 'AED', isActive: true },
      ],
    });
    await course.save();
    console.log(`ℹ️  Course updated: ${course.title}`);
  }
  return course;
}

async function upsertModulesAndLessons(courseId) {
  const lessonIds = [];

  for (const modData of MODULES) {
    let mod = await Module.findOne({ course: courseId, title: modData.title });
    if (!mod) {
      mod = await Module.create({
        course: courseId,
        title: modData.title,
        description: modData.description,
        order: modData.order,
        isPublished: true,
      });
      console.log(`   ✅ Module: ${mod.title}`);
    } else {
      mod.description = modData.description;
      mod.order = modData.order;
      mod.isPublished = true;
      await mod.save();
      console.log(`   ℹ️  Module: ${mod.title}`);
    }

    for (const lessonData of modData.lessons) {
      let lesson = await Lesson.findOne({ module: mod._id, title: lessonData.title });
      if (!lesson) {
        lesson = await Lesson.create({
          module: mod._id,
          course: courseId,
          title: lessonData.title,
          description: lessonData.description,
          order: lessonData.order,
          duration: lessonData.duration,
          isFree: lessonData.isFree,
          isPublished: true,
          uploadStatus: 'none',
        });
        console.log(`      ✅ Lesson: ${lesson.title}${lesson.isFree ? ' (free preview)' : ''}`);
      } else {
        lesson.description = lessonData.description;
        lesson.order = lessonData.order;
        lesson.duration = lessonData.duration;
        lesson.isFree = lessonData.isFree;
        lesson.isPublished = true;
        await lesson.save();
        console.log(`      ℹ️  Lesson: ${lesson.title}`);
      }
      lessonIds.push(lesson);
    }
  }

  await recalculateCourseStats(courseId);
  return lessonIds;
}

async function upsertPurchase(userId, courseId) {
  const months = DEMO.purchase.months;
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);

  let purchase = await CoursePurchase.findOne({
    user: userId,
    course: courseId,
    status: 'active',
  });

  if (!purchase) {
    purchase = await CoursePurchase.create({
      user: userId,
      course: courseId,
      months,
      status: 'active',
      startDate,
      endDate,
      amountPaid: DEMO.purchase.amountPaid,
      currency: DEMO.purchase.currency,
      paymentProvider: 'manual',
      metadata: { seeded: true, note: 'Demo enrollment for live testing' },
    });
    console.log(`✅ Active purchase created (${months} months)`);
  } else {
    purchase.status = 'active';
    purchase.startDate = startDate;
    purchase.endDate = endDate;
    purchase.months = months;
    purchase.paymentProvider = 'manual';
    await purchase.save();
    console.log(`ℹ️  Active purchase renewed (${months} months, ends ${endDate.toISOString().slice(0, 10)})`);
  }

  const activeCount = await CoursePurchase.countDocuments({ course: courseId, status: 'active' });
  await Course.findByIdAndUpdate(courseId, { totalEnrolled: activeCount });
}

async function attachStudentProgress(user, lessons) {
  if (!lessons.length) return;

  const first = lessons[0];
  const second = lessons[1] || lessons[0];

  user.watchHistory = [
    {
      lesson: first._id,
      progress: Math.min(180, first.duration || 180),
      watchedAt: new Date(),
    },
    {
      lesson: second._id,
      progress: Math.min(120, second.duration || 120),
      watchedAt: new Date(Date.now() - 3600000),
    },
  ];
  user.bookmarks = [second._id];
  await user.save();
  console.log('✅ Watch history + bookmark added for test student');
}

async function seedDemo() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB...\n');

  console.log('── Users ──');
  await upsertUser({ ...DEMO.admin, role: 'admin' });
  const student = await upsertUser({ ...DEMO.student, role: 'student' });

  console.log('\n── Subscription plans ──');
  await seedPlans();

  console.log('\n── Demo course ──');
  const course = await upsertDemoCourse();
  const lessons = await upsertModulesAndLessons(course._id);

  console.log('\n── Enrollment ──');
  await upsertPurchase(student._id, course._id);
  await attachStudentProgress(student, lessons);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              DEMO SEED COMPLETE                        ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  ADMIN LOGIN (admin panel)                           ║');
  console.log(`║  Email   : ${DEMO.admin.email.padEnd(38)}║`);
  console.log(`║  Password: ${DEMO.admin.password.padEnd(38)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  TEST STUDENT (web app — already enrolled)             ║');
  console.log(`║  Email   : ${DEMO.student.email.padEnd(38)}║`);
  console.log(`║  Password: ${DEMO.student.password.padEnd(38)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Course  : ${DEMO.course.title.padEnd(38)}║`);
  console.log(`║  Modules : ${String(MODULES.length).padEnd(38)}║`);
  console.log(`║  Lessons : ${String(lessons.length).padEnd(38)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Note: Upload lesson videos in admin to enable playback║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

seedDemo().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
