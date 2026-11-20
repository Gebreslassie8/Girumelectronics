// lib/constants.js
// All constant label maps and static lists used by dashboard pages.
// Charts/stats are computed from real orders in lib/analytics.js.

// ============================================================
// Orders
// ============================================================
export const ORDER_STATUS = {
  pending:       'በመጠባበቅ ላይ',
  in_production: 'በሂደት',
  picked_up:     'ተነስቷል',
  cancelled:     'ተሰርዟል',
};

export const ORDER_ITEM_TYPES = [
  'ሽያጭ',
  'አገልግሎት',
  'ጥገና',
];

// ============================================================
// Users
// ============================================================
export const USER_ROLES = {
  admin:       { label: 'አስተዳዳሪ',       color: 'purple' },
  seller:      { label: 'ሻጭ',            color: 'blue'   },
  cashier:     { label: 'ገንዘብ ተቀባይ',    color: 'green'  },
  storekeeper: { label: 'መጋዘን ተቆጣጣሪ',  color: 'orange' },
  customer:    { label: 'ደንበኛ',          color: 'gray'   },
  owner:       { label: 'ባለቤት',          color: 'red'    },
  manager:     { label: 'ሥራ አስኪያጅ',      color: 'yellow' },
  employee:    { label: 'ሠራተኛ',          color: 'cyan'   },
};

export const USER_BRANCHES = [
  { _id: 'addis',    name: 'አዲስ አበባ', value: 'addis',    label: 'አዲስ አበባ' },
  { _id: 'hawassa',  name: 'ሀዋሳ',      value: 'hawassa',  label: 'ሀዋሳ' },
  { _id: 'bahirdar', name: 'ባሂር ዳር',   value: 'bahirdar', label: 'ባሂር ዳር' },
  { _id: 'mekele',   name: 'መቀለ',      value: 'mekele',   label: 'መቀለ' },
];

// ============================================================
// Employees
// ============================================================
export const EMPLOYEE_STATUS = {
  active:     { label: 'ንቁ',        color: 'green'  },
  on_leave:   { label: 'ፍቃድ ላይ',    color: 'yellow' },
  suspended:  { label: 'ታግዷል',     color: 'orange' },
  terminated: { label: 'ተባረረ',     color: 'red'    },
  inactive:   { label: 'የቦዘነ',     color: 'gray'   },
};

export const POSITIONS = [
  'አስተዳዳሪ',
  'ሻጭ',
  'ገንዘብ ተቀባይ',
  'መጋዘን ተቆጣጣሪ',
  'ቴክኒሻን',
  'ሌላ',
];

export const DEPARTMENTS = [
  'ሽያጭ',
  'መጋዘን',
  'ፋይናንስ',
  'አገልግሎት',
  'አስተዳደር',
];

// ============================================================
// Permissions
// ============================================================
export const PERMISSIONS_LIST = [
  { key: 'users.view',      label: 'ተጠቃሚዎችን ማየት' },
  { key: 'users.edit',      label: 'ተጠቃሚዎችን ማስተካከል' },
  { key: 'employees.view',  label: 'ሠራተኞችን ማየት' },
  { key: 'employees.edit',  label: 'ሠራተኞችን ማስተካከል' },
  { key: 'products.view',   label: 'ምርቶችን ማየት' },
  { key: 'products.edit',   label: 'ምርቶችን ማስተካከል' },
  { key: 'orders.view',     label: 'ትዕዛዞችን ማየት' },
  { key: 'orders.edit',     label: 'ትዕዛዞችን ማስተካከል' },
  { key: 'receipts.view',   label: 'ደረሰኞችን ማየት' },
  { key: 'finance.view',    label: 'ፋይናንስን ማየት' },
  { key: 'analytics.view',  label: 'ትንተናን ማየት' },
  { key: 'settings.edit',   label: 'ቅንብሮችን ማስተካከል' },
];

// ============================================================
// Products
// ============================================================
export const PRODUCT_CATEGORIES = [
  'ቲቪ',
  'ማቀዝቀዣ',
  'ስልክ',
  'ላፕቶፕ',
  'ማጠቢያ ማሽን',
  'ሌላ',
];

export const PRODUCT_STATUS = {
  in_stock:    'በመጋዘን አለ',
  low_stock:   'ያነሰ ክምችት',
  out_of_stock:'ከመጋዘን ውጪ',
};

// ============================================================
// Receipts
// ============================================================
export const RECEIPT_STATUS = {
  draft:    'ረቂቅ',
  issued:   'ተሰጥቷል',
  paid:     'ተከፍሏል',
  refunded: 'ተመላሽ ሆኗል',
};

export const DEFAULT_RECEIPT_NOTE = 'ስለ ግዢዎ እናመሰግናለን።';

// ============================================================
// Analytics time-range filter
// ============================================================
export const TIME_RANGES = [
  { key: 'day',   label: 'ዛሬ' },
  { key: 'week',  label: 'ሳምንት' },
  { key: 'month', label: 'ወር' },
  { key: 'year',  label: 'ዓመት' },
];