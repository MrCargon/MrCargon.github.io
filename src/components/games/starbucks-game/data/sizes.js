/**
 * sizes.js - Size information and mappings
 * Extracted from StarbucksGame.js Phase 1 refactoring
 */

export const SIZE_INFO = {
    S: { name: "Short", oz: "8oz", description: "Tiny but mighty!" },
    T: { name: "Tall", oz: "12oz", description: "Not so tall after all!" },
    G: { name: "Grande", oz: "16oz", description: "Italian for 'big'" },
    V: { name: "Venti", oz: "20/24oz", description: "Italian for '20'" },
    TR: { name: "Trenta", oz: "30oz", description: "The giant cup!" }
};

export const SIZE_MAPPINGS = {
    hotDrinks: ['S', 'T', 'G', 'V'],
    icedDrinks: ['T', 'G', 'V'],
    frappuccinos: ['T', 'G', 'V'],
    refreshers: ['T', 'G', 'V', 'TR']
};
