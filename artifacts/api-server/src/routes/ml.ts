import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { collectAllMlFeatures } from "../services/ml-collection";

const router: IRouter = Router();

// Trigger a manual snapshot of ML features
router.post("/v1/ml/collect", requireAuth, async (req, res): Promise<void> => {
  // Only super_admin can trigger this
  if (req.user?.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden: Super Admin access required" });
    return;
  }

  const { dateSnapshot } = req.body;
  
  try {
    // We don't await this because it might take a long time for a large org
    // In a real production environment, this should be sent to a queue
    collectAllMlFeatures(dateSnapshot).catch(console.error);
    
    res.json({ success: true, message: "ML collection job started in the background" });
  } catch (error: any) {
    req.log.error({ error }, "Error starting ML collection job");
    res.status(500).json({ error: "Failed to start ML collection job" });
  }
});

export default router;
