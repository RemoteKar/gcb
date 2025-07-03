const { formatUUID, toNonHyphenatedUUID } = require('../util');
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

function aggregateAllPlayerStatistics(allGameRecordContents) {
    const playerStats = {}; // { formattedUUID: { totalGames, winCount, ... } }

    allGameRecordContents.forEach(recordContent => {
        if (recordContent && typeof recordContent.Game === 'object' && recordContent.Game !== null && recordContent.Game.joinedPlayers && recordContent.Player) {
            const joinedPlayers = recordContent.Game.joinedPlayers.split(',').map(s => s.trim());

            joinedPlayers.forEach(playerUUID => {
                const playerData = recordContent.Player[playerUUID]; // 하이픈 있는 UUID 직접 사용

                const formattedPlayerUUID = formatUUID(playerUUID); // Keep original hyphenated UUID for playerStats key
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
                        uuid: formattedPlayerUUID,
                        maxDamageDealt: 0,
                        maxDamageTaken: 0,
                        maxKill: 0
                    };
                }

                const stats = playerStats[formattedPlayerUUID];

                if (playerData) {
                    const character = playerData.Character ?? 99999;

                    if (character < 900) { // Apply character filter here as well
                        stats.totalGames++;
                        if (playerData.Ranking / recordContent.Game.amountOfPlayers <= 0.5) {
                            stats.rankAtLeast50++;
                        }
                        if (playerData.outCuase === "우승") {
                            stats.winCount++;
                        }
                        if (playerData.Damage) {
                            if (typeof playerData.Damage.Dealt === "number") {
                                stats.totalDamageDealt += playerData.Damage.Dealt;
                                if (playerData.Damage.Dealt > stats.maxDamageDealt) {
                                    stats.maxDamageDealt = playerData.Damage.Dealt;
                                }
                            }
                            if (typeof playerData.Damage.Taken === "number") {
                                stats.totalDamageTaken += playerData.Damage.Taken;
                                if (playerData.Damage.Taken > stats.maxDamageTaken) {
                                    stats.maxDamageTaken = playerData.Damage.Taken;
                                }
                            }
                        }
                        if (typeof playerData.kill === "number") {
                            stats.totalKills += playerData.kill;
                            if (playerData.kill > stats.maxKill) {
                                stats.maxKill = playerData.kill;
                            }
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

        const winRate = totalGames > 0 ? (stats.winCount / totalGames) * 100 : 0;
        const avarageRankLeast50 = totalGames > 0 ? (stats.rankAtLeast50 / totalGames) * 100 : 0;
        const averageDamageDealt = totalGames > 0 ? stats.totalDamageDealt / totalGames : 0;
        const averageDamageTaken = totalGames > 0 ? stats.totalDamageTaken / totalGames : 0;
        const averageKillRate = totalGames > 0 ? stats.totalKills / totalGames : 0;
        const averageAliveTime = totalGames > 0 ? stats.totalAliveTime / totalGames : 0;

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

    console.log(`[DEBUG] 필터링 전 집계된 플레이어 통계 수: ${finalStats.length}`);
    return finalStats; // 필터 제거
}

module.exports = { computeStatistics, aggregateAllPlayerStatistics, computeGlobalCharacterStatistics };

function computeGlobalCharacterStatistics(gameRecords) {
    const characterStats = {}; // { characterId: { picks, wins, totalRank, ... } }

    gameRecords.forEach(record => {
        if (!record.content || !record.content.Player) return;

        const players = Object.values(record.content.Player);
        const totalPlayers = record.content.Game.amountOfPlayers;

        players.forEach(playerData => {
            const characterId = playerData.Character;

            if (characterId === undefined || characterId >= 900) return;

            if (!characterStats[characterId]) {
                characterStats[characterId] = {
                    picks: 0,
                    wins: 0,
                    totalRank: 0,
                    totalKills: 0,
                    totalDamageDealt: 0,
                };
            }

            const stats = characterStats[characterId];
            stats.picks++;
            if (playerData.outCuase === "우승") {
                stats.wins++;
            }
            if (typeof playerData.Ranking === 'number') {
                stats.totalRank += playerData.Ranking;
            }
            if (typeof playerData.kill === 'number') {
                stats.totalKills += playerData.kill;
            }
            if (playerData.Damage && typeof playerData.Damage.Dealt === 'number') {
                stats.totalDamageDealt += playerData.Damage.Dealt;
            }
        });
    });

    // 최종 통계 계산
    const finalStats = Object.entries(characterStats).map(([characterId, stats]) => {
        const winRate = stats.picks > 0 ? (stats.wins / stats.picks) * 100 : 0;
        const averageRank = stats.picks > 0 ? stats.totalRank / stats.picks : 0;
        const averageKills = stats.picks > 0 ? stats.totalKills / stats.picks : 0;
        const averageDamageDealt = stats.picks > 0 ? stats.totalDamageDealt / stats.picks : 0;

        return {
            characterId,
            picks: stats.picks,
            winRate: winRate.toFixed(2),
            averageRank: averageRank.toFixed(2),
            averageKills: averageKills.toFixed(2),
            averageDamageDealt: averageDamageDealt.toFixed(0),
        };
    });

    return finalStats.sort((a, b) => b.picks - a.picks); // 픽률 순으로 정렬
}

function computeGlobalAugmentStatistics(gameRecords) {
    const augmentStats = {}; // { augmentId: { picks: 0 } }

    gameRecords.forEach(record => {
        if (!record.content || !record.content.Player) return;

        const players = Object.values(record.content.Player);

        players.forEach(playerData => {
            if (playerData.Augment) {
                console.log("DEBUG: playerData.Augment (in computeGlobalAugmentStatistics)", playerData.Augment);
                Object.values(playerData.Augment).forEach(augmentValue => {
                    console.log("DEBUG: augmentValue (in computeGlobalAugmentStatistics)", augmentValue);
                    if (augmentValue !== undefined && augmentValue !== null) { // 유효한 증강 값만 처리
                        if (!augmentStats[augmentValue]) {
                            augmentStats[augmentValue] = { picks: 0 };
                        }
                        augmentStats[augmentValue].picks++;
                    }
                });
            }
        });
    });

    // 최종 통계 계산 및 정렬
    const finalStats = Object.entries(augmentStats).map(([augmentId, stats]) => {
        return {
            augmentId,
            picks: stats.picks,
        };
    });

    return finalStats.sort((a, b) => b.picks - a.picks); // 픽률 순으로 정렬
}

module.exports.computeGlobalAugmentStatistics = computeGlobalAugmentStatistics;