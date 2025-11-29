const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  OCRJob,
  OCRResult,
  ExtractPDFJob,
  ExtractPDFResult,
  ExtractElementType
} = require("@adobe/pdfservices-node-sdk");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// Adobe API credentials
const CLIENT_ID = "bfbcfe406f8f40889f68d15e7bd0076f";
const CLIENT_SECRET = "p8e-2S7jOgQoLhlLq-owGoVdR8i3NlNSo7qq";
const ORG_ID = "6D2121C7692AF6430A495FA5@AdobeOrg";

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
    console.log(`Processing: ${path.basename(pdfPath)}`);
    
    // Create credentials
    const credentials = new ServicePrincipalCredentials({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID
    });
    
    // Create PDF Services instance
    const pdfServices = new PDFServices({ credentials });
    
    // Read the PDF file
    const inputAsset = await pdfServices.upload({
      readStream: fs.createReadStream(pdfPath),
      mimeType: MimeType.PDF
    });
    
    // Create extract job
    const job = new ExtractPDFJob({
      inputAsset,
      elementsToExtract: [ExtractElementType.TEXT]
    });
    
    // Submit and get result
    const pollingURL = await pdfServices.submit({ job });
    const result = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult
    });
    
    // Download the result
    const resultAsset = result.resource;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });
    
    // Save to temp zip file
    const outputFileName = path.basename(pdfPath, ".pdf") + "_extracted.zip";
    const outputPath = path.join(OUTPUT_FOLDER, outputFileName);
    
    const writeStream = fs.createWriteStream(outputPath);
    streamAsset.readStream.pipe(writeStream);
    
    await new Promise((resolve, reject) => {
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
    
    return { success: false, error: "No text found", file: path.basename(pdfPath) };
    
  } catch (error) {
    console.error(`Error processing ${path.basename(pdfPath)}:`, error.message);
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
    expiryDate: null
  };
  
  // Common patterns for certificate numbers
  const certPatterns = [
    /certificate\s*(?:no|number|#)[:\s]*([A-Z0-9\-\/]+)/i,
    /cert\s*(?:no|number|#)[:\s]*([A-Z0-9\-\/]+)/i,
    /no[:\s]*([A-Z0-9\-\/]{5,})/i,
    /number[:\s]*([A-Z0-9\-\/]{5,})/i,
    /reference[:\s]*([A-Z0-9\-\/]+)/i,
    /reg(?:istration)?[:\s]*(?:no)?[:\s]*([A-Z0-9\-\/]+)/i
  ];
  
  // Date patterns
  const datePatterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g,
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/g,
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/gi,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/gi
  ];
  
  // Try to find certificate number
  for (const pattern of certPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.certNumber = match[1].trim();
      break;
    }
  }
  
  // Try to find dates
  const dates = [];
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  
  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  let match;
  const dateRegex1 = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
  while ((match = dateRegex1.exec(text)) !== null) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    if (parseInt(month) <= 12 && parseInt(day) <= 31) {
      dates.push(`${year}-${month}-${day}`);
    }
  }
  
  // Pattern: YYYY-MM-DD
  const dateRegex2 = /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/g;
  while ((match = dateRegex2.exec(text)) !== null) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    if (parseInt(month) <= 12 && parseInt(day) <= 31 && parseInt(year) > 2000) {
      dates.push(`${year}-${month}-${day}`);
    }
  }
  
  // Pattern: DD Mon YYYY
  const dateRegex3 = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/gi;
  while ((match = dateRegex3.exec(text)) !== null) {
    const day = match[1].padStart(2, '0');
    const month = monthMap[match[2].toLowerCase().substring(0, 3)];
    const year = match[3];
    dates.push(`${year}-${month}-${day}`);
  }
  
  // Sort dates and assign
  if (dates.length > 0) {
    dates.sort();
    data.issuanceDate = dates[0]; // Earliest date is likely issuance
    if (dates.length > 1) {
      data.expiryDate = dates[dates.length - 1]; // Latest date is likely expiry
    }
  }
  
  return data;
}

// Main function
async function main() {
  console.log("=== Adobe PDF OCR Extraction ===\n");
  
  // Get all PDF files
  const pdfFiles = getPDFFiles(CERTS_FOLDER);
  console.log(`Found ${pdfFiles.length} PDF files\n`);
  
  const results = [];
  
  // Process each file
  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfPath = pdfFiles[i];
    console.log(`[${i + 1}/${pdfFiles.length}] ${path.basename(pdfPath)}`);
    
    const extractResult = await extractTextFromPDF(pdfPath);
    
    if (extractResult.success) {
      const parsed = parseCertificateData(extractResult.text, extractResult.file);
      results.push({
        ...parsed,
        rawText: extractResult.text.substring(0, 500) // First 500 chars for reference
      });
      console.log(`  ✓ Cert#: ${parsed.certNumber || 'N/A'}, Issued: ${parsed.issuanceDate || 'N/A'}, Expires: ${parsed.expiryDate || 'N/A'}`);
    } else {
      results.push({
        file: extractResult.file,
        error: extractResult.error
      });
      console.log(`  ✗ Error: ${extractResult.error}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save results
  const outputFile = path.join(OUTPUT_FOLDER, "extraction-results.json");
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
  
  return results;
}

main().catch(console.error);
