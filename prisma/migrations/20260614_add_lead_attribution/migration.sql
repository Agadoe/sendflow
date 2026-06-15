-- Create LeadAttribution table for UTM/referral attribution
CREATE TABLE "LeadAttribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "ref" TEXT,
    "referrer" TEXT,
    "landingUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadAttribution_userId_key" UNIQUE ("userId"),
    CONSTRAINT "LeadAttribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
