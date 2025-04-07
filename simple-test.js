#!/usr/bin/env node

// 이 스크립트는 학교급식 서버를 직접 호출하는 간단한 테스트입니다.
// 이 파일을 실행하면 학교 데이터를 로드하고 테스트 케이스를 실행합니다.

const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');

// API 키
const API_KEY = "d23c63242a1b45d88c9f201da1dbabf5";

// 데이터 폴더 경로
const dataFolderPath = "D:/AI_DEV/Cursor/Project/mcp03/schoolfoods/data";

// 모든 학교 정보를 담을 객체
const schoolsData = {};

// 테스트 케이스 정의
const TEST_CASES = [
  { school: "의정부고등학교", date: "오늘", description: "오늘 날짜 테스트" },
  { school: "경기고등학교", date: "내일", description: "내일 날짜 테스트" },
  { school: "서울고등학교", date: "20250408", description: "특정 날짜(YYYYMMDD) 테스트" },
  { school: "존재하지않는학교", date: "오늘", description: "존재하지 않는 학교 테스트" },
  { school: "경민", date: "모레", description: "부분 학교명 + 모레 날짜 테스트" },
  { school: "삼성초등학교", date: "오늘", description: "중복 학교명 테스트 (총 9개)" },
  { school: "금성초등학교", date: "오늘", description: "가장 많이 중복된 학교명 테스트 (총 11개)" }
];

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

// 유사한 학교 이름 찾기
function findSimilarSchools(schoolName, limit = 3) {
  if (Object.keys(schoolsData).length === 0) {
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
    console.log("학교 데이터 로드 중...");
    
    // data 폴더에서 모든 파일 목록 가져오기
    const files = await fs.readdir(dataFolderPath);
    
    // JSON 파일만 필터링
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    // 각 파일에서 학교 데이터 읽기
    let totalSchools = 0;
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataFolderPath, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const schools = JSON.parse(fileContent);
        
        // 각 학교 정보를 schoolsData에 추가 (학교 이름을 키로 사용)
        for (const school of schools) {
          if (school && school.SCHUL_NM && school.ATPT_OFCDC_SC_CODE && school.SD_SCHUL_CODE) {
            schoolsData[school.SCHUL_NM] = {
              ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
              ATPT_OFCDC_SC_NM: school.ATPT_OFCDC_SC_NM || '',
              SD_SCHUL_CODE: school.SD_SCHUL_CODE,
              SCHUL_NM: school.SCHUL_NM
            };
            totalSchools++;
          }
        }
      } catch (error) {
        console.error(`${file} 파일 처리 중 오류 발생:`, error);
      }
    }
    
    console.log(`${jsonFiles.length}개의 파일에서 총 ${totalSchools}개 학교 정보를 로드했습니다.`);
    return true;
  } catch (error) {
    console.error("학교 데이터 로드 중 오류 발생:", error);
    return false;
  }
}

// 급식 정보 가져오는 함수
async function getMealInfo(schoolName, dateStr) {
  try {
    // 날짜 문자열 처리
    const formattedDate = processDateString(dateStr);
    
    // 학교 정보 찾기
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
    
    // API 요청 URL 구성 (API 키 제외)
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${schoolInfo.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${schoolInfo.SD_SCHUL_CODE}&MLSV_YMD=${formattedDate}`;
    
    console.log(`API 요청 URL: ${url}`);
    
    // API 요청
    const response = await fetch(url, { 
      timeout: 10000 // 10초 타임아웃 설정
    });
    
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
      try {
        // <br/> 태그를 줄바꿈으로 변환하고 불필요한 문자 제거
        const menuItems = meal.DDISH_NM
          .replace(/<br\s*\/?>/gi, '\n') // 모든 br 태그 처리
          .replace(/\([0-9\.]+\)/g, '') // 영양성분 숫자 제거
          .replace(/\s{2,}/g, ' ') // 중복 공백 제거
          .trim();
        
        // 식단 종류 (조식/중식/석식)와 칼로리 정보 추가
        const mealType = meal.MMEAL_SC_NM || "급식";
        const calInfo = meal.CAL_INFO || "";
        
        result.push(`[${mealType}] ${calInfo}\n${menuItems}`);
      } catch (error) {
        console.error("급식 정보 형식 처리 중 오류:", error);
      }
    });
    
    if (result.length === 0) {
      return `[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM}의 ${formattedDate} 급식 정보를 처리하는 중 오류가 발생했습니다.`;
    }
    
    // 날짜 형식 표시 변환 (YYYYMMDD -> YYYY-MM-DD)
    const displayDate = `${formattedDate.substring(0, 4)}-${formattedDate.substring(4, 6)}-${formattedDate.substring(6, 8)}`;
    
    // 교육청 이름을 응답 시작 부분에 명확하게 표시
    return `[${schoolInfo.ATPT_OFCDC_SC_NM}] ${schoolInfo.SCHUL_NM} ${displayDate} 급식 정보:\n\n${result.join('\n\n')}`;
  } catch (error) {
    console.error("급식 정보 조회 중 오류 발생:", error);
    return `급식 정보를 가져오는 중 오류가 발생했습니다: ${error.message}`;
  }
}

// 테스트 실행 함수
async function runTests() {
  console.log("SchoolFoods 기능 테스트 시작\n");
  
  // 학교 데이터 로드
  const dataLoaded = await loadSchoolsData();
  if (!dataLoaded) {
    console.error("학교 데이터 로드 실패. 테스트를 중단합니다.");
    return;
  }
  
  console.log("\n========== 테스트 케이스 실행 ==========\n");
  
  // 각 테스트 케이스 실행
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    console.log(`[테스트 ${i+1}] ${testCase.description}`);
    console.log(`학교: ${testCase.school}, 날짜: ${testCase.date}`);
    
    try {
      const result = await getMealInfo(testCase.school, testCase.date);
      console.log("\n결과:");
      console.log(result);
    } catch (error) {
      console.error(`테스트 실패:`, error);
    }
    
    console.log("\n" + "=".repeat(50) + "\n");
    
    // 테스트 간 대기
    if (i < TEST_CASES.length - 1) {
      console.log("다음 테스트로 진행합니다...\n");
    }
  }
  
  console.log("모든 테스트가 완료되었습니다.");
}

// 테스트 실행
runTests().catch(error => {
  console.error("테스트 실행 중 오류 발생:", error);
}); 