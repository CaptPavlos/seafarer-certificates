import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OCR.space API key
// Get your FREE API key at: https://ocr.space/ocrapi/freekey
// Then run: OCR_API_KEY=your_key_here npm run ocr
const API_KEY = process.env.OCR_API_KEY || 'helloworld';  // 'helloworld' is a test key with very limited use

if (!process.env.OCR_API_KEY) {
  console.log('⚠️  No OCR_API_KEY environment variable set.');
  console.log('   Get your FREE API key at: https://ocr.space/ocrapi/freekey');
  console.log('   Then run: OCR_API_KEY=your_key_here npm run ocr\n');
  console.log('   Using demo key with limited functionality...\n');
}

const CERTIFICATES_DIR = path.join(__dirname, '../../Certificates');
const OUTPUT_FILE = path.join(__dirname, '../src/data/ocr-results.json');

// Find all PDF files recursively
function findPDFs(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findPDFs(filePath, fileList);
    } else if (file.toLowerCase().endsWith('.pdf')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Extract text from PDF using OCR.space API
async function extractTextFromPDF(pdfPath) {
  const fileName = path.basename(pdfPath);
  console.log(`Processing: ${fileName}`);
  
  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    const base64File = fileBuffer.toString('base64');
    
    const formData = new FormData();
    formData.append('base64Image', `data:application/pdf;base64,${base64File}`);
    formData.append('apikey', API_KEY);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('filetype', 'PDF');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // More accurate engine
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.ParsedResults && result.ParsedResults.length > 0) {
      const text = result.ParsedResults[0].ParsedText;
      return {
        file: fileName,
        path: pdfPath.replace(CERTIFICATES_DIR, 'Certificates'),
        text: text,
        success: true
      };
    } else {
      console.log(`  Warning: No text extracted from ${fileName}`);
      return {
        file: fileName,
        path: pdfPath.replace(CERTIFICATES_DIR, 'Certificates'),
        text: '',
        success: false,
        error: result.ErrorMessage || 'No text found'
      };
    }
  } catch (error) {
    console.log(`  Error processing ${fileName}: ${error.message}`);
    return {
      file: fileName,
      path: pdfPath.replace(CERTIFICATES_DIR, 'Certificates'),
      text: '',
      success: false,
      error: error.message
    };
  }
}

// Parse certificate data from OCR text
function parseCertificateData(text) {
  const data = {
    certNumber: null,
    issuanceDate: null,
    expiryDate: null
  };
  
  if (!text) return data;
  
  // Common patterns for certificate numbers
  const certPatterns = [
    /certificate\s*(?:no|number|#)?[:\s]*([A-Z0-9\-\/]+)/i,
    /cert\s*(?:no|number|#)?[:\s]*([A-Z0-9\-\/]+)/i,
    /no[:\s]*([A-Z0-9\-\/]{5,})/i,
    /number[:\s]*([A-Z0-9\-\/]{5,})/i,
    /([A-Z]{2,3}[-\/][A-Z0-9\-\/]+)/i,  // Format like MI-12345 or C-EC-12201
    /reference[:\s]*([A-Z0-9\-\/]+)/i
  ];
  
  for (const pattern of certPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 4) {
      data.certNumber = match[1].trim();
      break;
    }
  }
  
  // Date patterns (various formats)
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,
    // Month DD, YYYY
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/gi,
    // DD Month YYYY
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/gi,
    // YYYY-MM-DD
    /(\d{4})-(\d{2})-(\d{2})/g
  ];
  
  const dates = [];
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      dates.push(match[0]);
    }
  }
  
  // Look for issue/expiry keywords
  const issuePatterns = [
    /(?:issue|issued|date of issue)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    /(?:issue|issued|date of issue)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:issue|issued|date of issue)[:\s]*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  ];
  
  const expiryPatterns = [
    /(?:expir|valid until|valid to|expires?)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    /(?:expir|valid until|valid to|expires?)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:expir|valid until|valid to|expires?)[:\s]*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  ];
  
  for (const pattern of issuePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.issuanceDate = match[1].trim();
      break;
    }
  }
  
  for (const pattern of expiryPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.expiryDate = match[1].trim();
      break;
    }
  }
  
  return data;
}

// Main function
async function main() {
  console.log('Finding PDF files...');
  const pdfFiles = findPDFs(CERTIFICATES_DIR);
  console.log(`Found ${pdfFiles.length} PDF files\n`);
  
  const results = [];
  
  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfPath = pdfFiles[i];
    console.log(`[${i + 1}/${pdfFiles.length}] Processing...`);
    
    const ocrResult = await extractTextFromPDF(pdfPath);
    const parsedData = parseCertificateData(ocrResult.text);
    
    results.push({
      ...ocrResult,
      parsed: parsedData
    });
    
    // Rate limiting - OCR.space free tier has limits
    if (i < pdfFiles.length - 1) {
      console.log('  Waiting 1.5s (rate limit)...\n');
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  // Save results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${OUTPUT_FILE}`);
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const withCertNumber = results.filter(r => r.parsed.certNumber).length;
  const withIssuance = results.filter(r => r.parsed.issuanceDate).length;
  const withExpiry = results.filter(r => r.parsed.expiryDate).length;
  
  console.log('\n=== Summary ===');
  console.log(`Total files: ${results.length}`);
  console.log(`Successfully OCR'd: ${successful}`);
  console.log(`Found cert numbers: ${withCertNumber}`);
  console.log(`Found issuance dates: ${withIssuance}`);
  console.log(`Found expiry dates: ${withExpiry}`);
}

main().catch(console.error);
