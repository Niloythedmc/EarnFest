/**
 * SECURED GAME PROBABILITY CONFIG
 * This file defines all game probabilities. Changes are tracked and auditable.
 * All calculations run on backend with cryptographic RNG.
 * Last verified: 2026-04-04
 */

/**
 * SPIN WHEEL CONFIGURATION
 * Total probability must equal 1.0
 */
export const SPIN_WHEEL_PRIZES = [
  { label: '$20', value: 20, prob: 0.40, description: '40% chance' },
  { label: '$100', value: 100, prob: 0.50, description: '50% chance' },
  { label: '$200', value: 200, prob: 0.10, description: '10% chance' },
  { label: '$1000', value: 1000, prob: 0.00, description: '0% chance' },
  { label: '$2000', value: 2000, prob: 0.00, description: '0% chance' },
  { label: '$4000', value: 4000, prob: 0.00, description: '0% chance' },
  { label: '$10000', value: 10000, prob: 0.00, description: '0% chance' },
  { label: '$20000', value: 20000, prob: 0.00, description: '0% chance' }
];

// Validation: Sum of probabilities
const totalProb = SPIN_WHEEL_PRIZES.reduce((sum, p) => sum + p.prob, 0);
if (Math.abs(totalProb - 1.0) > 0.0001) {
  throw new Error(`CRITICAL: SPIN_WHEEL_PRIZES probabilities sum to ${totalProb}, not 1.0!`);
}

// Validation: No duplicate values
const values = SPIN_WHEEL_PRIZES.map(p => p.value);
if (new Set(values).size !== values.length) {
  throw new Error('CRITICAL: Duplicate prize values found in SPIN_WHEEL_PRIZES!');
}

// Validation: All values must be positive
if (SPIN_WHEEL_PRIZES.some(p => p.value <= 0)) {
  throw new Error('CRITICAL: Negative or zero prize values found!');
}

export const SPIN_WHEEL_CONFIG = {
  costPerSpin: 100,
  cooldownMs: 1000, // Minimum milliseconds between spins
  maxSpinsPerHour: 60, // Rate limit
  auditLevel: 'high' // Full audit trail for every spin
};

/**
 * Verify that probabilities are correctly configured
 */
export function verifyProbabilityConfig() {
  const errors = [];

  // Check sum
  const sum = SPIN_WHEEL_PRIZES.reduce((acc, p) => acc + p.prob, 0);
  if (Math.abs(sum - 1.0) > 0.0001) {
    errors.push(`Probabilities sum to ${sum}, expected 1.0`);
  }

  // Check range restrictions - only $0.001, $0.005, $0.01 should have non-zero probabilities
  const forbiddenNonZero = SPIN_WHEEL_PRIZES.filter(p =>
    p.prob > 0 && ![20, 100, 200].includes(p.value)
  );
  if (forbiddenNonZero.length > 0) {
    errors.push(`Forbidden non-zero probabilities found: ${forbiddenNonZero.map(p => p.label).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Verify on startup
const verification = verifyProbabilityConfig();
if (!verification.valid) {
  console.error('CRITICAL: Game probability configuration is invalid!');
  console.error('Errors:', verification.errors);
  process.exit(1);
} else {
  console.log('✓ Game probability configuration verified and valid');
}

/**
 * SCRATCH CARDS CONFIGURATION
 */
export const SCRATCH_CARDS_CONFIG = {
  mini: {
    price: 10,
    maxPrize: 100,
    label: 'Mini Scratch Card',
    probs: [0.35, 0.40, 0.15, 0.06, 0.03, 0.009, 0.001] // Index represents diamond count 0 to 6
  },
  mega: {
    price: 100,
    maxPrize: 1000,
    label: 'Mega Scratch Card',
    probs: [0.35, 0.40, 0.15, 0.06, 0.03, 0.009, 0.001]
  },
  jackpot: {
    price: 300,
    maxPrize: 3000,
    label: 'Jackpot Scratch Card',
    probs: [0.40, 0.35, 0.15, 0.06, 0.03, 0.009, 0.001]
  },
  festillion: {
    price: 500,
    maxPrize: 5000,
    label: 'Festillion Scratch Card',
    probs: [0.45, 0.30, 0.15, 0.06, 0.03, 0.009, 0.001]
  }
};

/**
 * Calculate reward based on card type and diamond count
 */
export function getScratchCardReward(type, diamondCount) {
  const card = SCRATCH_CARDS_CONFIG[type];
  if (!card) return 0;

  // Multipliers: 0=0%, 1=1%, 2=5%, 3=10%, 4=40%, 5=75%, 6=100%
  const multipliers = [0.00, 0.01, 0.05, 0.10, 0.40, 0.75, 1.00];
  const mult = multipliers[diamondCount] || 0;

  if (diamondCount === 0) return 0;

  // Reward must be in int and min 1
  return Math.max(1, Math.floor(card.maxPrize * mult));
}

// Validate scratch card probabilities on load
Object.entries(SCRATCH_CARDS_CONFIG).forEach(([type, card]) => {
  const sum = card.probs.reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 1.0) > 0.0001) {
    throw new Error(`CRITICAL: Scratch card ${type} probabilities sum to ${sum}, not 1.0!`);
  }
  if (card.probs.length !== 7) {
    throw new Error(`CRITICAL: Scratch card ${type} must have exactly 7 probability weights (for 0-6 diamonds)!`);
  }
});

