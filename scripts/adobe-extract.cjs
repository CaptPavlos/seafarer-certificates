const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFJob,
  ExtractPDFParams,
  ExtractElementType,
  ExtractPDFResult
} = require("@adobe/pdfservices-node-sdk");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// Adobe API credentials
const CLIENT_ID = "bfbcfe406f8f40889f68d15e7bd0076f";
const CLIENT_SECRET = "p8e-2S7jOgQoLhlLq-owGoVdR8i3NlNSo7qq";

// Certificates folder
const CERTS_FOLDER = path.join(__dirname, "../../Certificates");
const OUTPUT_FOLDER = path.join(__dirname, "../src/data/ocr-output");

// Create output folder
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

// Get all PDF files recursively
function getPDFFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getPDFFiles(fullPath, files);
    } else if (item.toLowerCase().endsWith(".pdf")) {
      files.push(fullPath);
    }
  }
  return files;
}

// Extract text from PDF using Adobe API
async function extractTextFromPDF(pdfPath) {
  try {
    console.log(`\nProcessing: ${path.basename(pdfPath)}`);
    
    // Create credentials
    const credentials = new ServicePrincipalCredentials({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET
    });
    
    // Create PDF Services instance
    const pdfServices = new PDFServices({ credentials });
    
    // Read the PDF file
    const readStream = fs.createReadStream(pdfPath);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.PDF
    });
    
    // Create extract params
    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractElementType.TEXT]
    });
    
    // Create extract job
    const job = new ExtractPDFJob({ inputAsset, params });
    
    // Submit job
    const pollingURL = await pdfServices.submit({ job });
    
    // Get result
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult
    });
    
    // Get the result asset
    const resultAsset = pdfServicesResponse.result.resource;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });
    
    // Save to temp zip file
    const outputFileName = path.basename(pdfPath, ".pdf") + "_extracted.zip";
    const outputPath = path.join(OUTPUT_FOLDER, outputFileName);
    
    // Write stream to file
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPath);
      streamAsset.readStream.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    
    // Extract JSON from zip
    const zip = new AdmZip(outputPath);
    const jsonEntry = zip.getEntry("structuredData.json");
    
    if (jsonEntry) {
      const jsonContent = JSON.parse(jsonEntry.getData().toString("utf8"));
      
      // Extract text elements
      let fullText = "";
      if (jsonContent.elements) {
        for (const element of jsonContent.elements) {
          if (element.Text) {
            fullText += element.Text + "\n";
          }
        }
      }
      
      // Clean up zip file
      fs.unlinkSync(outputPath);
      
      return {
        success: true,
        text: fullText,
        file: path.basename(pdfPath)
      };
    }
    
    fs.unlinkSync(outputPath);
    return { success: false, error: "No text found in PDF", file: path.basename(pdfPath) };
    
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return { 
      success: false, 
      error: error.message, 
      file: path.basename(pdfPath) 
    };
  }
}

// Parse certificate data from extracted text
function parseCertificateData(text, filename) {
  const data = {
    file: filename,
    certNumber: null,
    issuanceDate: null,
    expiryDate: null,
    extractedText: text.substring(0, 1000) // First 1000 chars
  };
  
  const textLower = text.toLowerCase();
  
  // Common patterns for certificate numbers
  const certPatterns = [
    /certificate\s*(?:no|number|#|:)[:\s]*([A-Z0-9\-\/\.]+)/i,
    /cert\s*(?:no|number|#|:)[:\s]*([A-Z0-9\-\/\.]+)/i,
    /(?:no|number)[:\.\s]+([A-Z0-9\-\/]{5,})/i,
    /reference[:\s]*([A-Z0-9\-\/]+)/i,
    /reg(?:istration)?[:\s]*(?:no)?[:\s]*([A-Z0-9\-\/]+)/i,
    /license\s*(?:no|number)?[:\s]*([A-Z0-9\-\/]+)/i
  ];
  
  // Try to find certificate number
  for (const pattern of certPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 4) {
      data.certNumber = match[1].trim();
      break;
    }
  }
  
  // Month mapping
  const monthMap = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12'
  };
  
  // Find all dates
  const dates = new Set();
  
  // Pattern: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dateRegex1 = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
  let match;
  while ((match = dateRegex1.exec(text)) !== null) {
    let day = parseInt(match[1]);
    let month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // Handle DD/MM/YYYY vs MM/DD/YYYY ambiguity
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    
    if (month <= 12 && day <= 31 && year >= 2000 && year <= 2040) {
      dates.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  }
  
  // Pattern: DD Mon YYYY or DD Month YYYY
  const dateRegex2 = /(\d{1,2})[\s\-]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s\-,]+(\d{4})/gi;
  while ((match = dateRegex2.exec(text)) !== null) {
    const day = parseInt(match[1]);
    const monthStr = match[2].toLowerCase();
    const month = monthMap[monthStr] || monthMap[monthStr.substring(0, 3)];
    const year = parseInt(match[3]);
    
    if (month && day <= 31 && year >= 2000 && year <= 2040) {
      dates.add(`${year}-${month}-${String(day).padStart(2, '0')}`);
    }
  }
  
  // Pattern: Month DD, YYYY
  const dateRegex3 = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})[\s,]+(\d{4})/gi;
  while ((match = dateRegex3.exec(text)) !== null) {
    const monthStr = match[1].toLowerCase();
    const month = monthMap[monthStr] || monthMap[monthStr.substring(0, 3)];
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    if (month && day <= 31 && year >= 2000 && year <= 2040) {
      dates.add(`${year}-${month}-${String(day).padStart(2, '0')}`);
    }
  }
  
  // Sort dates and assign
  const sortedDates = Array.from(dates).sort();
  if (sortedDates.length > 0) {
    // Look for keywords to identify date types
    if (textLower.includes('issue') || textLower.includes('dated') || textLower.includes('valid from')) {
      data.issuanceDate = sortedDates[0];
    }
    if (textLower.includes('expir') || textLower.includes('valid until') || textLower.includes('valid to')) {
      data.expiryDate = sortedDates[sortedDates.length - 1];
    }
    
    // If no keywords found, use first as issuance, last as expiry (if different)
    if (!data.issuanceDate) {
      data.issuanceDate = sortedDates[0];
    }
    if (!data.expiryDate && sortedDates.length > 1 && sortedDates[sortedDates.length - 1] !== data.issuanceDate) {
      data.expiryDate = sortedDates[sortedDates.length - 1];
    }
  }
  
  return data;
}

// Main function
async function main() {
  console.log("=== Adobe PDF Text Extraction ===\n");
  
  // Get all PDF files
  const pdfFiles = getPDFFiles(CERTS_FOLDER);
  console.log(`Found ${pdfFiles.length} PDF files\n`);
  
  const results = [];
  const errors = [];
  
  // Process each file
  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfPath = pdfFiles[i];
    console.log(`[${i + 1}/${pdfFiles.length}] ${path.basename(pdfPath)}`);
    
    const extractResult = await extractTextFromPDF(pdfPath);
    
    if (extractResult.success && extractResult.text.trim()) {
      const parsed = parseCertificateData(extractResult.text, extractResult.file);
      results.push(parsed);
      console.log(`  ✓ Cert#: ${parsed.certNumber || 'N/A'}`);
      console.log(`    Issued: ${parsed.issuanceDate || 'N/A'}, Expires: ${parsed.expiryDate || 'N/A'}`);
    } else {
      errors.push({
        file: extractResult.file,
        error: extractResult.error || "No text extracted"
      });
      console.log(`  ✗ ${extractResult.error || "No text extracted"}`);
    }
    
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Save results
  const outputFile = path.join(OUTPUT_FOLDER, "extraction-results.json");
  fs.writeFileSync(outputFile, JSON.stringify({ results, errors }, null, 2));
  console.log(`\n=== Summary ===`);
  console.log(`Successful: ${results.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Results saved to: ${outputFile}`);
  
  return { results, errors };
}

main().catch(console.error);
