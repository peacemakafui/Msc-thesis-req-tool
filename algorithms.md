# Key Algorithms - MSc Thesis Requirements Gathering Application

## 1. Document Processing Pipeline

```pseudocode
ALGORITHM: ProcessDocument(documentFile, userId, projectId)
INPUT: documentFile (File), userId (String), projectId (String)
OUTPUT: Array of Requirements

BEGIN
    // Step 1: Extract text from document
    IF documentFile.type == "application/pdf" THEN
        extractedText ← ExtractTextFromPDF(documentFile)
    ELSE IF documentFile.type CONTAINS "word" THEN
        extractedText ← ExtractTextFromWord(documentFile)
    ELSE
        THROW Error("Unsupported file type")
    END IF
    
    // Step 2: Store document metadata
    document ← SaveDocument({
        filename: documentFile.name,
        userId: userId,
        projectId: projectId,
        extractedText: extractedText,
        status: "PROCESSING"
    })
    
    // Step 3: Analyze with LLM using fallback chain
    requirements ← AnalyzeDocumentWithLLM(extractedText, document.id)
    
    // Step 4: Save requirements to database
    FOR EACH requirement IN requirements DO
        SaveRequirement(requirement, projectId, document.id)
    END FOR
    
    // Step 5: Update document status
    UpdateDocumentStatus(document.id, "COMPLETED")
    
    RETURN requirements
END
```

## 2. LLM Fallback Chain Algorithm

```pseudocode
ALGORITHM: AnalyzeDocumentWithLLM(text, documentId)
INPUT: text (String), documentId (String)
OUTPUT: Array of Requirements

BEGIN
    models ← ["gemini", "gpt", "claude"]
    
    FOR EACH model IN models DO
        TRY
            startTime ← GetCurrentTime()
            
            // Construct analysis prompt
            prompt ← BuildAnalysisPrompt(text)
            
            // Call LLM API
            response ← CallLLMAPI(model, prompt)
            
            // Parse JSON response
            requirements ← ParseRequirements(response)
            
            // Calculate metrics
            responseTime ← GetCurrentTime() - startTime
            
            // Store processing metadata
            FOR EACH requirement IN requirements DO
                StoreProcessingMetadata({
                    model: model,
                    responseTime: responseTime,
                    success: true,
                    requirementId: requirement.id
                })
            END FOR
            
            RETURN requirements
            
        CATCH ApiError AS e
            IF model == "claude" THEN
                // No more fallbacks
                THROW Error("All LLM providers failed")
            END IF
            
            LOG("Failed with " + model + ", trying next provider")
            CONTINUE
        END TRY
    END FOR
    
    THROW Error("All LLM providers exhausted")
END
```

## 3. Requirements Analysis Prompt Construction

```pseudocode
ALGORITHM: BuildAnalysisPrompt(documentText)
INPUT: documentText (String)
OUTPUT: Structured prompt (String)

BEGIN
    systemPrompt ← "You are an expert software requirements analyst..."
    
    userPrompt ← CONCATENATE(
        "Analyze the following document and extract software requirements.\n\n",
        "Document:\n",
        documentText,
        "\n\nFor each requirement, provide:\n",
        "1. title: Clear, concise requirement title\n",
        "2. description: Detailed description\n",
        "3. type: FUNCTIONAL | NON_FUNCTIONAL | BUSINESS | USER_STORY | ACCEPTANCE_CRITERIA\n",
        "4. priority: CRITICAL | HIGH | MEDIUM | LOW\n",
        "5. confidence: 0.0-1.0 confidence score\n",
        "6. sourceText: Original text from document\n",
        "7. rationale: Why this is a requirement\n\n",
        "Return as JSON array of requirements."
    )
    
    RETURN {
        system: systemPrompt,
        user: userPrompt
    }
END
```

## 4. Chat-Based Requirements Extraction

```pseudocode
ALGORITHM: ProcessChatMessage(message, projectId, userId, conversationHistory)
INPUT: message (String), projectId (String), userId (String), conversationHistory (Array)
OUTPUT: ChatResponse with optional extracted requirements

BEGIN
    // Step 1: Build conversation context
    messages ← []
    FOR EACH historyItem IN conversationHistory DO
        messages.APPEND({
            role: historyItem.role,
            content: historyItem.content
        })
    END FOR
    messages.APPEND({ role: "user", content: message })
    
    // Step 2: Call LLM with requirement extraction instructions
    TRY
        startTime ← GetCurrentTime()
        
        systemPrompt ← BuildChatSystemPrompt()
        response ← CallLLMAPI("gemini", systemPrompt, messages)
        
        responseTime ← GetCurrentTime() - startTime
        
        // Step 3: Parse response for embedded requirements
        requirements ← ExtractRequirementsFromResponse(response)
        
        // Step 4: Save chat messages
        SaveChatMessage({
            userId: userId,
            projectId: projectId,
            role: "user",
            content: message
        })
        
        SaveChatMessage({
            userId: userId,
            projectId: projectId,
            role: "assistant",
            content: response,
            llmModel: "gemini",
            responseTime: responseTime
        })
        
        // Step 5: Save any extracted requirements
        IF requirements.LENGTH > 0 THEN
            FOR EACH requirement IN requirements DO
                SaveRequirement({
                    ...requirement,
                    projectId: projectId,
                    source: "CHAT",
                    llmModel: "gemini"
                })
            END FOR
        END IF
        
        RETURN {
            response: response,
            requirements: requirements,
            responseTime: responseTime
        }
        
    CATCH ApiError AS e
        // Fallback to next model
        RETURN ProcessChatMessageWithFallback(message, projectId, userId, conversationHistory)
    END TRY
END
```

## 5. SRS Document Generation

```pseudocode
ALGORITHM: GenerateSRSDocument(projectId, userId)
INPUT: projectId (String), userId (String)
OUTPUT: Formatted SRS Document (String)

BEGIN
    // Step 1: Fetch project and requirements
    project ← GetProject(projectId, userId)
    requirements ← GetRequirements(projectId, ORDER_BY: [priority DESC, type ASC])
    
    IF requirements.LENGTH == 0 THEN
        THROW Error("No requirements found for project")
    END IF
    
    // Step 2: Organize requirements by type
    requirementsByType ← GroupRequirementsByType(requirements)
    
    // Step 3: Build comprehensive SRS prompt
    prompt ← CONCATENATE(
        "Generate a complete Software Requirements Specification (SRS) document.\n\n",
        "Project: ", project.name, "\n",
        "Description: ", project.description, "\n\n",
        "Requirements:\n",
        FormatRequirementsForPrompt(requirements),
        "\n\nGenerate IEEE 830-compliant SRS with sections:\n",
        "1. Introduction\n",
        "2. Overall Description\n",
        "3. Specific Requirements\n",
        "4. System Features\n",
        "5. External Interface Requirements\n",
        "6. Non-functional Requirements\n",
        "7. Other Requirements"
    )
    
    // Step 4: Generate with LLM (try GPT first for better formatting)
    TRY
        srsDocument ← CallLLMAPI("gpt", prompt)
    CATCH ApiError
        TRY
            srsDocument ← CallLLMAPI("gemini", prompt)
        CATCH ApiError
            srsDocument ← CallLLMAPI("claude", prompt)
        END TRY
    END TRY
    
    RETURN srsDocument
END
```

## 6. User Authentication & Session Management

```pseudocode
ALGORITHM: AuthenticateUser(email, password)
INPUT: email (String), password (String)
OUTPUT: Session token or null

BEGIN
    // Step 1: Find user by email
    user ← FindUserByEmail(email)
    
    IF user == null THEN
        RETURN null
    END IF
    
    // Step 2: Verify password using bcrypt
    isPasswordValid ← CompareHash(password, user.passwordHash)
    
    IF NOT isPasswordValid THEN
        RETURN null
    END IF
    
    // Step 3: Generate JWT session token
    token ← GenerateJWT({
        id: user.id,
        email: user.email,
        name: user.name,
        expiresIn: "7d"
    })
    
    RETURN {
        token: token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name
        }
    }
END
```

## 7. Requirement Export Algorithm

```pseudocode
ALGORITHM: ExportRequirements(projectId, format, filters)
INPUT: projectId (String), format (Enum), filters (Object)
OUTPUT: Document file (Buffer or String)

BEGIN
    // Step 1: Build query with filters
    query ← {
        projectId: projectId
    }
    
    IF filters.type != "ALL" THEN
        query.type ← filters.type
    END IF
    
    IF filters.priority != "ALL" THEN
        query.priority ← filters.priority
    END IF
    
    IF filters.source != "ALL" THEN
        query.source ← filters.source
    END IF
    
    // Step 2: Fetch requirements
    requirements ← GetRequirements(query, 
        ORDER_BY: [priority DESC, type ASC, createdAt DESC])
    
    // Step 3: Generate export based on format
    SWITCH format DO
        CASE "markdown":
            content ← GenerateMarkdownExport(requirements)
            RETURN {
                content: content,
                mimeType: "text/markdown",
                filename: projectName + "_Requirements.md"
            }
            
        CASE "word":
            document ← CreateWordDocument()
            
            // Add title and metadata
            document.AddHeading("Requirements Document", LEVEL_1)
            document.AddParagraph("Project: " + projectName)
            document.AddParagraph("Generated: " + CurrentDate())
            
            // Group by type
            requirementsByType ← GroupByType(requirements)
            
            FOR EACH (type, reqs) IN requirementsByType DO
                document.AddHeading(type, LEVEL_2)
                
                FOR EACH requirement IN reqs DO
                    document.AddHeading(requirement.title, LEVEL_3)
                    
                    // Add metadata table
                    table ← document.AddTable(5, 2)
                    table.AddRow(["Priority", requirement.priority])
                    table.AddRow(["Source", requirement.source])
                    table.AddRow(["Confidence", requirement.confidence])
                    table.AddRow(["Document", requirement.document])
                    table.AddRow(["Created", requirement.createdAt])
                    
                    // Add description
                    document.AddParagraph("Description:")
                    document.AddParagraph(requirement.description)
                    
                    IF requirement.sourceText THEN
                        document.AddParagraph("Source Text:")
                        document.AddIndentedParagraph(requirement.sourceText)
                    END IF
                END FOR
            END FOR
            
            buffer ← document.ToBuffer()
            RETURN buffer
            
        CASE "json":
            content ← JSON.Stringify(requirements, INDENT: 2)
            RETURN {
                content: content,
                mimeType: "application/json",
                filename: projectName + "_Requirements.json"
            }
    END SWITCH
END
```

## 8. Project Deletion with Cascade

```pseudocode
ALGORITHM: DeleteProject(projectId, userId)
INPUT: projectId (String), userId (String)
OUTPUT: Success boolean

BEGIN
    // Step 1: Verify project ownership
    project ← GetProject(projectId)
    
    IF project == null THEN
        THROW Error("Project not found")
    END IF
    
    IF project.userId != userId THEN
        THROW Error("Unauthorized")
    END IF
    
    // Step 2: Begin transaction
    BEGIN_TRANSACTION()
    
    TRY
        // Step 3: Delete in order (due to foreign key constraints)
        
        // Delete processing metadata
        DELETE FROM processing_metadata 
        WHERE requirementId IN (
            SELECT id FROM requirements WHERE projectId = projectId
        )
        
        // Delete requirements
        DELETE FROM requirements WHERE projectId = projectId
        
        // Delete chat messages
        DELETE FROM chat_messages WHERE projectId = projectId
        
        // Delete documents
        documents ← GetDocuments(projectId)
        FOR EACH document IN documents DO
            DeleteFile(document.filePath)  // Delete physical file
            DELETE FROM documents WHERE id = document.id
        END FOR
        
        // Delete project
        DELETE FROM projects WHERE id = projectId
        
        COMMIT_TRANSACTION()
        RETURN true
        
    CATCH Error AS e
        ROLLBACK_TRANSACTION()
        THROW e
    END TRY
END
```

## 9. Session Persistence & Restoration

```pseudocode
ALGORITHM: RestoreChatSession(userId, projectId)
INPUT: userId (String), projectId (String)
OUTPUT: Restored conversation state

BEGIN
    // Step 1: Check localStorage for recent session
    cachedSession ← GetFromLocalStorage("chat_session_" + projectId)
    
    IF cachedSession != null AND NotExpired(cachedSession) THEN
        // Restore from cache
        RETURN {
            messages: cachedSession.messages,
            projectId: cachedSession.projectId,
            timestamp: cachedSession.timestamp
        }
    END IF
    
    // Step 2: Fetch from database
    messages ← GetChatMessages(projectId, userId, ORDER_BY: createdAt ASC)
    
    // Step 3: Transform to UI format
    conversationHistory ← []
    FOR EACH message IN messages DO
        conversationHistory.APPEND({
            role: message.role,
            content: message.content,
            timestamp: message.createdAt
        })
    END FOR
    
    // Step 4: Cache for next time
    SaveToLocalStorage("chat_session_" + projectId, {
        messages: conversationHistory,
        projectId: projectId,
        timestamp: CurrentTime(),
        expiresAt: CurrentTime() + 1_HOUR
    })
    
    RETURN conversationHistory
END
```

## 10. Real-time Requirement Updates

```pseudocode
ALGORITHM: UpdateRequirement(requirementId, updates, userId)
INPUT: requirementId (String), updates (Object), userId (String)
OUTPUT: Updated requirement

BEGIN
    // Step 1: Fetch requirement with project ownership check
    requirement ← GetRequirement(requirementId, INCLUDE: project)
    
    IF requirement == null THEN
        THROW Error("Requirement not found")
    END IF
    
    IF requirement.project.userId != userId THEN
        THROW Error("Unauthorized")
    END IF
    
    // Step 2: Validate updates
    IF updates.type THEN
        ValidateRequirementType(updates.type)
    END IF
    
    IF updates.priority THEN
        ValidateRequirementPriority(updates.priority)
    END IF
    
    // Step 3: Update requirement
    updatedRequirement ← UpdateRecord("requirements", requirementId, {
        ...updates,
        updatedAt: CurrentTimestamp()
    })
    
    // Step 4: Log update for analytics
    LogRequirementUpdate({
        requirementId: requirementId,
        userId: userId,
        changes: updates,
        timestamp: CurrentTimestamp()
    })
    
    RETURN updatedRequirement
END
```

## 11. Requirements Filtering & Search

```pseudocode
ALGORITHM: FilterRequirements(userId, filters, searchQuery)
INPUT: userId (String), filters (Object), searchQuery (String)
OUTPUT: Filtered requirements list

BEGIN
    // Step 1: Build base query (user-scoped)
    query ← {
        project: {
            userId: userId
        }
    }
    
    // Step 2: Apply filters
    IF filters.projectId != null THEN
        query.projectId ← filters.projectId
    END IF
    
    IF filters.type != "ALL" THEN
        query.type ← filters.type
    END IF
    
    IF filters.priority != "ALL" THEN
        query.priority ← filters.priority
    END IF
    
    IF filters.source != "ALL" THEN
        query.source ← filters.source
    END IF
    
    // Step 3: Apply search query
    IF searchQuery != "" THEN
        query.OR ← [
            { title: { CONTAINS: searchQuery, CASE_INSENSITIVE } },
            { description: { CONTAINS: searchQuery, CASE_INSENSITIVE } }
        ]
    END IF
    
    // Step 4: Execute query with pagination
    requirements ← GetRequirements(query, {
        ORDER_BY: [createdAt DESC],
        INCLUDE: [project, document],
        TAKE: 50,
        SKIP: filters.page * 50
    })
    
    // Step 5: Calculate statistics
    stats ← {
        total: requirements.LENGTH,
        byType: CountByType(requirements),
        byPriority: CountByPriority(requirements),
        bySource: CountBySource(requirements)
    }
    
    RETURN {
        requirements: requirements,
        stats: stats,
        page: filters.page,
        hasMore: requirements.LENGTH == 50
    }
END
```

## Complexity Analysis

### Time Complexity

| Algorithm | Best Case | Average Case | Worst Case | Space |
|-----------|-----------|--------------|------------|-------|
| ProcessDocument | O(n) | O(n) | O(n·m) | O(n) |
| LLM Fallback Chain | O(1) | O(k) | O(k) | O(1) |
| Filter Requirements | O(log n) | O(log n) | O(n) | O(n) |
| Export Requirements | O(n) | O(n) | O(n) | O(n) |
| Delete Project | O(n) | O(n) | O(n) | O(1) |

**Where:**
- n = number of requirements/documents
- m = number of LLM retry attempts (typically 3)
- k = number of LLM providers in fallback chain (3)

### Space Complexity

| Component | Memory Usage | Notes |
|-----------|--------------|-------|
| Document Processing | O(n) | n = document size in chars |
| LLM Response Caching | O(k·n) | k = number of cached sessions |
| Session Storage | O(m) | m = number of messages in conversation |
| Export Generation | O(n) | n = number of requirements |

