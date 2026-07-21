우리 둘 V4 설치 순서

1. setup_v4.sql 전체를 Supabase SQL Editor에서 실행합니다.

2. config.js에서 SUPABASE_PUBLISHABLE_KEY만 실제 값으로 바꿉니다.
   Secret key는 절대 넣지 마세요.

3. GitHub의 기존 V3 파일을 V4 파일로 교체합니다.
   assets 폴더도 함께 올립니다.

4. 처음 실행하면 진성 또는 성은을 선택합니다.
   선택값은 해당 휴대폰에 저장되어 다음부터 바로 앱이 열립니다.

중요한 보안 안내
- 이 버전은 Supabase Auth 로그인을 사용하지 않습니다.
- 따라서 GitHub Pages 주소와 프로젝트 연결 정보를 아는 사람은 데이터 접근을 시도할 수 있습니다.
- 개인적인 장보기·여행 메모 용도로만 사용하고, 주민번호·계좌 비밀번호·민감한 개인정보는 저장하지 마세요.
