시공사례 레코드 작성 규칙 (md 1개 = 사례 1건)

이 폴더의 md는 글이 아니라 데이터 레코드입니다.
프론트매터가 사례 목록·홈 마퀴·블로그 "실제 사례" 블록·상황 페이지에서 재사용됩니다.

■ 개인정보 규칙 (절대)
  - 단지명·동호수·상세주소·고객명 기재 금지. region은 시·구까지만 (예: 서울 강서)
  - 사진은 장비·천장·배관만. 현관문·문패·차량 번호판·사람이 나온 사진 금지
  - building은 유형까지만 (예: 구축 아파트 30평형대)

■ 필수 필드
  region, space, brand, type(설치|세척|복원), units, date

■ 레코드 필드 (선택 — 비우면 해당 블록이 화면에서 조용히 빠짐)
  building, size, model, condition, work{duration, crew, scope[]},
  photos[{file, caption}], note, tags[], related_articles[], related_situations[]
  - work.duration은 실측값만. 실측이 없으면 비워 둘 것 (추정값 금지)
  - related_articles: 블로그 파일명(확장자 제외), related_situations: situation 슬러그

■ 샘플
  "sample: true" 인 파일은 형식 참고용 템플릿 — 사이트에 나오지 않습니다.
  실제 기록으로 바꾼 뒤 그 줄을 지우면 노출됩니다.
