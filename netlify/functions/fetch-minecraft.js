const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('Function triggered with event:', event); // 요청 이벤트 로그

  const nickname = event.queryStringParameters.nickname;
  console.log('Nickname:', nickname); // 닉네임 확인

  const url = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
  console.log('Mojang API URL:', url); // API URL 로그

  try {
    const response = await fetch(url);
    console.log('Mojang API Response:', response.status); // 응답 상태 코드 로그

    if (!response.ok) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: '유저를 찾을 수 없습니다.' }),
      };
    }

    const data = await response.json();
    console.log('Mojang API Data:', data); // API 응답 데이터 로그

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error occurred:', error); // 에러 로그
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
