import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import * as auth from "../controllers/auth.controller";
import * as users from "../controllers/users.controller";
import * as cards from "../controllers/cards.controller";
import * as tx from "../controllers/transactions.controller";
import * as imp from "../controllers/import.controller";
import * as dash from "../controllers/dashboard.controller";
import * as rules from "../controllers/categoryRules.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const router = Router();

router.post("/auth/login", asyncHandler(auth.login));
router.get("/auth/me", requireAuth, asyncHandler(auth.me));

// Users & departments (admin-managed)
router.get("/departments", requireAuth, asyncHandler(users.listDepartments));
router.get("/users", requireAuth, asyncHandler(users.listUsers));
router.post("/users", requireAuth, requireRole("ADMIN"), asyncHandler(users.createUser));
router.put("/users/:id", requireAuth, requireRole("ADMIN"), asyncHandler(users.updateUser));
router.delete("/users/:id", requireAuth, requireRole("ADMIN"), asyncHandler(users.deleteUser));

// Corporate cards
router.get("/cards", requireAuth, asyncHandler(cards.listCards));
router.post("/cards", requireAuth, requireRole("ADMIN"), asyncHandler(cards.createCard));
router.put("/cards/:id", requireAuth, requireRole("ADMIN"), asyncHandler(cards.updateCard));
router.delete("/cards/:id", requireAuth, requireRole("ADMIN"), asyncHandler(cards.deleteCard));

// Transactions + filtering + review workflow
router.get("/transactions", requireAuth, asyncHandler(tx.listTransactions));
router.get("/transactions/:id", requireAuth, asyncHandler(tx.getTransaction));
router.put("/transactions/:id", requireAuth, asyncHandler(tx.updateTransaction));
router.post(
  "/transactions/:id/review",
  requireAuth,
  requireRole("ACCOUNTANT"),
  asyncHandler(tx.reviewTransaction),
);

// Import
router.post(
  "/import/excel/preview",
  requireAuth,
  upload.single("file"),
  asyncHandler(imp.previewExcel),
);
router.post("/import/excel/commit", requireAuth, asyncHandler(imp.commitExcel));
router.get("/import/jobs", requireAuth, asyncHandler(imp.listImportJobs));

// Dashboards
router.get("/dashboard/summary", requireAuth, asyncHandler(dash.dashboardSummary));
router.get(
  "/dashboard/user/:userId",
  requireAuth,
  asyncHandler(dash.userMonthlyDashboard),
);

// Category rules (settings)
router.get("/category-rules", requireAuth, asyncHandler(rules.listCategoryRules));
router.post(
  "/category-rules",
  requireAuth,
  requireRole("ACCOUNTANT"),
  asyncHandler(rules.createCategoryRule),
);
router.put(
  "/category-rules/:id",
  requireAuth,
  requireRole("ACCOUNTANT"),
  asyncHandler(rules.updateCategoryRule),
);
router.delete(
  "/category-rules/:id",
  requireAuth,
  requireRole("ACCOUNTANT"),
  asyncHandler(rules.deleteCategoryRule),
);
