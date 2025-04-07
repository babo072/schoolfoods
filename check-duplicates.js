// 중복 학교명 확인 스크립트
const fs = require('fs');
const path = require('path');

// 데이터 폴더 경로
const dataFolderPath = "D:/AI_DEV/Cursor/Project/mcp03/schoolfoods/data";

// 학교명 카운트 및 정보 저장 객체
const schoolCounts = {};

console.log("동일한 이름을 가진 학교 찾기 시작...\n");

try {
  // 데이터 폴더에서 모든 JSON 파일 목록 가져오기
  const files = fs.readdirSync(dataFolderPath).filter(file => file.endsWith('.json'));
  
  if (files.length === 0) {
    console.log("데이터 폴더에 JSON 파일이 없습니다.");
    process.exit(0);
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
    
    // 상위 10개 중복 학교 출력
    const showCount = Math.min(10, duplicateSchools.length);
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
  console.log(`- 중복 학교명 수: ${duplicateSchools.length}개`);
  
} catch (error) {
  console.error("스크립트 실행 중 오류 발생:", error.message);
  process.exit(1);
} 