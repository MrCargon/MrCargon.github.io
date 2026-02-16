/**
 * AnswerValidator.js - Recipe validation logic
 * Extracted from StarbucksGame.js Phase 2 refactoring
 */

const MAX_INPUT_VALUE = 10;
const MIN_INPUT_VALUE = 0;

export class AnswerValidator {
    /**
     * Validate and parse numeric input with bounds checking
     * @param {string} value - Input value
     * @returns {number|null} Parsed value or null if invalid
     */
    validateNumericInput(value) {
        const parsed = parseInt(value || '0', 10);

        if (isNaN(parsed)) {
            return null;
        }
        if (parsed < MIN_INPUT_VALUE || parsed > MAX_INPUT_VALUE) {
            return null;
        }

        return parsed;
    }

    /**
     * Validate answer against recipe
     * Returns true if answer matches recipe requirements
     */
    validateAnswer(answer, recipe, category, size) {
        let correct = true;

        // Check appropriate fields based on drink type
        if (category === 'hotDrinks' || category === 'icedDrinks') {
            if (recipe.shots) {
                const shotsInput = this.validateNumericInput(answer.shots);
                if (shotsInput === null || shotsInput !== recipe.shots[size]) {
                    correct = false;
                }
            }
            if (recipe.syrup) {
                const syrupInput = this.validateNumericInput(answer.syrup);
                if (syrupInput === null || syrupInput !== recipe.syrup[size]) {
                    correct = false;
                }
            }
        } else if (category === 'frappuccinos') {
            if (recipe.roast) {
                const roastInput = this.validateNumericInput(answer.roast);
                if (roastInput === null || roastInput !== recipe.roast[size]) {
                    correct = false;
                }
            }
            if (recipe.frappBase) {
                const frappBaseInput = this.validateNumericInput(answer.frappBase);
                if (frappBaseInput === null || frappBaseInput !== recipe.frappBase[size]) {
                    correct = false;
                }
            }
            if (recipe.mochaSauce) {
                const mochaSauceInput = this.validateNumericInput(answer.mochaSauce);
                if (mochaSauceInput === null || mochaSauceInput !== recipe.mochaSauce[size]) {
                    correct = false;
                }
            }
            if (recipe.caramelSyrup) {
                const caramelSyrupInput = this.validateNumericInput(answer.caramelSyrup);
                if (caramelSyrupInput === null || caramelSyrupInput !== recipe.caramelSyrup[size]) {
                    correct = false;
                }
            }
        } else if (category === 'refreshers') {
            if (recipe.inclusion) {
                const inclusionInput = this.validateNumericInput(answer.inclusion);
                if (inclusionInput === null || inclusionInput !== recipe.inclusion[size]) {
                    correct = false;
                }
            }
        }

        return correct;
    }

    /**
     * Get correct answer for a recipe (useful for hints/debugging)
     */
    getCorrectAnswer(recipe, category, size) {
        const correctAnswer = {};

        if (category === 'hotDrinks' || category === 'icedDrinks') {
            if (recipe.shots) correctAnswer.shots = recipe.shots[size];
            if (recipe.syrup) correctAnswer.syrup = recipe.syrup[size];
        } else if (category === 'frappuccinos') {
            if (recipe.roast) correctAnswer.roast = recipe.roast[size];
            if (recipe.frappBase) correctAnswer.frappBase = recipe.frappBase[size];
            if (recipe.mochaSauce) correctAnswer.mochaSauce = recipe.mochaSauce[size];
            if (recipe.caramelSyrup) correctAnswer.caramelSyrup = recipe.caramelSyrup[size];
        } else if (category === 'refreshers') {
            if (recipe.inclusion) correctAnswer.inclusion = recipe.inclusion[size];
        }

        return correctAnswer;
    }
}
