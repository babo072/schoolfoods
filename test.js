// SchoolFoods 통합 테스트 스크립트
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// 테스트 케이스 정의
const TEST_CASES = [
  { school: "의정부고등학교", date: "오늘", description: "오늘 날짜 테스트" },
  { school: "경기고등학교", date: "내일", description: "내일 날짜 테스트" },
  { school: "서울고등학교", date: "20250408", description: "특정 날짜(YYYYMMDD) 테스트" },
  { school: "존재하지않는학교", date: "오늘", description: "존재하지 않는 학교 테스트" },
  { school: "경민", date: "모레", description: "부분 학교명 + 모레 날짜 테스트" },
  { school: "삼성초등학교", date: "오늘", description: "중복 학교명 테스트 (9개)" },
  { school: "금성초등학교", date: "오늘", description: "가장 많이 중복된 학교명 테스트 (11개)" }
];

// 테스트 모드 선택
const TEST_MODE = {
  MCP: 'mcp',    // MCP 프로토콜 테스트
  SIMPLE: 'simple'  // 간단한 API 테스트
};

// 사용할 테스트 모드 (명령행 인수로 받을 수 있음)
let testMode = TEST_MODE.SIMPLE; // 기본값을 SIMPLE로 변경
if (process.argv.length > 2) {
  if (process.argv[2] === 'mcp') {
    testMode = TEST_MODE.MCP;
  } else if (process.argv[2] === 'simple') {
    testMode = TEST_MODE.SIMPLE;
  }
}

// MCP SDK 로드 (mcp 모드에서만 사용)
let Client, StdioClientTransport;
if (testMode === TEST_MODE.MCP) {
  try {
    // SDK 경로 확인을 위한 로깅
    console.log("MCP SDK 로드 중...");
    
    // 다양한 경로 시도
    try {
      const sdk = require('@modelcontextprotocol/sdk');
      Client = sdk.Client;
      StdioClientTransport = sdk.StdioClientTransport;
      console.log("SDK가 루트 경로에서 로드되었습니다.");
    } catch (e) {
      try {
        Client = require('@modelcontextprotocol/sdk/client');
        StdioClientTransport = require('@modelcontextprotocol/sdk/client/stdio');
        console.log("SDK가 개별 경로에서 로드되었습니다.");
      } catch (e2) {
        console.error("MCP SDK 로드 실패:", e2.message);
        console.error("MCP 테스트를 위해서는 SDK가 필요합니다. simple 모드로 전환합니다.");
        testMode = TEST_MODE.SIMPLE;
      }
    }
  } catch (error) {
    console.error("MCP SDK 모듈 로드 중 오류 발생:", error.message);
    console.error("simple 모드로 전환합니다.");
    testMode = TEST_MODE.SIMPLE;
  }
}

// SchoolFoods 서버 시작 (MCP 모드)
async function startMcpServer() {
  if (testMode !== TEST_MODE.MCP) {
    throw new Error("MCP 모드가 아닙니다. SDK가 로드되지 않았을 수 있습니다.");
  }
  
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
async function getMealInfoMcp(client, schoolName, date) {
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

// 중복 학교 확인 테스트
async function checkDuplicateSchools() {
  console.log("\n===== 중복 학교명 확인 테스트 =====\n");
  
  // 데이터 폴더 경로
  const dataFolderPath = path.join(process.cwd(), "data");
  
  // 학교명 카운트 및 정보 저장 객체
  const schoolCounts = {};
  
  try {
    // 데이터 폴더 존재 확인
    if (!fs.existsSync(dataFolderPath)) {
      console.error(`데이터 폴더가 존재하지 않습니다: ${dataFolderPath}`);
      return;
    }
    
    // 데이터 폴더에서 모든 JSON 파일 목록 가져오기
    const files = fs.readdirSync(dataFolderPath).filter(file => file.endsWith('.json'));
    
    if (files.length === 0) {
      console.log("데이터 폴더에 JSON 파일이 없습니다.");
      return;
    }
    
    console.log(`총 ${files.length}개의 JSON 파일을 검사합니다...`);
    
    // 각 파일에서 학교 정보 읽기
    files.forEach(file => {
      try {
        const filePath = path.join(dataFolderPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const schools = JSON.parse(fileContent);
        
        if (!Array.isArray(schools)) {
          console.error(`경고: ${file} 파일의 데이터가 배열 형식이 아닙니다. 건너뜁니다.`);
          return;
        }
        
        // 각 학교 정보 처리
        schools.forEach(school => {
          if (school && school.SCHUL_NM) {
            const schoolName = school.SCHUL_NM;
            
            // 학교명 정보 초기화
            if (!schoolCounts[schoolName]) {
              schoolCounts[schoolName] = [];
            }
            
            // 학교 정보 추가
            schoolCounts[schoolName].push({
              ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE || 'N/A',
              ATPT_OFCDC_SC_NM: school.ATPT_OFCDC_SC_NM || '정보 없음',
              SD_SCHUL_CODE: school.SD_SCHUL_CODE || 'N/A',
              fileName: file
            });
          }
        });
      } catch (error) {
        console.error(`${file} 파일 처리 중 오류 발생:`, error.message);
      }
    });
    
    // 중복 학교 필터링
    const duplicateSchools = Object.entries(schoolCounts)
      .filter(([name, instances]) => instances.length > 1)
      .sort((a, b) => b[1].length - a[1].length); // 중복 수가 많은 순으로 정렬
    
    if (duplicateSchools.length === 0) {
      console.log("\n중복된 이름의 학교가 없습니다.");
    } else {
      console.log(`\n총 ${duplicateSchools.length}개의 중복 학교명이 발견되었습니다.`);
      
      // 상위 3개 중복 학교 출력
      const showCount = Math.min(3, duplicateSchools.length);
      console.log(`\n가장 많이 중복된 상위 ${showCount}개 학교:`);
      
      for (let i = 0; i < showCount; i++) {
        const [schoolName, instances] = duplicateSchools[i];
        console.log(`\n${i+1}. 학교명: ${schoolName} (총 ${instances.length}개 중복)`);
        
        instances.forEach((info, idx) => {
          console.log(`   ${idx+1}. ${info.ATPT_OFCDC_SC_NM} (코드: ${info.SD_SCHUL_CODE}, 파일: ${info.fileName})`);
        });
      }
    }
    
    // 총계 출력
    const totalSchools = Object.values(schoolCounts).flat().length;
    const uniqueSchools = Object.keys(schoolCounts).length;
    
    console.log(`\n데이터 요약:`);
    console.log(`- 전체 학교 수: ${totalSchools}개`);
    console.log(`- 고유한 학교명 수: ${uniqueSchools}개`);
    console.log(`- 중복 학교명 수: ${duplicateSchools.length}개\n`);
    
  } catch (error) {
    console.error("중복 학교명 확인 중 오류 발생:", error.message);
  }
}

// 간단한 API 테스트
async function runSimpleTest() {
  console.log("SchoolFoods 간단한 API 테스트 시작\n");
  
  // 데이터 폴더 경로
  const dataFolderPath = path.join(process.cwd(), "data");
  
  // 모든 학교 정보를 담을 객체
  let schoolsData = {};
  
  // 학교 데이터 로드
  try {
    console.log("학교 데이터 로드 중...");
    
    // 데이터 폴더 존재 확인
    if (!fs.existsSync(dataFolderPath)) {
      throw new Error(`데이터 폴더가 존재하지 않습니다: ${dataFolderPath}`);
    }
    
    const files = fs.readdirSync(dataFolderPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      throw new Error("데이터 폴더에 JSON 파일이 없습니다.");
    }
    
    for (const file of jsonFiles) {
      const filePath = path.join(dataFolderPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const schools = JSON.parse(fileContent);
      
      schools.forEach(school => {
        if (school && school.SCHUL_NM && school.ATPT_OFCDC_SC_CODE && school.SD_SCHUL_CODE) {
          schoolsData[school.SCHUL_NM] = {
            ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
            ATPT_OFCDC_SC_NM: school.ATPT_OFCDC_SC_NM || '',
            SD_SCHUL_CODE: school.SD_SCHUL_CODE,
            SCHUL_NM: school.SCHUL_NM
          };
        }
      });
    }
    
    console.log(`${jsonFiles.length}개의 파일에서 총 ${Object.keys(schoolsData).length}개 학교 정보를 로드했습니다.`);
  } catch (error) {
    console.error("학교 데이터 로드 중 오류 발생:", error);
    return; // 데이터 로드 실패 시 테스트 종료
  }
  
  // 날짜 문자열 처리 (오늘, 내일 등)
  function processDateString(dateStr) {
    if (!dateStr) {
      return formatDate(new Date());
    }
    
    const today = new Date();
    
    if (dateStr === "오늘") {
      return formatDate(today);
    } else if (dateStr === "내일") {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return formatDate(tomorrow);
    } else if (dateStr === "모레") {
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      return formatDate(dayAfterTomorrow);
    }
    
    if (/^\d{8}$/.test(dateStr)) {
      return dateStr;
    }
    
    console.error(`인식할 수 없는 날짜 형식: ${dateStr}. 오늘 날짜를 사용합니다.`);
    return formatDate(today);
  }
  
  // 날짜 객체를 YYYYMMDD 형식으로 변환
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  // 유사한 학교 이름 찾기
  function findSimilarSchools(schoolName, limit = 3) {
    if (Object.keys(schoolsData).length === 0) {
      return [];
    }
    
    return Object.keys(schoolsData)
      .filter(name => 
        name.includes(schoolName) || 
        schoolName.includes(name)
      )
      .slice(0, limit);
  }
  
  // 급식 정보 가져오기
  async function getMealInfo(schoolName, date) {
    try {
      const formattedDate = processDateString(date);
      
      // 학교 정보 찾기 또는 API 직접 호출
      const schoolInfo = schoolsData[schoolName];
      if (!schoolInfo) {
        // 유사한 학교 찾기
        const similarSchools = findSimilarSchools(schoolName);
        let message = `"${schoolName}" 학교 정보를 찾을 수 없습니다.`;
        
        if (similarSchools.length > 0) {
          message += `\n\n유사한 학교명: ${similarSchools.join(', ')}`;
        }
        
        return message;
      }
      
      // API 요청 URL 구성
      const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${schoolInfo.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${schoolInfo.SD_SCHUL_CODE}&MLSV_YMD=${formattedDate}`;
      
      console.log(`API 요청 URL: ${url}`);
      
      // API 요청
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 응답 처리
      if (data.RESULT) {
        if (data.RESULT.CODE === "INFO-200") {
          return `[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM}의 ${formattedDate} 급식 정보가 없습니다.`;
        } else {
          return `API 오류: ${data.RESULT.CODE} - ${data.RESULT.MESSAGE}`;
        }
      }
      
      // 급식 정보 확인
      if (!data.mealServiceDietInfo || !data.mealServiceDietInfo[1] || !data.mealServiceDietInfo[1].row) {
        return `[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM}의 ${formattedDate} 급식 정보가 없거나 형식이 올바르지 않습니다.`;
      }
      
      // 급식 정보 추출 및 반환
      const meals = data.mealServiceDietInfo[1].row;
      const result = [];
      
      meals.forEach(meal => {
        const menuItems = meal.DDISH_NM
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/\([0-9\.]+\)/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        
        const mealType = meal.MMEAL_SC_NM || "급식";
        const calInfo = meal.CAL_INFO || "";
        
        result.push(`[${mealType}] ${calInfo}\n${menuItems}`);
      });
      
      // 날짜 형식 표시 변환 (YYYYMMDD -> YYYY-MM-DD)
      const displayDate = `${formattedDate.substring(0, 4)}-${formattedDate.substring(4, 6)}-${formattedDate.substring(6, 8)}`;
      
      return `[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM} ${displayDate} 급식 정보:\n\n${result.join('\n\n')}`;
    } catch (error) {
      console.error("급식 정보 조회 중 오류 발생:", error);
      return `급식 정보를 가져오는 중 오류가 발생했습니다: ${error.message}`;
    }
  }
  
  console.log("\n========== 테스트 케이스 실행 ==========\n");
  
  // 각 테스트 케이스 실행
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    console.log(`[테스트 ${i+1}] ${testCase.description}`);
    console.log(`학교: ${testCase.school}, 날짜: ${testCase.date}`);
    
    // 급식 정보 조회
    const result = await getMealInfo(testCase.school, testCase.date);
    
    console.log("\n결과:");
    console.log(result);
    
    console.log("\n" + "=".repeat(50) + "\n");
    
    // 테스트 간 대기
    if (i < TEST_CASES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("다음 테스트로 진행합니다...\n");
    }
  }
}

// MCP 프로토콜 테스트
async function runMcpTest() {
  if (testMode !== TEST_MODE.MCP || !Client || !StdioClientTransport) {
    console.error("MCP SDK가 로드되지 않았습니다. simple 모드로 전환합니다.");
    testMode = TEST_MODE.SIMPLE;
    return runSimpleTest();
  }
  
  console.log("SchoolFoods MCP 서버 테스트 시작\n");
  
  let client = null;
  let serverProcess = null;
  
  try {
    // 서버 시작
    const server = await startMcpServer();
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
        const response = await getMealInfoMcp(client, testCase.school, testCase.date);
        
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
  } catch (error) {
    console.error("MCP 테스트 중 오류 발생:", error);
    console.log("simple 모드로 전환합니다.");
    return runSimpleTest();
  } finally {
    // 서버 종료
    if (serverProcess) {
      console.log("테스트 완료. 서버 종료 중...");
      serverProcess.kill();
      console.log("서버가 종료되었습니다.");
    }
  }
}

// 메인 테스트 실행
async function runTests() {
  console.log(`테스트 모드: ${testMode}`);
  
  try {
    // 먼저 중복 학교명 확인
    await checkDuplicateSchools();
    
    // 선택된 모드에 따라 테스트 실행
    if (testMode === TEST_MODE.MCP) {
      await runMcpTest();
    } else {
      await runSimpleTest();
    }
    
    console.log("\n모든 테스트가 완료되었습니다.");
  } catch (error) {
    console.error("테스트 실행 중 오류 발생:", error);
  }
}

// 테스트 실행
runTests().catch(error => {
  console.error("테스트 실행 중 오류 발생:", error);
});