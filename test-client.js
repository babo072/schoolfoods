// 테스트 클라이언트
const { spawn } = require('child_process');
const path = require('path');

// MCP 서버 프로세스 시작
function startMCPServer() {
  const serverProcess = spawn('node', [path.join(__dirname, 'index.js')], {
    stdio: ['pipe', 'pipe', process.stderr]
  });

  return serverProcess;
}

// JSON-RPC 요청 만들기
function createRequest(id, method, params) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
}

// 테스트 실행
async function runTest() {
  // 서버 시작
  const server = startMCPServer();
  
  // 입출력 스트림 설정
  const stdin = server.stdin;
  const stdout = server.stdout;
  
  // 응답 처리
  stdout.on('data', (data) => {
    try {
      const response = JSON.parse(data.toString());
      console.log('서버 응답:');
      console.log(JSON.stringify(response, null, 2));
      
      // 모든 테스트 완료 후 서버 종료
      if (response.id === 3) {
        console.log('테스트 완료, 서버를 종료합니다.');
        server.kill();
        process.exit(0);
      }
    } catch (error) {
      console.error('응답 파싱 오류:', error);
      console.error('데이터:', data.toString());
    }
  });

  // 오류 처리
  stdout.on('error', (error) => {
    console.error('stdout 오류:', error);
  });

  // 서버 프로세스 오류 처리
  server.on('error', (error) => {
    console.error('서버 오류:', error);
  });

  // 서버 프로세스 종료 처리
  server.on('close', (code) => {
    console.log(`서버 프로세스가 종료되었습니다. 종료 코드: ${code}`);
  });

  // 잠시 대기하여 서버가 시작할 시간을 줍니다
  await new Promise(resolve => setTimeout(resolve, 1000));

  // MCP 서버 기능 요청 (첫 번째 통신)
  console.log('MCP 서버 기능 요청 중...');
  const capabilitiesRequest = createRequest(1, 'mcp.capabilities', {});
  stdin.write(JSON.stringify(capabilitiesRequest) + '\n');

  // 잠시 대기
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 도구 목록 요청
  console.log('\n도구 목록 요청 중...');
  const listToolsRequest = createRequest(2, 'mcp.tools.list', {});
  stdin.write(JSON.stringify(listToolsRequest) + '\n');

  // 잠시 대기
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 테스트 케이스 1: 의정부고등학교 오늘 급식
  console.log('\n테스트 케이스 1: 의정부고등학교 오늘 급식');
  const testCase1 = createRequest(3, 'mcp.tools.call', {
    name: 'get_school_meal',
    arguments: {
      school_name: '의정부고등학교',
      date: '오늘'
    }
  });
  stdin.write(JSON.stringify(testCase1) + '\n');

  // 3초 후에 자동으로 종료 (응답이 없으면)
  setTimeout(() => {
    console.log('테스트 시간 초과, 서버를 종료합니다.');
    server.kill();
    process.exit(1);
  }, 3000);
}

// 테스트 실행
runTest().catch(error => {
  console.error('테스트 실행 중 오류:', error);
  process.exit(1);
}); 