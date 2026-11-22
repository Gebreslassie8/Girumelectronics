// =====================================================================
//  የኤሌክትሪክ እና ማገዶ ቆጣቢ ምጣድ መሸጫ እና ማምረቻ ድርጅት
//  ሙሉ የMongoose (MongoDB) ዳታቤዝ ስነ-ህንፃ
//  File: models/index.js
//  DB: MongoDB + Mongoose 7+
// =====================================================================

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------
// 0. Helpers
// ---------------------------------------------------------------------
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

export async function nextCode(prefix, collection) {
  const year = new Date().getFullYear();
  const key = `${collection}-${year}`;
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${year}-${String(counter.seq).padStart(4, '0')}`;
}

const PHONE_REGEX = /^(\+251|0)9\d{8}$/;
const PHONE_MSG = 'ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ምሳሌ: 0912345678)';

// =====================================================================
// 1. Branch — ቅርንጫፎች
// =====================================================================
const branchSchema = new mongoose.Schema(
  {
    name:   { type: String, required: [true, 'የቅርንጫፍ ስም ያስፈልጋል'], trim: true, unique: true },
    code:   { type: String, unique: true, uppercase: true, trim: true },
    address:{ type: String, required: [true, 'አድራሻ ያስፈልጋል'], trim: true },
    phone:  { type: String, trim: true, match: [PHONE_REGEX, PHONE_MSG] },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive:{ type: Boolean, default: true },
  },
  { timestamps: true, collection: 'branches' }
);

branchSchema.index({ isActive: 1 });

// =====================================================================
// 2. User — ተጠቃሚዎች
// =====================================================================
const userSchema = new mongoose.Schema(
  {
    fullName:{ type: String, required: [true, 'ሙሉ ስም ያስፈልጋል'], trim: true },
    phone:   { type: String, required: [true, 'ስልክ ቁጥር ያስፈልጋል'], unique: true, trim: true, match: [PHONE_REGEX, PHONE_MSG] },
    email:   { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    password:{ type: String, required: [true, 'ፓስወርድ ያስፈልጋል'], minlength: [6, 'ፓስወርድ ቢያንስ 6 ፊደል መሆን አለበት'], select: false },
    role:    { type: String, enum: ['admin', 'owner', 'seller', 'cashier', 'storekeeper', 'customer'], default: 'customer' },
    branch:  { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    address: { type: String, trim: true },
    avatar:  { type: String, trim: true },
    isActive:{ type: Boolean, default: true },
    lastLogin:{ type: Date },
  },
  { timestamps: true, collection: 'users' }
);

userSchema.index({ role: 1 });
userSchema.index({ branch: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  // Prevent double-hashing when a route already hashed the password with bcrypt
  if (/^\$2[aby]\$\d{2}\$/.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  if (!this.password || !candidate) return Promise.resolve(false);
  return bcrypt.compare(String(candidate), String(this.password));
};

// =====================================================================
// 3. Employee — ሠራተኞች
// =====================================================================
const employeeSchema = new mongoose.Schema(
  {
    employeeCode:{ type: String, unique: true, uppercase: true, trim: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    position:    { type: String, required: [true, 'የሥራ መደብ ያስፈልጋል'], trim: true },
    department:  { type: String, trim: true },
    salary:      { type: Number, required: true, min: [0, 'ደመወዝ አሉታዊ መሆን አይችልም'] },
    hireDate:    { type: Date, default: Date.now },
    status:      { type: String, enum: ['active', 'on_leave', 'suspended', 'terminated'], default: 'active' },
    branch:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        canSell: true,
        canManageInventory: false,
        canManageOrders: true,
        canIssueReceipts: true,
        canViewAnalytics: false,
        canManageEmployees: false,
      }),
    },
    emergencyContact: {
      name:  { type: String },
      phone: { type: String, match: [PHONE_REGEX, PHONE_MSG] },
    },
  },
  { timestamps: true, collection: 'employees' }
);

employeeSchema.index({ branch: 1 });
employeeSchema.index({ status: 1 });

employeeSchema.pre('save', async function () {
  if (!this.employeeCode) this.employeeCode = await nextCode('EMP', 'employee');
  if (this.isModified('permissions')) {
    this.markModified('permissions');
  }
});

// =====================================================================
// 4. Inventory — ወደ መጋዘን ገቢ (purchase log, not stock source)
// =====================================================================
const inventorySchema = new mongoose.Schema(
  {
    itemCode:   { type: String, unique: true, uppercase: true, trim: true },
    itemType:   { type: String, required: [true, 'የዕቃ ዓይነት ያስፈልጋል'], trim: true },
    quantity:   { type: Number, required: true, min: [0, 'ብዛት አሉታዊ መሆን አይችልም'] },
    unitPrice:  { type: Number, required: true, min: [0, 'ዋጋ አሉታዊ መሆን አይችልም'] },
    totalPrice: { type: Number, required: true, min: 0 },
    supplier:   { type: String, trim: true },
    description:{ type: String, trim: true },
    branch:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    receivedDate:{ type: Date, required: true, default: Date.now },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    transaction:{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    // ✅ FIX: was referenced in post('save') but never declared,
    //        so the "flag" update was silently dropped and stock
    //        was incremented on every save.
    _stockApplied: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'inventory' }
);

inventorySchema.index({ branch: 1, receivedDate: -1 });
inventorySchema.index({ itemType: 1 });

inventorySchema.pre('save', async function () {
  if (this.isModified('quantity') || this.isModified('unitPrice')) {
    this.totalPrice = this.quantity * this.unitPrice;
  }
  if (!this.itemCode) {
    this.itemCode = await nextCode('INV', 'inventory');
  }
});

// When a purchase is received, bump the linked product's stock — once only.
inventorySchema.post('save', async function (doc) {
  if (!doc.product || doc._stockApplied) return;

  // Atomically claim this inventory row before touching stock.
  const claimed = await mongoose.model('Inventory').findOneAndUpdate(
    { _id: doc._id, _stockApplied: false },
    { $set: { _stockApplied: true } },
    { new: true }
  );
  if (!claimed) return; // another process already applied it

  await mongoose.model('Product').findByIdAndUpdate(doc.product, {
    $inc: { quantity: doc.quantity },
  });
});

// =====================================================================
// 5. Product — የሚሸጡ ዕቃዎች (source of truth for current stock)
// =====================================================================
const productSchema = new mongoose.Schema(
  {
    code:        { type: String, unique: true, uppercase: true, trim: true },
    name:        { type: String, required: [true, 'የዕቃ ስም ያስፈልጋል'], trim: true },
    category:    { type: String, trim: true },
    description: { type: String, trim: true },
    image:       { type: String, trim: true },
    quantity:    { type: Number, required: true, min: 0, default: 0 },
    unit:        { type: String, default: 'pcs', trim: true },
    unitPrice:   { type: Number, required: true, min: [0, 'የመግዣ ዋጋ አሉታዊ መሆን አይችልም'] },
    sellingPrice:{ type: Number, required: true, min: [0, 'የመሸጫ ዋጋ አሉታዊ መሆን አይችልም'] },
    status:      { type: String, enum: ['in_stock', 'sold', 'reserved', 'damaged'], default: 'in_stock' },
    branch:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'products', toJSON: { virtuals: true } }
);

productSchema.index({ branch: 1, status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ name: 'text', description: 'text' });

productSchema.virtual('profitMargin').get(function () {
  if (!this.unitPrice) return 0;
  return Number((((this.sellingPrice - this.unitPrice) / this.unitPrice) * 100).toFixed(2));
});

productSchema.pre('validate', function () {
  if (this.sellingPrice < this.unitPrice) {
    throw new Error('የመሸጫ ዋጋ ከመግዣ ዋጋ መቀነስ አይችልም');
  }
});

productSchema.pre('save', async function () {
  if (!this.code) this.code = await nextCode('PRD', 'product');
});

// =====================================================================
// 6. Order — ትዕዛዞች
// =====================================================================
const ORDER_STATUSES = ['pending', 'in_production', 'ready', 'picked_up', 'delivered', 'completed', 'paid', 'cancelled'];

const VALID_TRANSITIONS = {
  pending:       ['in_production', 'cancelled'],
  in_production: ['ready', 'cancelled'],
  ready:         ['picked_up', 'delivered', 'completed', 'paid', 'cancelled'],
  picked_up:     ['delivered', 'completed', 'paid'],
  delivered:     ['completed', 'paid'],
  completed:     [],
  paid:          ['completed'],
  cancelled:     [],
};

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, uppercase: true, trim: true },
    customerName:{ type: String, required: [true, 'የደንበኛ ስም ያስፈልጋል'], trim: true },
    customerPhone:{ type: String, required: [true, 'የደንበኛ ስልክ ያስፈልጋል'], match: [PHONE_REGEX, PHONE_MSG] },
    address:     { type: String, required: [true, 'አድራሻ ያስፈልጋል'], trim: true },
    itemType:    { type: String, required: [true, 'የዕቃ ዓይነት ያስፈልጋል'], trim: true },
    product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    quantity:    { type: Number, required: true, min: [1, 'ብዛት ቢያንስ 1 መሆን አለበት'] },
    measurements:{
      width: { type: Number }, height: { type: Number }, depth: { type: Number },
      unit:  { type: String, default: 'cm' },
      note:  { type: String },
    },
    unitPrice:   { type: Number, required: true, min: 0 },
    totalPrice:  { type: Number, required: true, min: 0 },
    prepayment:  { type: Number, required: true, min: 0, default: 0 },
    remainingPayment:{ type: Number, required: true, min: 0, default: 0 },
    status:      { type: String, enum: ORDER_STATUSES, default: 'pending' },
    orderDate: { type: Date, default: Date.now },
    appointmentDate: { type: Date, default: Date.now },
    note:        { type: String, trim: true },
    branch:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    _stockDeducted: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'orders' }
);

orderSchema.index({ status: 1 });
orderSchema.index({ appointmentDate: 1 });
orderSchema.index({ branch: 1, createdAt: -1 });
orderSchema.index({ branch: 1, status: 1, appointmentDate: 1 });
orderSchema.index({ customerPhone: 1 });

orderSchema.pre('validate', function () {
  if (this.prepayment > this.totalPrice) {
    throw new Error('ቅድመ ክፍያ ከጠቅላላ ዋጋ መብለጥ አይችልም');
  }
  this.remainingPayment = Math.max(this.totalPrice - this.prepayment, 0);
});

orderSchema.pre('init', function (raw) {
  this.$locals.prevStatus = raw.status;
});

orderSchema.pre('save', function () {
  if (!this.isNew && this.isModified('status')) {
    const prev = this.$locals.prevStatus;
    if (prev && !VALID_TRANSITIONS[prev]?.includes(this.status)) {
      throw new Error(`ሕገ-ወጥ የሁኔታ ሽግግር: ${prev} → ${this.status}`);
    }
  }
});

orderSchema.pre('save', async function () {
  if (!this.orderNumber) this.orderNumber = await nextCode('ORD', 'order');
});

// Deduct stock when order moves to 'ready' — atomically, once only.
orderSchema.post('save', async function (doc) {
  if (doc.status !== 'ready' || !doc.product || doc._stockDeducted) return;

  const claimed = await mongoose.model('Order').findOneAndUpdate(
    { _id: doc._id, _stockDeducted: false },
    { $set: { _stockDeducted: true } },
    { new: true }
  );
  if (!claimed) return;

  await mongoose.model('Product').findByIdAndUpdate(doc.product, {
    $inc: { quantity: -doc.quantity },
  });
});

// =====================================================================
// 7. Receipt — ደረሰኞች
// =====================================================================
const DEFAULT_RECEIPT_NOTE =
  'የተከፈለ የቅድመ ክፍያ ከሁለት ወር በኋላ አገልግሎት አይሰጥም፤ ወይም የዕቃው ዋጋ ከጨመረ የጨመረውን ሂሳብ አክለው ይወስዳሉ።';

const receiptSchema = new mongoose.Schema(
  {
    receiptNumber:{ type: String, unique: true, uppercase: true, trim: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    productCode:  { type: String, trim: true },
    itemType:     { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone:{ type: String, match: [PHONE_REGEX, PHONE_MSG] },
    prepayment:   { type: Number, required: true, min: 0 },
    remainingPayment:{ type: Number, required: true, min: 0 },
    totalPrice:   { type: Number, required: true, min: 0 },
    appointmentDate:{ type: Date, required: true },
    note:         { type: String, default: DEFAULT_RECEIPT_NOTE, trim: true },
    status:       { type: String, enum: ['active', 'completed', 'expired', 'cancelled'], default: 'active' },
    issuedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branch:       { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  },
  { timestamps: true, collection: 'receipts' }
);

receiptSchema.index({ status: 1 });
receiptSchema.index({ branch: 1, createdAt: -1 });
receiptSchema.index({ branch: 1, status: 1, createdAt: -1 });
receiptSchema.index(
  { order: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

receiptSchema.pre('save', async function () {
  if (!this.receiptNumber) this.receiptNumber = await nextCode('RCP', 'receipt');
});

// =====================================================================
// 8. Expense — ወጪዎች
// =====================================================================
const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['purchase','salary','rent','utilities','transport','maintenance','marketing','other'],
      required: [true, 'የወጪ ምድብ ያስፈልጋል'],
    },
    description: {
      type: String,
      required: [false, 'መግለጫ ያስፈልጋል'],
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'መጠን አሉታዊ መሆን አይችልም'],
    },
    paidTo: {
      type: String,
      required: [true, 'የተከፈለበት ሰው ስም ያስፈልጋል'],
      trim: true,
    },
    paidToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ['cash','bank','telebirr','cbe_birr','other'],
      default: 'cash',
    },
    reference: { type: String, trim: true },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
  },
  { timestamps: true, collection: 'expenses' }
);

expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ branch: 1, expenseDate: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ paidTo: 1 });
expenseSchema.index({ paidTo: 'text' });

// =====================================================================
// 9. Revenue — ገቢዎች
// =====================================================================
const revenueSchema = new mongoose.Schema(
  {
    source:   { type: String, enum: ['sale','order_payment','service','other'], required: [true, 'የገቢ ምንጭ ያስፈልጋል'] },
    description:{ type: String, required: [true, 'መግለጫ ያስፈልጋል'], trim: true },
    amount:   { type: Number, required: true, min: [0, 'መጠን አሉታዊ መሆን አይችልም'] },
    revenueDate:{ type: Date, required: true, default: Date.now },
    paymentMethod:{ type: String, enum: ['cash','bank','telebirr','cbe_birr','other'], default: 'cash' },
    reference:{ type: String, trim: true },
    order:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    receipt:  { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },
    branch:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    recordedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transaction:{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  },
  { timestamps: true, collection: 'revenues' }
);

revenueSchema.index({ revenueDate: -1 });
revenueSchema.index({ branch: 1, revenueDate: -1 });
revenueSchema.index({ source: 1 });

// =====================================================================
// 10. Transaction — Central Ledger
// =====================================================================
const transactionSchema = new mongoose.Schema(
  {
    transactionNumber:{ type: String, unique: true, uppercase: true, trim: true },
    type:     { type: String, enum: ['income','expense','transfer','adjustment'], required: true },
    category: { type: String, required: true, trim: true },
    amount:   { type: Number, required: true, min: [0, 'መጠን አሉታዊ መሆን አይችልም'] },
    direction:{ type: String, enum: ['credit','debit'], required: true },
    transactionDate:{ type: Date, required: true, default: Date.now },
    paymentMethod:{ type: String, enum: ['cash','bank','telebirr','cbe_birr','other'], default: 'cash' },
    reference:{ type: String, trim: true },
    description:{ type: String, required: [true, 'መግለጫ ያስፈልጋል'], trim: true },
    order:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    receipt:  { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },
    expense:  { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    revenue:  { type: mongoose.Schema.Types.ObjectId, ref: 'Revenue', default: null },
    inventory:{ type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', default: null },
    branch:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    recordedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    balanceAfter:{ type: Number, default: null },
  },
  { timestamps: true, collection: 'transactions' }
);

transactionSchema.index({ transactionDate: -1 });
transactionSchema.index({ type: 1, transactionDate: -1 });
transactionSchema.index({ branch: 1, transactionDate: -1 });

transactionSchema.pre('save', async function () {
  if (!this.transactionNumber) this.transactionNumber = await nextCode('TXN', 'transaction');
});

// =====================================================================
// 11. Warranty — ዋስትና
// =====================================================================
const WARRANTY_STATUSES = ['active', 'expiring', 'expired', 'claimed', 'voided'];

const warrantySchema = new mongoose.Schema(
  {
    warrantyNumber: { type: String, unique: true, uppercase: true, trim: true },
    order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order',   default: null },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    itemType:      { type: String, required: [true, 'የዕቃ ዓይነት ያስፈልጋል'], trim: true },
    customerName:  { type: String, required: [true, 'የደንበኛ ስም ያስፈልጋል'], trim: true },
    customerPhone: { type: String, required: [true, 'የደንበኛ ስልክ ያስፈልጋል'], trim: true },
    startDate:      { type: Date, required: [true, 'የጀመረበት ቀን ያስፈልጋል'], default: Date.now },
    endDate:        { type: Date, required: [true, 'የሚያልቅበት ቀን ያስፈልጋል'] },
    durationMonths: { type: Number, required: true, min: [1, 'የዋስትና ጊዜ ቢያንስ 1 ወር መሆን አለበት'], default: 24 },
    status: { type: String, enum: WARRANTY_STATUSES, default: 'active' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    notes:  { type: String, trim: true },
    claimHistory: [
      {
        date:        { type: Date, default: Date.now },
        description: { type: String, trim: true },
        resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    _autoExpired: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'warranties' }
);

warrantySchema.index({ status: 1 });
warrantySchema.index({ endDate: 1 });
warrantySchema.index({ customerPhone: 1 });
warrantySchema.index({ branch: 1, status: 1 });
warrantySchema.index({ branch: 1, createdAt: -1 });
warrantySchema.index({ order: 1 }, { sparse: true });

warrantySchema.pre('validate', function () {
  if (this.startDate && this.durationMonths && !this.endDate) {
    const d = new Date(this.startDate);
    d.setMonth(d.getMonth() + this.durationMonths);
    this.endDate = d;
  }
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    throw new Error('የሚያልቅበት ቀን ከመጀመሪያው ቀን መቅደም አይችልም');
  }
});

warrantySchema.pre('save', async function () {
  if (!this.warrantyNumber) this.warrantyNumber = await nextCode('WRN', 'warranty');
});

// =====================================================================
// 12. Notification — ማሳወቂያዎች   ✅ ADDED (was the crash)
// =====================================================================
const NOTIFICATION_TYPES = ['order', 'payment', 'stock', 'warranty', 'system', 'other'];
const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'error'];

const notificationSchema = new mongoose.Schema(
  {
    title:      { type: String, required: [true, 'ርዕስ ያስፈልጋል'], trim: true },
    message:    { type: String, required: [true, 'መልእክት ያስፈልጋል'], trim: true },
    type:       { type: String, enum: NOTIFICATION_TYPES, default: 'system' },
    severity:   { type: String, enum: NOTIFICATION_SEVERITIES, default: 'info' },
    isRead:     { type: Boolean, default: false },
    readAt:     { type: Date, default: null },

    // Who should see it
    recipient:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    branch:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

    // What it relates to
    relatedModel: { type: String, enum: ['Order','Receipt','Product','Inventory','Warranty','Transaction','Expense','Revenue', null], default: null },
    relatedId:    { type: mongoose.Schema.Types.ObjectId, default: null },

    // Optional CTA
    link:       { type: String, trim: true },
    icon:       { type: String, trim: true },
  },
  { timestamps: true, collection: 'notifications' }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ branch: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });

// =====================================================================
// 📦 Model registration (prevent OverwriteModelError)
// =====================================================================
export const Branch       = mongoose.models.Branch       || mongoose.model('Branch', branchSchema);
export const User         = mongoose.models.User         || mongoose.model('User', userSchema);
export const Employee     = mongoose.models.Employee     || mongoose.model('Employee', employeeSchema);
export const Inventory    = mongoose.models.Inventory    || mongoose.model('Inventory', inventorySchema);
export const Product      = mongoose.models.Product      || mongoose.model('Product', productSchema);
export const Order        = mongoose.models.Order        || mongoose.model('Order', orderSchema);
export const Receipt      = mongoose.models.Receipt      || mongoose.model('Receipt', receiptSchema);
export const Expense      = mongoose.models.Expense      || mongoose.model('Expense', expenseSchema);
export const Revenue      = mongoose.models.Revenue      || mongoose.model('Revenue', revenueSchema);
export const Transaction  = mongoose.models.Transaction  || mongoose.model('Transaction', transactionSchema);
export const Warranty     = mongoose.models.Warranty     || mongoose.model('Warranty', warrantySchema);
export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

// =====================================================================
// 📤 Re-export of OtpCode (kept from original)
// =====================================================================
export { default as OtpCode } from './OtpCode.js';