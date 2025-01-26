document.addEventListener('DOMContentLoaded', () => {
  const menuLinks = document.querySelectorAll('.menu-link');
  const sections = document.querySelectorAll('.section');

  menuLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();

      // 모든 링크에서 active 클래스 제거
      menuLinks.forEach(link => link.classList.remove('active'));
      
      // 클릭한 링크에 active 클래스 추가
      link.classList.add('active');

      // 모든 섹션 숨기기
      sections.forEach(section => section.classList.remove('active'));

      // 클릭한 링크의 섹션 표시
      const targetSection = document.getElementById(link.dataset.section);
      targetSection.classList.add('active');
    });
  });
});
