// 쇼핑몰(아임웹, shop.baramdaero.com)과 이 사이트는 출처가 달라 로그인 여부를 직접 읽을 수 없다.
// 쇼핑몰 공통 코드가 쿠키 bd_login=1 을 켜고 끈다(쇼핑몰 화면을 열 때마다, 도메인 .baramdaero.com). 이 사이트는 읽기만 한다.
// 켜져 있으면 <html class="bd-member"> — 헤더·푸터가 '로그인' 대신 '마이페이지'를 보인다.
// 로그인 뒤 돌아올 화면은 이 스크립트가 아무것도 저장하지 않는다 — '로그인' 링크가 referrerpolicy="unsafe-url" 이라
// 쇼핑몰이 리퍼러로 방금 보던 화면 주소를 알아 간다. 쇼핑몰 쪽 코드와 계약은 docs/shop-login-bridge.md.
// SiteHeader 가 헤더 위에 인라인으로 넣는다(주석 줄은 빼고) — 첫 화면이 그려지기 전에 클래스가 정해져 '로그인'이 잠깐 비치지 않는다.
(function () {
  var root = document.documentElement;
  var sync = function () {
    root.classList.toggle('bd-member', /(?:^|;\s*)bd_login=1(?:;|$)/.test(document.cookie));
  };
  sync();
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', sync);
})();
