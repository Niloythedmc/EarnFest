const liveUsers = new Map();

export const trackActivity = (telegramUser, actionName) => {
  if (!telegramUser || !telegramUser.id) return;
  const userId = telegramUser.id.toString();
  const name = telegramUser.username 
    ? `@${telegramUser.username}` 
    : [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'Anonymous';
  
  liveUsers.set(userId, {
    userId,
    name,
    action: actionName,
    timestamp: Date.now()
  });
};

export const getLiveUsers = () => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  // Clean up old activities
  for (const [userId, data] of liveUsers.entries()) {
    if (data.timestamp < fiveMinutesAgo) {
      liveUsers.delete(userId);
    }
  }
  
  // Return sorted by most recent timestamp
  return Array.from(liveUsers.values()).sort((a, b) => b.timestamp - a.timestamp);
};
