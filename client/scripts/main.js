document.addEventListener("DOMContentLoaded", () => {
  const searchButton = document.getElementById("search-button");
  const nicknameInput = document.getElementById("nickname");
  const resultDisplay = document.getElementById("result");

  const goSearch = () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      return;
    }
    // 검색 후 /user/{닉네임}으로 이동
    window.location.href = `/user/${encodeURIComponent(nickname)}`;
  };
  searchButton.addEventListener("click", goSearch);
  nicknameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") goSearch(); });
});
