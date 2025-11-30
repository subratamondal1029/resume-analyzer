# Resume Analyzer

An intelligent resume screening system that extracts text from PDF resumes using JavaScript libraries for regular PDFs and OCR (Optical Character Recognition) for scanned documents. The system evaluates resumes against job requirements using Google Gemini AI and provides comprehensive assessment with evidence, reasoning, and confidence scores.

## 🚀 Features

- **Smart Text Extraction**: Automatically extracts text from PDF resumes using `unpdf` library
- **OCR Support**: Falls back to Tesseract OCR for scanned resumes or PDFs with minimal extractable text
- **AI-Powered Resume Review**: Uses Google Gemini AI to evaluate resumes against job role, skills, and experience requirements
- **Intelligent Experience Assessment**: Evaluates candidates based on project quality and relevance, not just years of experience
- **Skills Matching**: Checks if resume demonstrates required technical skills through projects, work experience, or explicit mentions
- **Real-time Progress Tracking**: Server-Sent Events (SSE) for live analysis progress updates
- **Docker Support**: Self-hosted Tesseract OCR server running in Docker
- **Web Interface**: Clean and intuitive UI for resume upload and job criteria specification
- **Structured Assessment**: Returns well-formatted JSON with pass/fail status, evidence, reasoning, and confidence scores

## 🏗️ Architecture

The system consists of three main components:

1. **Express.js Backend** - Handles resume uploads, orchestrates PDF processing, and manages API endpoints
2. **Tesseract OCR Server** - Self-hosted Docker container for OCR processing of scanned resumes
3. **Google Gemini AI** - Cloud-based LLM for intelligent resume evaluation and candidate assessment

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
2. Upload a resume PDF file (max 5MB, up to 5 pages)
3. Enter job requirements:
   - **Job Role**: Target position (e.g., Frontend Developer, Full Stack Engineer)
   - **Skills**: Required technical skills as comma-separated values (e.g., html, javascript, react)
   - **Experience Level**: Required experience (e.g., Fresher, 2-3 years, Mid-level, Senior)
   - **Other Details**: Additional requirements (optional)
4. Click "Review Resume" and watch real-time progress
5. View comprehensive assessment with PASS/FAIL status, evidence, reasoning, and confidence score

### API Endpoints

#### 1. Review Resume

**POST** `/api/pdf-analyze`

Upload a resume PDF and specify job requirements for evaluation.

**Request:**

```bash
curl -X POST http://localhost:3000/api/pdf-analyze \
  -F "file=@resume.pdf" \
  -F 'rules={"role":"Frontend Developer","skills":["html","javascript","react"],"experience":"2-3 years","other_details":"Bachelor degree in CS"}'
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

## 📊 Resume Review Format

### Input Criteria

Job requirements should be provided as a JSON object:

```json
{
  "role": "Full Stack Developer",
  "skills": ["javascript", "react", "node.js", "mongodb"],
  "experience": "2-3 years or strong projects for freshers",
  "other_details": "Bachelor's degree in Computer Science, remote work experience preferred"
}
```

### Output Schema

The system returns a comprehensive assessment:

```json
{
  "status": "pass",
  "evidence": "Candidate has 2 years of experience with React and Node.js at XYZ Company. Built 3 full-stack projects including an e-commerce platform with React frontend and Node.js backend.",
  "reasoning": "The resume demonstrates strong alignment with the Full Stack Developer role. All required skills (JavaScript, React, Node.js, MongoDB) are evident through professional experience and project work. The candidate's 2 years of experience matches the requirement, and their projects show practical application of the technology stack.",
  "confidence": 88
}
```

**Field Descriptions:**

- `status`: Either "pass" or "fail" based on overall fit
- `evidence`: Specific sections, projects, or experiences from the resume that support the assessment
- `reasoning`: 2-3 sentence comprehensive explanation highlighting key strengths or gaps
- `confidence`: Integer from 0-100 indicating certainty level of the assessment

### Assessment Criteria

The AI evaluates resumes based on:

- **Role Alignment**: How well the candidate's background matches the target position
- **Skills Verification**: Checks for required technical skills through projects, work experience, or explicit mentions
- **Experience Quality**: Assesses if projects and work history demonstrate competency matching the required level
  - For freshers: Evaluates project quality, complexity, and relevance
  - For experienced: Validates professional experience and technical depth
- **Additional Requirements**: Considers education, certifications, and other specified criteria

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
    │   └── resumeReview.controller.js  # Main analysis logic
    ├── services/
    │   └── pdf.service.js      # PDF processing & AI services
    ├── routers/
    │   └── resumeReview.route.js # API route definitions
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

| Variable         | Description                | Default                           | Required |
| ---------------- | -------------------------- | --------------------------------- | -------- |
| `PORT`           | Server port                | `3000`                            | No       |
| `TESSERACT_API`  | Tesseract OCR endpoint     | `http://localhost:8884/tesseract` | Yes      |
| `GEMINI_API_KEY` | Google Gemini API key      | -                                 | Yes      |
| `TEXT_THRESHOLD` | Min text length before OCR | `100`                             | No       |
| `OCR_TIMEOUT_MS` | OCR request timeout        | `120000`                          | No       |

### File Upload Limits

- **Max file size**: 5MB
- **Max pages**: 5 pages (standard resume length)
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

1. **Resume Upload**: User uploads a resume PDF file through the web interface or API
2. **Page Validation**: System checks if resume is within 5-page limit
3. **Text Extraction**: System attempts to extract text using `unpdf` library
4. **OCR Fallback**: If extracted text is below threshold (default 100 chars), the system:
   - Splits PDF into individual pages
   - Renders each page as an image
   - Sends images to Tesseract OCR server
   - Combines OCR results
5. **Resume Evaluation**: Extracted text is sent to Google Gemini AI with job criteria:
   - Evaluates role fit
   - Validates required skills through projects and experience
   - Assesses experience quality (projects for freshers, professional work for experienced)
   - Checks additional requirements
6. **Comprehensive Assessment**: AI provides PASS/FAIL decision with evidence, detailed reasoning, and confidence score
7. **Progress Updates**: Client receives real-time updates via Server-Sent Events

## 🧪 Testing

```bash
# Run the server in development mode
pnpm run dev

# Test with a sample resume
curl -X POST http://localhost:3000/api/pdf-analyze \
  -F "file=@sample_resume.pdf" \
  -F 'rules={"role":"Software Engineer","skills":["python","django"],"experience":"Fresher with projects"}'
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

### Adding New Criteria

Job criteria are flexible and support various formats:

**Role Examples:**

- "Frontend Developer"
- "Full Stack Engineer"
- "DevOps Engineer"
- "Data Scientist"

**Skills Examples:**

- ["html", "css", "javascript"]
- ["python", "django", "postgresql"]
- ["react", "typescript", "node.js", "mongodb"]

**Experience Examples:**

- "Fresher" - Evaluates based on project quality
- "1-2 years" - Checks internships and junior roles
- "Mid-level" - Validates solid professional experience
- "Senior" - Requires leadership and depth

**Other Details Examples:**

- "Bachelor's degree in Computer Science"
- "Experience with cloud platforms (AWS/Azure)"
- "Open source contributions preferred"
- "Remote work experience"

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

**Note**: This resume analyzer uses AI-powered evaluation to screen candidates based on role fit, skills, and experience quality. The system goes beyond keyword matching by understanding project relevance and competency levels, making it suitable for evaluating both fresh graduates and experienced professionals.
