// netlify/functions/fetch-minecraft.js
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

exports.handler = async (event, context) => {
  const { nickname } = event.queryStringParameters;

  // Fetch UUID from Mojang API
  const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
  const mojangResponse = await fetch(mojangUrl);
  if (!mojangResponse.ok) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: '유저를 찾을 수 없습니다.' }),
    };
  }
  const mojangData = await mojangResponse.json();
  const uuid = mojangData.id;

  // Read badge data from YAML file
  const badgeFilePath = path.join(__dirname, '..', '..', 'playerData', 'badge', `${uuid}.yaml`);
  try {
    const fileContents = fs.readFileSync(badgeFilePath, 'utf8');
    const badgeData = yaml.load(fileContents); // Parse YAML to JSON
    return {
      statusCode: 200,
      body: JSON.stringify({ id: uuid, badges: badgeData.badge }), // Return UUID and badge data
    };
  } catch (error) {
    console.error('YAML 파일 읽기 오류:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ id: uuid, badges: null }), // Return UUID even if badges are not found
    };
  }
};