// netlify/functions/fetch-minecraft.js
const fetch = require('node-fetch');
const yaml = require('js-yaml');

// GitHub token (replace with your actual token)
const GITHUB_TOKEN = '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';

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
  console.log('Formatted UUID:', formattedUUID); // Log the formatted UUID

  // Fetch badge data from GitHub API
  const githubUrl = `https://api.github.com/repos/RemoteKar/gcb/contents/playerData/badge/${formattedUUID}.yaml`;
  console.log('Fetching badge data from:', githubUrl); // Log the GitHub API URL

  try {
    const response = await fetch(githubUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`, // Use the GitHub token
        Accept: 'application/vnd.github.v3.raw', // Request raw file content
      },
    });

    if (!response.ok) {
      throw new Error('배지 데이터를 찾을 수 없습니다.');
    }

    const fileContents = await response.text();
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