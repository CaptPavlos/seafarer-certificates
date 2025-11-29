// Script to compare OCR results with existing certificate data and suggest updates
const fs = require('fs');
const path = require('path');

// Load OCR results
const ocrResults = require('../src/data/ocr-output/extraction-results.json');

// Load current certificates
const certsPath = path.join(__dirname, '../src/data/certificates.js');
let certsContent = fs.readFileSync(certsPath, 'utf8');

// Manual corrections based on OCR review
const manualUpdates = {
  // Cayman Islands Master Endorsement - OCR found issuance date
  "Cayman Island - Master Endorsement.pdf": {
    issuanceDate: "2023-05-23" // From OCR
  },
  
  // FPOS - OCR found dates in text
  "FILIPPAKIS PAVLOS ANGELOS_FPOS.pdf": {
    certNumber: "FPOS1 8897",
    issuanceDate: "2023-02-24",
    expiryDate: "2026-02-24"
  },
  
  // Trauma - OCR found dates
  "FILIPPAKIS PAVLOS ANGELOS_TRAUMA.pdf": {
    certNumber: "TMEC 1179",
    issuanceDate: "2023-02-24",
    expiryDate: "2025-02-24"
  },
  
  // PADI Rescue Diver
  "PADI - Rescue Diver.pdf": {
    certNumber: "2410UF5166",
    issuanceDate: "2024-10-24"
  },
  
  // AECO General
  "PavlosFilippakis-AECOGeneralQuestions2024.pdf": {
    issuanceDate: "2024-08-03"
  },
  
  // AECO Mariner
  "PavlosFilippakis-AECOMarinerAssessment2024.pdf": {
    issuanceDate: "2024-08-03"
  },
  
  // Svalbard
  "PavlosFilippakis-Svalbard2024.pdf": {
    issuanceDate: "2024-08-02"
  },
  
  // Close Protection
  "Close Protection Officer Course - 2022.pdf": {
    issuanceDate: "2022-05-13"
  },
  
  // Draeger Gas
  "Draeger Gas Detectors.pdf": {
    certNumber: "GT20678",
    issuanceDate: "2022-03-01" // March 2022 from text
  },
  
  // Mooring Ropes
  "FILIPPAKIS PAVLOS-ANGELOS_MOORING ROPES BY KATRADIS.pdf": {
    issuanceDate: "2023-03-16"
  },
  
  // Freefall Lifeboat
  "Freefall Lifeboat.pdf": {
    certNumber: "GR 19 OEM FF 586",
    issuanceDate: "2019-01-31"
  },
  
  // K-Chief
  "KChief Step1.pdf": {
    certNumber: "12684",
    issuanceDate: "2019-10-18"
  },
  
  // SRB Cayman
  "SRB - Cayman Islands.pdf": {
    certNumber: "055220",
    issuanceDate: "2023-06-29"
  },
  
  // Advanced LNG
  "Advanced Liquefied Gas Training.pdf": {
    certNumber: "FTAGTCOP/18716155601",
    issuanceDate: "2018-03-02"
  },
  
  // BRM-BTM - already have correct data
  
  // ECDIS Generic
  "ECDIS Generic New.pdf": {
    certNumber: "520.12.10723.2",
    issuanceDate: "2020-10-12"
  },
  
  // Furuno ECDIS
  "FURUNO ECDIS Certificate.pdf": {
    certNumber: "TE32035",
    issuanceDate: "2018-04-12"
  },
  
  // Ice Navigator
  "Ice Navigator - Level 1.pdf": {
    certNumber: "IN00245",
    issuanceDate: "2025-09-01",
    expiryDate: "2030-08-31"
  },
  
  // JRC ECDIS
  "JRC ECDIS Certificate.pdf": {
    certNumber: "2016-ECDIS-JAN-0316",
    issuanceDate: "2016-09-30"
  },
  
  // Polar Code
  "Polar Code Courses - Filippakis.pdf": {
    certNumber: "1-6-2/2024/11",
    issuanceDate: "2024-03-13"
  },
  
  // SSA
  "SSA.pdf": {
    certNumber: "0012481"
  },
  
  // STCW 95 LSA
  "STCW 95_ LSA-FFE-Fast Rescue.pdf": {
    certNumber: "93023",
    issuanceDate: "2018-04-26"
  },
  
  // Sperry ECDIS
  "Sperry ECDIS Certificate.pdf": {
    certNumber: "116828",
    issuanceDate: "2018-06-21"
  }
};

console.log("=== Certificate Data Updates ===\n");

// Print updates to apply
for (const [file, updates] of Object.entries(manualUpdates)) {
  console.log(`File: ${file}`);
  for (const [key, value] of Object.entries(updates)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log();
}

console.log("\n=== Applying Updates ===\n");

// The updates need to be applied manually to certificates.js
// This script just outputs what needs to be changed
