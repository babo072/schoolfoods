// SchoolFoods MCP 서버 테스트 스크립트
const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio');

// 테스트 케이스 정의
const TEST_CASES = [
  { school: "의정부고등학교", date: "오늘", description: "오늘 날짜 테스트" },
  { school: "경기고등학교", date: "내일", description: "내일 날짜 테스트" },
  { school: "서울고등학교", date: "20250408", description: "특정 날짜(YYYYMMDD) 테스트" },
  { school: "존재하지않는학교", date: "오늘", description: "존재하지 않는 학교 테스트" },
  { school: "경민", date: "모레", description: "부분 학교명 + 모레 날짜 테스트" }
];

// SchoolFoods 서버 시작
async function startServer() {
  console.log("SchoolFoods 서버 시작 중...");
  
  const serverProcess = spawn('node', ['index.js', 'stdio'], { 
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'inherit']
  });
  
  const transport = new StdioClientTransport(serverProcess.stdin, serverProcess.stdout);
  
  const client = new Client();
  await client.connect(transport);
  
  // 초기화 요청 보내기
  await client.initialize();
  
  console.log("서버가 준비되었습니다.");
  
  return { client, serverProcess };
}

// MCP 프로토콜로 급식 정보 요청
async function getSchoolMeal(client, schoolName, date) {
  try {
    // 도구 목록 조회
    const toolsResponse = await client.listTools();
    
    // SchoolFoods 도구 찾기
    const schoolFoodsTool = toolsResponse.tools.find(tool => tool.name === "get_school_meal");
    
    if (!schoolFoodsTool) {
      throw new Error("get_school_meal 도구를 찾을 수 없습니다.");
    }
    
    // 도구 호출
    const response = await client.callTool(schoolFoodsTool.name, {
      school_name: schoolName,
      date: date
    });
    
    return response;
  } catch (error) {
    console.error("급식 정보 요청 중 오류 발생:", error);
    throw error;
  }
}

// 테스트 실행 함수
async function runTests() {
  console.log("SchoolFoods MCP 서버 테스트 시작\n");
  
  let client = null;
  let serverProcess = null;
  
  try {
    // 서버 시작
    const server = await startServer();
    client = server.client;
    serverProcess = server.serverProcess;
    
    console.log("\n========== 테스트 케이스 실행 ==========\n");
    
    // 각 테스트 케이스 실행
    for (let i = 0; i < TEST_CASES.length; i++) {
      const testCase = TEST_CASES[i];
      console.log(`[테스트 ${i+1}] ${testCase.description}`);
      console.log(`학교: ${testCase.school}, 날짜: ${testCase.date}`);
      
      try {
        // MCP 요청 전송
        const response = await getSchoolMeal(client, testCase.school, testCase.date);
        
        console.log("\n결과:");
        
        // 텍스트 콘텐츠 추출
        if (response.content && response.content.length > 0) {
          response.content.forEach(item => {
            if (item.type === 'text') {
              console.log(item.text);
            }
          });
        } else {
          console.log("응답에 콘텐츠가 없습니다.");
        }
      } catch (error) {
        console.error(`테스트 실패:`, error);
      }
      
      console.log("\n" + "=".repeat(50) + "\n");
      
      // 테스트 간 대기
      if (i < TEST_CASES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("다음 테스트로 진행합니다...\n");
      }
    }
  } finally {
    // 서버 종료
    if (serverProcess) {
      console.log("테스트 완료. 서버 종료 중...");
      serverProcess.kill();
      console.log("서버가 종료되었습니다.");
    }
  }
}

// 테스트 실행
runTests().catch(error => {
  console.error("테스트 실행 중 오류 발생:", error);
}); 