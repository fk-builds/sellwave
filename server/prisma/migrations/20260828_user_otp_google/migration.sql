-- Add OTP + Google auth fields to User
ALTER TABLE "User" ADD COLUMN "otpCode" TEXT;
ALTER TABLE "User" ADD COLUMN "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
