-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "model" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "totalLatencyMs" INTEGER,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "totalToolCalls" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "finalAnswer" TEXT,
    "citationPrecision" REAL,
    CONSTRAINT "Run_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "tool" TEXT NOT NULL,
    "argsJson" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "error" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Step_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasRead" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Source_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Run_sessionId_startedAt_idx" ON "Run"("sessionId", "startedAt");

-- CreateIndex
CREATE INDEX "Step_runId_stepNo_idx" ON "Step"("runId", "stepNo");

-- CreateIndex
CREATE INDEX "Note_runId_idx" ON "Note"("runId");

-- CreateIndex
CREATE INDEX "Source_runId_idx" ON "Source"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_runId_index_key" ON "Source"("runId", "index");
