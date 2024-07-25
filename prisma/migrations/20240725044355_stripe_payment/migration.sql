/*
  Warnings:

  - You are about to drop the column `receipt_url` on the `OrderReceipt` table. All the data in the column will be lost.
  - Added the required column `receiptUrl` to the `OrderReceipt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderReceipt" DROP COLUMN "receipt_url",
ADD COLUMN     "receiptUrl" TEXT NOT NULL;
