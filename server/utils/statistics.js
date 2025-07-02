const { formatUUID } = require('../util');

function computeStatistics(gameRecords, uuid) {
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
  
    const formattedUUID = formatUUID(uuid);
    gameRecords.forEach(record => {
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
  
    const winRate = ((winCount / totalGames) * 100).toFixed(1);
    const avarageRankLeast50 = ((rankAtLeast50 / totalGames) * 100).toFixed(1);
    const averageDamageDealt = (totalDamageDealt / totalGames).toFixed(0);
    const averageDamageTaken = (totalDamageTaken / totalGames).toFixed(0);
    const averageKillRate = (totalKills / totalGames).toFixed(2);
    const averageAliveTime = (totalAliveTime / totalGames).toFixed(1);
    let mostUsedCharacter = "N/A";
    let maxCharacterCount = 0;
    maxDamageDealt = maxDamageDealt.toFixed(0);
    maxDamageTaken = maxDamageTaken.toFixed(0);
  
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

  module.exports = { computeStatistics };