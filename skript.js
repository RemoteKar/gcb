document.addEventListener('DOMContentLoaded', () => {
  const menuLinks = document.querySelectorAll('.menu-link'); // 메뉴 링크
  const sections = document.querySelectorAll('.section'); // 모든 섹션

  // 각 메뉴 클릭 시 이벤트 추가
  menuLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault(); // 기본 동작 방지

      // 모든 링크의 active 클래스 제거
      menuLinks.forEach(link => link.classList.remove('active'));

      // 클릭한 링크에 active 클래스 추가
      link.classList.add('active');

      // 모든 섹션 숨기기
      sections.forEach(section => section.classList.remove('active'));

      // 클릭한 메뉴와 연결된 섹션 표시
      const targetSection = document.getElementById(link.dataset.section);
      targetSection.classList.add('active');
    });
  });
});
