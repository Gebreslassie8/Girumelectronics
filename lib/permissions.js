import { Employee } from '@/models';

export const STAFF_ROLES = ['seller', 'storekeeper', 'cashier'];

export function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'owner';
}

/**
 * Resolves the effective branch ID string for a user (checks User.branch first, then Employee.branch).
 */
export async function resolveUserBranchId(user) {
  if (!user) return null;
  const direct = user.branch?._id || user.branch;
  if (direct) return String(direct);

  const userId = user._id || user.id;
  if (!userId) return null;

  const emp = await Employee.findOne({ user: userId }).select('branch permissions').lean();
  return emp?.branch ? String(emp.branch) : null;
}

/**
 * Checks whether an actor can perform 'read' | 'create' | 'update' | 'delete'
 * on a branch-scoped resource ('receipts', 'orders', 'products', 'inventory', etc.).
 */
export function canPerformBranchCrud(user, userBranchId, action = 'read', record = null) {
  if (!user) return false;
  if (isAdmin(user)) return true;

  const userId = String(user._id || user.id || '');
  const role = user.role;

  // Customers can only read their own receipts/orders (and create orders)
  if (role === 'customer') {
    if (!record) return action === 'read';
    const isCustomerOwner = [record.customer, record.customerId, record.user, record.userId]
      .filter(Boolean)
      .some((v) => String(v._id || v) === userId);
    return action === 'read' && isCustomerOwner;
  }

  // Staff actors (seller, cashier, storekeeper):
  // Can perform CRUD on their own branch's records (or records they created if branch is unset)
  if (STAFF_ROLES.includes(role)) {
    if (!record) {
      // Creating or listing requires an assigned branch
      return Boolean(userBranchId);
    }

    const recordBranchId = record.branch?._id
      ? String(record.branch._id)
      : record.branch
      ? String(record.branch)
      : null;

    const isCreator = [record.createdBy, record.seller, record.cashier, record.user]
      .filter(Boolean)
      .some((v) => String(v._id || v) === userId);

    if (userBranchId && recordBranchId) {
      return recordBranchId === String(userBranchId);
    }

    return isCreator;
  }

  return false;
}