import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { authRouter } from "./auth";
import { webauthnRouter } from "./webauthn";
import { usersRouter } from "./users";
import { driversRouter } from "./drivers";
import { ridesRouter } from "./rides";
import { offersRouter } from "./offers";
import { adminRouter } from "./admin";
import { feedbacksRouter } from "./feedbacks";
import proxyRouter from "./proxy";
import { dispatchRouter } from "./dispatch";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/auth/webauthn", webauthnRouter);
router.use("/users", usersRouter);
router.use("/drivers", driversRouter);
router.use("/rides", ridesRouter);
router.use("/rides/:id/feedback", feedbacksRouter);
router.use("/rides/:rideId/offers", offersRouter);
router.use("/admin", adminRouter);
router.use("/proxy", proxyRouter);
router.use("/dispatch", dispatchRouter);

export default router;
