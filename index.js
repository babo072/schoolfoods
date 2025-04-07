#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const fs = require("fs/promises");
const path = require("path");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const fetch = require("node-fetch");

// Schema definitions
const SchoolFoodsArgsSchema = z.object({
  school_name: z.string().min(1, "학교 이름을 입력해주세요").describe("학교 이름 (예: 의정부고등학교)"),
  date: z.string().default("오늘").describe("급식 조회 날짜 (YYYYMMDD 형식, '오늘', '내일' 등)")
});

// 상대 경로로 변경 (data 폴더가 현재 디렉토리에 있음)
const dataFolderPath = path.join(__dirname, "data");

// API_KEY는 필요 없음 (주석 처리)
// const API_KEY = ""; // 실제 서비스에서는 환경 변수 등으로 관리해야 함

// 모든 학교 정보를 담을 객체
let schoolsData = {};
// 데이터 로딩 완료 여부
let dataLoaded = false;

// 폴더 존재 여부 확인 함수
async function checkFolder(folderPath) {
  try {
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      throw new Error(`${folderPath}는 디렉토리가 아닙니다.`);
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`오류: ${folderPath} 디렉토리가 존재하지 않습니다.`);
    } else {
      console.error(`폴더 확인 중 오류 발생:`, error);
    }
    return false;
  }
}

// 유사한 학교 이름 찾기
function findSimilarSchools(schoolName, limit = 3) {
  if (!dataLoaded || Object.keys(schoolsData).length === 0) {
    return [];
  }
  
  // 간단한 유사도 검사 (포함 여부)
  return Object.keys(schoolsData)
    .filter(name => 
      name.includes(schoolName) || 
      schoolName.includes(name)
    )
    .slice(0, limit);
}

// data 폴더에서 학교 정보 로드하는 함수
async function loadSchoolsData() {
  try {
    // 데이터 폴더 존재 여부 확인
    const folderExists = await checkFolder(dataFolderPath);
    if (!folderExists) {
      throw new Error(`데이터 폴더를 찾을 수 없습니다: ${dataFolderPath}`);
    }
    
    // data 폴더에서 모든 파일 목록 가져오기
    const files = await fs.readdir(dataFolderPath);
    
    // JSON 파일만 필터링
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      throw new Error("데이터 폴더에 학교 정보 파일(.json)이 없습니다.");
    }
    
    // 각 파일에서 학교 데이터 읽기
    let totalSchools = 0;
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataFolderPath, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const schools = JSON.parse(fileContent);
        
        if (!Array.isArray(schools)) {
          console.error(`경고: ${file} 파일의 데이터가 배열 형식이 아닙니다. 건너뜁니다.`);
          continue;
        }
        
        // 각 학교 정보를 schoolsData에 추가 (학교 이름을 키로 사용)
        schools.forEach(school => {
          if (school && school.SCHUL_NM && school.ATPT_OFCDC_SC_CODE && school.SD_SCHUL_CODE) {
            schoolsData[school.SCHUL_NM] = {
              ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
              ATPT_OFCDC_SC_NM: school.ATPT_OFCDC_SC_NM || '',
              SD_SCHUL_CODE: school.SD_SCHUL_CODE,
              SCHUL_NM: school.SCHUL_NM
            };
            totalSchools++;
          }
        });
      } catch (error) {
        console.error(`${file} 파일 처리 중 오류 발생:`, error);
        // 개별 파일 오류는 전체 로드 과정을 중단하지 않음
      }
    }
    
    if (totalSchools === 0) {
      throw new Error("유효한 학교 정보를 찾을 수 없습니다.");
    }
    
    dataLoaded = true;
    console.error(`${jsonFiles.length}개의 파일에서 총 ${totalSchools}개 학교 정보를 로드했습니다.`);
  } catch (error) {
    console.error("학교 데이터 로드 중 오류 발생:", error);
    process.exit(1);
  }
}

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
  } else if (dateStr === "어제") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  } else if (dateStr === "모레") {
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    return formatDate(dayAfterTomorrow);
  } 
  
  // YYYYMMDD 형식 검증
  if (/^\d{8}$/.test(dateStr)) {
    // 날짜 유효성 검사
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // 0-11 범위
    const day = parseInt(dateStr.substring(6, 8));
    
    const inputDate = new Date(year, month, day);
    
    // 유효한 날짜인지 확인
    if (
      inputDate.getFullYear() === year &&
      inputDate.getMonth() === month &&
      inputDate.getDate() === day
    ) {
      return dateStr;
    } else {
      console.error(`날짜 형식 오류: ${dateStr}는 유효한 날짜가 아닙니다. 오늘 날짜를 사용합니다.`);
      return formatDate(today);
    }
  } 
  
  // 기타 형식은 오늘 날짜로 처리
  console.error(`인식할 수 없는 날짜 형식: ${dateStr}. 오늘 날짜를 사용합니다.`);
  return formatDate(today);
}

// 날짜 객체를 YYYYMMDD 형식으로 변환
function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error("유효하지 않은 Date 객체입니다. 현재 날짜를 사용합니다.");
    date = new Date();
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// 학교 데이터에서 이름으로 모든 학교 정보 찾기
async function findAllSchoolsByName(schoolName) {
  if (!dataLoaded) {
    console.error("학교 데이터가 로드되지 않았습니다.");
    return [];
  }

  // 기존 데이터에서 정확히 일치하는 학교 정보가 있는지 먼저 확인
  const results = [];
  if (schoolsData[schoolName]) {
    results.push(schoolsData[schoolName]);
  }

  // 중복 학교 검색: 모든 JSON 파일에서 동일한 학교명 검색
  try {
    // 데이터 폴더에서 모든 JSON 파일 목록 가져오기
    const files = await fs.readdir(dataFolderPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataFolderPath, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const schools = JSON.parse(fileContent);
        
        if (!Array.isArray(schools)) {
          continue;
        }
        
        // 현재 파일에서 일치하는 학교 찾기
        for (const school of schools) {
          if (school && school.SCHUL_NM === schoolName && school.ATPT_OFCDC_SC_CODE && school.SD_SCHUL_CODE) {
            // 이미 동일한 학교 코드가 추가되었는지 확인
            const isDuplicate = results.some(
              existingSchool => 
                existingSchool.ATPT_OFCDC_SC_CODE === school.ATPT_OFCDC_SC_CODE && 
                existingSchool.SD_SCHUL_CODE === school.SD_SCHUL_CODE
            );
            
            if (!isDuplicate) {
              results.push({
                ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
                ATPT_OFCDC_SC_NM: school.ATPT_OFCDC_SC_NM || '',
                SD_SCHUL_CODE: school.SD_SCHUL_CODE,
                SCHUL_NM: school.SCHUL_NM
              });
            }
          }
        }
      } catch (error) {
        console.error(`${file} 파일 처리 중 오류:`, error.message);
      }
    }
  } catch (error) {
    console.error("학교 검색 중 오류 발생:", error.message);
  }

  if (results.length === 0) {
    console.error(`"${schoolName}"과 일치하는 학교를 찾을 수 없습니다.`);
  } else if (results.length > 1) {
    console.error(`"${schoolName}" 이름을 가진 학교가 ${results.length}개 발견되었습니다.`);
  }

  return results;
}

// 급식 정보 가져오는 함수
async function getMealInfo(schoolName, dateStr) {
  if (!dataLoaded) {
    console.error("학교 데이터가 로드되지 않았습니다.");
    return "학교 데이터가 로드되지 않았습니다. 서버를 재시작해 주세요.";
  }

  try {
    // 날짜 포맷팅
    const formattedDate = processDateString(dateStr);
    
    // 학교 정보 검색
    const schools = await findAllSchoolsByName(schoolName);
    
    if (schools.length === 0) {
      // 유사한 학교 찾기
      const similarSchools = findSimilarSchools(schoolName);
      let message = `"${schoolName}" 학교 정보를 찾을 수 없습니다.`;
      
      if (similarSchools.length > 0) {
        message += `\n\n유사한 학교명: ${similarSchools.join(', ')}`;
      }
      
      return message;
    }

    // 여러 학교에서 급식 정보 가져오기
    const mealResults = [];
    
    for (const schoolInfo of schools) {
      try {
        // NEIS Open API 요청 URL 구성
        // API_KEY 제거 - 필요하지 않음
        const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${schoolInfo.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${schoolInfo.SD_SCHUL_CODE}&MLSV_YMD=${formattedDate}`;
        
        // API 요청 보내기
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // NEIS API 응답 처리 (에러 코드 등)
        if (data.RESULT) {
          if (data.RESULT.CODE === "INFO-200") {
            mealResults.push(`[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM}의 ${formattedDate} 급식 정보가 없습니다.`);
            continue;
          } else {
            mealResults.push(`[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM} API 오류: ${data.RESULT.CODE} - ${data.RESULT.MESSAGE}`);
            continue;
          }
        }
        
        // 응답 데이터에서 급식 정보 추출
        if (!data.mealServiceDietInfo || !data.mealServiceDietInfo[1] || !data.mealServiceDietInfo[1].row) {
          mealResults.push(`[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM}의 ${formattedDate} 급식 정보가 없거나 형식이 올바르지 않습니다.`);
          continue;
        }
        
        // 급식 정보 파싱 및 결과 구성
        const meals = data.mealServiceDietInfo[1].row;
        const schoolResult = [];
        
        meals.forEach(meal => {
          // 메뉴 가공: <br/> 태그 제거, 알레르기 정보(1.2.) 제거
          const menuItems = meal.DDISH_NM
            .replace(/<br\s*\/?>/gi, '\n')  // <br> 태그를 줄바꿈으로
            .replace(/\([0-9\.]+\)/g, '')   // 알레르기 정보 제거
            .replace(/\s{2,}/g, ' ')        // 연속 공백 하나로
            .trim();
          
          const mealType = meal.MMEAL_SC_NM || "급식"; // 급식 유형 (조식, 중식, 석식)
          const calInfo = meal.CAL_INFO || "";         // 칼로리 정보
          
          schoolResult.push(`[${mealType}] ${calInfo}\n${menuItems}`);
        });
        
        // 날짜 형식 표시 변환 (YYYYMMDD -> YYYY-MM-DD)
        const displayDate = `${formattedDate.substring(0, 4)}-${formattedDate.substring(4, 6)}-${formattedDate.substring(6, 8)}`;
        
        mealResults.push(`[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM} ${displayDate} 급식 정보:\n\n${schoolResult.join('\n\n')}`);
      } catch (error) {
        console.error(`${schoolInfo.SCHUL_NM} 급식 정보 조회 중 오류:`, error);
        mealResults.push(`[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM} 급식 정보 조회 실패: ${error.message}`);
      }
    }
    
    // 모든 결과 반환
    return mealResults.join('\n\n--------------------------------------------------\n\n');
    
  } catch (error) {
    console.error("급식 정보 요청 중 오류 발생:", error);
    return `급식 정보를 가져오는 중 오류가 발생했습니다: ${error.message}`;
  }
}

// Server setup
const server = new Server(
  {
    name: "schoolfoods-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_school_meal",
        description: 
          "학교명과 날짜를 입력받아 급식 정보를 제공합니다. " +
          "날짜는 YYYYMMDD 형식이나 '오늘', '내일', '모레'와 같은 상대적인 표현도 사용 가능합니다. " +
          "날짜를 생략하면 오늘 급식 정보를 조회합니다.",
        inputSchema: zodToJsonSchema(SchoolFoodsArgsSchema),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_school_meal": {
        const parsed = SchoolFoodsArgsSchema.safeParse(args);
        if (!parsed.success) {
          const errorDetails = parsed.error.format();
          return {
            content: [{ 
              type: "text", 
              text: `입력 형식 오류: ${JSON.stringify(errorDetails, null, 2)}` 
            }],
            isError: true,
          };
        }
        
        const { school_name, date } = parsed.data;
        const mealInfo = await getMealInfo(school_name, date || "오늘");
        
        return {
          content: [{ type: "text", text: mealInfo }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `알 수 없는 도구: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    console.error("요청 처리 중 오류 발생:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `오류: ${errorMessage}` }],
      isError: true,
    };
  }
});

// 서버 시작
async function runServer() {
  try {
    // 먼저 학교 데이터 로드
    console.error("학교 데이터 로드 중...");
    await loadSchoolsData();
    
    console.error("MCP 서버 초기화 중...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("SchoolFoods MCP 서버가 stdio에서 실행 중입니다");
    
    // 프로세스 종료 처리
    process.on('SIGINT', () => {
      console.error("서버 종료 중...");
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error("서버 종료 중...");
      process.exit(0);
    });
  } catch (error) {
    console.error("서버 실행 중 치명적 오류 발생:", error);
    process.exit(1);
  }
}

// 서버 실행 및 에러 처리
runServer().catch((error) => {
  console.error("서버 시작 중 치명적 오류 발생:", error);
  process.exit(1);
}); 