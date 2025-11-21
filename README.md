# Resume Analyzer

A powerful PDF document analysis system that extracts text from resumes/documents using JavaScript libraries for regular PDFs and OCR (Optical Character Recognition) for scanned images. The system then validates the content against user-defined rules using Google Gemini AI and returns structured results.

## 🚀 Features

- **Smart Text Extraction**: Automatically extracts text from PDF documents using `unpdf` library
- **OCR Support**: Falls back to Tesseract OCR for scanned documents or PDFs with minimal extractable text
- **AI-Powered Rule Checking**: Uses Google Gemini AI to validate documents against custom rules
- **Real-time Progress Tracking**: Server-Sent Events (SSE) for live analysis progress updates
- **Docker Support**: Self-hosted Tesseract OCR server running in Docker
- **Web Interface**: Simple and intuitive UI for document upload and rule specification
- **Structured Results**: Returns well-formatted JSON responses with evidence, reasoning, and confidence scores

## 🏗️ Architecture

The system consists of three main components:

1. **Express.js Backend** - Handles file uploads, orchestrates PDF processing, and manages API endpoints
2. **Tesseract OCR Server** - Self-hosted Docker container for OCR processing of scanned documents
3. **Google Gemini AI** - Cloud-based LLM for intelligent rule validation and analysis

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express Server  │─────▶│  Tesseract OCR  │
│  (Browser)  │      │   (Node.js)      │      │   (Docker)      │
└─────────────┘      └──────────────────┘      └─────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Google Gemini  │
                     │      AI API     │
                     └─────────────────┘
```

## 📋 Prerequisites

- **Node.js** v20 or higher
- **Docker** and **Docker Compose**
- **pnpm** package manager (v10.18.3 or higher)
- **Google Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))

### System Dependencies (for manual installation without Docker)

```bash
sudo apt update
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev \
libjpeg-dev libgif-dev librsvg2-dev
```

## 🔧 Installation

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/subratamondal1029/resume-analyzer.git
   cd resume-analyzer
   ```

2. **Set up environment variables**
   ```bash
   cd server
   cp .env.example .env
   ```
   
   Edit `.env` and add your Google Gemini API key:
   ```env
   PORT=3000
   TESSERACT_API=http://tesseract:8884/tesseract
   GEMINI_API_KEY=your_gemini_api_key_here
   TEXT_THRESHOLD=100
   OCR_TIMEOUT_MS=120000
   ```

3. **Start the services**
   ```bash
   cd ..
   docker-compose up -d
   ```

4. **Access the application**
   - Open your browser and navigate to: `http://localhost:3000`

### Option 2: Manual Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/subratamondal1029/resume-analyzer.git
   cd resume-analyzer/server
   ```

2. **Install dependencies**
   ```bash
   npm install -g pnpm
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Tesseract OCR server separately**
   ```bash
   docker run -d -p 8884:8884 hertzg/tesseract-server:latest
   ```

5. **Start the application**
   ```bash
   pnpm run dev
   ```

## 🎯 Usage

### Web Interface

1. Navigate to `http://localhost:3000`
2. Upload a PDF file (max 5MB)
3. Enter up to 3 rules to check against the document
4. Click "Analyze" and watch real-time progress
5. View structured results with evidence and confidence scores

### API Endpoints

#### 1. Analyze PDF Document

**POST** `/api/pdf-analyze`

Upload a PDF file and specify rules for analysis.

**Request:**
```bash
curl -X POST http://localhost:3000/api/pdf-analyze \
  -F "file=@resume.pdf" \
  -F 'rules=["Must contain contact information", "Should mention at least 2 years of experience", "Must include education details"]'
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "PDF analysis started",
  "data": {
    "fileName": "resume.pdf",
    "analysisId": "1234567890"
  },
  "success": true
}
```

#### 2. Get Analysis Status (Server-Sent Events)

**GET** `/api/pdf-analyze/status/:id`

Stream real-time progress updates for an ongoing analysis.

**Request:**
```bash
curl -N http://localhost:3000/api/pdf-analyze/status/1234567890
```

**Response Stream:**
```
data: {"status":"Starting analysis...","progress":0}

data: {"status":"Reading document...","progress":30}

data: {"status":"Checking Rules...","progress":80}

data: {"status":"Analyzing Completed!","progress":100,"data":[...]}
```

#### 3. Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "OK"
}
```

## 📊 Rule Checking Format

### Input Rules

Rules should be provided as an array of strings:

```json
[
  "Document must mention a date",
  "Must contain contact information",
  "Should list at least 3 technical skills"
]
```

### Output Schema

Each rule is analyzed and returns a structured result:

```json
{
  "rule": "Document must mention a date",
  "status": "pass",
  "evidence": "Found on page 1: 'Published 2024-07-01'",
  "reasoning": "Document explicitly contains a date string",
  "confidence": 95
}
```

**Field Descriptions:**
- `rule`: The original rule being checked
- `status`: Either "pass" or "fail"
- `evidence`: Specific text found in the document with page reference
- `reasoning`: 1-2 sentence explanation of the decision
- `confidence`: Integer from 0-100 indicating certainty level

## 🐳 Docker Configuration

The project uses Docker Compose with two services:

### Tesseract OCR Service
- **Image**: `hertzg/tesseract-server:latest`
- **Port**: 8884
- **Purpose**: OCR text extraction from scanned documents

### Backend Service
- **Base Image**: Node.js 20
- **Port**: 3000
- **Features**: 
  - Hot reload with nodemon
  - Volume mounting for development
  - Health checks
  - Automatic dependency installation

### Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

## 📁 Project Structure

```
resume-analyzer/
├── docker-compose.yml          # Docker orchestration configuration
├── README.md                   # This file
└── server/
    ├── Dockerfile              # Server container definition
    ├── package.json            # Node.js dependencies
    ├── .env.example            # Environment variables template
    ├── index.js                # Application entry point
    ├── app.js                  # Express app configuration
    ├── config.js               # Environment configuration loader
    ├── controllers/
    │   └── pdfAnalyze.controller.js  # Main analysis logic
    ├── services/
    │   └── pdf.service.js      # PDF processing & AI services
    ├── routers/
    │   └── pdfAnalyze.route.js # API route definitions
    ├── middlewares/
    │   └── upload.middleware.js # File upload handling
    ├── utils/
    │   ├── ApiError.js         # Error handling utility
    │   ├── ApiResponse.js      # Response formatting utility
    │   └── asyncHandler.js     # Async error wrapper
    ├── state/
    │   └── progress.js         # Progress tracking state
    ├── public/
    │   ├── index.html          # Web interface
    │   └── app.js              # Client-side JavaScript
    └── uploads/                # Temporary file storage
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `TESSERACT_API` | Tesseract OCR endpoint | `http://localhost:8884/tesseract` | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | - | Yes |
| `TEXT_THRESHOLD` | Min text length before OCR | `100` | No |
| `OCR_TIMEOUT_MS` | OCR request timeout | `120000` | No |

### File Upload Limits

- **Max file size**: 5MB
- **Allowed format**: PDF only
- **Temporary storage**: Files are automatically deleted after analysis

## 🛠️ Technology Stack

### Backend
- **Express.js 5.1.0** - Web framework
- **Node.js 20** - Runtime environment
- **multer 2.0.2** - File upload handling

### PDF Processing
- **unpdf 1.4.0** - PDF text extraction
- **pdf-lib 1.17.1** - PDF manipulation
- **@napi-rs/canvas 0.1.82** - Image rendering for OCR

### AI & OCR
- **@google/genai 1.30.0** - Google Gemini AI integration
- **Tesseract OCR** - Text recognition for scanned documents

### Additional Libraries
- **axios 1.13.2** - HTTP client
- **cors 2.8.5** - Cross-origin resource sharing
- **dotenv 17.2.3** - Environment configuration

## 🔍 How It Works

1. **File Upload**: User uploads a PDF file through the web interface or API
2. **Text Extraction**: System attempts to extract text using `unpdf` library
3. **OCR Fallback**: If extracted text is below threshold (default 100 chars), the system:
   - Splits PDF into individual pages
   - Renders each page as an image
   - Sends images to Tesseract OCR server
   - Combines OCR results
4. **Rule Validation**: Extracted text is sent to Google Gemini AI with user rules
5. **Result Formatting**: AI response is parsed and formatted as structured JSON
6. **Progress Updates**: Client receives real-time updates via Server-Sent Events

## 🧪 Testing

```bash
# Run the server in development mode
pnpm run dev

# Test with a sample PDF
curl -X POST http://localhost:3000/api/pdf-analyze \
  -F "file=@test.pdf" \
  -F 'rules=["Must contain a date"]'
```

## 🐛 Troubleshooting

### Issue: OCR not working
**Solution**: Ensure Tesseract Docker container is running:
```bash
docker ps | grep tesseract
```

### Issue: Gemini API errors
**Solution**: Verify your API key is correctly set in `.env`:
```bash
cat server/.env | grep GEMINI_API_KEY
```

### Issue: File upload fails
**Solution**: Check that `uploads/` directory exists and has write permissions:
```bash
mkdir -p server/uploads
chmod 755 server/uploads
```

### Issue: Docker build fails
**Solution**: Ensure you have enough disk space and try rebuilding:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📝 Development

### Running in Development Mode

```bash
cd server
pnpm run dev
```

This starts the server with nodemon for automatic restarts on file changes.

### Adding New Rules

Rules are flexible natural language statements. Examples:
- "Document must be in English"
- "Should contain at least 5 bullet points"
- "Must mention Python or JavaScript"
- "Should include a LinkedIn profile URL"

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Subrata Mondal**

## 🙏 Acknowledgments

- Google Gemini AI for intelligent text analysis
- Tesseract OCR for text recognition
- The open-source community for excellent libraries

---

**Note**: This is a resume analyzer application that can be extended to analyze any type of PDF document against custom rules. The system is designed to be flexible and can be adapted for various document validation use cases.
