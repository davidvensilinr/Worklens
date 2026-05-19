import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, attendanceTable, promotionsTable, trainingsTable, claimsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/ml-export", requireAuth, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).where(eq(usersTable.orgId, req.user!.orgId));
  const attendances = await db.select().from(attendanceTable).where(eq(attendanceTable.orgId, req.user!.orgId));
  const promotions = await db.select().from(promotionsTable).where(eq(promotionsTable.orgId, req.user!.orgId));
  const trainings = await db.select().from(trainingsTable).where(eq(trainingsTable.orgId, req.user!.orgId));
  const claims = await db.select().from(claimsTable).where(and(eq(claimsTable.orgId, req.user!.orgId), eq(claimsTable.status, "verified")));

  const rows = [];
  rows.push([
    "Age", "DistanceFromHome", "Education", "EnvironmentSatisfaction", "Gender",
    "JobInvolvement", "JobLevel", "JobSatisfaction", "NumCompaniesWorked", "OverTime",
    "PerformanceRating", "RelationshipSatisfaction", "StockOptionLevel", "TotalWorkingYears",
    "TrainingTimesLastYear", "WorkLifeBalance", "YearsAtCompany", "YearsInCurrentRole",
    "YearsSinceLastPromotion", "YearsWithCurrManager"
  ].join(","));

  for (const u of users) {
    const age = u.dateOfBirth ? Math.floor((new Date().getTime() - new Date(u.dateOfBirth).getTime()) / 31557600000) : 30;
    const distance = u.distanceFromHome || 5;
    const education = u.education || 3;
    const gender = u.gender || 0;
    const numCompanies = u.numCompaniesWorked || 1;
    
    const hireDate = u.hireDate ? new Date(u.hireDate) : new Date();
    const yearsAtCompany = Math.floor((new Date().getTime() - hireDate.getTime()) / 31557600000);
    const totalWorkingYears = (u.totalWorkingYearsBeforeHire || 0) + yearsAtCompany;

    const userAttendances = attendances.filter(a => a.userId === u.id);
    const overTime = userAttendances.some(a => a.isOvertime) ? 1 : 0;

    const userTrainings = trainings.filter(t => t.userId === u.id && t.status === "completed");
    const trainingTimesLastYear = userTrainings.length;

    const userPromotions = promotions.filter(p => p.userId === u.id).sort((a, b) => b.promotedAt.getTime() - a.promotedAt.getTime());
    const yearsSinceLastPromotion = userPromotions.length > 0 ? Math.floor((new Date().getTime() - userPromotions[0].promotedAt.getTime()) / 31557600000) : yearsAtCompany;
    const yearsInCurrentRole = yearsSinceLastPromotion;
    const yearsWithCurrManager = yearsAtCompany; // Simplified
    const jobLevel = userPromotions.length + 1; // Simplified
    const stockOptionLevel = jobLevel > 2 ? 1 : 0;

    const userClaims = claims.filter(c => c.userId === u.id);
    const performanceClaims = userClaims.filter(c => c.claimType === "performance").length;
    const performanceRating = performanceClaims > 3 ? 4 : (performanceClaims > 0 ? 3 : 2);

    const getSurvey = (type: string, def: number) => {
      const c = userClaims.find(c => c.claimType === type);
      return c ? parseInt(c.description, 10) : def;
    };

    const envSat = getSurvey("survey_environment", 3);
    const jobInv = getSurvey("survey_involvement", 3);
    const jobSat = getSurvey("survey_job_satisfaction", 3);
    const relSat = getSurvey("survey_relationship", 3);
    const wlb = getSurvey("survey_wlb", 3);

    rows.push([
      age, distance, education, envSat, gender,
      jobInv, jobLevel, jobSat, numCompanies, overTime,
      performanceRating, relSat, stockOptionLevel, totalWorkingYears,
      trainingTimesLastYear, wlb, yearsAtCompany, yearsInCurrentRole,
      yearsSinceLastPromotion, yearsWithCurrManager
    ].join(","));
  }

  res.header("Content-Type", "text/csv");
  res.attachment("hr_analytics.csv");
  res.send(rows.join("\n"));
});

export default router;
