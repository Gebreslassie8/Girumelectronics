import { Employee } from '@/models';

export const STAFF_ROLES = ['seller', 'storekeeper', 'cashier'];

export function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'owner';
}

/**
 * Synchronous helper for client components / UI tables where `user` (and optional `employee`)
 * is already in memory.
 */
export function getBranchIdSync(user, employee = null) {
  if (!user && !employee) return null;
  const direct =
    user?.branch?._id ||
    user?.branch ||
    employee?.branch?._id ||
    employee?.branch ||
    user?.employee?.branch?._id ||
    user?.employee?.branch;
  return direct ? String(direct) : null;
}

/**
 * Resolves the effective branch ID string for a user (checks User.branch first, then Employee.branch).
 */
export async function resolveUserBranchId(user) {
  if (!user) return null;
  const direct = getBranchIdSync(user);
  if (direct) return direct;

  const userId = user._id || user.id;
  if (!userId) return null;

  const emp = await Employee.findOne({ user: userId }).select('branch permissions').lean();
  return emp?.branch ? String(emp.branch) : null;
}

function hasExplicitActionPermission(user, action, resource = 'general') {
  const perms = user?.permissions || {};
  const resPerms = typeof perms[resource] === 'object' && perms[resource] !== null ? perms[resource] : {};

  if (action === 'delete') {
    return Boolean(
      perms.canDelete ||
        perms.delete ||
        resPerms.delete ||
        resPerms.canDelete ||
        perms[`delete_${resource}`]
    );
  }
  if (action === 'update') {
    return Boolean(
      perms.canUpdate ||
        perms.canEdit ||
        perms.update ||
        perms.edit ||
        resPerms.update ||
        resPerms.edit ||
        perms[`edit_${resource}`]
    );
  }
  if (action === 'create') {
    return Boolean(
      perms.canCreate ||
        perms.create ||
        resPerms.create ||
        perms[`create_${resource}`]
    );
  }
  return Boolean(
    perms.canView ||
      perms.view ||
      perms.read ||
      resPerms.view ||
      resPerms.read ||
      perms[`view_${resource}`]
  );
}

/**
 * Checks whether an actor can perform 'read' | 'create' | 'update' | 'delete'
 * on a branch-scoped resource ('receipts', 'orders', 'products', 'inventory', etc.).
 */
export function canPerformBranchCrud(
  user,
  userBranchId,
  action = 'read',
  record = null,
  resource = 'general'
) {
  if (!user) return false;
  if (isAdmin(user)) return true;

  const userId = String(user._id || user.id || '');
  const role = user.role;

  // Customers can only read their own receipts/orders (and create orders)
  if (role === 'customer') {
    if (!record) return action === 'read' || (action === 'create' && resource === 'orders');
    const isCustomerOwner = [record.customer, record.customerId, record.user, record.userId]
      .filter(Boolean)
      .some((v) => String(v._id || v) === userId);
    return action === 'read' && isCustomerOwner;
  }

  // Staff actors (seller, cashier, storekeeper):
  // Can perform CRUD on their own branch's records (or records they created if branch is unset)
  if (STAFF_ROLES.includes(role)) {
    const effectiveBranchId = userBranchId || getBranchIdSync(user);
    const hasExplicitFlag = hasExplicitActionPermission(user, action, resource);

    if (!record) {
      return Boolean(effectiveBranchId) || hasExplicitFlag;
    }

    const recordBranchId = record.branch?._id
      ? String(record.branch._id)
      : record.branch
      ? String(record.branch)
      : null;

    const isCreator = [
      record.createdBy,
      record.issuedBy,
      record.recordedBy,
      record.seller,
      record.cashier,
      record.user,
    ]
      .filter(Boolean)
      .some((v) => String(v._id || v) === userId);

    if (effectiveBranchId && recordBranchId) {
      return recordBranchId === String(effectiveBranchId) || isCreator;
    }

    return isCreator || hasExplicitFlag;
  }

  return false;
}