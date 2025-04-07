# SchoolFoods MCP 서버

학교명과 날짜를 입력받아 급식 정보를 제공하는 Model Context Protocol(MCP) 서버입니다.

## 기능

- 학교명과 날짜를 입력하면 급식 정보를 반환
- 날짜는 YYYYMMDD 형식 또는 "오늘", "내일"과 같은 상대적 표현 사용 가능
- 전국 모든 초·중·고등학교 지원

## API

### 도구

- **get_school_meal**
  - 입력:
    - `school_name` (string): 학교 이름 (예: "의정부고등학교")
    - `date` (string): 급식 조회 날짜 (YYYYMMDD 형식, "오늘", "내일" 등)
  - 출력:
    - 해당 날짜의 급식 정보 문자열

## 사용 예시

```
의정부고등학교 오늘 급식정보를 알려줘
경민고등학교 20250409 급식정보를 알려줘
경기고등학교 내일 급식정보를 알려줘
```

## Claude Desktop에서 사용하기

`claude_desktop_config.json` 파일에 다음 내용을 추가하세요:

### Docker

```json
{
  "mcpServers": {
    "schoolfoods": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "mcp/schoolfoods"
      ]
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "schoolfoods": {
      "command": "npx",
      "args": [
        "-y",
        "schoolfoods"
      ]
    }
  }
}
```

## 직접 실행하기

```bash
node index.js
```

## 설치

```bash
npm install
```

## 데이터 소스

- 나이스(NEIS) 학교급식 정보 API
- API 키: d23c63242a1b45d88c9f201da1dbabf5

## 라이센스

MIT 라이센스 