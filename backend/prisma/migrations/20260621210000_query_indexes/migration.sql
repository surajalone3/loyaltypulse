-- CreateIndex
CREATE INDEX "Customer_storeId_tier_idx" ON "Customer"("storeId", "tier");

-- CreateIndex
CREATE INDEX "PointsTransaction_storeId_createdAt_idx" ON "PointsTransaction"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewRequest_status_scheduledSendAt_idx" ON "ReviewRequest"("status", "scheduledSendAt");
