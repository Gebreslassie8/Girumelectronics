import { Notification, User } from '@/models';

export async function createNotificationsForUsers({
  userIds = [],
  title,
  message,
  type = 'system',
  severity = 'info',
  branch = null,
  relatedModel = null,
  relatedId = null,
  link = '/dashboard',
}) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];

  const uniqueIds = [...new Set(userIds.map((id) => String(id)))];

  const docs = uniqueIds.map((recipient) => ({
    recipient,
    branch,
    title,
    message,
    type,
    severity,
    isRead: false,
    relatedModel,
    relatedId,
    link,
  }));

  return Notification.insertMany(docs, { ordered: false }).catch(() => []);
}

export async function notifyAdmins({
  title,
  message,
  type = 'system',
  severity = 'info',
  branch = null,
  relatedModel = null,
  relatedId = null,
  link = '/dashboard',
}) {
  const admins = await User.find({
    role: { $in: ['admin', 'owner'] },
    isActive: { $ne: false },
  })
    .select('_id')
    .lean();

  return createNotificationsForUsers({
    userIds: admins.map((a) => a._id),
    title,
    message,
    type,
    severity,
    branch,
    relatedModel,
    relatedId,
    link,
  });
}