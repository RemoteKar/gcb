const fetch = require('node-fetch');

exports.handler = async (event) => {
  const nickname = event.queryStringParameters.nickname; // 닉네임 가져오기
  const url = `https://api.mojang.com/users/profiles/minecraft/${nickname}`; // Mojang API

  try {
    const response = await fetch(url); // Mojang API 호출
    if (!response.ok) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: '유저를 찾을 수 없습니다.' }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data), // Mojang API의 JSON 응답 반환
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '서버 오류' }),
    };
  }
};
