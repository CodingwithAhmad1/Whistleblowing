# Development Standards

## Code Standards

### Frontend Standards (TypeScript/React)

#### TypeScript Guidelines
```typescript
// Use explicit types for function parameters and return values
interface ReportData {
  organization_tier: string;
  country: string;
  // ... other fields
}

const updateReport = (field: keyof ReportData, value: string): void => {
  // Implementation
};

// Prefer interfaces over types for object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// Use enums for constants
export enum ReportStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REVIEWED = 'reviewed'
}
```

#### React Component Standards
```typescript
// Functional components with hooks
interface ComponentProps {
  title: string;
  onSubmit: (data: ReportData) => void;
}

export const ReportPanel: React.FC<ComponentProps> = ({ title, onSubmit }) => {
  const [report, setReport] = useState<ReportData>(initialReportData);
  
  // Use useCallback for memoized functions
  const handleSubmit = useCallback((data: ReportData) => {
    onSubmit(data);
  }, [onSubmit]);
  
  return (
    <div className={styles.container}>
      <h1>{title}</h1>
      {/* Component JSX */}
    </div>
  );
};

// Default exports for components
export default ReportPanel;
```

#### File Naming Conventions
```
components/
├── ChatPanel/
│   ├── ChatPanel.tsx          # Main component
│   ├── ChatPanel.module.css   # Component styles
│   ├── ChatPanel.test.tsx     # Component tests
│   └── index.ts              # Export barrel
├── ReportPanel/
│   ├── ReportPanel.tsx
│   ├── ReportPanel.module.css
│   └── index.ts
```

#### Import Organization
```typescript
// 1. React imports
import React, { useState, useCallback } from 'react';

// 2. Third-party libraries
import { useRouter } from 'next/router';

// 3. Internal imports (absolute paths)
import { ReportProvider } from '@/context/ReportContext';
import { ChatPanel } from '@/components/ChatPanel';
import { ReportData } from '@/types/report';

// 4. Relative imports
import styles from './ReportPanel.module.css';
```

### Backend Standards (Python/FastAPI)

#### Python Code Style
```python
# Follow PEP 8 standards
# Use type hints for all functions
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class ReportCreate(BaseModel):
    """Report data structure aligned with UI form fields."""
    
    organization_tier: Optional[str] = None
    country: Optional[str] = None
    incident_location: Optional[str] = None

async def create_report(
    report_data: ReportCreate,
    user_id: Optional[str] = None
) -> Report:
    """Create a new report with validation."""
    # Implementation
    pass

# Use descriptive variable names
def process_llm_response(
    response_text: str,
    extraction_rules: Dict[str, Any]
) -> Dict[str, str]:
    """Process LLM response and extract structured data."""
    extracted_fields = {}
    # Implementation
    return extracted_fields
```

#### FastAPI Standards
```python
# Use dependency injection
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

security = HTTPBearer()

@router.post("/reports", response_model=Report)
async def create_report(
    report: ReportCreate,
    token: str = Depends(security)
) -> Report:
    """Create a new report."""
    if not validate_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    return await report_service.create(report)

# Use proper HTTP status codes
@router.get("/reports/{report_id}", response_model=Report)
async def get_report(report_id: str) -> Report:
    """Get a specific report by ID."""
    report = await report_service.get_by_id(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    return report
```

#### File Organization
```
backend/app/
├── __init__.py
├── main.py                 # FastAPI application
├── config.py              # Configuration settings
├── models.py              # Pydantic models
├── routers/
│   ├── __init__.py
│   ├── chat.py           # Chat endpoints
│   └── reports.py        # Report endpoints
├── services/
│   ├── __init__.py
│   ├── report_service.py  # Business logic
│   └── llm_service.py     # AI integration
└── utils/
    ├── __init__.py
    ├── validation.py      # Validation utilities
    └── helpers.py         # Helper functions
```

## Testing Standards

### Frontend Testing

#### Unit Tests (Jest + React Testing Library)
```typescript
// ChatPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatPanel } from './ChatPanel';
import { ReportProvider } from '@/context/ReportContext';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ReportProvider>
      {component}
    </ReportProvider>
  );
};

describe('ChatPanel', () => {
  test('renders chat interface', () => {
    renderWithProviders(<ChatPanel />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  test('sends message when form is submitted', async () => {
    renderWithProviders(<ChatPanel />);
    
    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: 'Send' });
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });
});
```

#### Integration Tests
```typescript
// ReportIntegration.test.tsx
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { mockWebLLM } from '../__mocks__/webllm';

// Mock external dependencies
jest.mock('@/services/llm', () => mockWebLLM);

describe('Report Integration', () => {
  test('complete report creation flow', async () => {
    render(<App />);
    
    // Test chat interaction
    const chatInput = screen.getByRole('textbox');
    fireEvent.change(chatInput, { target: { value: 'I want to report misconduct' } });
    
    // Test report update
    await waitFor(() => {
      expect(screen.getByDisplayValue('misconduct')).toBeInTheDocument();
    });
  });
});
```

### Backend Testing

#### Unit Tests (Pytest)
```python
# test_report_service.py
import pytest
from app.services.report_service import ReportService
from app.models import ReportCreate

@pytest.fixture
def report_service():
    return ReportService()

@pytest.fixture
def sample_report():
    return ReportCreate(
        organization_tier="Regional",
        country="US",
        incident_location="Office"
    )

class TestReportService:
    def test_create_report(self, report_service, sample_report):
        """Test report creation."""
        report = report_service.create(sample_report)
        
        assert report.id is not None
        assert report.organization_tier == "Regional"
        assert report.country == "US"

    def test_validate_report(self, report_service):
        """Test report validation."""
        invalid_report = ReportCreate()
        
        with pytest.raises(ValueError, match="required fields"):
            report_service.validate(invalid_report)

@pytest.mark.asyncio
async def test_llm_integration():
    """Test LLM service integration."""
    from app.services.llm_service import LLMService
    
    llm_service = LLMService()
    response = await llm_service.process_message("Hello")
    
    assert response is not None
    assert len(response) > 0
```

#### API Tests
```python
# test_api.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    """Test health check endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_chat_endpoint():
    """Test chat endpoint."""
    response = client.post(
        "/api/chat",
        json={"message": "Hello"}
    )
    assert response.status_code == 200
    assert "response" in response.json()

@pytest.mark.asyncio
async def test_websocket_chat():
    """Test WebSocket chat functionality."""
    with client.websocket_connect("/api/chat/ws") as websocket:
        websocket.send_json({"message": "Hello"})
        response = websocket.receive_json()
        assert "response" in response
```

## Documentation Standards

### Code Documentation
```typescript
/**
 * Chat panel component for AI-assisted report creation.
 * 
 * @component
 * @example
 * ```tsx
 * <ChatPanel onMessage={(msg) => console.log(msg)} />
 * ```
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({ onMessage }) => {
  /**
   * Handles user message submission
   * @param message - The user's input message
   * @returns Promise<void>
   */
  const handleSubmit = async (message: string): Promise<void> => {
    // Implementation
  };
};
```

```python
class LLMManager:
    """Manages AI model loading and inference operations.
    
    This class handles the lifecycle of language models, including
    loading, inference, and resource management.
    
    Attributes:
        model: The loaded AI model instance
        config: Model configuration settings
    """
    
    async def initialize(self) -> None:
        """Initialize the LLM manager and load the model.
        
        Raises:
            ModelLoadError: If model fails to load
            ResourceError: If insufficient resources available
        """
        # Implementation
```

### API Documentation
```python
@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_current_user)
) -> ChatResponse:
    """Process chat message and return AI response.
    
    Args:
        request: Chat message request containing user input
        user_id: Optional user identifier for context
    
    Returns:
        ChatResponse: AI response with extracted report fields
    
    Raises:
        HTTPException: If message processing fails
        ModelNotLoadedError: If AI model is not available
    """
    # Implementation
```

## Git Standards

### Commit Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or dependency changes

#### Examples
```
feat(chat): add streaming response support

Implement real-time streaming for AI responses to improve
user experience during long-running inference tasks.

Closes #123
```

```
fix(report): validate empty form fields

Add validation to prevent submission of incomplete reports.
Fixes issue where empty fields were being accepted.

Fixes #456
```

### Branch Naming
```
feature/add-pdf-export
bugfix/fix-validation-error
docs/update-api-documentation
refactor/optimize-llm-loading
```

## Performance Standards

### Frontend Performance
```typescript
// Use React.memo for expensive components
export const ReportPreview = React.memo<ReportPreviewProps>(({ report }) => {
  return (
    <div>
      {/* Expensive rendering logic */}
    </div>
  );
});

// Use useMemo for expensive calculations
const filteredReports = useMemo(() => {
  return reports.filter(report => report.status === 'active');
}, [reports]);

// Use useCallback for stable function references
const handleReportUpdate = useCallback((field: string, value: string) => {
  updateReport(field, value);
}, [updateReport]);
```

### Backend Performance
```python
# Use async/await for I/O operations
async def get_reports(user_id: str) -> List[Report]:
    """Get user reports with async database access."""
    reports = await database.get_reports_by_user(user_id)
    return reports

# Implement caching for expensive operations
from functools import lru_cache

@lru_cache(maxsize=128)
def get_model_config(model_name: str) -> Dict[str, Any]:
    """Get cached model configuration."""
    return load_model_config(model_name)

# Use connection pooling
async def get_database_connection():
    """Get database connection from pool."""
    return await connection_pool.get_connection()
```

## Security Standards

### Frontend Security
```typescript
// Sanitize user input
import DOMPurify from 'dompurify';

const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input);
};

// Validate data before sending
const validateReportData = (data: ReportData): boolean => {
  return Object.values(data).every(value => 
    typeof value === 'string' && value.length <= 1000
  );
};

// Use secure storage
const secureStorage = {
  set: (key: string, value: string) => {
    // Encrypt before storing
    const encrypted = encrypt(value);
    localStorage.setItem(key, encrypted);
  }
};
```

### Backend Security
```python
# Input validation
from pydantic import validator

class ReportCreate(BaseModel):
    content: str
    
    @validator('content')
    def validate_content(cls, v):
        if len(v) > 10000:
            raise ValueError('Content too long')
        return v

# Rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/chat")
@limiter.limit("10/minute")
async def chat_endpoint(request: Request):
    # Implementation
    pass

# Error handling without information leakage
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

## Code Review Standards

### Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] Security considerations addressed
- [ ] Performance impact assessed
- [ ] Error handling implemented
- [ ] Accessibility requirements met
- [ ] Browser compatibility verified

### Review Process
1. **Self-review**: Author reviews own changes
2. **Peer review**: Team member reviews changes
3. **Automated checks**: CI/CD pipeline validation
4. **Approval**: Merge after successful review
