# SchoolFoods

SchoolFoods는 전국 학교의 급식 정보를 조회할 수 있는 서비스입니다. Model Context Protocol(MCP)을 지원하며, 다양한 방식으로 학교 급식 정보를 쉽게 조회할 수 있습니다.

## 주요 기능

- 학교명으로 급식 정보 조회
- 다양한 날짜 형식 지원 (오늘, 내일, 모레, YYYYMMDD)
- 동일한 이름의 학교 검색 및 정보 제공
- 유사한 학교명 추천 기능
- Model Context Protocol(MCP) 지원

## 설치 방법

1. 저장소 클론
```bash
git clone https://github.com/사용자명/schoolfoods.git
cd schoolfoods
```

2. 의존성 설치
```bash
npm install
```

3. 데이터 폴더 확인
```
schoolfoods/data 폴더에 학교 정보 JSON 파일이 있어야 합니다.
```

## 사용 방법

### 서버 실행
```bash
node index.js
```

### MCP 프로토콜로 실행
```bash
node index.js stdio
```

### 테스트 실행
```bash
# 기본 기능 테스트
node simple-test.js

# 중복 학교명 테스트
node test-duplication.js
```

## API 사용 예시

### MCP 도구 호출
```javascript
// MCP 클라이언트에서 학교 급식 정보 요청
const response = await client.callTool("get_school_meal", {
  school_name: "서울고등학교",
  date: "오늘"
});
```

## 도구 설명

### get_school_meal
학교명과 날짜를 입력받아 급식 정보를 제공합니다.

**입력 파라미터**:
- `school_name`: 학교 이름 (예: "의정부고등학교")
- `date`: 급식 조회 날짜 (YYYYMMDD 형식, '오늘', '내일', '모레' 등)

**응답**:
- 조식, 중식, 석식 정보
- 칼로리 정보
- 교육청 정보

## 중복 학교명 처리

같은 이름의 학교가 여러 지역에 있는 경우, 모든 학교의 급식 정보를 함께 제공합니다. 예를 들어 "삼성초등학교"는 전국에 9개가 있으며, 이 경우 각 교육청별 모든 학교의 급식 정보를 확인할 수 있습니다.

## 데이터 출처

본 서비스는 [나이스 교육정보 개방 포털](https://open.neis.go.kr)의 급식식단정보를 활용합니다.

## 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요. 