import { Router } from "express";
import { db, usersTable, ridesTable, rideFeedbacksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

export const feedbacksRouter = Router({ mergeParams: true });

// POST /api/rides/:id/feedback — submit a star rating + optional anonymous message
feedbacksRouter.post("/", requireAuth, async (req, res) => {
  const rideId = parseInt(String(req.params.id));
  const currentUser = (req as any).user;
  const { stars, message } = req.body ?? {};

  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    res.status(400).json({ error: "stars must be a number between 1 and 5" }); return;
  }

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, rideId));
  if (!ride) { res.status(404).json({ error: "Ride not found" }); return; }
  if (ride.status !== "completed") {
    res.status(400).json({ error: "Can only rate completed rides" }); return;
  }

  const isPassenger = currentUser.id === ride.passengerId;
  const isDriver = currentUser.id === ride.driverId;

  if (!isPassenger && !isDriver) {
    res.status(403).json({ error: "You are not part of this ride" }); return;
  }

  const revieweeId = isPassenger ? ride.driverId! : ride.passengerId;
  const reviewerRole = isPassenger ? "passenger" : "driver";

  // Prevent duplicate feedback from the same reviewer for the same ride
  const existing = await db.select().from(rideFeedbacksTable).where(
    and(
      eq(rideFeedbacksTable.rideId, rideId),
      eq(rideFeedbacksTable.reviewerId, currentUser.id)
    )
  );
  if (existing.length > 0) {
    res.status(409).json({ error: "Você já avaliou esta corrida" }); return;
  }

  // Save feedback
  const [feedback] = await db.insert(rideFeedbacksTable).values({
    rideId,
    reviewerId: currentUser.id,
    revieweeId,
    reviewerRole,
    stars: Math.round(stars * 10) / 10,
    message: message?.trim() || null,
  }).returning();

  // Update reviewee's rolling rating
  // newRating = (currentRating * totalRatings + newStars) / (totalRatings + 1)
  const [reviewee] = await db.select().from(usersTable).where(eq(usersTable.id, revieweeId));
  if (reviewee) {
    const currentRating = reviewee.rating ?? 4.6;
    const currentTotal = reviewee.totalRatings ?? 0;
    const newTotal = currentTotal + 1;
    // Weighted rolling average — new ratings move the needle slowly as count grows
    const newRating = (currentRating * currentTotal + stars) / newTotal;
    const clamped = Math.max(1, Math.min(5, newRating));

    await db.update(usersTable).set({
      rating: Math.round(clamped * 100) / 100,
      totalRatings: newTotal,
    }).where(eq(usersTable.id, revieweeId));
  }

  res.status(201).json(feedback);
});

// GET /api/rides/:id/feedback/mine — check if current user already rated this ride
feedbacksRouter.get("/mine", requireAuth, async (req, res) => {
  const rideId = parseInt(String(req.params.id));
  const currentUser = (req as any).user;

  const [existing] = await db.select().from(rideFeedbacksTable).where(
    and(
      eq(rideFeedbacksTable.rideId, rideId),
      eq(rideFeedbacksTable.reviewerId, currentUser.id)
    )
  );

  res.json({ submitted: !!existing, feedback: existing ?? null });
});
