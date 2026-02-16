/**
 * recipes.js - Recipe database for all drink categories
 * Extracted from StarbucksGame.js Phase 1 refactoring
 */

export const RECIPES = {
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
