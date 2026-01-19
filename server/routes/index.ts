import { Express } from "express";
import { createServer, Server } from "http";
import { authRouter } from "./auth";
import { schoolRouter } from "./schools";
import { userRouter } from "./users";
import { studentRouter } from "./students";
import { feeRouter } from "./fees";
import { gradeRouter } from "./grades";
import { academicRouter } from "./academics";
import { reportRouter } from "./reports";
import { sessionRouter } from "./sessions";
import { attendanceRouter } from "./attendance";
import { transportRouter } from "./transport";
import backupRouter from "../backup_routes";
import { requireAuth } from "../middleware/auth";

export async function registerRoutes(app: Express): Promise<Server> {
    // Mount routes
    app.use(authRouter);
    app.use(schoolRouter);
    app.use(userRouter);
    app.use(studentRouter);
    app.use(feeRouter);
    app.use(gradeRouter);
    app.use(academicRouter);
    app.use(reportRouter);
    app.use(sessionRouter);
    app.use(attendanceRouter);
    app.use(transportRouter);

    // Backup Routes (Kept external)
    app.use("/api/backup", requireAuth, backupRouter);

    const httpServer = createServer(app);
    return httpServer;
}
