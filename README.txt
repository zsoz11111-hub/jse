우리 둘 V1 설치 순서

1. Supabase > SQL Editor에서 setup.sql 전체 내용을 실행합니다.

2. config.js를 메모장으로 엽니다.
   SUPABASE_PUBLISHABLE_KEY의 값을
   Supabase > Settings > API Keys > Publishable key로 교체합니다.
   sb_secret로 시작하는 Secret key는 절대 넣지 마세요.

3. GitHub에서 새 Public 저장소를 만들고 이 폴더 안의 파일과 assets 폴더를 모두 업로드합니다.

4. GitHub 저장소 > Settings > Pages
   Source: Deploy from a branch
   Branch: main
   Folder: /(root)
   Save

5. 생성된 GitHub Pages 주소에서 두 분이 각각 '처음 계정 만들기'를 누릅니다.
   Supabase의 이메일 인증 설정에 따라 인증 메일을 확인해야 할 수 있습니다.

6. 두 계정 생성 후 권장 설정
   Supabase > Authentication > Providers > Email에서 신규 가입을 비활성화합니다.
   메뉴 명칭은 대시보드 개편에 따라 약간 다를 수 있습니다.

7. 아이폰
   Safari로 주소 열기 > 공유 > 홈 화면에 추가

8. 갤럭시
   Chrome으로 주소 열기 > 메뉴(⋮) > 앱 설치 또는 홈 화면에 추가

주의
- Project URL과 Publishable key는 브라우저 앱에 사용하는 공개용 값입니다.
- Secret key는 절대로 GitHub나 config.js에 넣지 마세요.
- 현재 RLS 정책은 로그인한 사용자라면 모두 같은 기록을 보게 합니다.
  두 계정 생성 후 신규 가입을 꺼두는 것이 중요합니다.
