module.exports = {
    // Calculate XP needed for a specific level
    xpForLevel: (level) => {
        return 100 * Math.pow(level, 2);
    },
    
    // Calculate level progress metrics
    calculateLevelProgress: (xp, currentLevel) => {
        const currentLevelXP = module.exports.xpForLevel(currentLevel);
        const nextLevelXP = module.exports.xpForLevel(currentLevel + 1);
        const progress = Math.min((xp / currentLevelXP) * 100, 100);
        const xpNeeded = nextLevelXP - xp;
        
        return {
            currentLevelXP,
            nextLevelXP,
            progress,
            xpNeeded
        };
    }
};