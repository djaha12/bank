import { z } from "zod";

/** Currency + money helpers. Amounts arrive as decimal strings, never floats. */
export const currencyEnum = z.enum(["KGS", "USD", "EUR"]);

export const moneyString = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,2})?$/, "Amount must be a positive number with up to 2 decimals")
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

const uuid = z.string().uuid();
const email = z.string().email().max(254);
const otpCode = z.string().regex(/^\d{6}$/);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const registerSchema = z.object({
  email,
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const otpRequestSchema = z.object({
  email,
  purpose: z.enum(["LOGIN", "SIGNUP", "STEP_UP"]).default("LOGIN"),
});

export const otpVerifySchema = z.object({
  email,
  code: otpCode,
  purpose: z.enum(["LOGIN", "SIGNUP", "STEP_UP"]).default("LOGIN"),
});

export const adminLoginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------
export const kycSubmitSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  dateOfBirth: z.string().min(4).max(40),
  nationality: z.string().length(2),
  country: z.string().length(2),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  postalCode: z.string().min(1).max(20),
  occupation: z.string().min(1).max(120),
  sourceOfFunds: z.enum(["SALARY", "BUSINESS", "INVESTMENTS", "SAVINGS", "OTHER"]),
  declaredPepStatus: z.boolean().default(false),
  riskQuestionnaire: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
  documents: z
    .array(
      z.object({
        type: z.enum(["PASSPORT", "ID_CARD", "DRIVERS_LICENSE", "PROOF_OF_ADDRESS", "SELFIE"]),
        fileName: z.string().max(200).optional(),
      }),
    )
    .max(10)
    .optional(),
});

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------
export const transferInternalSchema = z.object({
  fromAccountId: uuid,
  toAccountId: uuid,
  amount: moneyString,
  note: z.string().max(200).optional(),
});

export const transferP2PSchema = z.object({
  fromAccountId: uuid,
  toAccountId: uuid.optional(),
  recipientEmail: email.optional(),
  amount: moneyString,
  note: z.string().max(200).optional(),
  counterparty: z
    .object({
      name: z.string().max(120).optional(),
      country: z.string().length(2).optional(),
    })
    .optional(),
}).refine((d) => d.toAccountId || d.recipientEmail, {
  message: "Provide toAccountId or recipientEmail",
});

export const transferBankSchema = z.object({
  fromAccountId: uuid,
  amount: moneyString,
  note: z.string().max(200).optional(),
  counterparty: z.object({
    name: z.string().min(1).max(120),
    ibanMasked: z.string().max(40).optional(),
    bank: z.string().max(120).optional(),
    country: z.string().length(2).optional(),
  }),
});

export const transferFxSchema = z.object({
  fromAccountId: uuid,
  toAccountId: uuid,
  amount: moneyString,
});

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
export const cardCreateSchema = z.object({
  accountId: uuid,
  cardholderName: z.string().min(1).max(80),
});

export const cardLimitsSchema = z.object({
  dailyLimit: moneyString.optional(),
  monthlyLimit: moneyString.optional(),
  perTxLimit: moneyString.optional(),
  atmDailyLimit: moneyString.optional(),
  onlinePaymentsEnabled: z.boolean().optional(),
  atmEnabled: z.boolean().optional(),
  contactlessEnabled: z.boolean().optional(),
});

export const cardPurchaseSchema = z.object({
  amount: moneyString,
  merchantName: z.string().min(1).max(120),
  mcc: z.string().min(2).max(8),
  capture: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
export const aiChatSchema = z.object({
  conversationId: uuid.optional(),
  message: z.string().min(1).max(2000),
});

export const aiSkillSchema = z.object({
  // explicit skill invocation from the UI
  skill: z.enum(["spending", "budget", "fraud", "support"]).optional(),
  transactionId: uuid.optional(),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const kycReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "IN_REVIEW"]),
  notes: z.string().max(1000).optional(),
  rejectionReason: z.string().max(500).optional(),
});

export const amlAlertUpdateSchema = z.object({
  status: z.enum(["OPEN", "REVIEWING", "CLOSED"]).optional(),
  adminNotes: z.string().max(2000).optional(),
  assignToSelf: z.boolean().optional(),
});

export const customerBlockSchema = z.object({
  action: z.enum(["BLOCK", "UNBLOCK", "SUSPEND"]),
  reason: z.string().min(1).max(500),
});

export const disputeUpdateSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "REJECTED"]),
  resolution: z.string().max(1000).optional(),
  refund: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type KycSubmitInput = z.infer<typeof kycSubmitSchema>;
