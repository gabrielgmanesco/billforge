-- CreateIndex
CREATE INDEX "Subscription_userId_status_cancelAtPeriodEnd_idx" ON "Subscription"("userId", "status", "cancelAtPeriodEnd");
