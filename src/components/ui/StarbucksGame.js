/**
 * StarbucksGame.js - Standalone React Component
 * Optimized for integration with the projects page
 * Can be used as ES6 module or loaded dynamically
 */

// Check if React is available
const React = window.React || (typeof require !== 'undefined' ? require('react') : null);
const { useState, useEffect, useMemo, useCallback } = React || {};

// Game Constants
const BADGE_TYPES = [
  { id: "first_star", name: "First Star", icon: "⭐", description: "Earned your first star!" },
  { id: "hot_expert", name: "Hot Drink Expert", icon: "☕", description: "Mastered hot drink recipes" },
  { id: "ice_master", name: "Ice Master", icon: "🧊", description: "Conquered all iced drink recipes" },
  { id: "frapp_wizard", name: "Frappuccino Wizard", icon: "🥤", description: "Perfected all Frappuccino recipes" },
  { id: "streak_5", name: "5-Streak", icon: "🔥", description: "5 correct answers in a row!" },
  { id: "level_5", name: "Level 5 Barista", icon: "🌟", description: "Reached level 5!" }
];

const SIZE_INFO = {
  S: { name: "Short", oz: "8oz", description: "Tiny but mighty!" },
  T: { name: "Tall", oz: "12oz", description: "Not so tall after all!" },
  G: { name: "Grande", oz: "16oz", description: "Italian for 'big'" },
  V: { name: "Venti", oz: "20/24oz", description: "Italian for '20'" },
  TR: { name: "Trenta", oz: "30oz", description: "The giant cup!" }
};

const BARISTA_TIPS = [
  "Welcome to your barista adventure! Remember to have fun while learning!",
  "Did you know? 'Tall' is actually the smallest size for iced drinks!",
  "Grande means 'large' in Italian, but it's actually the middle size!",
  "Most hot drinks get 1 shot for Tall, 2 shots for Grande and Venti",
  "The syrup pumps increase by 1 for each size up you go",
  "Iced Venti drinks get more syrup (6 pumps) because the cup is bigger",
  "For refreshers, only Trenta size gets 2 scoops of fruit inclusions",
  "Frappuccinos always get whipped cream unless requested without",
  "Remember to shake refreshers 10 times for the perfect mix!",
  "You're becoming a star barista! Keep practicing those recipes!"
];

// Recipe Database
const RECIPES = {
  hotDrinks: {
    "Caffè Latte": {
      icon: "☕",
      color: "#E6C19C",
      shots: { S: 1, T: 1, G: 2, V: 2 },
      syrup: { S: 2, T: 3, G: 4, V: 5 },
      funFact: "A latte is like a warm milk hug with coffee!",
      description: "Espresso topped with steamed milk and a light layer of foam"
    },
    "Cappuccino": {
      icon: "☁️",
      color: "#D8C4B6",
      shots: { S: 1, T: 1, G: 2, V: 2 },
      syrup: { S: 2, T: 3, G: 4, V: 5 },
      funFact: "The foam on top is like a fluffy cloud for your coffee!",
      description: "Espresso with steamed milk and lots of foam"
    },
    "Flat White": {
      icon: "🥛",
      color: "#F5F0DC",
      shots: { S: 2, T: 2, G: 3, V: 3 },
      syrup: { S: 2, T: 3, G: 4, V: 5 },
      funFact: "This drink uses special ristretto shots that are extra strong!",
      description: "Ristretto espresso with steamed whole milk and a thin layer of microfoam"
    },
    "Caffè Americano": {
      icon: "💧",
      color: "#8B5A2B",
      shots: { S: 1, T: 2, G: 3, V: 4 },
      syrup: { S: 2, T: 3, G: 4, V: 5 },
      funFact: "It's like a coffee swimming pool for espresso shots!",
      description: "Espresso shots topped with hot water"
    }
  },
  icedDrinks: {
    "Iced Caffè Latte": {
      icon: "🧊",
      color: "#BEB9B5",
      shots: { T: 1, G: 2, V: 3 },
      syrup: { T: 3, G: 4, V: 6 },
      funFact: "The perfect coffee treat on a hot summer day!",
      description: "Espresso, cold milk and ice cubes"
    },
    "Iced Flat White": {
      icon: "❄️",
      color: "#E8E8E6",
      shots: { T: 2, G: 3, V: 4 },
      syrup: { T: 3, G: 4, V: 6 },
      funFact: "The special ristretto shots give it an extra kick!",
      description: "Ristretto espresso shots with cold whole milk over ice"
    },
    "Iced Caffè Americano": {
      icon: "🧊",
      color: "#6F4E37",
      shots: { T: 2, G: 3, V: 4 },
      syrup: { T: 3, G: 4, V: 6 },
      funFact: "Some people call it 'coffee on the rocks'!",
      description: "Espresso shots topped with water and ice"
    }
  },
  frappuccinos: {
    "Coffee Frappuccino": {
      icon: "🥤",
      color: "#C4A484",
      roast: { T: 2, G: 3, V: 4 },
      frappBase: { T: 2, G: 3, V: 4 },
      funFact: "It's like a coffee milkshake - but way cooler!",
      description: "Coffee blended with milk, ice, and frappuccino base"
    },
    "Caramel Frappuccino": {
      icon: "🍮",
      color: "#C68E17",
      roast: { T: 2, G: 3, V: 4 },
      caramelSyrup: { T: 2, G: 3, V: 4 },
      frappBase: { T: 2, G: 3, V: 4 },
      funFact: "This drink wears a caramel crown on top!",
      description: "Coffee with caramel syrup blended with milk, ice, topped with whipped cream and caramel drizzle"
    },
    "Mocha Frappuccino": {
      icon: "🍫",
      color: "#6B4423",
      roast: { T: 2, G: 3, V: 4 },
      mochaSauce: { T: 2, G: 3, V: 4 },
      frappBase: { T: 2, G: 3, V: 4 },
      funFact: "It's like chocolate and coffee had a frozen party!",
      description: "Coffee with mocha sauce blended with milk and ice, topped with whipped cream"
    }
  },
  refreshers: {
    "Mango Dragonfruit": {
      icon: "🐉",
      color: "#FF77FF",
      inclusion: { T: 1, G: 1, V: 1, TR: 2 },
      funFact: "The pink color comes from real dragonfruit pieces!",
      description: "Tropical-inspired with sweet mango and dragonfruit flavors, with real fruit pieces"
    },
    "Strawberry Açaí": {
      icon: "🍓",
      color: "#FF2E2E",
      inclusion: { T: 1, G: 1, V: 1, TR: 2 },
      funFact: "This refreshing drink has real strawberry pieces inside!",
      description: "Sweet strawberry flavors with real strawberry pieces"
    }
  }
};

// Sound Effects (Mock implementations)
const playSound = (type) => {
  // In a real implementation, you'd play actual sound files
  console.log(`🎵 Playing ${type} sound effect`);
  
  // Optional: Use Web Audio API for actual sounds
  if (typeof AudioContext !== 'undefined') {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different sounds
      const frequencies = {
        correct: 523.25, // C5
        wrong: 220.00,   // A3
        star: 659.25,    // E5
        levelUp: 783.99  // G5
      };
      
      oscillator.frequency.setValueAtTime(frequencies[type] || 440, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log(`Sound effect: ${type}`);
    }
  }
};

// Main Game Component
function StarbucksGame({ 
  onClose, 
  onGameEvent, 
  embedded = false,
  customStyles = {} 
}) {
  // Game State Management
  const [gameState, setGameState] = useState({
    screen: 'welcome',
    playerName: '',
    playerLevel: 1,
    stars: 0,
    streak: 0,
    maxStreak: 0,
    badges: []
  });
  
  const [challengeState, setChallengeState] = useState({
    activeCategory: 'all',
    currentChallenge: null,
    answer: {},
    showResult: false,
    isCorrect: false,
    animation: ''
  });
  
  const [uiState, setUiState] = useState({
    showTip: false,
    selectedDrink: null,
    completedDrinks: {}
  });

  // Game Logic Functions
  const updateGameState = useCallback((updates) => {
    setGameState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const updateChallengeState = useCallback((updates) => {
    setChallengeState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const updateUIState = useCallback((updates) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);

  const getAvailableSizes = useCallback((category) => {
    switch(category) {
      case 'hotDrinks': return ['S', 'T', 'G', 'V'];
      case 'refreshers': return ['T', 'G', 'V', 'TR'];
      default: return ['T', 'G', 'V'];
    }
  }, []);

  const generateChallenge = useCallback(() => {
    const categories = challengeState.activeCategory === 'all' 
      ? Object.keys(RECIPES) 
      : [challengeState.activeCategory];
    
    const randomCat = categories[Math.floor(Math.random() * categories.length)];
    const drinks = Object.keys(RECIPES[randomCat]);
    const randomDrink = drinks[Math.floor(Math.random() * drinks.length)];
    
    const sizes = getAvailableSizes(randomCat);
    const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
    
    updateChallengeState({
      currentChallenge: {
        category: randomCat,
        drink: randomDrink,
        size: randomSize
      },
      answer: {},
      showResult: false,
      animation: ''
    });
  }, [challengeState.activeCategory, getAvailableSizes, updateChallengeState]);

  const checkAnswer = useCallback(() => {
    const { currentChallenge, answer } = challengeState;
    if (!currentChallenge) return;
    
    const drinkData = RECIPES[currentChallenge.category][currentChallenge.drink];
    let correct = true;
    
    // Check all relevant fields
    const fieldsToCheck = ['shots', 'syrup', 'roast', 'frappBase', 'mochaSauce', 'caramelSyrup', 'inclusion'];
    
    fieldsToCheck.forEach(field => {
      if (drinkData[field] && parseInt(answer[field]) !== drinkData[field][currentChallenge.size]) {
        correct = false;
      }
    });
    
    updateChallengeState({ 
      isCorrect: correct, 
      showResult: true,
      animation: correct ? 'correct' : 'wrong'
    });
    
    if (correct) {
      playSound('correct');
      
      const newStars = gameState.stars + 1;
      const newStreak = gameState.streak + 1;
      const newMaxStreak = Math.max(newStreak, gameState.maxStreak);
      const newLevel = Math.floor(newStars / 5) + 1;
      
      let newBadges = [...gameState.badges];
      
      // Award badges
      if (newStreak === 5 && !newBadges.includes("streak_5")) {
        newBadges.push("streak_5");
      }
      
      if (newLevel === 5 && !newBadges.includes("level_5")) {
        newBadges.push("level_5");
      }
      
      // Check for level up
      if (newLevel > gameState.playerLevel) {
        playSound('levelUp');
      } else {
        playSound('star');
      }
      
      updateGameState({
        stars: newStars,
        streak: newStreak,
        maxStreak: newMaxStreak,
        playerLevel: newLevel,
        badges: newBadges
      });
      
      // Update completed drinks
      const drinkKey = `${currentChallenge.category}-${currentChallenge.drink}`;
      updateUIState({
        completedDrinks: {
          ...uiState.completedDrinks,
          [drinkKey]: (uiState.completedDrinks[drinkKey] || 0) + 1
        }
      });
      
      // Trigger game event for parent component
      if (onGameEvent) {
        onGameEvent('correct_answer', {
          drink: currentChallenge.drink,
          category: currentChallenge.category,
          newStats: { level: newLevel, stars: newStars, streak: newStreak }
        });
      }
      
    } else {
      playSound('wrong');
      updateGameState({ streak: 0 });
      
      if (onGameEvent) {
        onGameEvent('wrong_answer', {
          drink: currentChallenge.drink,
          category: currentChallenge.category
        });
      }
    }
  }, [challengeState, gameState, uiState.completedDrinks, updateChallengeState, updateGameState, updateUIState, onGameEvent]);

  // Get current tip based on level
  const currentTip = useMemo(() => {
    return BARISTA_TIPS[Math.min(gameState.playerLevel - 1, BARISTA_TIPS.length - 1)];
  }, [gameState.playerLevel]);

  // Barista character state
  const baristaEmoji = challengeState.isCorrect ? "😄" : 
                      (challengeState.showResult && !challengeState.isCorrect) ? "😢" : "😊";

  // Format category name
  const formatCategory = useCallback((cat) => {
    const names = {
      hotDrinks: 'Hot Drinks',
      icedDrinks: 'Iced Drinks',
      frappuccinos: 'Frappuccinos',
      refreshers: 'Refreshers'
    };
    return names[cat] || cat;
  }, []);

  // Navigation functions
  const goToScreen = useCallback((screen) => {
    updateGameState({ screen });
  }, [updateGameState]);

  const goToMainMenu = useCallback(() => {
    updateGameState({ screen: 'main' });
    updateChallengeState({ activeCategory: 'all' });
    updateUIState({ selectedDrink: null });
  }, [updateGameState, updateChallengeState, updateUIState]);

  // Container styles
  const containerStyle = {
    width: '100%',
    height: embedded ? '100%' : '600px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
    ...customStyles
  };

  // Component JSX based on screen
  const renderScreen = () => {
    switch (gameState.screen) {
      case 'welcome':
        return (
          <div style={{
            height: '100%',
            padding: '1.5rem',
            maxWidth: '36rem',
            margin: '0 auto',
            background: 'linear-gradient(to bottom, #065f46, #047857)',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                ☕ Starbucks Barista Adventure ☕
              </h1>
              <p style={{ fontSize: '1.125rem' }}>
                Become a master barista through fun challenges!
              </p>
            </div>
            
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              backdropFilter: 'blur(4px)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '4rem' }}>👨‍🍳</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                  Welcome, Future Barista!
                </h2>
                <p style={{ marginTop: '0.25rem' }}>What's your barista name?</p>
              </div>
              
              <input
                type="text"
                value={gameState.playerName}
                onChange={(e) => updateGameState({ playerName: e.target.value })}
                placeholder="Enter your name"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.3)',
                  border: '2px solid rgba(255, 255, 255, 0.5)',
                  color: 'white',
                  textAlign: 'center',
                  marginBottom: '1rem',
                  fontSize: '1rem'
                }}
              />
              
              <button
                onClick={() => updateGameState({ screen: 'main' })}
                disabled={!gameState.playerName.trim()}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  transition: 'all 0.3s',
                  border: 'none',
                  cursor: gameState.playerName.trim() ? 'pointer' : 'not-allowed',
                  background: gameState.playerName.trim() ? '#10b981' : '#6b7280',
                  color: 'white'
                }}
              >
                Start My Adventure!
              </button>
            </div>
            
            <div style={{ textAlign: 'center', fontSize: '0.875rem', opacity: 0.7 }}>
              <p>Learn recipes • Earn stars • Collect badges</p>
              <p>Become the ultimate Starbucks barista!</p>
            </div>
          </div>
        );

      case 'main':
        return (
          <div style={{
            height: '100%',
            padding: '1.5rem',
            maxWidth: '36rem',
            margin: '0 auto',
            background: 'linear-gradient(to bottom, #047857, #10b981)',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            color: 'white',
            overflow: 'auto'
          }}>
            {/* Player info header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Barista {gameState.playerName}
                </h1>
                <div style={{ fontSize: '0.875rem' }}>
                  Level {gameState.playerLevel} • {gameState.stars} ⭐
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem' }}>{gameState.badges.length} badges</span>
                <button 
                  onClick={() => goToScreen('badges')}
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f59e0b',
                    borderRadius: '50%',
                    fontSize: '1.125rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🏆
                </button>
              </div>
            </div>
            
            {/* Barista tip */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '1rem',
              borderRadius: '0.75rem',
              backdropFilter: 'blur(4px)',
              marginBottom: '1rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '4rem' }}>{baristaEmoji}</div>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>Barista Tip:</h2>
                  <p style={{ fontSize: '0.875rem' }}>{currentTip}</p>
                </div>
              </div>
              
              {gameState.streak >= 3 && (
                <div style={{
                  position: 'absolute',
                  bottom: '-0.75rem',
                  right: '-0.75rem',
                  background: '#ea580c',
                  width: '6rem',
                  height: '6rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(12deg)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem' }}>Streak</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                      {gameState.streak} 🔥
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Game options */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              <button 
                onClick={() => {
                  updateChallengeState({ activeCategory: 'all' });
                  updateGameState({ screen: 'challenge' });
                  generateChallenge();
                }}
                style={{
                  padding: '1rem',
                  background: '#7c3aed',
                  borderRadius: '0.75rem',
                  transition: 'colors 0.3s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎯</span>
                <span style={{ fontWeight: 'bold' }}>Random Challenge</span>
                <span style={{ fontSize: '0.75rem' }}>Test your skills!</span>
              </button>
              
              <button 
                onClick={() => goToScreen('categories')}
                style={{
                  padding: '1rem',
                  background: '#2563eb',
                  borderRadius: '0.75rem',
                  transition: 'colors 0.3s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📚</span>
                <span style={{ fontWeight: 'bold' }}>Recipe Types</span>
                <span style={{ fontSize: '0.75rem' }}>Choose a category</span>
              </button>
              
              <button 
                onClick={() => goToScreen('recipes')}
                style={{
                  padding: '1rem',
                  background: '#d97706',
                  borderRadius: '0.75rem',
                  transition: 'colors 0.3s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📖</span>
                <span style={{ fontWeight: 'bold' }}>Recipe Book</span>
                <span style={{ fontSize: '0.75rem' }}>Study the recipes</span>
              </button>
              
              <button 
                onClick={() => updateUIState({ showTip: !uiState.showTip })}
                style={{
                  padding: '1rem',
                  background: '#0891b2',
                  borderRadius: '0.75rem',
                  transition: 'colors 0.3s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>💡</span>
                <span style={{ fontWeight: 'bold' }}>Barista Tips</span>
                <span style={{ fontSize: '0.75rem' }}>Helpful advice</span>
              </button>
            </div>
            
            {/* Status info */}
            <div style={{ textAlign: 'center', fontSize: '0.875rem' }}>
              <p style={{ opacity: 0.7 }}>
                {gameState.streak > 0 
                  ? `Current streak: ${gameState.streak} 🔥` 
                  : "Start a streak by getting answers right in a row!"
                }
              </p>
              <p style={{ opacity: 0.7, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {gameState.playerLevel < 10 
                  ? `${gameState.playerLevel * 5 - gameState.stars} more stars to level up!` 
                  : "You've reached max level!"
                }
              </p>
            </div>
            
            {/* Close button for embedded mode */}
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            )}
          </div>
        );

      // Additional screens would be implemented here (categories, challenge, recipes, badges)
      default:
        return (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(to bottom, #047857, #10b981)',
            color: 'white',
            textAlign: 'center'
          }}>
            <div>
              <h2>Coming Soon!</h2>
              <p>This feature is being developed.</p>
              <button
                onClick={goToMainMenu}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                Back to Main Menu
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={containerStyle}>
      {renderScreen()}
    </div>
  );
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StarbucksGame;
} else if (typeof define === 'function' && define.amd) {
  define(() => StarbucksGame);
} else {
  window.StarbucksGame = StarbucksGame;
}

// Default export for ES6 modules
export default StarbucksGame;