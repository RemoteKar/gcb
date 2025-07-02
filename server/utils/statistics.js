const { formatUUID } = require('../util');

function computeStatistics(gameRecords, formattedUUID) {
    let totalGames = 0;
    let winCount = 0;
    let totalDamageDealt = 0;
    let totalDamageTaken = 0;
    let totalKills = 0;
    let totalAliveTime = 0;
    let maxDamageDealt = 0;
    let maxDamageTaken = 0;
    let maxKill = 0;
    let rankAtLeast50 = 0;
    const characterCounts = {};
    const augmentCounts = {};

    const filteredGameRecords = gameRecords.filter(record => {
        if (record.Player && record.Player[formattedUUID]) {
            const playerData = record.Player[formattedUUID];
            const character = playerData.Character ?? 99999;
            return character < 900;
        }
        return false;
    });

    filteredGameRecords.forEach(record => {
      if (record.Player && record.Player[formattedUUID]) {
        const playerData = record.Player[formattedUUID];
        const character = playerData.Character ?? 99999;
  
        //특정 값 이상인 캐릭터는 계산 대상에서 제외
        if (character >= 900) {
            return;
        }
  
        totalGames++;
        if (playerData.Ranking / record.Game.amountOfPlayers <= 0.5) {
          rankAtLeast50++;
        }
        if (playerData.outCuase === "우승") {
          winCount++;
        }
        if (playerData.Damage) {
          if (typeof playerData.Damage.Dealt === "number") {
            if (playerData.Damage.Dealt >= maxDamageDealt) {
              maxDamageDealt = playerData.Damage.Dealt;
            }
            totalDamageDealt += playerData.Damage.Dealt;
          }
          if (typeof playerData.Damage.Taken === "number") {
            if (playerData.Damage.Taken >= maxDamageTaken) {
              maxDamageTaken = playerData.Damage.Taken;
            }
            totalDamageTaken += playerData.Damage.Taken;
          }
        }
        if (typeof playerData.kill === "number") {
          if (playerData.kill >= maxKill) {
            maxKill = playerData.kill;
          }
          totalKills += playerData.kill;
        }
        if (typeof playerData.TimeSurvived === "number") {
          totalAliveTime += playerData.TimeSurvived;
        }
  
        if (character !== undefined) {
          characterCounts[character] = (characterCounts[character] || 0) + 1;
        }
  
        if (playerData.Augment) {
          Object.values(playerData.Augment).forEach(augmentValue => {
            augmentCounts[augmentValue] = (augmentCounts[augmentValue] || 0) + 1;
          });
        }
      }
    });
  
    if (totalGames === 0) {
      return {
        winRate: "0.0",
        winCount: "0",
        avarageRankLeast50: 0.0,
        mostUsedCharacter: "N/A",
        mostUsedAugments: [],
        averageDamageDealt: "0",
        averageDamageTaken: "0",
        averageKillRate: "0.0",
        averageAliveTime: "0.0",
        maxDamageDealt: "0",
        maxDamageTaken: "0",
        maxKill: "0",
        totalGames: "0"
      };
    }
  
    const winRate = (winCount / totalGames) * 100;
    const avarageRankLeast50 = (rankAtLeast50 / totalGames) * 100;
    const averageDamageDealt = totalDamageDealt / totalGames;
    const averageDamageTaken = totalDamageTaken / totalGames;
    const averageKillRate = totalKills / totalGames;
    const averageAliveTime = totalAliveTime / totalGames;
    let mostUsedCharacter = "N/A";
    let maxCharacterCount = 0;
    
    for (const char in characterCounts) {
      if (characterCounts[char] > maxCharacterCount) {
        maxCharacterCount = characterCounts[char];
        mostUsedCharacter = char;
      }
    }
  
    const mostUsedAugments = Object.entries(augmentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  
    return {
      winRate,
      winCount,
      avarageRankLeast50,
      mostUsedCharacter,
      mostUsedAugments,
      averageDamageDealt,
      averageDamageTaken,
      averageKillRate,
      averageAliveTime,
      maxDamageDealt,
      maxDamageTaken,
      maxKill,
      totalGames
    };
  }

  function computeStatistics(gameRecords, formattedUUID) {
    let totalGames = 0;
    let winCount = 0;
    let totalDamageDealt = 0;
    let totalDamageTaken = 0;
    let totalKills = 0;
    let totalAliveTime = 0;
    let maxDamageDealt = 0;
    let maxDamageTaken = 0;
    let maxKill = 0;
    let rankAtLeast50 = 0;
    const characterCounts = {};
    const augmentCounts = {};

    const filteredGameRecords = gameRecords.filter(record => {
        if (record.Player && record.Player[formattedUUID]) {
            const playerData = record.Player[formattedUUID];
            const character = playerData.Character ?? 99999;
            return character < 900;
        }
        return false;
    });

    filteredGameRecords.forEach(record => {
      if (record.Player && record.Player[formattedUUID]) {
        const playerData = record.Player[formattedUUID];
        const character = playerData.Character ?? 99999;
  
        //특정 값 이상인 캐릭터는 계산 대상에서 제외
        if (character >= 900) {
            return;
        }
  
        totalGames++;
        if (playerData.Ranking / record.Game.amountOfPlayers <= 0.5) {
          rankAtLeast50++;
        }
        if (playerData.outCuase === "우승") {
          winCount++;
        }
        if (playerData.Damage) {
          if (typeof playerData.Damage.Dealt === "number") {
            if (playerData.Damage.Dealt >= maxDamageDealt) {
              maxDamageDealt = playerData.Damage.Dealt;
            }
            totalDamageDealt += playerData.Damage.Dealt;
          }
          if (typeof playerData.Damage.Taken === "number") {
            if (playerData.Damage.Taken >= maxDamageTaken) {
              maxDamageTaken = playerData.Damage.Taken;
            }
            totalDamageTaken += playerData.Damage.Taken;
          }
        }
        if (typeof playerData.kill === "number") {
          if (playerData.kill >= maxKill) {
            maxKill = playerData.kill;
          }
          totalKills += playerData.kill;
        }
        if (typeof playerData.TimeSurvived === "number") {
          totalAliveTime += playerData.TimeSurvived;
        }
  
        if (character !== undefined) {
          characterCounts[character] = (characterCounts[character] || 0) + 1;
        }
  
        if (playerData.Augment) {
          Object.values(playerData.Augment).forEach(augmentValue => {
            augmentCounts[augmentValue] = (augmentCounts[augmentValue] || 0) + 1;
          });
        }
      }
    });
  
    if (totalGames === 0) {
      return {
        winRate: "0.0",
        winCount: "0",
        avarageRankLeast50: 0.0,
        mostUsedCharacter: "N/A",
        mostUsedAugments: [],
        averageDamageDealt: "0",
        averageDamageTaken: "0",
        averageKillRate: "0.0",
        averageAliveTime: "0.0",
        maxDamageDealt: "0",
        maxDamageTaken: "0",
        maxKill: "0",
        totalGames: "0"
      };
    }
  
    const winRate = (winCount / totalGames) * 100;
    const avarageRankLeast50 = (rankAtLeast50 / totalGames) * 100;
    const averageDamageDealt = totalDamageDealt / totalGames;
    const averageDamageTaken = totalDamageTaken / totalGames;
    const averageKillRate = totalKills / totalGames;
    const averageAliveTime = totalAliveTime / totalGames;
    let mostUsedCharacter = "N/A";
    let maxCharacterCount = 0;
    
    for (const char in characterCounts) {
      if (characterCounts[char] > maxCharacterCount) {
        maxCharacterCount = characterCounts[char];
        mostUsedCharacter = char;
      }
    }
  
    const mostUsedAugments = Object.entries(augmentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  
    return {
      winRate,
      winCount,
      avarageRankLeast50,
      mostUsedCharacter,
      mostUsedAugments,
      averageDamageDealt,
      averageDamageTaken,
      averageKillRate,
      averageAliveTime,
      maxDamageDealt,
      maxDamageTaken,
      maxKill,
      totalGames
    };
  }

function aggregateAllPlayerStatistics(allParsedGameRecords) {
    const playerStats = {}; // { formattedUUID: { totalGames, winCount, ... } }

    allParsedGameRecords.forEach(record => {
        if (record && typeof record.Game === 'object' && record.Game !== null && record.Game.joinedPlayers && record.Player) {
            const joinedPlayers = record.Game.joinedPlayers.split(',').map(s => s.trim());

            joinedPlayers.forEach(playerUUID => {
                const formattedPlayerUUID = formatUUID(playerUUID); // Ensure consistent format
                if (!playerStats[formattedPlayerUUID]) {
                    playerStats[formattedPlayerUUID] = {
                        totalGames: 0,
                        winCount: 0,
                        totalDamageDealt: 0,
                        totalDamageTaken: 0,
                        totalKills: 0,
                        totalAliveTime: 0,
                        rankAtLeast50: 0,
                        characterCounts: {},
                        augmentCounts: {},
                        uuid: formattedPlayerUUID // Add UUID to the stats object
                    };
                }

                const stats = playerStats[formattedPlayerUUID];
                const playerData = record.Player[formattedPlayerUUID];

                if (playerData) {
                    const character = playerData.Character ?? 99999;

                    if (character < 900) { // Apply character filter here as well
                        stats.totalGames++;
                        if (playerData.Ranking / record.Game.amountOfPlayers <= 0.5) {
                            stats.rankAtLeast50++;
                        }
                        if (playerData.outCuase === "우승") {
                            stats.winCount++;
                        }
                        if (playerData.Damage) {
                            if (typeof playerData.Damage.Dealt === "number") {
                                stats.totalDamageDealt += playerData.Damage.Dealt;
                            }
                            if (typeof playerData.Damage.Taken === "number") {
                                stats.totalDamageTaken += playerData.Damage.Taken;
                            }
                        }
                        if (typeof playerData.kill === "number") {
                            stats.totalKills += playerData.kill;
                        }
                        if (typeof playerData.TimeSurvived === "number") {
                            stats.totalAliveTime += playerData.TimeSurvived;
                        }

                        if (character !== undefined) {
                            stats.characterCounts[character] = (stats.characterCounts[character] || 0) + 1;
                        }

                        if (playerData.Augment) {
                            Object.values(playerData.Augment).forEach(augmentValue => {
                                stats.augmentCounts[augmentValue] = (stats.augmentCounts[augmentValue] || 0) + 1;
                            });
                        }
                    }
                }
            });
        }
    });

    // Finalize statistics for each player
    const finalStats = Object.values(playerStats).map(stats => {
        const totalGames = stats.totalGames;
        if (totalGames === 0) {
            return {
                uuid: stats.uuid,
                winRate: 0.0,
                winCount: 0,
                avarageRankLeast50: 0.0,
                mostUsedCharacter: "N/A",
                mostUsedAugments: [],
                averageDamageDealt: 0,
                averageDamageTaken: 0,
                averageKillRate: 0.0,
                averageAliveTime: 0.0,
                maxDamageDealt: 0,
                maxDamageTaken: 0,
                maxKill: 0,
                totalGames: 0
            };
        }

        const winRate = (stats.winCount / totalGames) * 100;
        const avarageRankLeast50 = (stats.rankAtLeast50 / totalGames) * 100;
        const averageDamageDealt = stats.totalDamageDealt / totalGames;
        const averageDamageTaken = stats.totalDamageTaken / totalGames;
        const averageKillRate = stats.totalKills / totalGames;
        const averageAliveTime = stats.totalAliveTime / totalGames;

        let mostUsedCharacter = "N/A";
        let maxCharacterCount = 0;
        for (const char in stats.characterCounts) {
            if (stats.characterCounts[char] > maxCharacterCount) {
                maxCharacterCount = stats.characterCounts[char];
                mostUsedCharacter = char;
            }
        }

        const mostUsedAugments = Object.entries(stats.augmentCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(entry => entry[0]);

        return {
            uuid: stats.uuid,
            winRate,
            winCount: stats.winCount,
            avarageRankLeast50,
            mostUsedCharacter,
            mostUsedAugments,
            averageDamageDealt,
            averageDamageTaken,
            averageKillRate,
            averageAliveTime,
            maxDamageDealt: stats.maxDamageDealt,
            maxDamageTaken: stats.maxDamageTaken,
            maxKill: stats.maxKill,
            totalGames
        };
    });

    return finalStats;
}

module.exports = { computeStatistics, aggregateAllPlayerStatistics };