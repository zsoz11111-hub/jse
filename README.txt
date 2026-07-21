우리 둘 V2 설치 순서

1. Supabase > SQL Editor에서 setup_v2.sql 전체 내용을 실행합니다.

2. config.js를 메모장으로 열고
   SUPABASE_PUBLISHABLE_KEY에
   Supabase > Settings > API Keys > Publishable key 값을 붙여넣습니다.
   sb_secret 키는 절대 넣지 마세요.

3. 기존 GitHub 저장소를 사용한다면
   기존 파일을 모두 삭제한 뒤 V2 파일을 업로드하거나,
   같은 이름의 파일을 덮어씁니다.
   assets 폴더도 반드시 올립니다.

4. GitHub > Settings > Pages
   Deploy from a branch / main / root 로 설정합니다.

5. 두 분이 각각 계정을 만든 뒤
   Supabase > Authentication에서 신규 가입을 비활성화하는 것이 안전합니다.

V2 주요 기능
- 하단 탭 메뉴
- 홈 대시보드
- 커플 D-Day
- 일정 달력
- 할 일 / 장보기 / 메모
- 가계부 월 합계
- 실시간 동기화
- PWA 설치
