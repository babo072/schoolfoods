// 중복 학교명 테스트 스크립트
const fetch = require('node-fetch');

// 테스트할 중복 학교명 목록
const DUPLICATE_SCHOOLS = [
  { name: "삼성초등학교", date: "오늘", description: "9개 중복된 학교" },
  { name: "금성초등학교", date: "오늘", description: "11개 중복된 학교" }
];

// MCP 서버 URL (기본적으로 로컬 서버 사용)
const SERVER_URL = "http://localhost:3000";

// 날짜 문자열 처리 (오늘, 내일 등)
function processDateString(dateStr) {
  if (!dateStr) {
    return formatDate(new Date()); // 값이 없으면 오늘 날짜 반환
  }
  
  const today = new Date();
  
  // 한글 날짜 표현 처리
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
  
  // YYYYMMDD 형식 검증
  if (/^\d{8}$/.test(dateStr)) {
    return dateStr;
  }
  
  // 기타 형식은 오늘 날짜로 처리
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

// REST API를 통해 급식 정보 요청
async function getMealInfo(schoolName, date) {
  try {
    const formattedDate = processDateString(date);
    
    // API 요청
    const response = await fetch(`${SERVER_URL}/api/meals?school=${encodeURIComponent(schoolName)}&date=${formattedDate}`);
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error("급식 정보 조회 중 오류 발생:", error);
    return `오류: ${error.message}`;
  }
}

// JSON-RPC를 통해 급식 정보 요청
async function getMealInfoRPC(schoolName, date) {
  try {
    const requestBody = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "get_school_meal",
      params: {
        school_name: schoolName,
        date: date
      }
    };
    
    // API 요청
    const response = await fetch(`${SERVER_URL}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      return `RPC 오류: ${JSON.stringify(data.error)}`;
    }
    
    if (data.result && data.result.content && data.result.content[0] && data.result.content[0].text) {
      return data.result.content[0].text;
    } else {
      return "응답에 텍스트 내용이 없습니다.";
    }
  } catch (error) {
    console.error("RPC 요청 중 오류 발생:", error);
    return `오류: ${error.message}`;
  }
}

// MCP 프로토콜을 통해 테스트
async function testWithMCP() {
  console.log("MCP 프로토콜을 통한 중복 학교명 테스트\n");
  
  for (const school of DUPLICATE_SCHOOLS) {
    console.log(`학교: ${school.name} (${school.description})`);
    console.log(`날짜: ${school.date}`);
    
    try {
      const result = await getMealInfoRPC(school.name, school.date);
      console.log("\n결과:");
      console.log(result);
    } catch (error) {
      console.error("테스트 실패:", error);
    }
    
    console.log("\n" + "=".repeat(50) + "\n");
  }
}

// REST API를 통해 테스트
async function testWithREST() {
  console.log("REST API를 통한 중복 학교명 테스트\n");
  
  for (const school of DUPLICATE_SCHOOLS) {
    console.log(`학교: ${school.name} (${school.description})`);
    console.log(`날짜: ${school.date}`);
    
    try {
      const result = await getMealInfo(school.name, school.date);
      console.log("\n결과:");
      console.log(result);
    } catch (error) {
      console.error("테스트 실패:", error);
    }
    
    console.log("\n" + "=".repeat(50) + "\n");
  }
}

// 메인 테스트 실행
async function runTests() {
  console.log("SchoolFoods 중복 학교명 테스트 시작\n");
  
  try {
    // MCP 프로토콜로 테스트
    await testWithMCP();
    
    // REST API로 테스트
    await testWithREST();
    
    console.log("모든 테스트가 완료되었습니다.");
  } catch (error) {
    console.error("테스트 실행 중 오류 발생:", error);
  }
}

// 테스트 실행
runTests(); 