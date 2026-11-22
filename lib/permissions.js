export const STAFF_ROLES = ['seller', 'storekeeper', 'cashier'];
export const NON_ADMIN_ROLES = ['seller', 'storekeeper', 'cashier', 'customer'];

export function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'owner';
}

/**
 * Checks whether a user can perform an action ('read' | 'create' | 'update' | 'delete')
 * on a resource ('receipts' | 'orders' | 'products' | 'inventory' | 'expenses' | 'activity' | 'settings').
 */
export function canPerformAction(user, resource, action = 'read', record = null) {
  if (!user) return false;
  if (isAdmin(user)) return true;

  const role = user.role;
  const userId = String(user._id || user.id || '');
  const userBranchId = user.branch ? String(user.branch._id || user.branch) : null;

  // Explicit permissions granted by admin (e.g., on employee/user permissions object)
  const perms = user.permissions || {};
  const resPerms = perms[resource] || {};
  const actionMap = {
    create: Boolean(resPerms.create ?? resPerms.add ?? perms.canAdd),
    update: Boolean(resPerms.update ?? resPerms.edit ?? perms.canEdit),
    delete: Boolean(resPerms.delete ?? perms.canDelete),
    read: true,
  };

  // Own-record check when a specific record is passed
  const isOwnerOfRecord = record
    ? [
        record.user,
        record.userId,
        record.createdBy,
        record.seller,
        record.sellerId,
        record.cashier,
        record.customer,
        record.customerId,
      ]
        .filter(Boolean)
        .some((val) => String(val._id || val) === userId)
    : false;

  const isSameBranch =
    record && userBranchId
      ? String(record.branch?._id || record.branch || '') === userBranchId
      : false;

  // Customer sees only their own records; can only read (and create orders if allowed)
  if (role === 'customer') {
    if (action === 'read') return record ? isOwnerOfRecord : true;
    if (action === 'create' && resource === 'orders') return true;
    return false;
  }

  // Staff roles (seller, storekeeper, cashier):
  // Default to own info only unless admin explicitly granted create/update/delete
  if (action === 'read') {
    if (!record) return true; // list endpoint will filter to own records
    return isOwnerOfRecord || (actionMap.update && isSameBranch);
  }

  if (!actionMap[action]) {
    return false;
  }

  // Even when admin grants create/update/delete, scope to own record or user's branch
  if (!record) return true;
  return isOwnerOfRecord || isSameBranch;
}

/**
 * Builds a MongoDB filter for list endpoints so non-admins only see their own data
 * (unless explicitly scoped to their branch by admin permissions).
 */
export function buildOwnershipFilter(user, resource = 'general') {
  if (!user || isAdmin(user)) return {};

  const userId = user._id || user.id;
  const perms = user.permissions || {};
  const resPerms = perms[resource] || {};
  const branchId = user.branch?._id || user.branch;

  // If admin granted branch-wide access for this resource and user has a branch
  if (resPerms.branchScope && branchId) {
    return { branch: branchId };
  }

  // Otherwise restrict strictly to records belonging to this user
  return {
    $or: [
      { user: userId },
      { userId: userId },
      { createdBy: userId },
      { seller: userId },
      { cashier: userId },
      { customer: userId },
    ],
  };
}