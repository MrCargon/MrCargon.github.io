/**
 * ScoreManager.js - Stars, levels, and streaks management
 * Extracted from StarbucksGame.js Phase 2 refactoring
 *
 * IMPORTANT: Pure functions - receives current state, returns new values
 * Does NOT mutate state directly
 */

export class ScoreManager {
    constructor(starsPerLevel = 5) {
        this.starsPerLevel = starsPerLevel;
    }

    /**
     * Add a star and check for level up
     * Returns: { newStars, leveledUp, newLevel }
     */
    addStar(currentStars, currentLevel) {
        const newStars = currentStars + 1;
        const newLevel = Math.floor(newStars / this.starsPerLevel) + 1;
        const leveledUp = newLevel > currentLevel;

        return {
            newStars,
            leveledUp,
            newLevel: leveledUp ? newLevel : currentLevel
        };
    }

    /**
     * Update streak (increment on correct, reset on wrong)
     * Returns: { newStreak, maxStreak, streakBadgeEarned }
     */
    updateStreak(currentStreak, maxStreak, isCorrect) {
        if (isCorrect) {
            const newStreak = currentStreak + 1;
            const newMaxStreak = Math.max(newStreak, maxStreak);
            const streakBadgeEarned = (newStreak === 5); // 5-streak badge

            return {
                newStreak,
                maxStreak: newMaxStreak,
                streakBadgeEarned
            };
        } else {
            return {
                newStreak: 0,
                maxStreak: maxStreak, // unchanged
                streakBadgeEarned: false
            };
        }
    }

    /**
     * Get stars needed to reach next level
     */
    getStarsToNextLevel(currentStars) {
        const currentLevel = Math.floor(currentStars / this.starsPerLevel) + 1;
        const nextLevelStars = currentLevel * this.starsPerLevel;
        return nextLevelStars - currentStars;
    }

    /**
     * Get current level from stars
     */
    getCurrentLevel(currentStars) {
        return Math.floor(currentStars / this.starsPerLevel) + 1;
    }
}
