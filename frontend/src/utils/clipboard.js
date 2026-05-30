import { toast } from 'sonner';

/**
 * Copies a given text to the clipboard using the best available method:
 * 1. Telegram WebApp SDK native copy
 * 2. Navigator Clipboard API
 * 3. Textarea + document.execCommand fallback
 */
export const copyTextToClipboard = async (text, successMsg = 'Copied to clipboard!') => {
  if (!text) return false;

  // 1. Try Telegram WebApp SDK copy first (most robust inside Telegram WebApp)
  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.copyToClipboard === 'function') {
    try {
      tg.copyToClipboard(text);
      toast.success(successMsg);
      return true;
    } catch (e) {
      console.warn('Telegram copyToClipboard failed:', e);
    }
  }

  // 2. Fallback to standard navigator.clipboard
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMsg);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard failed:', err);
    }
  }

  // 3. Final fallback to temporary textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      toast.success(successMsg);
      return true;
    } else {
      throw new Error('execCommand returned false');
    }
  } catch (err) {
    console.error('Fallback copy failed:', err);
    toast.error('Failed to copy. Please copy manually.');
    return false;
  }
};
