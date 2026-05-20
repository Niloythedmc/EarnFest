import axios from 'axios';

export const sendTelegramMessage = async (chatId, text, replyMarkup = null, disablePreview = false) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing in the environment!');
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      ...(replyMarkup && { reply_markup: replyMarkup }),
      ...(disablePreview && { disable_web_page_preview: true })
    });
  } catch (error) {
    console.error('Failed to send Telegram message:', error.response?.data || error.message);
    throw error; // Throw so that callers can catch it and know it failed
  }
};

export const sendTelegramPhoto = async (chatId, photoUrl, caption, replyMarkup = null) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing in the environment!');
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML',
      ...(replyMarkup && { reply_markup: replyMarkup })
    });
  } catch (error) {
    console.error('Failed to send Telegram photo:', error.response?.data || error.message);
    throw error; // Throw so the caller can trigger a fallback
  }
};

/**
 * Checks if a user is a member of a chat (channel/group)
 * Returns true if status is member, administrator, or creator
 */
export const checkChatMember = async (userId, chatId) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    // If chatId is a username, ensure it starts with @
    const formattedChatId = chatId.startsWith('-') || chatId.startsWith('@') ? chatId : `@${chatId}`;
    
    const response = await axios.get(`https://api.telegram.org/bot${token}/getChatMember`, {
      params: {
        chat_id: formattedChatId,
        user_id: userId
      }
    });

    const status = response.data?.result?.status;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch (error) {
    console.error(`Membership check failed for ${userId} in ${chatId}:`, error.response?.data || error.message);
    return false;
  }
};
