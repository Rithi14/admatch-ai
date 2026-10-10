# 🚀 AdMatch AI

### Evidence-Backed Ad-to-Landing-Page Message Match Auditor

AdMatch AI is a web application designed to identify potential mismatches between digital advertisement copy and landing-page content. It compares advertising claims with available landing-page evidence, highlights claims that appear supported, partially supported, or not found, and helps users identify messaging gaps.

🌐 **Live Demo:** [https://admatch-ai.vercel.app](https://admatch-ai.vercel.app)

> **Project status:** MVP — under active development  
> **Analysis approach:** Rule-based text matching and evidence checks

The goal is to make advertising messages clearer, more consistent, and easier to verify against landing-page content.

---

## 📌 Table of Contents

- [Problem Statement](#-problem-statement)
- [Our Solution](#-our-solution)
- [Live Demo](#-live-demo)
- [Key Features](#-key-features)
- [How It Works](#-how-it-works)
- [Technology Stack](#️-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#️-getting-started)
- [API Endpoints](#-api-endpoints)
- [Example Input](#-example-input)
- [Testing](#-testing)
- [Limitations](#️-limitations)
- [Future Enhancements](#-future-enhancements)
- [Security Notes](#-security-notes)

## 🎯 Problem Statement

Digital advertisements sometimes make promises that are not clearly reflected on their destination landing pages. This can create confusion, reduce trust, and make it difficult for visitors to understand what is actually being offered.

Manually reviewing many advertisement-to-landing-page pairs can be time-consuming. AdMatch AI aims to simplify this process by comparing supplied ad copy with available landing-page content and presenting explainable findings.

## 💡 Our Solution

AdMatch AI provides a structured auditing workflow that compares advertisements with their associated landing pages.

Depending on the configured workflow, users can provide:

- Advertisement headlines and descriptions
- Call-to-action (CTA)
- Landing-page URL or saved HTML snapshot/text
- Optional campaign information, such as industry or target audience

The system evaluates textual alignment, classifies findings, and presents recommendations to help users investigate messaging gaps.

**Important:** A missing text match does not automatically mean that a claim is false. Match scores are indicators of textual alignment, not proof of truth or predictors of conversion performance.

## 🌐 Live Demo

Try the deployed application:

**[https://admatch-ai.vercel.app](https://admatch-ai.vercel.app)**

The frontend is deployed on Vercel. Features that require a backend also depend on the API being available and correctly configured.

## ✨ Key Features

### 1. Advertisement and Landing-Page Comparison

Compares advertising copy with available landing-page content to identify potential message mismatches.

### 2. Claim Evidence Classification

Organizes findings into statuses such as:

- Supported
- Partially supported
- Not found
- Unable to verify

The exact classifications depend on the evidence and analysis rules implemented in the current version.

### 3. Section-Aware Evidence Checks

Supports identifying where evidence appears on a landing page, such as the hero section, main content, features, pricing, FAQ, or footer, where implemented.

### 4. Match Scoring

Produces an indicator of how well the supplied landing-page content aligns with advertising claims.

The score is a heuristic indicator and should not be interpreted as a legal-compliance verdict or a prediction of campaign performance.

### 5. Improvement Recommendations

Provides suggestions intended to help improve consistency between ad promises and landing-page content.

### 6. Dataset-Based Auditing

The project includes an advertisement dataset and corresponding HTML snapshots for testing the auditing workflow.

### 7. Frontend and Backend Architecture

The application is organized into frontend and backend components, with API endpoints for audit operations and dataset status.

> Feature availability may vary by implementation. Verify the current code before describing a feature as fully implemented.

## 🔄 How It Works

1. The user supplies advertisement copy and a landing-page source.
2. The frontend collects the input.
3. In backend mode, the frontend sends an audit request to the API.
4. The backend extracts or receives available landing-page text.
5. The analysis engine compares ad claims with page content.
6. Findings and match indicators are generated.
7. The frontend presents the audit results and recommendations.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| Vite | Frontend development server and build tooling |
| Python | Backend implementation |
| FastAPI | Backend REST API |
| Uvicorn | ASGI server |
| Pydantic | Request validation |
| HTML | Landing-page snapshots |
| CSV | Advertisement dataset |
| Git | Version control |
| Vercel | Frontend deployment |

Check `frontend/package.json` and `backend/requirements.txt` for the exact dependencies used by the current version.

## 🏗️ System Architecture

AdMatch AI follows a frontend-backend architecture.

- **Frontend layer:** Provides the user interface for entering advertisement information and viewing audit results.
- **API layer:** Accepts requests and returns audit results.
- **Analysis layer:** Evaluates textual matches and classifies findings using the implemented rules.
- **Data layer:** Provides advertisement records and landing-page snapshots for analysis and testing.
- **Deployment layer:** Hosts the frontend on Vercel.

Backend-dependent functionality requires the backend service to be running and configured to accept frontend requests.

## 📂 Project Structure

The repository contains these main folders and files:

```text
admatch-ai/
├── backend/
├── docs/
├── frontend/
├── sample_data/
├── .env.example
├── .gitignore
└── README.md
```

The dataset is expected to be located under the backend dataset directory in the relevant project version. Check the current repository for the exact filenames and paths.

## ⚙️ Getting Started

### Prerequisites

Install the following tools:

- Python, using a version supported by the backend dependencies
- Node.js and npm
- Git
- Visual Studio Code (recommended)

### 1. Open the Project

Open the project root folder in Visual Studio Code.

The root folder should contain the `backend` and `frontend` directories.

### 2. Set Up the Backend

Open a terminal in the project root:

```cmd
cd backend
python -m venv .venv
```

Activate the environment on Windows Command Prompt:

```cmd
.venv\Scripts\activate
```

If using Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the dependencies:

```cmd
python -m pip install -r requirements.txt
```

Start the backend from the `backend` directory:

```cmd
python -m uvicorn app.main:app --reload
```

If the entry-point module differs in your checkout, use the module path defined by your backend source code.

### 3. Verify the Backend

When the backend starts successfully, try these addresses:

- **API documentation:** http://127.0.0.1:8000/docs
- **Backend root:** http://127.0.0.1:8000/
- **Dataset status:** http://127.0.0.1:8000/api/dataset

The API documentation shows the available endpoints and their request schemas.

### 4. Set Up the Frontend

Open a second terminal from the project root:

```cmd
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite in the terminal. It is commonly:

http://localhost:5173

Keep both terminals running while testing the complete application.

### 5. Configure Backend Mode

Review `.env.example` and the frontend source code to confirm the environment variable names supported by your version.

If your frontend supports these variables, create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_BACKEND=true
```

Restart the Vite development server after changing environment variables.

Do not commit passwords, API keys, or private configuration files.

## 🔌 API Endpoints

The backend may expose endpoints such as the following. Verify the exact routes and methods in the running API documentation.

Base URL: `http://127.0.0.1:8000`

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/audits` | Submit an audit |
| `GET` | `/api/audits/{audit_id}` | Retrieve an audit |
| `DELETE` | `/api/audits/{audit_id}` | Delete one audit |
| `DELETE` | `/api/audits` | Delete audit records |
| `GET` | `/` | Access the backend root |
| `GET` | `/api/dataset` | Check dataset status |

**Note:** Check `/docs` for the actual endpoint behavior and supported request fields in the current version.

Deleting all audit records is a destructive operation and should only be used intentionally.

## 🧾 Example Input

Example advertisement details:

- **Headline 1:** Rates From 6.9% APR
- **Headline 2:** Apply in 10 Minutes
- **Headline 3:** Same-Day Approval
- **Description 1:** Rates starting at 6.9% APR for qualified businesses.
- **Description 2:** Simple online application, about 10 minutes. Apply Now.

The auditor should compare each claim against the corresponding landing-page content and report the evidence it finds.

This example is illustrative. Actual findings depend on the supplied landing-page snapshot and the current analysis implementation.

## 🧪 Testing

Recommended functional checks include:

- An ad claim that is clearly supported by the landing page
- A claim that is only partially supported
- A claim for which no supporting text is found
- An incomplete or unavailable landing-page snapshot
- Invalid or missing request fields
- Successful audit retrieval
- Correct mapping between advertisement records and their snapshots
- Correct frontend display of backend responses

### Dataset Testing

Verify that the advertisement records map to the correct HTML snapshots and that the dataset-status endpoint reports the expected data.

For benchmark evaluation, prepare expected claim-level labels and compare the system's findings with those labels.

Do not report accuracy, precision, recall, or F1 scores until the benchmark has been run.

## ⚠️ Limitations

- Rule-based matching may miss meaning expressed with different wording.
- A claim missing from extracted text may appear elsewhere on a page that could not be accessed.
- A match score does not prove that a claim is true.
- The system does not inherently predict clicks, conversions, or revenue.
- Dynamic or protected websites may not be fully extractable.
- Production use requires additional security, testing, monitoring, and deployment work.

## 🚀 Future Enhancements

Potential improvements include:

- Stronger semantic claim matching
- Contradiction and fine-print detection
- More robust landing-page section classification
- Visual highlighting of evidence locations
- Benchmark evaluation across the provided dataset
- Improved audit history, filtering, and exports
- Automated frontend and backend regression tests
- Deployment automation and monitoring
- Authentication and access control

These are proposed enhancements unless they are already implemented in the active version.

## 🔐 Security Notes

- Never commit passwords, API keys, access tokens, or private environment files.
- Keep virtual environments and local `.env` files out of version control.
- Treat user-provided URLs and external webpage content as untrusted.
- Validate requests and protect destructive endpoints.
- Review audit findings before using them to make business decisions.

## 📄 License

A license has not been specified in this README. Add a `LICENSE` file and update this section once the project license is chosen.

---

**AdMatch AI — Making advertising messages clearer, more consistent, and evidence-backed.**

🌐 **Live Application:** [https://admatch-ai.vercel.app](https://admatch-ai.vercel.app)
