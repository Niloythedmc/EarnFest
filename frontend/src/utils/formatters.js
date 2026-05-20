/**
 * Formats a reward amount according to the rule:
 * - Exactly 1 decimal place if it's not a whole number (e.g., 0.5, 9.9)
 * - Whole number if no decimals (e.g., 10)
 */
export const formatRewardAmount = (amount) => {
    const num = Number(amount);
    if (isNaN(num)) return '0';
    
    // Check if it has a decimal part
    if (num % 1 !== 0) {
        return num.toFixed(1);
    }

    return num.toLocaleString('en-US');
};

/**
 * Formats a balance with comma separators every 3 digits from the right.
 * Example: 1234 -> 1,234
 */
export const formatBalance = (amount) => {
    const num = Number(amount || 0);
    if (isNaN(num)) return '0';
    
    // For balance, we usually want whole numbers or max 2 decimals based on the app's current style
    // The user specifically asked for commas every 3 chars from backward.
    return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Formats a number with K (thousands), M (millions), B (billions) suffix.
 * Examples:
 *   1234 -> 1.2K
 *   12345 -> 12.3K
 *   1234567 -> 1.2M
 *   1234567890 -> 1.2B
 *   Less than 1000 returns the number as-is
 */
export const formatCompactNumber = (amount) => {
    const num = Number(amount || 0);
    if (isNaN(num)) return '0';
    
    if (num >= 1_000_000_000) {
        return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
};
