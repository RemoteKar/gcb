// netlify/functions/fetch-minecraft.js
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Helper function to add hyphens to UUID
function formatUUID(uuid) {
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

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

  // Format UUID with hyphens
  const formattedUUID = formatUUID(uuid);

  // Construct the file path
  const badgeFilePath = path.join(__dirname, '..', '..', 'playerData', 'badge', `${formattedUUID}.yaml`);
  console.log('Looking for badge file at:', badgeFilePath); // Log the file path

  // Read badge data from YAML file
  try {
    const fileContents = fs.readFileSync(badgeFilePath, 'utf8');
    const badgeData = yaml.load(fileContents); // Parse YAML to JSON
    return {
      statusCode: 200,
      body: JSON.stringify({ id: uuid, badges: badgeData.badge }), // Return UUID and badge data
    };
  } catch (error) {
    console.error('YAML 파일 읽기 오류:', error); // Log the error
    return {
      statusCode: 200,
      body: JSON.stringify({ id: uuid, badges: null }), // Return UUID even if badges are not found
    };
  }
};